import type { SensorRole } from '@/sensors/types';
import type { MockCircuitState } from '@/sensors/mock/mockCircuit';
import type { InquiryId, InquirySession } from '@/poe/types';

/** 예측 입력 항목. 각 탐구가 선언적으로 정의하고 공통 예측 화면이 그린다. */
export type PredictionField =
  | {
      id: string;
      type: 'choice';
      label: string;
      options: Array<{ value: string; label: string }>;
      help?: string;
    }
  | { id: string; type: 'text'; label: string; placeholder?: string; help?: string }
  | {
      id: string;
      type: 'bars';
      label: string;
      items: Array<{ id: string; label: string }>;
      help?: string;
    }
  | {
      id: string;
      type: 'graph-points';
      label: string;
      xLabel: string;
      yLabel: string;
      xMax: number;
      yMax: number;
      help?: string;
    };

export type DiagramKey = 'series-lamp' | 'series-resistor' | 'series-two-resistors' | 'parallel-two';

export interface DiagramSpec {
  key: DiagramKey;
  /** 전류 센서를 끼울 위치 */
  currentAt?: 'A' | 'B' | 'C' | 'total' | 'branch1' | 'branch2';
  /** 전압 센서 리드를 물릴 두 점 */
  voltageAcross?: 'r1' | 'r2' | 'total' | 'supply';
  branches?: { b1: boolean; b2: boolean };
  /** 두 저항이 같은지 (그림 라벨용) */
  equalResistors?: boolean;
}

export interface MeasurementSlot {
  id: string;
  label: string;
  shortLabel: string;
  /** 이 슬롯 저장에 꼭 필요한 역할 */
  roles: SensorRole[];
  /** 있으면 함께 저장하는 역할 */
  optionalRoles?: SensorRole[];
  /** 조건 묶음 (예: 같은 저항 / 다른 저항) */
  group?: string;
  groupLabel?: string;
  /** 선택 활동 슬롯 */
  optional?: boolean;
  /** 단계별 배선 안내 */
  steps: string[];
  diagram: DiagramSpec;
  /** 연습 모드에서 이 슬롯을 고르면 적용할 모의 회로 상태 */
  mockPreset?: Partial<MockCircuitState>;
}

export interface ExplanationPrompts {
  claim: string;
  evidence: string;
  concept: string;
  change: string;
  further: string;
}

export interface InquiryDefinition {
  id: InquiryId;
  slug: string;
  title: string;
  question: string;
  curriculum: string[];
  summary: string;
  requiredSensors: SensorRole[];
  optionalSensors: SensorRole[];
  materials: string[];
  safety: string[];
  /** 배선 확인 체크리스트 — 사용자가 직접 확인하는 항목이지 자동 검증이 아니다 */
  setupChecklist: Array<{ id: string; text: string }>;
  predictionIntro: string;
  predictionFields: PredictionField[];
  slots: MeasurementSlot[];
  /** 관찰 중 유의점 */
  observationTips: string[];
  explanationPrompts: ExplanationPrompts;
  /** 힌트(개념 노트). 공개 시점은 교사 설정을 따른다 */
  conceptNotes: string[];
  /** 규칙 기반 질문형 피드백 (외부 AI 없음) */
  feedback: (session: InquirySession) => string[];
  mockDefaults: Partial<MockCircuitState>;
  /** 결과 화면에서 비교에 쓰는 안내 (허용 차이 등) */
  comparisonTolerancePct: number;
}
