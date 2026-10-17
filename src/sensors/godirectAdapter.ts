/**
 * Vernier Go Direct SDK(@vernier/godirect 1.8.3) 어댑터.
 *
 * 이 파일 밖에서는 SDK 객체를 직접 다루지 않는다.
 *
 * 왜 godirect.selectDevice() 를 쓰지 않는가:
 *   selectDevice() 는 내부에서 createDevice(device) 를 기본 옵션(open: true, startMeasurements: true)으로 부르고,
 *   Device.open(true) 는 기본 센서를 켜고 즉시 start() 를 호출한다 (src/godirect.js, src/Device.js).
 *   이 앱은 예측 단계 잠금과 본 실험 기록 시작·정지를 직접 관리해야 하므로
 *   requestDevice() 를 같은 필터로 직접 호출한 뒤 createDevice(native, { open: true, startMeasurements: false }) 를 쓴다.
 */
import godirectDefault from '@vernier/godirect';
import type { GdxDevice, GdxSensor, GodirectApi } from './godirectTypes';
import { GODIRECT_BLE_NAME_PREFIX, GODIRECT_BLE_SERVICE_UUID } from './godirectTypes';
import type { ChannelInfo, DeviceAdapter, DeviceInfo, RawReading } from './types';
import { classifyOpenError, classifyRequestError, makeSensorError } from './errors';

const godirect = godirectDefault as unknown as GodirectApi;

const START_TIMEOUT_MS = 6000;
const STOP_TIMEOUT_MS = 6000;

/**
 * 장치 선택창을 연다. 반드시 클릭 등 사용자 제스처 안에서, 다른 await 없이 가장 먼저 호출해야 한다.
 */
export async function requestGoDirectBluetoothDevice(): Promise<BluetoothDevice> {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw makeSensorError('unsupported', 'Web Bluetooth API 를 사용할 수 없습니다.');
  }
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: GODIRECT_BLE_NAME_PREFIX }],
      optionalServices: [GODIRECT_BLE_SERVICE_UUID],
    });
  } catch (err) {
    throw classifyRequestError(err);
  }
}

function channelFromSensor(s: GdxSensor): ChannelInfo {
  const mi = s.specs?.measurementInfo;
  return {
    number: s.number,
    name: s.name,
    unit: s.unit,
    minValue: Number.isFinite(mi?.minValue) ? mi.minValue : undefined,
    maxValue: Number.isFinite(mi?.maxValue) ? mi.maxValue : undefined,
    minPeriodMs: Number.isFinite(mi?.minPeriod) ? mi.minPeriod : undefined,
    typicalPeriodMs: Number.isFinite(mi?.typicalPeriod) ? mi.typicalPeriod : undefined,
  };
}

function waitForDeviceEvent(
  device: GdxDevice,
  event: 'measurements-started' | 'measurements-stopped',
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      device.off(event, handler);
      reject(new Error(`${event} 이벤트가 ${timeoutMs}ms 안에 오지 않았습니다.`));
    }, timeoutMs);
    const handler = () => {
      clearTimeout(timer);
      device.off(event, handler);
      resolve();
    };
    device.on(event, handler);
  });
}

export class GoDirectBluetoothAdapter implements DeviceAdapter {
  readonly info: DeviceInfo;
  readonly canReconnect = true;

  private device: GdxDevice;
  private readonly native: BluetoothDevice;
  private readingListeners = new Set<(r: RawReading) => void>();
  private closedListeners = new Set<() => void>();
  private activeSensor: GdxSensor | null = null;
  private valueHandler: ((s: GdxSensor) => void) | null = null;
  private closedHandler: (() => void) | null = null;
  private sampleIndex = 0;
  private closedEmitted = false;

  private constructor(native: BluetoothDevice, device: GdxDevice) {
    this.native = native;
    this.device = device;
    this.info = GoDirectBluetoothAdapter.describe(native, device);
    this.attachDeviceListeners();
  }

  private static describe(native: BluetoothDevice, device: GdxDevice): DeviceInfo {
    const serial = device.serialNumber || '';
    const order = device.orderCode || '';
    const deviceId = serial ? `${order || 'GDX'}-${serial}` : `ble-${native.id}`;
    return {
      deviceId,
      name: device.name || native.name || 'GDX',
      serialNumber: serial,
      orderCode: order,
      source: 'live',
      channels: device.sensors.map(channelFromSensor),
    };
  }

  private static async openSdkDevice(native: BluetoothDevice): Promise<GdxDevice> {
    let device: GdxDevice;
    try {
      device = await godirect.createDevice(native, { open: true, startMeasurements: false });
    } catch (err) {
      throw classifyOpenError(err);
    }
    // sensor.values 가 무한히 쌓이지 않도록 한다 (앱이 자체 기록 계층을 가진다).
    device.keepValues = false;
    // 처음에는 모든 채널을 끈 상태로 둔다. 활성화는 enableChannel 에서 명시적으로 한다.
    device.sensors.forEach((s) => {
      if (s.enabled) s.setEnabled(false);
    });
    return device;
  }

  /**
   * 이미 선택된 BluetoothDevice 로 GATT 연결을 맺고 장치 정보·채널을 읽는다.
   * 측정은 시작하지 않는다.
   */
  static async open(native: BluetoothDevice): Promise<GoDirectBluetoothAdapter> {
    const device = await GoDirectBluetoothAdapter.openSdkDevice(native);
    return new GoDirectBluetoothAdapter(native, device);
  }

  /** 보관한 BluetoothDevice 객체로 다시 연결한다 (선택창 없음). 실물 검증 필요. */
  async reconnect(): Promise<void> {
    this.detachAll();
    const device = await GoDirectBluetoothAdapter.openSdkDevice(this.native);
    this.device = device;
    this.closedEmitted = false;
    this.sampleIndex = 0;
    this.attachDeviceListeners();
  }

  private attachDeviceListeners() {
    this.closedHandler = () => {
      if (this.closedEmitted) return;
      this.closedEmitted = true;
      this.detachSensor();
      this.closedListeners.forEach((cb) => cb());
    };
    this.device.on('device-closed', this.closedHandler);
  }

  private detachSensor() {
    if (this.activeSensor && this.valueHandler) {
      this.activeSensor.off('value-changed', this.valueHandler);
    }
    this.activeSensor = null;
    this.valueHandler = null;
  }

  private detachAll() {
    this.detachSensor();
    if (this.closedHandler) this.device.off('device-closed', this.closedHandler);
    this.closedHandler = null;
  }

  async enableChannel(channelNumber: number): Promise<void> {
    if (this.device.collecting) {
      throw makeSensorError('start_failed', '측정 중에는 채널을 바꿀 수 없습니다. 먼저 측정을 정지하세요.');
    }
    const target = this.device.getSensor(channelNumber);
    if (!target) {
      throw makeSensorError('wrong_device', `채널 ${channelNumber} 이(가) 이 장치에 없습니다.`);
    }
    this.detachSensor();
    this.device.sensors.forEach((s) => {
      if (s.number !== channelNumber && s.enabled) s.setEnabled(false);
    });
    if (!target.enabled) target.setEnabled(true);
    this.activeSensor = target;
    this.valueHandler = (s: GdxSensor) => {
      if (s.value === null || !Number.isFinite(s.value)) return;
      const reading: RawReading = {
        deviceId: this.info.deviceId,
        channel: s.number,
        value: s.value,
        unit: s.unit,
        tReceived: Date.now(),
        sampleIndex: this.sampleIndex++,
      };
      this.readingListeners.forEach((cb) => cb(reading));
    };
    target.on('value-changed', this.valueHandler);
  }

  async start(periodMs: number): Promise<number> {
    if (!this.activeSensor) {
      throw makeSensorError('start_failed', '활성화된 채널이 없습니다.');
    }
    const minFromChannel = this.activeSensor.specs?.measurementInfo?.minPeriod ?? 0;
    const minFromDevice = this.device.minMeasurementPeriod ?? 10;
    const applied = Math.max(Math.round(periodMs), Math.ceil(minFromChannel), Math.ceil(minFromDevice));
    this.sampleIndex = 0;
    const started = waitForDeviceEvent(this.device, 'measurements-started', START_TIMEOUT_MS);
    try {
      // SDK start(period) 의 period 단위는 ms (Device.measurementPeriod 주석, _setMeasurementPeriod 가 ×1000 해 µs 로 전송)
      this.device.start(applied);
      await started;
    } catch (err) {
      throw makeSensorError('start_failed', '장치가 측정 시작에 응답하지 않았습니다.', {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    return this.device.measurementPeriod;
  }

  async stop(): Promise<void> {
    if (!this.device.collecting) return;
    const stopped = waitForDeviceEvent(this.device, 'measurements-stopped', STOP_TIMEOUT_MS);
    this.device.stop();
    try {
      await stopped;
    } catch {
      // 장치가 이미 끊어진 경우 등. 상태는 device-closed 이벤트로 따로 반영된다.
    }
  }

  async close(): Promise<void> {
    this.detachSensor();
    try {
      if (this.device.opened) {
        await this.device.close();
      }
    } catch {
      // 이미 끊어진 경우 close 가 던질 수 있다.
    } finally {
      if (!this.closedEmitted) {
        this.closedEmitted = true;
        this.closedListeners.forEach((cb) => cb());
      }
      this.detachAll();
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
    try {
      const v = await this.device.getBatteryLevel();
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }
}
