/**
 * 센서 계층의 공용 타입.
 * UI 는 이 타입만 알고, Vernier SDK 의 객체는 godirectAdapter.ts 안에만 머문다.
 */

export type SensorRole = 'current' | 'voltage';

/** 데이터 출처. 모의(mock) 데이터는 어디서도 실측(live)으로 표시되면 안 된다. */
export type DataSource = 'live' | 'mock' | 'imported';

export type ConnectionState = 'connecting' | 'connected' | 'measuring' | 'disconnected' | 'error';

/** 내부 기준 단위: 전압 V, 전류 A, 시간 s */
export type SiUnit = 'A' | 'V';

export interface ChannelInfo {
  number: number;
  name: string;
  /** 장치가 보고한 원래 단위 문자열 (예: "A", "mA", "V") */
  unit: string;
  minValue?: number;
  maxValue?: number;
  /** SDK 가 ms 로 환산해 제공하는 값 */
  minPeriodMs?: number;
  typicalPeriodMs?: number;
}

export interface DeviceInfo {
  /** 앱 내부 식별자 (주문코드-일련번호 또는 브라우저 장치 id) */
  deviceId: string;
  name: string;
  serialNumber: string;
  orderCode: string;
  source: DataSource;
  channels: ChannelInfo[];
}

/** 어댑터가 넘겨주는 원시 측정값 (단위 변환 전) */
export interface RawReading {
  deviceId: string;
  channel: number;
  value: number;
  unit: string;
  /** 앱이 값을 받은 시각 (Date.now() 기준 ms) */
  tReceived: number;
  /** 측정 시작 후 몇 번째 표본인지 (0부터) */
  sampleIndex: number;
}

/**
 * 센서 장치 어댑터 인터페이스.
 * 실제 SDK 어댑터와 모의 어댑터가 같은 인터페이스를 구현한다.
 */
export interface DeviceAdapter {
  readonly info: DeviceInfo;
  /** 해당 채널만 활성화하고 나머지는 비활성화한다. 측정 중에는 호출하지 않는다. */
  enableChannel(channelNumber: number): Promise<void>;
  /** 측정을 시작하고 실제 적용된 측정 주기(ms)를 돌려준다. */
  start(periodMs: number): Promise<number>;
  stop(): Promise<void>;
  /** 연결을 끊고 모든 구독을 정리한다. */
  close(): Promise<void>;
  onReading(cb: (reading: RawReading) => void): () => void;
  onClosed(cb: () => void): () => void;
  getBatteryLevel?(): Promise<number | null>;
  /** 재연결 가능 여부 (Bluetooth 장치 객체를 보관하고 있을 때) */
  readonly canReconnect?: boolean;
}

export type SampleFlag = 'saturated' | 'near_range' | 'near_resolution';

/** 단위 변환과 보정을 거친 표본 */
export interface Sample {
  deviceId: string;
  role: SensorRole;
  source: DataSource;
  channel: number;
  originalUnit: string;
  /** 장치가 보고한 값 (원래 단위) */
  rawValue: number;
  /** 내부 기준 단위(A 또는 V)로 변환하고 앱 오프셋을 뺀 값 */
  value: number;
  siUnit: SiUnit;
  /** 적용된 앱 오프셋(내부 단위). 장치 자체 교정과는 별개다. */
  offset: number;
  tReceived: number;
  sampleIndex: number;
  flags: SampleFlag[];
}

export interface ZeroCalibration {
  /** 내부 단위 기준 오프셋 */
  offset: number;
  appliedAt: number;
  /** 보정 전 원래 값(내부 단위) 표본 */
  preValues: number[];
  note: string;
}

export interface ManagedDevice {
  id: string;
  info: DeviceInfo;
  role: SensorRole;
  alias: string;
  channel: ChannelInfo;
  state: ConnectionState;
  error: SensorErrorInfo | null;
  latest: Sample | null;
  lastReceivedAt: number | null;
  /** 측정 중인데 일정 시간 값이 오지 않음 */
  stale: boolean;
  appliedPeriodMs: number | null;
  zero: ZeroCalibration | null;
  /** 소프트웨어로 읽을 수 없는 물리 범위 스위치 등 사용자가 직접 확인한 설정 */
  declaredRange: string | null;
  batteryPct: number | null;
  canReconnect: boolean;
}

export type SensorErrorCode =
  | 'unsupported'
  | 'insecure_context'
  | 'user_cancelled'
  | 'permission_denied'
  | 'not_found'
  | 'connect_failed'
  | 'wrong_device'
  | 'duplicate'
  | 'start_failed'
  | 'disconnected_during_measurement'
  | 'no_data_timeout'
  | 'unknown';

export interface SensorErrorInfo {
  code: SensorErrorCode;
  message: string;
  /** 사용자에게 보여줄 다음 행동 안내 */
  hint: string;
  /** 다른 앱(Graphical Analysis 등)이 장치를 쓰고 있을 가능성 */
  busyPossible: boolean;
  cause?: string;
}

export type ManagerEvent =
  | { type: 'sample'; sample: Sample }
  | { type: 'disconnected'; deviceId: string; at: number; whileMeasuring: boolean }
  | { type: 'stale'; deviceId: string; at: number }
  | { type: 'resumed'; deviceId: string; at: number }
  | { type: 'measurement'; measuring: boolean; at: number };

export interface ManagerSnapshot {
  devices: ManagedDevice[];
  measuring: boolean;
  /** 요청한 측정 주기 (ms) */
  requestedPeriodMs: number;
  practiceMode: boolean;
  /** 장치 선택창이 열려 있거나 GATT 연결 중인 역할 */
  pending: SensorRole | null;
}
