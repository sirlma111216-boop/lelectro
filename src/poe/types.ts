import type { DataSource, SampleFlag, SensorRole, SiUnit } from '@/sensors/types';

export const SESSION_SCHEMA_VERSION = 1 as const;

export type InquiryId = 1 | 2 | 3 | 4;

/** POE 단계. 진행 비율은 계산하지 않고 현재 단계 이름만 쓴다. */
export type Stage = 'prep' | 'predict' | 'observe' | 'explain' | 'summary';

export const STAGE_ORDER: Stage[] = ['prep', 'predict', 'observe', 'explain', 'summary'];

export const STAGE_LABEL: Record<Stage, string> = {
  prep: '실험 준비',
  predict: '예측 (P)',
  observe: '관찰 (O)',
  explain: '설명 (E)',
  summary: '탐구 정리',
};

export type PredictionValues = Record<string, unknown>;

export interface PredictionEntry {
  values: PredictionValues;
  reason: string;
  /** 1(전혀 확신 없음) ~ 5(매우 확신) */
  confidence: number;
  submittedAt: number;
}

export interface Prediction {
  /** 최초 제출본. 이후 절대 바꾸지 않는다. */
  initial: PredictionEntry;
  /** 수정본 이력 (오래된 것부터) */
  revisions: PredictionEntry[];
}

export interface RoleStats {
  mean: number;
  sd: number;
  n: number;
  min: number;
  max: number;
  siUnit: SiUnit;
  flags: SampleFlag[];
}

export interface RoleMeta {
  deviceId: string;
  deviceName: string;
  channelName: string;
  originalUnit: string;
  declaredRange: string | null;
  zeroOffset: number;
  periodMs: number | null;
}

/** 기록표 한 줄: 조건(측정 위치)별 안정 구간 통계 */
export interface ConditionRecord {
  id: string;
  /** 탐구 정의의 측정 슬롯 id */
  slotId: string;
  /** 사용자가 입력한 조건 이름 */
  label: string;
  /** 같은 슬롯의 몇 번째 반복인지 (1부터) */
  repeat: number;
  source: DataSource;
  window: { tStart: number; tEnd: number };
  segmentIds: string[];
  stats: Partial<Record<SensorRole, RoleStats>>;
  meta: Partial<Record<SensorRole, RoleMeta>>;
  note: string;
  createdAt: number;
  warnings: string[];
}

export interface Explanation {
  claim: string;
  evidenceRecordIds: string[];
  evidenceText: string;
  conceptExplanation: string;
  changeFromPrediction: string;
  furtherQuestions: string;
  updatedAt: number;
}

export interface InquirySession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  sessionId: string;
  inquiryId: InquiryId;
  source: DataSource;
  /** 가져온 자료라면 원래 출처 */
  originalSource?: DataSource;
  createdAt: number;
  updatedAt: number;
  stage: Stage;
  completedAt: number | null;
  prediction: Prediction | null;
  records: ConditionRecord[];
  observationNotes: string;
  explanation: Explanation | null;
  /** 배선 확인 체크리스트 상태 (자동 검증이 아니라 사용자가 직접 확인한 항목) */
  checklist: Record<string, boolean>;
  /** 탐구별 부가 상태 (예: 탐구 2 직선 적합 선택, 탐구 4 전압 측정 여부) */
  extra: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  inquiryId: InquiryId;
  source: DataSource;
  stage: Stage;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  recordCount: number;
  hasPrediction: boolean;
}

export function summarize(s: InquirySession): SessionSummary {
  return {
    sessionId: s.sessionId,
    inquiryId: s.inquiryId,
    source: s.source,
    stage: s.stage,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    completedAt: s.completedAt,
    recordCount: s.records.length,
    hasPrediction: !!s.prediction,
  };
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  live: '실측',
  mock: '모의 데이터',
  imported: '가져온 자료',
};
