import { describe, expect, it } from 'vitest';
import { INQUIRIES, getInquiry } from '@/inquiries/registry';
import { inquiry1 } from '@/inquiries/inquiry1';
import { inquiry3 } from '@/inquiries/inquiry3';
import { addRecord, applyPrediction, createEmptySession } from '@/poe/sessionLogic';
import type { ConditionRecord } from '@/poe/types';

function rec(slotId: string, role: 'current' | 'voltage', mean: number): Omit<ConditionRecord, 'repeat'> {
  return {
    id: `${slotId}-${mean}`,
    slotId,
    label: slotId,
    source: 'mock',
    window: { tStart: 0, tEnd: 1 },
    segmentIds: [],
    stats: { [role]: { mean, sd: 0.001, n: 10, min: mean, max: mean, siUnit: role === 'current' ? 'A' : 'V', flags: [] } },
    meta: {},
    note: '',
    createdAt: 1,
    warnings: [],
  };
}

describe('탐구 정의', () => {
  it('네 탐구가 모두 등록되어 있고 슬롯 id 가 중복되지 않는다', () => {
    expect(INQUIRIES.map((q) => q.id)).toEqual([1, 2, 3, 4]);
    for (const q of INQUIRIES) {
      const ids = q.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(q.curriculum.every((c) => /^\[9과14-0[23]\]$/.test(c))).toBe(true);
    }
    expect(getInquiry('2')?.slug).toBe('voltage-current');
  });
});

describe('규칙 기반 피드백 (질문형, 정오 판정 아님)', () => {
  it('탐구 1: 예측은 B 가 작다고 했는데 측정이 같으면 전류/에너지 구분 질문을 낸다', () => {
    let s = applyPrediction(createEmptySession(1, 'mock'), { values: { bars: { A: 8, B: 4, C: 4 }, claim_stance: 'agree', claim_reason: '전류가 소모된다' }, reason: 'x', confidence: 4, submittedAt: 1 });
    s = addRecord(s, rec('A', 'current', 0.2));
    s = addRecord(s, rec('B', 'current', 0.199));
    const fb = inquiry1.feedback(s);
    expect(fb.some((q) => q.includes('전류일까요'))).toBe(true);
    expect(fb.some((q) => q.includes('소모'))).toBe(true);
    expect(fb.every((q) => !/틀렸|오답|감점/.test(q))).toBe(true);
  });

  it('탐구 3: 음수 전압이 있으면 클립 방향 확인 질문을 낸다', () => {
    let s = applyPrediction(createEmptySession(3, 'mock'), { values: {}, reason: 'x', confidence: 3, submittedAt: 1 });
    s = addRecord(s, rec('A-V1', 'voltage', -1.5));
    s = addRecord(s, rec('A-V2', 'voltage', 1.5));
    s = addRecord(s, rec('A-Vtotal', 'voltage', 3.0));
    const fb = inquiry3.feedback(s);
    expect(fb.some((q) => q.includes('클립'))).toBe(true);
  });

  it('기록이 없으면 빈 배열 (예측 단계에서 결과를 암시하지 않음)', () => {
    const s = applyPrediction(createEmptySession(4, 'mock'), { values: {}, reason: 'x', confidence: 3, submittedAt: 1 });
    for (const q of INQUIRIES) expect(q.feedback({ ...s, inquiryId: q.id })).toEqual([]);
  });
});
