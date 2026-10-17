/**
 * CSV 내보내기. 한글이 깨지지 않도록 UTF-8 BOM 을 붙이고 CRLF 를 쓴다.
 * 값 열은 내부 기준 단위(A, V, s)이며 단위 열을 함께 기록한다.
 * 전류는 화면 표시용 mA 열을 따로 둔다.
 */
import type { SensorRole } from '@/sensors/types';
import type { ConditionRecord, InquirySession } from '@/poe/types';
import { bitsToFlags, type RecordedSegment } from './recording';
import { displayUnit, toDisplayValue } from './units';

const BOM = '﻿';
const EOL = '\r\n';

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  return BOM + lines.join(EOL) + EOL;
}

export const RAW_CSV_HEADER = [
  'session_id',
  'inquiry_id',
  'source',
  'segment_id',
  'device_id',
  'device_name',
  'role',
  'channel_number',
  'channel_name',
  't_rel_s',
  'received_at_iso',
  'sample_index',
  'raw_value',
  'original_unit',
  'value_si',
  'si_unit',
  'app_offset_si',
  'flags',
  'declared_range',
  'period_ms',
  'segment_end_reason',
];

export function rawSegmentsToCsv(session: InquirySession, segments: RecordedSegment[]): string {
  const rows: unknown[][] = [];
  for (const seg of segments) {
    for (let k = 0; k < seg.tRel.length; k++) {
      const received = new Date(seg.recordingStartedAt + seg.tRel[k] * 1000).toISOString();
      rows.push([
        session.sessionId,
        session.inquiryId,
        seg.source,
        seg.segmentId,
        seg.deviceId,
        seg.deviceName,
        seg.role,
        seg.channelNumber,
        seg.channelName,
        seg.tRel[k],
        received,
        seg.sampleIndex[k],
        seg.raw[k],
        seg.originalUnit,
        seg.value[k],
        seg.siUnit,
        seg.zeroOffset,
        bitsToFlags(seg.flags[k] ?? 0).join('|'),
        seg.declaredRange ?? '',
        seg.periodMs ?? '',
        seg.endReason ?? '',
      ]);
    }
  }
  return toCsv(RAW_CSV_HEADER, rows);
}

export const SUMMARY_CSV_HEADER = [
  'session_id',
  'inquiry_id',
  'source',
  'record_id',
  'slot_id',
  'label',
  'repeat',
  't_start_s',
  't_end_s',
  'role',
  'mean_si',
  'sd_si',
  'si_unit',
  'mean_display',
  'display_unit',
  'n',
  'min_si',
  'max_si',
  'flags',
  'device_name',
  'channel_name',
  'declared_range',
  'app_offset_si',
  'note',
  'warnings',
  'created_at_iso',
];

export function recordsToSummaryCsv(session: InquirySession, records: ConditionRecord[] = session.records): string {
  const rows: unknown[][] = [];
  for (const r of records) {
    const roles = Object.keys(r.stats) as SensorRole[];
    for (const role of roles) {
      const st = r.stats[role];
      if (!st) continue;
      const meta = r.meta[role];
      rows.push([
        session.sessionId,
        session.inquiryId,
        r.source,
        r.id,
        r.slotId,
        r.label,
        r.repeat,
        r.window.tStart,
        r.window.tEnd,
        role,
        st.mean,
        st.sd,
        st.siUnit,
        toDisplayValue(st.mean, role),
        displayUnit(role),
        st.n,
        st.min,
        st.max,
        st.flags.join('|'),
        meta?.deviceName ?? '',
        meta?.channelName ?? '',
        meta?.declaredRange ?? '',
        meta?.zeroOffset ?? '',
        r.note,
        r.warnings.join(' / '),
        new Date(r.createdAt).toISOString(),
      ]);
    }
  }
  return toCsv(SUMMARY_CSV_HEADER, rows);
}

/** 브라우저에서 파일 다운로드 */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
