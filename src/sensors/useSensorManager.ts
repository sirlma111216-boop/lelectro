import { useSyncExternalStore } from 'react';
import { sensorManager } from './SensorManager';
import type { ManagerSnapshot } from './types';

/**
 * React 에서 센서 관리자 상태를 읽는 훅.
 * useSyncExternalStore 를 쓰므로 StrictMode 의 이중 마운트에도 구독이 중복되지 않는다.
 */
export function useSensorManager(): ManagerSnapshot {
  return useSyncExternalStore(
    (cb) => sensorManager.subscribe(cb),
    () => sensorManager.getSnapshot(),
    () => sensorManager.getSnapshot(),
  );
}
