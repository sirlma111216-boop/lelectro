import type { InquiryId } from './types';

export type HintTiming = 'after_prediction' | 'after_observation' | 'never';

/**
 * 교사용 설정. 서버 인증이 없으므로 "보안" 이나 "부정행위 방지" 기능이 아니라
 * 같은 기기에서 수업 흐름을 맞추는 편의 설정이다.
 */
export interface TeacherSettings {
  schemaVersion: 1;
  enabledInquiries: InquiryId[];
  hintTiming: HintTiming;
  /** 기본 측정 주기 (ms). 정적인 회로 탐구에는 100~200ms 가 적당하다. */
  defaultPeriodMs: number;
  /** 안정 구간 평균에 필요한 최소 표본 수 */
  minSamplesPerWindow: number;
  /** 예시 조건에 쓰는 전원 전압 (V) */
  exampleSupplyVoltage: number;
  /** 예시 고정 저항 (Ω) */
  exampleResistors: number[];
  /** 저항 정격 전력 (W) — 여유 계산에 사용 */
  resistorRatedPowerW: number;
}

export const DEFAULT_TEACHER_SETTINGS: TeacherSettings = {
  schemaVersion: 1,
  enabledInquiries: [1, 2, 3, 4],
  hintTiming: 'after_prediction',
  defaultPeriodMs: 100,
  minSamplesPerWindow: 5,
  exampleSupplyVoltage: 3,
  exampleResistors: [100, 220, 330],
  resistorRatedPowerW: 0.25,
};

export const HINT_TIMING_LABEL: Record<HintTiming, string> = {
  after_prediction: '예측 제출 후',
  after_observation: '관찰 기록 후',
  never: '공개하지 않음',
};

/**
 * 저항 소비 전력과 정격 여유 계산.
 * P = V²/R. 정격의 50% 이하를 "여유 있음" 으로 본다.
 */
export function resistorPowerCheck(voltage: number, resistance: number, ratedW: number) {
  const current = resistance > 0 ? voltage / resistance : Infinity;
  const power = resistance > 0 ? (voltage * voltage) / resistance : Infinity;
  const ratio = ratedW > 0 ? power / ratedW : Infinity;
  const level: 'ok' | 'caution' | 'danger' = ratio <= 0.5 ? 'ok' : ratio <= 1 ? 'caution' : 'danger';
  return { current, power, ratio, level };
}
