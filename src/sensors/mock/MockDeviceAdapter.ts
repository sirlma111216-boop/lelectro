/**
 * 모의 장치 어댑터. 실제 SDK 어댑터와 같은 DeviceAdapter 인터페이스를 구현하므로
 * 센서 관리자·기록 계층·UI 는 둘을 구분하지 않고 쓴다. 단, info.source 는 항상 'mock' 이다.
 */
import type { ChannelInfo, DeviceAdapter, DeviceInfo, RawReading, SensorRole } from '../types';
import { mockCircuitStore, mockCurrentReading, mockVoltageReading, solveMockCircuit } from './mockCircuit';

let mockSerialCounter = 0;

/**
 * 채널 이름·번호는 모의값이다. 실제 GDX-CUR / GDX-VOLT 의 채널 이름과 번호는
 * 실물에서 확인해야 한다 (docs/hardware-checklist.md).
 */
function mockChannels(role: SensorRole): ChannelInfo[] {
  if (role === 'current') {
    return [
      { number: 1, name: 'Current', unit: 'A', minValue: -1, maxValue: 1, minPeriodMs: 10, typicalPeriodMs: 50 },
    ];
  }
  return [
    {
      number: 1,
      name: 'Potential - 20 V',
      unit: 'V',
      minValue: -20,
      maxValue: 20,
      minPeriodMs: 10,
      typicalPeriodMs: 50,
    },
    { number: 2, name: 'Potential - 1 V', unit: 'V', minValue: -1, maxValue: 1, minPeriodMs: 10, typicalPeriodMs: 50 },
  ];
}

export class MockDeviceAdapter implements DeviceAdapter {
  readonly info: DeviceInfo;
  readonly role: SensorRole;
  readonly canReconnect = true;

  private readingListeners = new Set<(r: RawReading) => void>();
  private closedListeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeChannel: ChannelInfo | null = null;
  private sampleIndex = 0;
  private unsubStore: (() => void) | null = null;
  private closed = false;

  constructor(role: SensorRole) {
    this.role = role;
    mockSerialCounter += 1;
    const serial = `MOCK-${String(mockSerialCounter).padStart(3, '0')}`;
    const order = role === 'current' ? 'GDX-CUR' : 'GDX-VOLT';
    this.info = {
      deviceId: `${order}-${serial}`,
      name: `${order} ${serial} (모의)`,
      serialNumber: serial,
      orderCode: order,
      source: 'mock',
      channels: mockChannels(role),
    };
    // 모의 연결 끊김 스위치를 감시한다.
    this.unsubStore = mockCircuitStore.subscribe((s) => {
      const flag = role === 'current' ? s.currentDisconnected : s.voltageDisconnected;
      if (flag && !this.closed) this.simulateDisconnect();
    });
  }

  private simulateDisconnect() {
    this.closed = true;
    this.stopTimer();
    this.closedListeners.forEach((cb) => cb());
  }

  /** 모의 재연결 */
  async reconnect(): Promise<void> {
    const s = mockCircuitStore.getState();
    const flag = this.role === 'current' ? s.currentDisconnected : s.voltageDisconnected;
    if (flag) {
      throw new Error('모의 연결 끊김 스위치가 켜져 있습니다. 끈 뒤 다시 연결하세요.');
    }
    this.closed = false;
    this.sampleIndex = 0;
  }

  async enableChannel(channelNumber: number): Promise<void> {
    const ch = this.info.channels.find((c) => c.number === channelNumber);
    if (!ch) throw new Error(`채널 ${channelNumber} 없음`);
    this.activeChannel = ch;
  }

  async start(periodMs: number): Promise<number> {
    if (this.closed) throw new Error('연결이 끊어진 모의 장치입니다.');
    if (!this.activeChannel) throw new Error('활성 채널 없음');
    const applied = Math.max(10, Math.round(periodMs));
    this.stopTimer();
    this.sampleIndex = 0;
    this.timer = setInterval(() => this.emitReading(), applied);
    return applied;
  }

  private emitReading() {
    if (this.closed || !this.activeChannel) return;
    const s = mockCircuitStore.getState();
    const sol = solveMockCircuit(s);
    let value: number;
    if (this.role === 'current') {
      value = mockCurrentReading(s, sol);
    } else {
      value = mockVoltageReading(s, sol);
      // 1 V 채널은 범위를 넘으면 포화 (실물 동작은 확인 필요)
      if (this.activeChannel.number === 2) value = Math.max(-1.02, Math.min(1.02, value));
    }
    const reading: RawReading = {
      deviceId: this.info.deviceId,
      channel: this.activeChannel.number,
      value,
      unit: this.activeChannel.unit,
      tReceived: Date.now(),
      sampleIndex: this.sampleIndex++,
    };
    this.readingListeners.forEach((cb) => cb(reading));
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async stop(): Promise<void> {
    this.stopTimer();
  }

  async close(): Promise<void> {
    this.stopTimer();
    this.unsubStore?.();
    this.unsubStore = null;
    if (!this.closed) {
      this.closed = true;
      this.closedListeners.forEach((cb) => cb());
    }
  }

  onReading(cb: (reading: RawReading) => void): () => void {
    this.readingListeners.add(cb);
    return () => this.readingListeners.delete(cb);
  }

  onClosed(cb: () => void): () => void {
    this.closedListeners.add(cb);
    return () => this.closedListeners.delete(cb);
  }

  async getBatteryLevel(): Promise<number | null> {
    return 87;
  }
}
