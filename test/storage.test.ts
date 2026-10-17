import { beforeEach, describe, expect, it } from 'vitest';
import { closeDbForTests, storage } from '@/storage/db';
import { createEmptySession, applyPrediction } from '@/poe/sessionLogic';
import type { RecordedSegment } from '@/data/recording';

const seg = (sessionId: string, id: string): RecordedSegment => ({
  schemaVersion: 1,
  segmentId: id,
  sessionId,
  deviceId: 'cur',
  deviceName: 'CUR',
  role: 'current',
  source: 'live',
  channelNumber: 1,
  channelName: 'Current',
  originalUnit: 'A',
  siUnit: 'A',
  declaredRange: '1A',
  zeroOffset: 0,
  periodMs: 100,
  recordingStartedAt: 1000,
  startedAt: 1000,
  endedAt: 2000,
  endReason: 'stopped',
  tRel: [0, 0.1],
  sampleIndex: [0, 1],
  raw: [0.1, 0.1],
  value: [0.1, 0.1],
  flags: [0, 0],
});

describe('IndexedDB 저장·복원', () => {
  beforeEach(async () => {
    await closeDbForTests();
    indexedDB.deleteDatabase('elect-lab');
  });

  it('세션과 구간을 저장하고 다시 읽는다 (새로고침 후 복구 시나리오)', async () => {
    const s = applyPrediction(createEmptySession(1, 'live'), { values: { a: 1 }, reason: 'r', confidence: 3, submittedAt: 1 });
    await storage.saveSession(s);
    await storage.saveSegments([seg(s.sessionId, 'g1'), seg(s.sessionId, 'g2')]);
    await closeDbForTests(); // 새로고침처럼 연결을 끊었다가
    const back = await storage.loadSession(s.sessionId);
    expect(back?.prediction?.initial.values).toEqual({ a: 1 });
    const segs = await storage.loadSegments(s.sessionId);
    expect(segs.map((g) => g.segmentId).sort()).toEqual(['g1', 'g2']);
  });

  it('세션 삭제 시 구간도 함께 삭제된다', async () => {
    const s = createEmptySession(2, 'mock');
    await storage.saveSession(s);
    await storage.saveSegments([seg(s.sessionId, 'x')]);
    await storage.deleteSession(s.sessionId);
    expect(await storage.loadSession(s.sessionId)).toBeUndefined();
    expect(await storage.loadSegments(s.sessionId)).toHaveLength(0);
  });

  it('설정을 저장하고 읽는다', async () => {
    await storage.setSetting('k', { x: 1 });
    expect(await storage.getSetting<{ x: number }>('k')).toEqual({ x: 1 });
  });
});
