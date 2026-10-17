import { isValidNumber } from './units';

export interface WindowStats {
  mean: number;
  /** 표본 표준편차 (n-1). n=1 이면 0. 센서 정확도나 신뢰구간이 아니라 구간 안 값의 흩어짐이다. */
  sd: number;
  n: number;
  min: number;
  max: number;
}

/** 유효하지 않은 값(NaN, Infinity, null)은 제외하고 통계를 낸다. 유효 표본이 없으면 null. */
export function computeStats(values: ReadonlyArray<number | null | undefined>): WindowStats | null {
  const xs = values.filter(isValidNumber);
  const n = xs.length;
  if (n === 0) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const x of xs) {
    sum += x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const mean = sum / n;
  let ss = 0;
  for (const x of xs) ss += (x - mean) * (x - mean);
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  return { mean, sd, n, min, max };
}

export interface TimedValue {
  tRel: number;
  value: number;
}

export function valuesInWindow(samples: ReadonlyArray<TimedValue>, tStart: number, tEnd: number): number[] {
  const lo = Math.min(tStart, tEnd);
  const hi = Math.max(tStart, tEnd);
  const out: number[] = [];
  for (const s of samples) {
    if (s.tRel >= lo && s.tRel <= hi) out.push(s.value);
  }
  return out;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

/**
 * 최소제곱 직선 적합 (원점을 강제하지 않음). 점이 2개 미만이거나 x 가 모두 같으면 null.
 */
export function linearFit(points: ReadonlyArray<{ x: number; y: number }>): LinearFit | null {
  const pts = points.filter((p) => isValidNumber(p.x) && isValidNumber(p.y));
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) * (p.x - mx);
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

/** 두 평균의 상대 차이 (%) — 비교 안내용. 0 으로 나눌 수 없으면 null */
export function relativeDifferencePct(a: number, b: number): number | null {
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return null;
  return (Math.abs(a - b) / base) * 100;
}
