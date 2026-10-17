import { describe, expect, it } from 'vitest';
import { Recorder, analyzePairedWindow, analyzeWindow, seriesWithGaps } from '@/data/recording';
import type { ManagerEvent, Sample } from '@/sensors/types';

function bus() {
  const listeners = new Set<(e: ManagerEvent) => void>();
  return {
    subscribe: (cb: (e: ManagerEvent) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emit: (e: ManagerEvent) => listeners.forEach((cb) => cb(e)),
    size: () => listeners.size,
  };
}

function sample(partial: Partial<Sample> & { tReceived: number; value: number }): Sample {
  return {
    deviceId: 'cur-1',
    role: 'current',
    source: 'live',
    channel: 1,
    originalUnit: 'A',
    rawValue: partial.value,
    siUnit: 'A',
    offset: 0,
    sampleIndex: 0,
    flags: [],
    ...partial,
  };
}

function makeRecorder(b: ReturnType<typeof bus>, source: 'live' | 'mock' = 'live', t0 = 1_000_000) {
  let now = t0;
  const rec = new Recorder({
    sessionId: 'S',
    source,
    subscribeEvents: b.subscribe,
    getDeviceMeta: () => ({ name: 'CUR', channelName: 'Current', declaredRange: '1A', periodMs: 100 }),
    now: () => now,
    idFactory: (() => {
      let i = 0;
      return () => `seg-${++i}`;
    })(),
  });
  return { rec, setNow: (t: number) => (now = t), t0 };
}

describe('Recorder', () => {
  it('연결 해제 후에는 새 구간으로 기록하고, 끊긴 사이는 보간하지 않는다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    for (let i = 0; i < 5; i++) b.emit({ type: 'sample', sample: sample({ tReceived: t0 + i * 100, value: 0.1, sampleIndex: i }) });
    b.emit({ type: 'disconnected', deviceId: 'cur-1', at: t0 + 450, whileMeasuring: true });
    // 끊긴 동안 도착한 "오래된" 값은 없어야 하지만, 혹시 도착해도 새 구간으로 간다
    for (let i = 0; i < 3; i++) b.emit({ type: 'sample', sample: sample({ tReceived: t0 + 2000 + i * 100, value: 0.2, sampleIndex: i }) });
    rec.stop();
    const segs = rec.getSegments();
    expect(segs).toHaveLength(2);
    expect(segs[0].endReason).toBe('disconnected');
    expect(segs[0].value).toHaveLength(5);
    expect(segs[1].value).toHaveLength(3);
    expect(segs[1].endReason).toBe('stopped');
    const series = seriesWithGaps(segs, 'current');
    expect(series.v).toContain(null); // 끊김 표시
  });

  it('수신 없음(stale) 이벤트가 오면 구간을 닫는다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.1 }) });
    b.emit({ type: 'stale', deviceId: 'cur-1', at: t0 + 2000 });
    expect(rec.getSegments()[0].endReason).toBe('timeout');
  });

  it('세션 출처와 다른 출처의 표본은 거부한다 (모의 → 실측 혼입 금지)', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b, 'live');
    rec.start();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.1, source: 'mock' }) });
    expect(rec.getSegments()).toHaveLength(0);
    expect(rec.rejectedCount).toBe(1);
  });

  it('기록 정지 후 도착한 표본은 기록되지 않는다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.1 }) });
    rec.stop();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0 + 100, value: 0.9 }) });
    expect(rec.getSegments()[0].value).toEqual([0.1]);
  });

  it('start 를 두 번 불러도 구독은 하나만 유지된다 (중복 구독 방지)', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    rec.start();
    expect(b.size()).toBe(1);
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.1 }) });
    expect(rec.getSegments()[0].value).toHaveLength(1);
    rec.stop();
    expect(b.size()).toBe(0);
  });

  it('채널이나 단위가 바뀐 표본은 같은 구간에 섞이지 않는다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.1, channel: 1, originalUnit: 'A' }) });
    b.emit({ type: 'sample', sample: sample({ tReceived: t0 + 100, value: 100, rawValue: 100, channel: 2, originalUnit: 'mA' }) });
    const segs = rec.getSegments();
    expect(segs).toHaveLength(2);
    expect(segs[0].originalUnit).toBe('A');
    expect(segs[1].originalUnit).toBe('mA');
    expect(segs[1].channelNumber).toBe(2);
  });

  it('원래 값과 보정값을 모두 보존한다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    b.emit({ type: 'sample', sample: sample({ tReceived: t0, value: 0.098, rawValue: 0.1, offset: 0.002 }) });
    const seg = rec.getSegments()[0];
    expect(seg.raw[0]).toBe(0.1);
    expect(seg.value[0]).toBe(0.098);
    expect(seg.zeroOffset).toBe(0.002);
  });
});

describe('공통 안정 구간', () => {
  it('두 센서 모두 충분한 표본이 있어야 쌍 저장이 가능하다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    for (let i = 0; i < 20; i++) {
      b.emit({ type: 'sample', sample: sample({ tReceived: t0 + i * 100, value: 0.02 }) });
      if (i < 3) b.emit({ type: 'sample', sample: sample({ deviceId: 'volt-1', role: 'voltage', siUnit: 'V', originalUnit: 'V', tReceived: t0 + i * 100, value: 2.0 }) });
    }
    rec.stop();
    const segs = rec.getSegments();
    const bad = analyzePairedWindow(segs, ['current', 'voltage'], 0.5, 1.9, 5);
    expect(bad.ok).toBe(false);
    expect(bad.reasons.some((r) => r.includes('전압'))).toBe(true);
    const good = analyzePairedWindow(segs, ['current'], 0.5, 1.9, 5);
    expect(good.ok).toBe(true);
    expect(good.byRole.current!.stats!.n).toBe(15);
  });

  it('구간 안에 끊김이 있으면 저장을 막는다', () => {
    const b = bus();
    const { rec, t0 } = makeRecorder(b);
    rec.start();
    for (let i = 0; i < 10; i++) b.emit({ type: 'sample', sample: sample({ tReceived: t0 + i * 100, value: 0.02 }) });
    b.emit({ type: 'disconnected', deviceId: 'cur-1', at: t0 + 950, whileMeasuring: true });
    for (let i = 0; i < 10; i++) b.emit({ type: 'sample', sample: sample({ tReceived: t0 + 1500 + i * 100, value: 0.02 }) });
    rec.stop();
    const res = analyzePairedWindow(rec.getSegments(), ['current'], 0.5, 2.0, 5);
    expect(res.ok).toBe(false);
    expect(res.reasons.some((r) => r.includes('끊'))).toBe(true);
    const a = analyzeWindow(rec.getSegments(), 'current', 1.6, 2.4);
    expect(a.interrupted).toBe(false);
  });
});
