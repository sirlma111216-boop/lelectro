/**
 * 앱 전체에서 하나만 존재하는 센서 관리자.
 * - 장치 등록(실측 Bluetooth / 모의), 역할·별칭·채널 지정, 연결 해제·재연결
 * - 측정 시작·정지 (모든 연결된 장치에 공통 주기 적용)
 * - 표본 단위 변환, 앱 오프셋 적용, 범위·해상도 플래그
 * - 연결 끊김·수신 없음 감시
 * 화면 전환과 무관하게 모듈 수준 싱글턴으로 유지된다.
 */
import { toSi } from '@/data/units';
import { findProfile, roleFromUnit } from './deviceProfiles';
import { makeSensorError, SensorError } from './errors';
import { GoDirectBluetoothAdapter, requestGoDirectBluetoothDevice } from './godirectAdapter';
import { MockDeviceAdapter } from './mock/MockDeviceAdapter';
import type {
  ChannelInfo,
  DeviceAdapter,
  ManagedDevice,
  ManagerEvent,
  ManagerSnapshot,
  RawReading,
  Sample,
  SampleFlag,
  SensorRole,
} from './types';

interface Entry {
  managed: ManagedDevice;
  adapter: DeviceAdapter;
  unsubs: Array<() => void>;
  reconnectFn: (() => Promise<void>) | null;
  measuringSince: number | null;
}

const DEFAULT_PERIOD_MS = 100;
const PRACTICE_MODE_KEY = 'elect-lab:practice-mode';
const WATCHDOG_INTERVAL_MS = 500;
const NOTIFY_THROTTLE_MS = 100;

function pickChannelForRole(channels: ChannelInfo[], role: SensorRole): ChannelInfo | null {
  const candidates = channels.filter((c) => roleFromUnit(c.unit) === role);
  if (candidates.length === 0) return null;
  if (role === 'voltage') {
    // GDX-VOLT: 기본은 "Potential - 20 V" 채널 (설명서 기준 기본 채널)
    const wide = candidates.find((c) => /20/.test(c.name));
    if (wide) return wide;
  }
  return candidates[0];
}

export class SensorManager {
  private entries = new Map<string, Entry>();
  private stateListeners = new Set<() => void>();
  private eventListeners = new Set<(e: ManagerEvent) => void>();
  private measuring = false;
  private requestedPeriodMs = DEFAULT_PERIOD_MS;
  private practiceMode = false;
  private pending: SensorRole | null = null;
  private snapshot: ManagerSnapshot;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // 연습 모드 여부만 기기에 기억한다 (Bluetooth 연결 자체는 새로고침 후 복구되지 않는다)
    try {
      this.practiceMode = typeof localStorage !== 'undefined' && localStorage.getItem(PRACTICE_MODE_KEY) === '1';
    } catch {
      this.practiceMode = false;
    }
    this.snapshot = this.buildSnapshot();
  }

  // ---------- 구독 ----------

  subscribe(cb: () => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  getSnapshot(): ManagerSnapshot {
    return this.snapshot;
  }

  subscribeEvents(cb: (e: ManagerEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }

  private emit(e: ManagerEvent) {
    this.eventListeners.forEach((cb) => cb(e));
  }

  private buildSnapshot(): ManagerSnapshot {
    return {
      devices: Array.from(this.entries.values()).map((e) => ({ ...e.managed })),
      measuring: this.measuring,
      requestedPeriodMs: this.requestedPeriodMs,
      practiceMode: this.practiceMode,
      pending: this.pending,
    };
  }

  /** 즉시 알림 (연결 상태 변화 등) */
  private notify() {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this.snapshot = this.buildSnapshot();
    this.stateListeners.forEach((cb) => cb());
  }

  /** 표본 갱신처럼 잦은 변화는 묶어서 알린다 */
  private scheduleNotify() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.notify();
    }, NOTIFY_THROTTLE_MS);
  }

  // ---------- 설정 ----------

  setPracticeMode(on: boolean) {
    if (this.practiceMode === on) return;
    this.practiceMode = on;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(PRACTICE_MODE_KEY, on ? '1' : '0');
    } catch {
      /* 저장 불가 환경이면 메모리에서만 유지 */
    }
    this.notify();
  }

  isPracticeMode() {
    return this.practiceMode;
  }

  setRequestedPeriod(ms: number) {
    this.requestedPeriodMs = Math.max(10, Math.round(ms));
    this.notify();
  }

  getDevices(): ManagedDevice[] {
    return this.snapshot.devices;
  }

  getDevice(id: string): ManagedDevice | undefined {
    return this.entries.get(id)?.managed;
  }

  /** 역할별로 쓸 장치: 해당 출처이고 끊기지 않은 장치 중 첫 번째 */
  getActiveDeviceForRole(role: SensorRole, source: 'live' | 'mock'): ManagedDevice | undefined {
    return this.snapshot.devices.find(
      (d) => d.role === role && d.info.source === source && (d.state === 'connected' || d.state === 'measuring'),
    );
  }

  // ---------- 장치 등록 ----------

  /**
   * 실제 Go Direct 장치 연결. 클릭 핸들러에서 직접 호출해야 하며,
   * 첫 await 가 requestDevice 가 되도록 앞에 다른 비동기 작업을 두지 않는다.
   */
  async connectBluetooth(role: SensorRole): Promise<ManagedDevice> {
    if (this.pending) {
      throw makeSensorError('unknown', '다른 장치 연결이 진행 중입니다. 잠시 후 다시 시도하세요.');
    }
    this.pending = role;
    this.notify();
    try {
      const native = await requestGoDirectBluetoothDevice();
      const adapter = await GoDirectBluetoothAdapter.open(native);
      return await this.register(adapter, role, () => adapter.reconnect());
    } finally {
      this.pending = null;
      this.notify();
    }
  }

  /** 연습 모드용 모의 장치 추가 */
  async addMockDevice(role: SensorRole): Promise<ManagedDevice> {
    const adapter = new MockDeviceAdapter(role);
    return this.register(adapter, role, () => adapter.reconnect());
  }

  private async register(
    adapter: DeviceAdapter,
    role: SensorRole,
    reconnectFn: (() => Promise<void>) | null,
  ): Promise<ManagedDevice> {
    const id = adapter.info.deviceId;
    const existing = this.entries.get(id);
    if (existing && existing.managed.state !== 'disconnected' && existing.managed.state !== 'error') {
      await adapter.close().catch(() => undefined);
      throw makeSensorError('duplicate', `${adapter.info.name} 은(는) 이미 연결되어 있습니다.`);
    }
    if (existing) {
      // 끊어진 장치를 새 선택으로 다시 등록: 이전 항목 정리
      existing.unsubs.forEach((u) => u());
      this.entries.delete(id);
    }

    const channel = pickChannelForRole(adapter.info.channels, role);
    if (!channel) {
      const found = adapter.info.channels.map((c) => `${c.name} [${c.unit}]`).join(', ') || '채널 없음';
      await adapter.close().catch(() => undefined);
      const need = role === 'current' ? '전류 센서(GDX-CUR, 단위 A)' : '전압 센서(GDX-VOLT, 단위 V)';
      throw makeSensorError('wrong_device', `${adapter.info.name} 에는 ${need} 채널이 없습니다. 발견한 채널: ${found}`);
    }

    try {
      await adapter.enableChannel(channel.number);
    } catch (err) {
      await adapter.close().catch(() => undefined);
      throw err instanceof SensorError
        ? err
        : makeSensorError('connect_failed', '채널 활성화에 실패했습니다.', {
            cause: err instanceof Error ? err.message : String(err),
          });
    }

    const profile = findProfile(adapter.info.orderCode, adapter.info.name);
    const managed: ManagedDevice = {
      id,
      info: adapter.info,
      role,
      alias: role === 'current' ? '전류 센서' : '전압 센서',
      channel,
      state: 'connected',
      error: null,
      latest: null,
      lastReceivedAt: null,
      stale: false,
      appliedPeriodMs: null,
      zero: null,
      declaredRange: profile?.physicalRangeSwitch ? null : profile ? '장치 채널 범위' : null,
      batteryPct: null,
      canReconnect: !!adapter.canReconnect && !!reconnectFn,
    };
    const entry: Entry = { managed, adapter, unsubs: [], reconnectFn, measuringSince: null };
    this.attach(entry);
    this.entries.set(id, entry);
    this.notify();

    adapter.getBatteryLevel?.().then((pct) => {
      if (pct !== null && this.entries.get(id) === entry) {
        entry.managed.batteryPct = pct;
        this.scheduleNotify();
      }
    });

    if (this.measuring) {
      await this.startEntry(entry);
    }
    return managed;
  }

  private attach(entry: Entry) {
    entry.unsubs.forEach((u) => u());
    entry.unsubs = [
      entry.adapter.onReading((r) => this.handleReading(entry, r)),
      entry.adapter.onClosed(() => this.handleClosed(entry)),
    ];
  }

  // ---------- 표본 처리 ----------

  private computeFlags(entry: Entry, value: number): SampleFlag[] {
    const flags: SampleFlag[] = [];
    const m = entry.managed;
    const abs = Math.abs(value);
    const profile = findProfile(m.info.orderCode, m.info.name);

    let maxAbs: number | null = null;
    let resolution: number | null = null;
    if (profile?.physicalRangeSwitch && m.declaredRange) {
      const opt = profile.physicalRangeSwitch.find((o) => o.id === m.declaredRange);
      if (opt) {
        maxAbs = opt.maxAbs;
        resolution = opt.resolution;
      }
    }
    if (profile && profile.channelResolution.length > 0) {
      const cr = profile.channelResolution.find((c) => m.channel.name.includes(c.nameIncludes));
      if (cr) {
        resolution = cr.resolution;
        if (maxAbs === null) maxAbs = cr.maxAbs;
      }
    }
    if (maxAbs === null && typeof m.channel.maxValue === 'number') {
      const si = toSi(m.channel.maxValue, m.channel.unit);
      if (si) maxAbs = Math.abs(si.value);
    }
    if (maxAbs !== null && maxAbs > 0) {
      if (abs >= maxAbs) flags.push('saturated');
      else if (abs >= maxAbs * 0.95) flags.push('near_range');
    }
    if (resolution !== null && abs < resolution * 5) flags.push('near_resolution');
    return flags;
  }

  private handleReading(entry: Entry, r: RawReading) {
    const m = entry.managed;
    // 채널이 바뀐 뒤 늦게 도착한 다른 채널 값은 섞지 않는다.
    if (r.channel !== m.channel.number) return;
    const si = toSi(r.value, r.unit);
    if (!si) return;
    const expected = m.role === 'current' ? 'A' : 'V';
    if (si.siUnit !== expected) return; // 다른 단위 데이터 혼입 방지

    const offset = m.zero?.offset ?? 0;
    const value = si.value - offset;
    const sample: Sample = {
      deviceId: m.id,
      role: m.role,
      source: m.info.source,
      channel: r.channel,
      originalUnit: r.unit,
      rawValue: r.value,
      value,
      siUnit: si.siUnit,
      offset,
      tReceived: r.tReceived,
      sampleIndex: r.sampleIndex,
      flags: this.computeFlags(entry, value),
    };
    const wasStale = m.stale;
    m.latest = sample;
    m.lastReceivedAt = r.tReceived;
    m.stale = false;
    if (m.state === 'connected' && this.measuring) m.state = 'measuring';
    if (wasStale) this.emit({ type: 'resumed', deviceId: m.id, at: r.tReceived });
    this.emit({ type: 'sample', sample });
    if (wasStale || m.error) {
      m.error = null;
      this.notify(); // 상태 변화는 즉시 알린다
    } else {
      this.scheduleNotify();
    }
  }

  private handleClosed(entry: Entry) {
    const m = entry.managed;
    if (m.state === 'disconnected') return;
    const whileMeasuring = m.state === 'measuring' || (this.measuring && entry.measuringSince !== null);
    m.state = 'disconnected';
    m.stale = false;
    m.latest = null; // 끊긴 뒤 이전 값을 실시간 값처럼 보여주지 않는다
    m.appliedPeriodMs = null;
    entry.measuringSince = null;
    m.error = whileMeasuring
      ? makeSensorError('disconnected_during_measurement', `${m.alias} 연결이 측정 중 끊어졌습니다.`).info
      : null;
    this.emit({ type: 'disconnected', deviceId: m.id, at: Date.now(), whileMeasuring });
    this.notify();
  }

  // ---------- 연결 관리 ----------

  async reconnect(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) throw makeSensorError('not_found', '등록되지 않은 장치입니다.');
    if (!entry.reconnectFn) throw makeSensorError('connect_failed', '이 장치는 자동 재연결을 지원하지 않습니다. 다시 선택해 연결하세요.');
    entry.managed.state = 'connecting';
    entry.managed.error = null;
    this.notify();
    try {
      await entry.reconnectFn();
      await entry.adapter.enableChannel(entry.managed.channel.number);
      this.attach(entry);
      entry.managed.state = 'connected';
      entry.managed.latest = null;
      entry.managed.lastReceivedAt = null;
      this.notify();
      if (this.measuring) await this.startEntry(entry);
    } catch (err) {
      entry.managed.state = 'disconnected';
      entry.managed.error =
        err instanceof SensorError
          ? err.info
          : makeSensorError('connect_failed', '재연결에 실패했습니다.', {
              cause: err instanceof Error ? err.message : String(err),
            }).info;
      this.notify();
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    await entry.adapter.close().catch(() => undefined);
    // onClosed 가 상태를 바꾼다. 어댑터가 이벤트를 못 올린 경우를 대비해 보정.
    if (entry.managed.state !== 'disconnected') this.handleClosed(entry);
  }

  async remove(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    await entry.adapter.close().catch(() => undefined);
    entry.unsubs.forEach((u) => u());
    this.entries.delete(id);
    this.notify();
  }

  setAlias(id: string, alias: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.managed.alias = alias.trim() || entry.managed.alias;
    this.notify();
  }

  setDeclaredRange(id: string, rangeId: string | null) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.managed.declaredRange = rangeId;
    this.notify();
  }

  /** 측정 중이 아닐 때만 채널 변경. 단위가 역할과 맞아야 한다. */
  async setChannel(id: string, channelNumber: number): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (this.measuring) throw makeSensorError('start_failed', '측정 중에는 채널을 바꿀 수 없습니다.');
    const ch = entry.managed.info.channels.find((c) => c.number === channelNumber);
    if (!ch) throw makeSensorError('wrong_device', '존재하지 않는 채널입니다.');
    if (roleFromUnit(ch.unit) !== entry.managed.role) {
      throw makeSensorError('wrong_device', `채널 단위(${ch.unit})가 역할과 맞지 않습니다.`);
    }
    await entry.adapter.enableChannel(channelNumber);
    entry.managed.channel = ch;
    entry.managed.latest = null;
    entry.managed.zero = null; // 채널이 바뀌면 오프셋도 무효
    this.notify();
  }

  // ---------- 측정 ----------

  isMeasuring() {
    return this.measuring;
  }

  private async startEntry(entry: Entry) {
    const m = entry.managed;
    if (m.state !== 'connected') return;
    try {
      const applied = await entry.adapter.start(this.requestedPeriodMs);
      m.appliedPeriodMs = applied;
      m.state = 'measuring';
      m.error = null;
      entry.measuringSince = Date.now();
      m.lastReceivedAt = null;
      m.stale = false;
    } catch (err) {
      m.state = 'error';
      m.error =
        err instanceof SensorError
          ? err.info
          : makeSensorError('start_failed', '측정 시작 실패', {
              cause: err instanceof Error ? err.message : String(err),
            }).info;
    }
    this.notify();
  }

  async startMeasuring(periodMs?: number): Promise<void> {
    if (periodMs) this.requestedPeriodMs = Math.max(10, Math.round(periodMs));
    this.measuring = true;
    this.emit({ type: 'measurement', measuring: true, at: Date.now() });
    this.notify();
    await Promise.all(Array.from(this.entries.values()).map((e) => this.startEntry(e)));
    this.startWatchdog();
  }

  async stopMeasuring(): Promise<void> {
    this.measuring = false;
    this.stopWatchdog();
    await Promise.all(
      Array.from(this.entries.values()).map(async (e) => {
        if (e.managed.state === 'measuring' || e.managed.state === 'error') {
          await e.adapter.stop().catch(() => undefined);
          if (e.managed.state === 'measuring') e.managed.state = 'connected';
          e.measuringSince = null;
          e.managed.stale = false;
        }
      }),
    );
    this.emit({ type: 'measurement', measuring: false, at: Date.now() });
    this.notify();
  }

  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => this.checkStale(), WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  /** 테스트에서 직접 호출할 수 있도록 공개 */
  checkStale(now = Date.now()) {
    let changed = false;
    this.entries.forEach((entry) => {
      const m = entry.managed;
      if (m.state !== 'measuring' || entry.measuringSince === null) return;
      const period = m.appliedPeriodMs ?? this.requestedPeriodMs;
      const limit = Math.max(1500, period * 5);
      const last = m.lastReceivedAt ?? entry.measuringSince;
      if (now - last > limit && !m.stale) {
        m.stale = true;
        m.latest = null; // 오래된 값을 실시간 값처럼 보여주지 않는다
        m.error = makeSensorError('no_data_timeout', `${m.alias}에서 ${Math.round(limit / 100) / 10}초 이상 값이 오지 않았습니다.`).info;
        this.emit({ type: 'stale', deviceId: m.id, at: now });
        changed = true;
      }
    });
    if (changed) this.notify();
  }

  // ---------- 영점 ----------

  /**
   * 앱 수준 영점 보정: 일정 시간 받은 원래 값의 평균을 오프셋으로 저장한다.
   * 장치 자체 교정(gain/offset)을 바꾸지 않는다. 측정 중이어야 한다.
   */
  async zero(id: string, durationMs = 1500, note = ''): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) throw makeSensorError('not_found', '등록되지 않은 장치입니다.');
    if (entry.managed.state !== 'measuring') {
      throw makeSensorError('start_failed', '영점을 맞추려면 측정이 진행 중이어야 합니다. 먼저 측정을 시작하세요.');
    }
    const collected: number[] = [];
    await new Promise<void>((resolve) => {
      const unsub = this.subscribeEvents((e) => {
        if (e.type === 'sample' && e.sample.deviceId === id) {
          collected.push(e.sample.value + e.sample.offset); // 보정 전 내부 단위 값
        }
      });
      setTimeout(() => {
        unsub();
        resolve();
      }, durationMs);
    });
    if (collected.length < 3) {
      throw makeSensorError('no_data_timeout', '영점 보정에 쓸 표본이 부족합니다.');
    }
    const offset = collected.reduce((a, b) => a + b, 0) / collected.length;
    entry.managed.zero = { offset, appliedAt: Date.now(), preValues: collected, note };
    this.notify();
  }

  clearZero(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.managed.zero = null;
    this.notify();
  }

  /** 테스트용: 모든 장치 제거 */
  async resetAll() {
    await this.stopMeasuring();
    for (const id of Array.from(this.entries.keys())) {
      await this.remove(id);
    }
  }
}

// 개발 중 HMR 로 모듈이 다시 평가되어도 연결된 장치를 잃지 않도록 전역에 보관한다.
const g = globalThis as unknown as { __electLabSensorManager?: SensorManager };
export const sensorManager: SensorManager = g.__electLabSensorManager ?? (g.__electLabSensorManager = new SensorManager());
