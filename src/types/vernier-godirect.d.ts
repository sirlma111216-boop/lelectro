/**
 * @vernier/godirect 1.8.3 은 package.json "exports" 에 types 조건이 없어
 * 번들된 ESM 진입점에 타입을 붙이지 못한다. 앱은 좁은 타입(src/sensors/godirectTypes.ts)으로 캐스팅해 쓴다.
 */
declare module '@vernier/godirect' {
  const godirect: unknown;
  export default godirect;
}
