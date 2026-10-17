import { describe, expect, it } from 'vitest';
import { addRecord, applyPrediction, canEnterStage, createEmptySession, latestPrediction } from '@/poe/sessionLogic';
import type { ConditionRecord } from '@/poe/types';

const record = (slotId: string, source: 'live' | 'mock' = 'live'): Omit<ConditionRecord, 'repeat'> => ({
  id: `r-${slotId}-${Math.random()}`,
  slotId,
  label: slotId,
  source,
  window: { tStart: 0, tEnd: 2 },
  segmentIds: [],
  stats: { current: { mean: 0.1, sd: 0.001, n: 20, min: 0.099, max: 0.101, siUnit: 'A', flags: [] } },
  meta: {},
  note: '',
  createdAt: Date.now(),
  warnings: [],
});

describe('POE 세션 규칙', () => {
  it('예측 제출 전에는 관찰 단계에 들어갈 수 없고 기록도 저장할 수 없다', () => {
    const s = createEmptySession(1, 'live');
    expect(canEnterStage(s, 'observe').ok).toBe(false);
    expect(() => addRecord(s, record('A'))).toThrow(/예측/);
  });

  it('최초 예측은 보존되고 수정은 이력으로 쌓인다', () => {
    let s = createEmptySession(1, 'live');
    s = applyPrediction(s, { values: { claim_stance: 'agree' }, reason: '전구가 전류를 쓴다', confidence: 4, submittedAt: 1 });
    s = applyPrediction(s, { values: { claim_stance: 'disagree' }, reason: '생각이 바뀜', confidence: 3, submittedAt: 2 });
    expect(s.prediction!.initial.values.claim_stance).toBe('agree');
    expect(s.prediction!.initial.submittedAt).toBe(1);
    expect(s.prediction!.revisions).toHaveLength(1);
    expect(latestPrediction(s)!.values.claim_stance).toBe('disagree');
    expect(canEnterStage(s, 'observe').ok).toBe(true);
  });

  it('같은 슬롯의 반복 측정에 반복 번호를 매긴다', () => {
    let s = applyPrediction(createEmptySession(1, 'live'), { values: {}, reason: 'x', confidence: 3, submittedAt: 1 });
    s = addRecord(s, record('A'));
    s = addRecord(s, record('A'));
    s = addRecord(s, record('B'));
    expect(s.records.map((r) => r.repeat)).toEqual([1, 2, 1]);
  });

  it('모의 데이터 기록은 실측 세션에 저장되지 않는다', () => {
    const s = applyPrediction(createEmptySession(1, 'live'), { values: {}, reason: 'x', confidence: 3, submittedAt: 1 });
    expect(() => addRecord(s, record('A', 'mock'))).toThrow(/출처/);
  });

  it('설명이 없으면 정리 단계에 들어갈 수 없다', () => {
    const s = applyPrediction(createEmptySession(2, 'mock'), { values: {}, reason: 'x', confidence: 3, submittedAt: 1 });
    expect(canEnterStage(s, 'summary').ok).toBe(false);
    expect(canEnterStage(s, 'explain').ok).toBe(true);
  });
});
