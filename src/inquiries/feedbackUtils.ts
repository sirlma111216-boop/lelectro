import { relativeDifferencePct } from '@/data/stats';
import { latestPrediction, meanOf } from '@/poe/sessionLogic';
import type { InquirySession } from '@/poe/types';

export function predicted(session: InquirySession, fieldId: string): unknown {
  return latestPrediction(session)?.values[fieldId];
}

export function predictedText(session: InquirySession, fieldId: string): string {
  const v = predicted(session, fieldId);
  return typeof v === 'string' ? v : '';
}

export function predictedBars(session: InquirySession, fieldId: string): Record<string, number> {
  const v = predicted(session, fieldId);
  if (v && typeof v === 'object') {
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'number') out[k] = val;
    }
    return out;
  }
  return {};
}

export { meanOf, relativeDifferencePct };

/** 두 평균이 허용 차이 안인지 */
export function closeEnough(a: number | null, b: number | null, tolPct: number): boolean | null {
  if (a === null || b === null) return null;
  const d = relativeDifferencePct(a, b);
  if (d === null) return null;
  return d <= tolPct;
}

export function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}
