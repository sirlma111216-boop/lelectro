/**
 * 세션 JSON 내보내기·가져오기.
 * 가져올 때 구조·단위·버전을 검증하고, 출처를 'imported' 로 바꾼다 (원래 출처는 보존).
 */
import type { DataSource, SensorRole, SiUnit } from '@/sensors/types';
import { SESSION_SCHEMA_VERSION, type InquirySession, type ConditionRecord } from '@/poe/types';
import { SEGMENT_SCHEMA_VERSION, type RecordedSegment } from './recording';

export const BUNDLE_FORMAT = 'elect-lab-session' as const;
export const BUNDLE_VERSION = 1 as const;

export interface SessionBundle {
  format: typeof BUNDLE_FORMAT;
  bundleVersion: typeof BUNDLE_VERSION;
  exportedAt: string;
  app: { name: string; version: string };
  session: InquirySession;
  segments: RecordedSegment[];
}

export function exportSessionBundle(session: InquirySession, segments: RecordedSegment[], appVersion: string): string {
  const bundle: SessionBundle = {
    format: BUNDLE_FORMAT,
    bundleVersion: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'elect-lab', version: appVersion },
    session,
    segments,
  };
  return JSON.stringify(bundle, null, 2);
}

export interface ImportResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  session?: InquirySession;
  segments?: RecordedSegment[];
}

const VALID_SOURCES: DataSource[] = ['live', 'mock', 'imported'];
const VALID_ROLES: SensorRole[] = ['current', 'voltage'];
const VALID_SI: SiUnit[] = ['A', 'V'];
const VALID_STAGES = ['prep', 'predict', 'observe', 'explain', 'summary'];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function isNumArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function validateRecord(r: unknown, i: number, errors: string[]) {
  if (!isObj(r)) {
    errors.push(`records[${i}] 이 객체가 아닙니다.`);
    return;
  }
  if (typeof r.id !== 'string' || typeof r.slotId !== 'string') errors.push(`records[${i}] id/slotId 누락`);
  if (!VALID_SOURCES.includes(r.source as DataSource)) errors.push(`records[${i}] source 가 올바르지 않습니다.`);
  if (!isObj(r.window) || typeof r.window.tStart !== 'number' || typeof r.window.tEnd !== 'number') {
    errors.push(`records[${i}] window 누락`);
  }
  if (!isObj(r.stats)) {
    errors.push(`records[${i}] stats 누락`);
  } else {
    for (const [role, st] of Object.entries(r.stats)) {
      if (!VALID_ROLES.includes(role as SensorRole)) errors.push(`records[${i}] 알 수 없는 역할 ${role}`);
      if (!isObj(st) || typeof st.mean !== 'number' || typeof st.n !== 'number') {
        errors.push(`records[${i}].stats.${role} 형식 오류`);
      } else {
        const expected = role === 'current' ? 'A' : 'V';
        if (st.siUnit !== expected) errors.push(`records[${i}].stats.${role} 단위가 ${expected} 가 아닙니다 (${String(st.siUnit)}).`);
      }
    }
  }
}

function validateSegment(s: unknown, i: number, errors: string[]) {
  if (!isObj(s)) {
    errors.push(`segments[${i}] 이 객체가 아닙니다.`);
    return;
  }
  if (s.schemaVersion !== SEGMENT_SCHEMA_VERSION) errors.push(`segments[${i}] schemaVersion 이 ${SEGMENT_SCHEMA_VERSION} 이 아닙니다.`);
  if (typeof s.segmentId !== 'string' || typeof s.sessionId !== 'string') errors.push(`segments[${i}] id 누락`);
  if (!VALID_ROLES.includes(s.role as SensorRole)) errors.push(`segments[${i}] role 오류`);
  if (!VALID_SOURCES.includes(s.source as DataSource)) errors.push(`segments[${i}] source 오류`);
  if (!VALID_SI.includes(s.siUnit as SiUnit)) errors.push(`segments[${i}] siUnit 오류`);
  else if ((s.role === 'current' && s.siUnit !== 'A') || (s.role === 'voltage' && s.siUnit !== 'V')) {
    errors.push(`segments[${i}] 역할(${String(s.role)})과 단위(${String(s.siUnit)})가 맞지 않습니다.`);
  }
  if (typeof s.originalUnit !== 'string') errors.push(`segments[${i}] originalUnit 누락`);
  const arrays = ['tRel', 'sampleIndex', 'raw', 'value', 'flags'] as const;
  let len = -1;
  for (const key of arrays) {
    if (!isNumArray(s[key])) {
      errors.push(`segments[${i}].${key} 가 숫자 배열이 아닙니다.`);
    } else {
      if (len === -1) len = (s[key] as number[]).length;
      else if ((s[key] as number[]).length !== len) errors.push(`segments[${i}] 배열 길이가 서로 다릅니다.`);
    }
  }
  if (typeof s.recordingStartedAt !== 'number' || typeof s.startedAt !== 'number') errors.push(`segments[${i}] 시각 누락`);
}

export function parseSessionBundle(text: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON 을 해석할 수 없습니다.'], warnings };
  }
  if (!isObj(data)) return { ok: false, errors: ['최상위가 객체가 아닙니다.'], warnings };
  if (data.format !== BUNDLE_FORMAT) errors.push(`format 이 "${BUNDLE_FORMAT}" 이 아닙니다.`);
  if (data.bundleVersion !== BUNDLE_VERSION) errors.push(`bundleVersion ${String(data.bundleVersion)} 은 지원하지 않습니다 (지원: ${BUNDLE_VERSION}).`);
  const session = data.session;
  if (!isObj(session)) {
    errors.push('session 이 없습니다.');
    return { ok: false, errors, warnings };
  }
  if (session.schemaVersion !== SESSION_SCHEMA_VERSION) errors.push(`session.schemaVersion 이 ${SESSION_SCHEMA_VERSION} 이 아닙니다.`);
  if (typeof session.sessionId !== 'string') errors.push('session.sessionId 누락');
  if (![1, 2, 3, 4].includes(session.inquiryId as number)) errors.push('session.inquiryId 는 1~4 여야 합니다.');
  if (!VALID_SOURCES.includes(session.source as DataSource)) errors.push('session.source 오류');
  if (!VALID_STAGES.includes(session.stage as string)) errors.push('session.stage 오류');
  if (!Array.isArray(session.records)) errors.push('session.records 가 배열이 아닙니다.');
  else session.records.forEach((r, i) => validateRecord(r, i, errors));
  if (session.prediction !== null && session.prediction !== undefined) {
    const p = session.prediction;
    if (!isObj(p) || !isObj(p.initial) || !Array.isArray(p.revisions)) errors.push('session.prediction 형식 오류');
  }
  const segments = data.segments;
  if (!Array.isArray(segments)) errors.push('segments 가 배열이 아닙니다.');
  else segments.forEach((s, i) => validateSegment(s, i, errors));

  if (errors.length > 0) return { ok: false, errors, warnings };

  const typedSession = session as unknown as InquirySession;
  const typedSegments = segments as unknown as RecordedSegment[];
  const sessionIdMismatch = typedSegments.some((s) => s.sessionId !== typedSession.sessionId);
  if (sessionIdMismatch) warnings.push('일부 구간의 sessionId 가 세션과 다릅니다. 세션 id 로 맞춰 가져옵니다.');

  const originalSource = typedSession.originalSource ?? typedSession.source;
  const importedSession: InquirySession = {
    ...typedSession,
    source: 'imported',
    originalSource,
    records: typedSession.records.map((r: ConditionRecord) => ({ ...r, source: 'imported' as const })),
    updatedAt: Date.now(),
  };
  const importedSegments: RecordedSegment[] = typedSegments.map((s) => ({
    ...s,
    sessionId: typedSession.sessionId,
    source: 'imported',
  }));
  if (originalSource === 'mock') warnings.push('원래 출처가 모의 데이터인 자료입니다. 보고서에도 모의 데이터로 표시됩니다.');
  return { ok: true, errors, warnings, session: importedSession, segments: importedSegments };
}
