import { describe, expect, it } from 'vitest';
import { rawSegmentsToCsv, recordsToSummaryCsv } from '@/data/csv';
import { exportSessionBundle, parseSessionBundle } from '@/data/sessionJson';
import { addRecord, applyPrediction, createEmptySession } from '@/poe/sessionLogic';
import type { RecordedSegment } from '@/data/recording';

const segment: RecordedSegment = {
  schemaVersion: 1,
  segmentId: 'g1',
  sessionId: 'S',
  deviceId: 'GDX-CUR-MOCK-001',
  deviceName: '전류 센서',
  role: 'current',
  source: 'mock',
  channelNumber: 1,
  channelName: 'Current',
  originalUnit: 'A',
  siUnit: 'A',
  declaredRange: '1A',
  zeroOffset: 0.0002,
  periodMs: 100,
  recordingStartedAt: 1_700_000_000_000,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_001_000,
  endReason: 'stopped',
  tRel: [0, 0.1, 0.2],
  sampleIndex: [0, 1, 2],
  raw: [0.1002, 0.1003, 0.1001],
  value: [0.1, 0.1001, 0.0999],
  flags: [0, 0, 2],
};

function mockSession() {
  let s = createEmptySession(1, 'mock');
  s = { ...s, sessionId: 'S' };
  s = applyPrediction(s, { values: { bars: { A: 7, B: 4, C: 4 } }, reason: '전구가 전류를 쓴다', confidence: 4, submittedAt: 1 });
  s = addRecord(s, {
    id: 'r1',
    slotId: 'A',
    label: 'A: 전구 앞',
    source: 'mock',
    window: { tStart: 0, tEnd: 0.2 },
    segmentIds: ['g1'],
    stats: { current: { mean: 0.1, sd: 0.0001, n: 3, min: 0.0999, max: 0.1001, siUnit: 'A', flags: ['near_range'] } },
    meta: { current: { deviceId: 'GDX-CUR-MOCK-001', deviceName: '전류 센서', channelName: 'Current', originalUnit: 'A', declaredRange: '1A', zeroOffset: 0.0002, periodMs: 100 } },
    note: '한글 메모, 쉼표 포함',
    createdAt: 2,
    warnings: [],
  });
  return s;
}

describe('CSV 내보내기', () => {
  it('원자료 CSV 에 출처·원래 단위·내부 단위·오프셋이 모두 들어간다', () => {
    const csv = rawSegmentsToCsv(mockSession(), [segment]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    const header = lines[0].replace('﻿', '').split(',');
    const row = lines[1].split(',');
    const col = (name: string) => row[header.indexOf(name)];
    expect(col('source')).toBe('mock');
    expect(col('original_unit')).toBe('A');
    expect(col('si_unit')).toBe('A');
    expect(col('raw_value')).toBe('0.1002');
    expect(col('value_si')).toBe('0.1');
    expect(col('app_offset_si')).toBe('0.0002');
    expect(lines[3].split(',')[header.indexOf('flags')]).toBe('near_range');
  });

  it('요약 CSV 는 내부 단위와 표시 단위를 함께 적고 한글·쉼표를 보존한다', () => {
    const csv = recordsToSummaryCsv(mockSession());
    const lines = csv.trimEnd().split('\r\n');
    const header = lines[0].replace('﻿', '').split(',');
    expect(lines[1]).toContain('"한글 메모, 쉼표 포함"');
    expect(lines[1].split(',')[header.indexOf('si_unit')]).toBe('A');
    expect(lines[1].split(',')[header.indexOf('display_unit')]).toBe('mA');
    expect(lines[1].split(',')[header.indexOf('mean_display')]).toBe('100');
    expect(lines[1].split(',')[header.indexOf('source')]).toBe('mock');
  });
});

describe('세션 JSON 내보내기·가져오기', () => {
  it('왕복 후 출처는 imported 가 되고 원래 출처가 보존된다', () => {
    const s = mockSession();
    const json = exportSessionBundle(s, [segment], '0.1.0');
    const res = parseSessionBundle(json);
    expect(res.ok).toBe(true);
    expect(res.session!.source).toBe('imported');
    expect(res.session!.originalSource).toBe('mock');
    expect(res.segments![0].source).toBe('imported');
    expect(res.segments![0].value).toEqual(segment.value);
    expect(res.session!.prediction!.initial.values).toEqual({ bars: { A: 7, B: 4, C: 4 } });
    expect(res.warnings.some((w) => w.includes('모의'))).toBe(true);
  });

  it('구조·단위·버전이 틀리면 거부한다', () => {
    const s = mockSession();
    const bundle = JSON.parse(exportSessionBundle(s, [segment], '0.1.0'));
    expect(parseSessionBundle('{"format":"other"}').ok).toBe(false);
    const badUnit = { ...bundle, segments: [{ ...segment, siUnit: 'V' }] };
    const r1 = parseSessionBundle(JSON.stringify(badUnit));
    expect(r1.ok).toBe(false);
    expect(r1.errors.some((e) => e.includes('단위'))).toBe(true);
    const badVersion = { ...bundle, bundleVersion: 99 };
    expect(parseSessionBundle(JSON.stringify(badVersion)).ok).toBe(false);
    const badArrays = { ...bundle, segments: [{ ...segment, raw: [1] }] };
    expect(parseSessionBundle(JSON.stringify(badArrays)).ok).toBe(false);
    expect(parseSessionBundle('not json').ok).toBe(false);
  });
});
