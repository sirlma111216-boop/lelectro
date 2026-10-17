/**
 * Web Bluetooth 사용 가능 여부 판별.
 * "API 가 존재한다" 와 "실제 연결에 성공했다" 는 다른 문제이므로 여기서는 전자만 판단한다.
 */

export interface BluetoothCapability {
  /** navigator.bluetooth 객체가 존재 */
  apiAvailable: boolean;
  /** HTTPS 또는 localhost 등 안전한 컨텍스트 */
  secureContext: boolean;
  /** 둘 다 만족해 연결 시도를 해볼 수 있는 상태 */
  canAttempt: boolean;
  reason: string | null;
}

export function detectBluetoothCapability(
  nav: Partial<Navigator> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
  secure: boolean = typeof window !== 'undefined' ? window.isSecureContext : false,
): BluetoothCapability {
  const apiAvailable = !!nav && typeof (nav as Navigator).bluetooth !== 'undefined';
  const secureContext = !!secure;
  let reason: string | null = null;
  if (!secureContext) {
    reason = 'HTTPS 또는 localhost 가 아닌 주소에서는 Web Bluetooth 를 사용할 수 없습니다.';
  } else if (!apiAvailable) {
    reason =
      '이 브라우저는 Web Bluetooth 를 지원하지 않습니다. 데스크톱 Chrome 또는 Edge 를 사용해 주세요. 기록 열람·보고서·연습 모드는 계속 사용할 수 있습니다.';
  }
  return { apiAvailable, secureContext, canAttempt: apiAvailable && secureContext, reason };
}
