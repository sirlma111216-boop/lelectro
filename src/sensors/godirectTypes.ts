/**
 * @vernier/godirect 1.8.3 의 실제 소스(src/Device.js, src/Sensor.js, src/godirect.js)를 읽고
 * 이 앱이 사용하는 범위만 좁게 적은 타입이다.
 * 패키지가 제공하는 types/*.d.ts 는 대부분 any 라서 그대로 쓰지 않는다.
 *
 * 여기에 적힌 메서드·이벤트 이름은 모두 1.8.3 소스에 존재하는 것만 담았다:
 *  - godirect.createDevice(nativeDevice, { open, startMeasurements })
 *  - godirect.selectDevice(bluetooth)
 *  - Device: name, serialNumber, orderCode, sensors, opened, collecting,
 *            measurementPeriod(ms), minMeasurementPeriod(ms), keepValues,
 *            start(periodMs), stop(), close(), getSensor(n), getBatteryLevel(),
 *            on/off('device-opened' | 'device-closed' | 'measurements-started' | 'measurements-stopped')
 *  - Sensor: number, name, unit, enabled, value, values, specs.measurementInfo{minValue,maxValue,minPeriod,typicalPeriod,...},
 *            setEnabled(bool), clear(), on/off('value-changed' | 'state-changed')
 */

export interface GdxMeasurementInfo {
  type: number;
  mode: number;
  minValue: number;
  maxValue: number;
  uncertainty: number;
  /** ms (SDK 가 µs 를 1000 으로 나눠 저장) */
  minPeriod: number;
  maxPeriod: number;
  typicalPeriod: number;
  granularity: number;
}

export interface GdxSensorSpecs {
  number: number;
  name: string;
  unit: string;
  mutalExclusionMask: number;
  measurementInfo: GdxMeasurementInfo;
}

export type GdxSensorEvent = 'value-changed' | 'state-changed';

export interface GdxSensor {
  number: number;
  name: string;
  unit: string;
  enabled: boolean;
  value: number | null;
  values: number[];
  specs: GdxSensorSpecs;
  setEnabled(enabled: boolean): void;
  clear(): void;
  on(event: GdxSensorEvent, cb: (sensor: GdxSensor) => void): void;
  off(event: GdxSensorEvent, cb: (sensor: GdxSensor) => void): boolean;
}

export type GdxDeviceEvent = 'device-opened' | 'device-closed' | 'measurements-started' | 'measurements-stopped';

export interface GdxDevice {
  name: string;
  serialNumber: string;
  orderCode: string;
  sensors: GdxSensor[];
  opened: boolean;
  collecting: boolean;
  /** ms */
  measurementPeriod: number;
  /** ms */
  minMeasurementPeriod: number;
  /** true 면 sensor.values 배열이 무한히 자란다. 앱은 false 로 둔다. */
  keepValues: boolean;
  /** period 는 ms. 내부에서 µs 로 바꿔 장치에 보낸다. 동기 함수이며 'measurements-started' 이벤트로 완료를 알린다. */
  start(periodMs?: number): void;
  /** 동기 함수. 'measurements-stopped' 이벤트로 완료를 알린다. */
  stop(): void;
  close(): Promise<unknown>;
  getSensor(number: number): GdxSensor | undefined;
  getBatteryLevel(): Promise<number>;
  on(event: GdxDeviceEvent, cb: () => void): void;
  off(event: GdxDeviceEvent, cb: () => void): boolean;
}

export interface GodirectApi {
  createDevice(
    nativeDevice: BluetoothDevice,
    options?: { open?: boolean; startMeasurements?: boolean },
  ): Promise<GdxDevice>;
  selectDevice(bluetooth?: boolean): Promise<GdxDevice>;
}

/**
 * SDK 소스 src/WebBluetoothDeviceAdapter.js 와 src/godirect.js 에 적힌 값 그대로.
 * 앱은 selectDevice() 대신 requestDevice() 를 직접 호출해 자동 측정 시작을 피하므로
 * 같은 필터와 서비스 UUID 를 여기서 재사용한다.
 */
export const GODIRECT_BLE_SERVICE_UUID = 'd91714ef-28b9-4f91-ba16-f0d9a604f112';
export const GODIRECT_BLE_NAME_PREFIX = 'GDX';
