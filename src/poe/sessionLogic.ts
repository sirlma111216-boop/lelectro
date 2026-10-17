/**
 * 세션 상태 전이 규칙 (순수 함수). 스토어와 테스트가 함께 쓴다.
 */
import type { DataSource } from '@/sensors/types';
import {
  SESSION_SCHEMA_VERSION,
  STAGE_ORDER,
  type ConditionRecord,
  type Explanation,
  type InquiryId,
  type InquirySession,
  type PredictionEntry,
  type Stage,
} from './types';

export function newId(prefix = 's'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptySession(inquiryId: InquiryId, source: DataSource, now = Date.now()): InquirySession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: newId('session'),
    inquiryId,
    source,
    createdAt: now,
    updatedAt: now,
    stage: 'prep',
    completedAt: null,
    prediction: null,
    records: [],
    observationNotes: '',
    explanation: null,
    checklist: {},
    extra: {},
  };
}

/** 어떤 단계로 갈 수 있는지. 관찰(본 실험 기록)은 예측 제출 후에만 가능하다. */
export function canEnterStage(session: InquirySession, stage: Stage): { ok: boolean; reason?: string } {
  switch (stage) {
    case 'prep':
    case 'predict':
      return { ok: true };
    case 'observe':
      if (!session.prediction) return { ok: false, reason: '예측을 먼저 제출해야 본 실험 기록을 시작할 수 있습니다.' };
      return { ok: true };
    case 'explain':
      if (!session.prediction) return { ok: false, reason: '예측을 먼저 제출하세요.' };
      return { ok: true };
    case 'summary':
      if (!session.prediction) return { ok: false, reason: '예측을 먼저 제출하세요.' };
      if (!session.explanation) return { ok: false, reason: '설명을 먼저 작성하세요.' };
      return { ok: true };
    default:
      return { ok: false, reason: '알 수 없는 단계' };
  }
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
export function prevStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage);
  return i > 0 ? STAGE_ORDER[i - 1] : null;
}

/** 최초 예측은 보존하고, 이후 제출은 수정 이력으로 쌓는다. */
export function applyPrediction(session: InquirySession, entry: PredictionEntry): InquirySession {
  const prediction = session.prediction
    ? { initial: session.prediction.initial, revisions: [...session.prediction.revisions, entry] }
    : { initial: entry, revisions: [] };
  return { ...session, prediction, updatedAt: entry.submittedAt };
}

export function latestPrediction(session: InquirySession): PredictionEntry | null {
  if (!session.prediction) return null;
  const revs = session.prediction.revisions;
  return revs.length > 0 ? revs[revs.length - 1] : session.prediction.initial;
}

/** 기록 추가. 예측이 없으면 거부한다. 같은 슬롯의 반복 번호를 자동으로 매긴다. */
export function addRecord(
  session: InquirySession,
  record: Omit<ConditionRecord, 'repeat'> & { repeat?: number },
): InquirySession {
  if (!session.prediction) {
    throw new Error('예측 제출 전에는 본 실험 기록을 저장할 수 없습니다.');
  }
  if (record.source !== session.source && !(session.source === 'imported')) {
    throw new Error(`세션 출처(${session.source})와 다른 출처(${record.source})의 기록은 저장할 수 없습니다.`);
  }
  const repeat = record.repeat ?? session.records.filter((r) => r.slotId === record.slotId).length + 1;
  const full: ConditionRecord = { ...record, repeat };
  return { ...session, records: [...session.records, full], updatedAt: Date.now() };
}

export function updateRecord(session: InquirySession, id: string, patch: Partial<ConditionRecord>): InquirySession {
  return {
    ...session,
    records: session.records.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
    updatedAt: Date.now(),
  };
}

export function removeRecord(session: InquirySession, id: string): InquirySession {
  return { ...session, records: session.records.filter((r) => r.id !== id), updatedAt: Date.now() };
}

export function setExplanation(session: InquirySession, explanation: Explanation): InquirySession {
  return { ...session, explanation, updatedAt: explanation.updatedAt };
}

export function recordsForSlot(session: InquirySession, slotId: string): ConditionRecord[] {
  return session.records.filter((r) => r.slotId === slotId).sort((a, b) => a.repeat - b.repeat);
}

/** 슬롯의 가장 최근 기록의 평균값 (내부 단위). 없으면 null */
export function meanOf(session: InquirySession, slotId: string, role: 'current' | 'voltage', which: 'first' | 'last' = 'last'): number | null {
  const rs = recordsForSlot(session, slotId);
  if (rs.length === 0) return null;
  const r = which === 'first' ? rs[0] : rs[rs.length - 1];
  return r.stats[role]?.mean ?? null;
}
