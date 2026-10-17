/**
 * @vernier/godirect 1.8.3 의 Device 생성자는 TextDecoder 가 없는 환경(구형 Node)에서만
 * `require('text-encoding')` 을 호출한다. 브라우저에는 항상 TextDecoder 가 있으므로 이 분기는 실행되지 않지만,
 * 번들러가 모듈을 해석할 수 있도록 전역 구현을 그대로 내보내는 빈 대체 모듈을 둔다.
 */
export const TextDecoder = globalThis.TextDecoder;
export const TextEncoder = globalThis.TextEncoder;
export default { TextDecoder, TextEncoder };
