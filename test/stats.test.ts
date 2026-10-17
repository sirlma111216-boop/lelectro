import { describe, expect, it } from 'vitest';
import { computeStats, linearFit, relativeDifferencePct, valuesInWindow } from '@/data/stats';

describe('구간 통계', () => {
  it('평균과 표본 표준편차를 계산한다', () => {
    const s = computeStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s).not.toBeNull();
    expect(s!.mean).toBe(5);
    expect(s!.sd).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(s!.n).toBe(8);
    expect(s!.min).toBe(2);
    expect(s!.max).toBe(9);
  });

  it('누락값(NaN, null, undefined, Infinity)은 제외한다', () => {
    const s = computeStats([1, NaN, null, 3, undefined, Infinity]);
    expect(s!.n).toBe(2);
    expect(s!.mean).toBe(2);
  });

  it('유효 표본이 없으면 null', () => {
    expect(computeStats([])).toBeNull();
    expect(computeStats([NaN, null])).toBeNull();
  });

  it('표본이 하나면 표준편차는 0', () => {
    expect(computeStats([3])!.sd).toBe(0);
  });

  it('시간 구간 안의 값만 고른다 (경계 포함)', () => {
    const samples = [0, 1, 2, 3, 4].map((t) => ({ tRel: t, value: t * 10 }));
    expect(valuesInWindow(samples, 1, 3)).toEqual([10, 20, 30]);
    expect(valuesInWindow(samples, 3, 1)).toEqual([10, 20, 30]);
  });
});

describe('직선 적합', () => {
  it('원점을 강제하지 않고 절편을 구한다', () => {
    const fit = linearFit([
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(fit!.slope).toBeCloseTo(2);
    expect(fit!.intercept).toBeCloseTo(1);
    expect(fit!.r2).toBeCloseTo(1);
  });

  it('점이 부족하거나 x 가 모두 같으면 null', () => {
    expect(linearFit([{ x: 1, y: 1 }])).toBeNull();
    expect(
      linearFit([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ]),
    ).toBeNull();
  });
});

describe('상대 차이', () => {
  it('큰 값 기준 백분율', () => {
    expect(relativeDifferencePct(100, 95)).toBeCloseTo(5);
    expect(relativeDifferencePct(0, 0)).toBeNull();
  });
});
