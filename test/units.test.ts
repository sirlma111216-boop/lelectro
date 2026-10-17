import { describe, expect, it } from 'vitest';
import { ampsToMilliamps, formatMeasurement, milliampsToAmps, toDisplayValue, toSi, unitFactorToSi } from '@/data/units';

describe('단위 변환', () => {
  it('A ↔ mA 변환이 정확하다', () => {
    expect(ampsToMilliamps(0.1234)).toBeCloseTo(123.4, 10);
    expect(milliampsToAmps(123.4)).toBeCloseTo(0.1234, 10);
    expect(milliampsToAmps(ampsToMilliamps(0.00731))).toBeCloseTo(0.00731, 12);
  });

  it('장치 단위 문자열을 내부 단위로 바꾼다', () => {
    expect(toSi(250, 'mA')).toEqual({ siUnit: 'A', value: 0.25 });
    expect(toSi(0.25, 'A')).toEqual({ siUnit: 'A', value: 0.25 });
    expect(toSi(1500, 'mV')).toEqual({ siUnit: 'V', value: 1.5 });
    expect(toSi(1.5, 'V')).toEqual({ siUnit: 'V', value: 1.5 });
  });

  it('알 수 없는 단위는 null 을 돌려주어 섞이지 않게 한다', () => {
    expect(unitFactorToSi('lux')).toBeNull();
    expect(toSi(3, 'N')).toBeNull();
  });

  it('화면 표시는 전류 mA, 전압 V 로 일관된다', () => {
    expect(toDisplayValue(0.05, 'current')).toBeCloseTo(50);
    expect(toDisplayValue(2.5, 'voltage')).toBe(2.5);
    expect(formatMeasurement(0.05, 'current')).toBe('50.0 mA');
    expect(formatMeasurement(2.5, 'voltage')).toBe('2.500 V');
  });

  it('유효하지 않은 값은 0 과 구분해 — 로 표시한다', () => {
    expect(formatMeasurement(NaN, 'current')).toBe('—');
    expect(formatMeasurement(null, 'voltage')).toBe('—');
    expect(formatMeasurement(0, 'current')).toBe('0.0 mA');
  });
});
