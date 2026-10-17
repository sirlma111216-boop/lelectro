import { APP_VERSION } from '@/app/version';
import type { InquirySession } from '@/poe/types';
import { storage } from '@/storage/db';
import { downloadText, rawSegmentsToCsv, recordsToSummaryCsv } from './csv';
import { exportSessionBundle } from './sessionJson';

function stamp(session: InquirySession): string {
  const d = new Date(session.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function base(session: InquirySession): string {
  const src = session.source === 'mock' ? '모의' : session.source === 'imported' ? '가져옴' : '실측';
  return `탐구${session.inquiryId}_${src}_${stamp(session)}`;
}

export async function exportRawCsv(session: InquirySession) {
  const segments = await storage.loadSegments(session.sessionId);
  downloadText(`${base(session)}_원자료.csv`, rawSegmentsToCsv(session, segments));
}

export function exportSummaryCsv(session: InquirySession) {
  downloadText(`${base(session)}_조건요약.csv`, recordsToSummaryCsv(session));
}

export async function exportJson(session: InquirySession) {
  const segments = await storage.loadSegments(session.sessionId);
  downloadText(`${base(session)}_세션.json`, exportSessionBundle(session, segments, APP_VERSION), 'application/json;charset=utf-8');
}
