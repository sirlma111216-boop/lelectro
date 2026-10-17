import { afterEach, describe, expect, it } from 'vitest';
import { SensorManager } from '@/sensors/SensorManager';
import type { DeviceAdapter, DeviceInfo, RawReading } from '@/sensors/types';

/** 테스트용 가짜 어댑터: 실제 Bluetooth 가 아니며, 실제 장치 검증을 대신하지 않는다 */
class FakeAdapter implements DeviceAdapter {
  info: DeviceInfo;
  readonly canReconnect = true;
  readings = new Set<(r: RawReading) => void>();
  closed = new Set<() => void>();
  enabled: number | null = null;
  started: number[] = [];
  stopped = 0;
  idx = 0;
  constructor(info: Partial<DeviceInfo> & { channels: DeviceInfo['channels'] }) {
    this.info = { deviceId: 'fake-1', name: 'GDX-CUR 0K1', serialNumber: '0K1', orderCode: 'GDX-CUR', source: 'live', ...info };
  }
  async enableChannel(n: number) {
    this.enabled = n;
  }
  async start(p: number) {
    this.started.push(p);
    return Math.max(p, 10);
  }
  async stop() {
    this.stopped += 1;
  }
  async close() {
    this.closed.forEach((cb) => cb());
  }
  onReading(cb: (r: RawReading) => void) {
    this.readings.add(cb);
    return () => {
      this.readings.delete(cb);
    };
  }
  onClosed(cb: () => void) {
    this.closed.add(cb);
    return () => {
      this.closed.delete(cb);
    };
  }
  emit(value: number, unit = 'A', channel = this.enabled ?? 1) {
    this.readings.forEach((cb) => cb({ deviceId: this.info.deviceId, channel, value, unit, tReceived: Date.now(), sampleIndex: this.idx++ }));
  }
  disconnect() {
    this.closed.forEach((cb) => cb());
  }
}

// register 는 private 이므로 테스트에서는 any 로 호출한다
async function register(m: SensorManager, a: FakeAdapter, role: 'current' | 'voltage') {
  return (m as unknown as { register: (a: DeviceAdapter, r: 'current' | 'voltage', f: null) => Promise<unknown> }).register(a, role, null);
}

const CUR = [{ number: 1, name: 'Current', unit: 'A', minValue: -1, maxValue: 1 }];
const VOLT = [
  { number: 1, name: 'Potential - 20 V', unit: 'V', minValue: -20, maxValue: 20 },
  { number: 2, name: 'Potential - 1 V', unit: 'V', minValue: -1, maxValue: 1 },
];

describe('SensorManager', () => {
  let m: SensorManager;
  afterEach(async () => {
    await m?.resetAll();
  });

  it('역할과 맞지 않는 단위의 장치는 거부한다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await expect(register(m, a, 'voltage')).rejects.toMatchObject({ info: { code: 'wrong_device' } });
    expect(m.getDevices()).toHaveLength(0);
  });

  it('GDX-VOLT 는 20 V 채널을 기본으로 고르고, 한 채널만 활성화한다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ deviceId: 'v1', orderCode: 'GDX-VOLT', channels: VOLT });
    await register(m, a, 'voltage');
    expect(a.enabled).toBe(1);
    expect(m.getDevices()[0].channel.name).toContain('20');
  });

  it('같은 장치를 두 번 등록하지 않는다', async () => {
    m = new SensorManager();
    await register(m, new FakeAdapter({ channels: CUR }), 'current');
    await expect(register(m, new FakeAdapter({ channels: CUR }), 'current')).rejects.toMatchObject({ info: { code: 'duplicate' } });
  });

  it('값을 내부 단위로 바꾸고, 다른 채널·단위 데이터는 섞지 않는다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: [{ number: 1, name: 'Current', unit: 'mA' }] });
    await register(m, a, 'current');
    const samples: number[] = [];
    m.subscribeEvents((e) => e.type === 'sample' && samples.push(e.sample.value));
    await m.startMeasuring(100);
    a.emit(250, 'mA'); // → 0.25 A
    a.emit(3, 'V', 2); // 다른 채널·단위: 무시
    a.emit(1, 'A', 1); // 채널은 맞지만 단위 문자열이 채널과 달라도 A 는 전류이므로 변환 — 값 1 A
    expect(samples).toEqual([0.25, 1]);
    expect(a.started).toEqual([100]);
  });

  it('연결이 끊기면 최신값을 지우고 끊김 이벤트를 낸다 (이전 값을 실시간처럼 두지 않음)', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await register(m, a, 'current');
    await m.startMeasuring(100);
    a.emit(0.1);
    const events: string[] = [];
    m.subscribeEvents((e) => events.push(e.type));
    a.disconnect();
    const d = m.getDevices()[0];
    expect(d.state).toBe('disconnected');
    expect(d.latest).toBeNull();
    expect(d.error?.code).toBe('disconnected_during_measurement');
    expect(events).toContain('disconnected');
  });

  it('일정 시간 값이 오지 않으면 stale 로 표시하고 최신값을 지운다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await register(m, a, 'current');
    await m.startMeasuring(100);
    a.emit(0.1);
    const now = Date.now();
    m.checkStale(now + 100);
    expect(m.getDevices()[0].stale).toBe(false);
    m.checkStale(now + 5000);
    expect(m.getDevices()[0].stale).toBe(true);
    expect(m.getDevices()[0].latest).toBeNull();
    // 값이 다시 오면 복구
    a.emit(0.1);
    expect(m.getDevices()[0].stale).toBe(false);
  });

  it('영점 보정은 원래 값을 보존하고 오프셋만 뺀다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await register(m, a, 'current');
    await m.startMeasuring(100);
    const id = m.getDevices()[0].id;
    const timer = setInterval(() => a.emit(0.002), 20);
    await m.zero(id, 150);
    clearInterval(timer);
    const d = m.getDevices()[0];
    expect(d.zero!.offset).toBeCloseTo(0.002, 6);
    expect(d.zero!.preValues.length).toBeGreaterThan(2);
    const got: Array<{ raw: number; value: number }> = [];
    m.subscribeEvents((e) => e.type === 'sample' && got.push({ raw: e.sample.rawValue, value: e.sample.value }));
    a.emit(0.102);
    expect(got[0].raw).toBe(0.102);
    expect(got[0].value).toBeCloseTo(0.1, 6);
  });

  it('범위 초과·근접 플래그를 붙인다 (사용자가 확인한 범위 스위치 기준)', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await register(m, a, 'current');
    const id = m.getDevices()[0].id;
    m.setDeclaredRange(id, '0.1A');
    await m.startMeasuring(100);
    const flags: string[][] = [];
    m.subscribeEvents((e) => e.type === 'sample' && flags.push(e.sample.flags));
    a.emit(0.05);
    a.emit(0.097);
    a.emit(0.12);
    expect(flags[0]).toEqual([]);
    expect(flags[1]).toContain('near_range');
    expect(flags[2]).toContain('saturated');
  });

  it('측정 정지 후 어댑터 stop 이 호출되고 상태가 connected 로 돌아온다', async () => {
    m = new SensorManager();
    const a = new FakeAdapter({ channels: CUR });
    await register(m, a, 'current');
    await m.startMeasuring(100);
    expect(m.getDevices()[0].state).toBe('measuring');
    await m.stopMeasuring();
    expect(a.stopped).toBe(1);
    expect(m.getDevices()[0].state).toBe('connected');
  });

  it('모의 장치는 source 가 mock 이며 실측으로 표시되지 않는다', async () => {
    m = new SensorManager();
    const d = await m.addMockDevice('current');
    expect(d.info.source).toBe('mock');
    const samples: string[] = [];
    m.subscribeEvents((e) => e.type === 'sample' && samples.push(e.sample.source));
    await m.startMeasuring(20);
    await new Promise((r) => setTimeout(r, 120));
    await m.stopMeasuring();
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every((s) => s === 'mock')).toBe(true);
  });
});
