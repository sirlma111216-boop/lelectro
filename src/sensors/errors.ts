import type { SensorErrorCode, SensorErrorInfo } from './types';

export class SensorError extends Error {
  readonly info: SensorErrorInfo;
  constructor(info: SensorErrorInfo) {
    super(info.message);
    this.name = 'SensorError';
    this.info = info;
  }
}

const HINTS: Record<SensorErrorCode, string> = {
  unsupported: '데스크톱 Chrome 또는 Edge 에서 열어 주세요. 기록 열람·보고서·연습 모드는 그대로 사용할 수 있습니다.',
  insecure_context: 'HTTPS 주소나 localhost 에서 열어야 Bluetooth 연결이 가능합니다.',
  user_cancelled: '장치 선택창을 닫았습니다. 다시 연결 버튼을 누르고 목록에서 GDX 장치를 고르세요.',
  permission_denied:
    '브라우저 권한 또는 정책 때문에 Bluetooth 를 사용할 수 없습니다. 주소창의 사이트 설정에서 Bluetooth 를 허용하거나, 관리자 정책을 확인하세요.',
  not_found: '장치를 찾지 못했습니다. 센서 전원을 켜고(LED 깜박임) 가까이 둔 뒤 다시 시도하세요.',
  connect_failed:
    '연결에 실패했습니다. 센서가 Graphical Analysis 등 다른 앱이나 다른 컴퓨터에 이미 연결되어 있지 않은지 확인하고, 센서를 껐다 켠 뒤 다시 시도하세요.',
  wrong_device: '필요한 종류의 센서가 아닙니다. 전류 측정에는 GDX-CUR, 전압 측정에는 GDX-VOLT 를 선택하세요.',
  duplicate: '이미 연결된 장치입니다. 같은 장치를 두 번 등록할 수 없습니다.',
  start_failed: '측정 시작 명령에 장치가 응답하지 않았습니다. 연결을 끊고 다시 연결해 보세요.',
  disconnected_during_measurement:
    '측정 중 연결이 끊어졌습니다. 끊긴 구간은 기록에 표시되었고, 재연결하면 새 구간으로 이어서 기록됩니다.',
  no_data_timeout: '측정값이 일정 시간 수신되지 않았습니다. 센서 전원과 거리를 확인하세요.',
  unknown: '알 수 없는 오류입니다. 페이지를 새로고침하고 다시 시도하세요.',
};

export function makeSensorError(
  code: SensorErrorCode,
  message: string,
  extra: Partial<Pick<SensorErrorInfo, 'busyPossible' | 'cause' | 'hint'>> = {},
): SensorError {
  return new SensorError({
    code,
    message,
    hint: extra.hint ?? HINTS[code],
    busyPossible: extra.busyPossible ?? code === 'connect_failed',
    cause: extra.cause,
  });
}

function errName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) return String((err as { name: unknown }).name);
  return '';
}
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * navigator.bluetooth.requestDevice() 가 던지는 오류 분류.
 * Chrome 은 사용자가 선택창을 취소하면 NotFoundError 를 던진다.
 */
export function classifyRequestError(err: unknown): SensorError {
  if (err instanceof SensorError) return err;
  const name = errName(err);
  const msg = errMessage(err);
  if (name === 'NotFoundError') {
    if (/cancel/i.test(msg) || /chooser/i.test(msg)) {
      return makeSensorError('user_cancelled', '장치 선택을 취소했습니다.', { cause: msg });
    }
    return makeSensorError('not_found', '선택할 수 있는 장치를 찾지 못했습니다.', { cause: msg });
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return makeSensorError('permission_denied', 'Bluetooth 권한이 거부되었거나 정책으로 막혀 있습니다.', {
      cause: msg,
    });
  }
  if (name === 'TypeError' && /bluetooth/i.test(msg)) {
    return makeSensorError('unsupported', 'Web Bluetooth API 를 사용할 수 없습니다.', { cause: msg });
  }
  return makeSensorError('unknown', msg || '장치 선택 중 오류', { cause: msg });
}

/**
 * godirect.createDevice / device.open 단계의 오류 분류.
 * SDK 어댑터는 gatt.connect 실패를 콘솔에만 남기고
 * "Expected command and response characteristics not found" 로 다시 던지므로
 * 이 메시지는 연결 실패(다른 앱 사용 중 가능성 포함)로 본다.
 */
export function classifyOpenError(err: unknown): SensorError {
  if (err instanceof SensorError) return err;
  const name = errName(err);
  const msg = errMessage(err);
  if (name === 'NetworkError' || /characteristics not found|Device Open Failed|GATT|connect/i.test(msg)) {
    return makeSensorError('connect_failed', '장치와 GATT 연결을 맺지 못했습니다.', {
      busyPossible: true,
      cause: msg,
    });
  }
  if (/timed out/i.test(msg)) {
    return makeSensorError('connect_failed', '장치가 초기화 명령에 응답하지 않았습니다.', {
      busyPossible: true,
      cause: msg,
    });
  }
  return makeSensorError('unknown', msg || '장치 열기 중 오류', { cause: msg });
}
