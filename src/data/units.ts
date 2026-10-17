import type { SiUnit, SensorRole } from '@/sensors/types';

/** 장치 단위 문자열 → 내부 기준 단위 환산 계수. 알 수 없는 단위는 null. */
export function unitFactorToSi(unit: string): { siUnit: SiUnit; factor: number } | null {
  switch (unit.trim()) {
    case 'A':
      return { siUnit: 'A', factor: 1 };
    case 'mA':
      return { siUnit: 'A', factor: 1e-3 };
    case 'V':
      return { siUnit: 'V', factor: 1 };
    case 'mV':
      return { siUnit: 'V', factor: 1e-3 };
    default:
      return null;
  }
}

export function toSi(value: number, unit: string): { siUnit: SiUnit; value: number } | null {
  const f = unitFactorToSi(unit);
  if (!f) return null;
  return { siUnit: f.siUnit, value: value * f.factor };
}

export function ampsToMilliamps(a: number): number {
  return a * 1000;
}
export function milliampsToAmps(mA: number): number {
  return mA / 1000;
}

export function siUnitForRole(role: SensorRole): SiUnit {
  return role === 'current' ? 'A' : 'V';
}

/** 화면 표시 단위: 전류는 mA, 전압은 V */
export function displayUnit(role: SensorRole): 'mA' | 'V' {
  return role === 'current' ? 'mA' : 'V';
}

/** 내부 값(A/V) → 화면 표시 숫자 (전류는 mA 로) */
export function toDisplayValue(value: number, role: SensorRole): number {
  return role === 'current' ? ampsToMilliamps(value) : value;
}

export function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 표시용 포맷. 유효하지 않은 값은 "—" 로 보여 실제 0 과 구분한다.
 */
export function formatMeasurement(value: number | null | undefined, role: SensorRole, digits?: number): string {
  if (!isValidNumber(value)) return '—';
  const shown = toDisplayValue(value, role);
  const d = digits ?? (role === 'current' ? 1 : 3);
  return `${shown.toFixed(d)} ${displayUnit(role)}`;
}

export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (!isValidNumber(value)) return '—';
  return value.toFixed(digits);
}

export function formatSeconds(s: number | null | undefined, digits = 1): string {
  if (!isValidNumber(s)) return '—';
  return `${s.toFixed(digits)} s`;
}
