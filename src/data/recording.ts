/**
 * 측정 기록 계층.
 * 센서 관리자의 이벤트를 받아 장치별 "구간(segment)" 으로 저장한다.
 * - 연결이 끊기거나 값이 끊기면 구간을 닫고, 다시 값이 오면 새 구간을 연다 (보간 없음).
 * - 세션 출처(live/mock)와 다른 출처의 표본은 거부한다.
 * - 원래 값(raw, 장치 단위)과 보정값(value, 내부 단위)을 함께 보존한다.
 */
import type { DataSource, ManagerEvent, Sample, SampleFlag, SensorRole, SiUnit } from '@/sensors/types';
import { computeStats, type WindowStats } from './stats';

export const SEGMENT_SCHEMA_VERSION = 1 as const;

export type SegmentEndReason = 'stopped' | 'disconnected' | 'timeout' | 'closed';

export const FLAG_BITS: Record<SampleFlag, number> = {
  saturated: 1,
  near_range: 2,
  near_resolution: 4,
};

export function flagsToBits(flags: SampleFlag[]): number {
  return flags.reduce((acc, f) => acc | FLAG_BITS[f], 0);
}
export function bitsToFlags(bits: number): SampleFlag[] {
  return (Object.keys(FLAG_BITS) as SampleFlag[]).filter((f) => (bits & FLAG_BITS[f]) !== 0);
}

export interface RecordedSegment {
  schemaVersion: typeof SEGMENT_SCHEMA_VERSION;
  segmentId: string;
  sessionId: string;
  deviceId: string;
  deviceName: string;
  role: SensorRole;
  source: DataSource;
  channelNumber: number;
  channelName: string;
  originalUnit: string;
  siUnit: SiUnit;
  /** 사용자가 확인한 물리 범위 등 */
  declaredRange: string | null;
  /** 구간 동안 적용된 앱 오프셋 (내부 단위) */
  zeroOffset: number;
  /** 장치가 보고한 적용 측정 주기 (ms). 알 수 없으면 null */
  periodMs: number | null;
  /** 기록 기준 시각 (epoch ms). tRel 은 이 시각 기준 초 */
  recordingStartedAt: number;
  /** 구간 첫 표본 수신 시각 (epoch ms) */
  startedAt: number;
  endedAt: number | null;
  endReason: SegmentEndReason | null;
  /** 상대 시각 (s) — 앱 수신 시각 기준. 장치 시각은 SDK 가 제공하지 않는다. */
  tRel: number[];
  /** 측정 시작 후 표본 순번 (장치 쪽 순서) */
  sampleIndex: number[];
  /** 원래 값 (originalUnit) */
  raw: number[];
  /** 보정값 (siUnit) */
  value: number[];
  /** 플래그 비트 */
  flags: number[];
}

export interface SeriesPoint {
  tRel: number;
  value: number;
  flags: number;
}

export interface RecorderOptions {
  sessionId: string;
  source: DataSource;
  subscribeEvents: (cb: (e: ManagerEvent) => void) => () => void;
  getDeviceMeta: (deviceId: string) => {
    name: string;
    channelName: string;
    declaredRange: string | null;
    periodMs: number | null;
  } | null;
  /** 저장 등 변경 알림 (잦게 호출됨) */
  onChange?: () => void;
  now?: () => number;
  idFactory?: () => string;
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class Recorder {
  private readonly opts: RecorderOptions;
  private segments: RecordedSegment[] = [];
  private open = new Map<string, RecordedSegment>();
  private unsub: (() => void) | null = null;
  private recording = false;
  private recordingStartedAt: number | null;
  private rejectedSamples = 0;
  /** 마지막 저장 이후 바뀐 구간 id */
  private dirty = new Set<string>();

  constructor(opts: RecorderOptions, existing: RecordedSegment[] = []) {
    this.opts = opts;
    this.recordingStartedAt = existing[0]?.recordingStartedAt ?? null;
    this.segments = existing.map((s) => ({ ...s }));
  }

  get isRecording() {
    return this.recording;
  }

  get rejectedCount() {
    return this.rejectedSamples;
  }

  getRecordingStartedAt(): number | null {
    return this.recordingStartedAt;
  }

  /** 기록 시작. 두 번 불러도 구독은 하나만 유지된다. */
  start() {
    if (this.recording) return;
    this.recording = true;
    if (this.recordingStartedAt === null) this.recordingStartedAt = this.now();
    if (!this.unsub) {
      this.unsub = this.opts.subscribeEvents((e) => this.handle(e));
    }
  }

  /** 기록 정지. 열린 구간은 'stopped' 로 닫는다. */
  stop() {
    if (!this.recording) return;
    this.recording = false;
    this.closeAll('stopped');
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
    this.opts.onChange?.();
  }

  dispose() {
    this.stop();
  }

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  private handle(e: ManagerEvent) {
    if (!this.recording) return;
    switch (e.type) {
      case 'sample':
        this.addSample(e.sample);
        break;
      case 'disconnected':
        this.closeFor(e.deviceId, 'disconnected', e.at);
        break;
      case 'stale':
        this.closeFor(e.deviceId, 'timeout', e.at);
        break;
      case 'measurement':
        if (!e.measuring) this.closeAll('stopped', e.at);
        break;
      case 'resumed':
      default:
        break;
    }
  }

  private addSample(s: Sample) {
    if (s.source !== this.opts.source) {
      this.rejectedSamples += 1;
      return;
    }
    let seg = this.open.get(s.deviceId);
    if (!seg) {
      const meta = this.opts.getDeviceMeta(s.deviceId);
      seg = {
        schemaVersion: SEGMENT_SCHEMA_VERSION,
        segmentId: (this.opts.idFactory ?? defaultId)(),
        sessionId: this.opts.sessionId,
        deviceId: s.deviceId,
        deviceName: meta?.name ?? s.deviceId,
        role: s.role,
        source: s.source,
        channelNumber: s.channel,
        channelName: meta?.channelName ?? '',
        originalUnit: s.originalUnit,
        siUnit: s.siUnit,
        declaredRange: meta?.declaredRange ?? null,
        zeroOffset: s.offset,
        periodMs: meta?.periodMs ?? null,
        recordingStartedAt: this.recordingStartedAt ?? s.tReceived,
        startedAt: s.tReceived,
        endedAt: null,
        endReason: null,
        tRel: [],
        sampleIndex: [],
        raw: [],
        value: [],
        flags: [],
      };
      this.open.set(s.deviceId, seg);
      this.segments.push(seg);
    }
    // 채널·단위가 달라진 표본은 같은 구간에 섞지 않는다
    if (seg.channelNumber !== s.channel || seg.originalUnit !== s.originalUnit || seg.zeroOffset !== s.offset) {
      this.closeFor(s.deviceId, 'closed', s.tReceived);
      this.addSample(s);
      return;
    }
    seg.tRel.push((s.tReceived - seg.recordingStartedAt) / 1000);
    seg.sampleIndex.push(s.sampleIndex);
    seg.raw.push(s.rawValue);
    seg.value.push(s.value);
    seg.flags.push(flagsToBits(s.flags));
    this.dirty.add(seg.segmentId);
    this.opts.onChange?.();
  }

  private closeFor(deviceId: string, reason: SegmentEndReason, at = this.now()) {
    const seg = this.open.get(deviceId);
    if (!seg) return;
    seg.endedAt = at;
    seg.endReason = reason;
    this.open.delete(deviceId);
    this.dirty.add(seg.segmentId);
    this.opts.onChange?.();
  }

  /** 저장이 필요한 구간을 돌려주고 dirty 표시를 지운다 */
  takeDirtySegments(): RecordedSegment[] {
    const out = this.segments.filter((s) => this.dirty.has(s.segmentId)).map((s) => ({ ...s }));
    this.dirty.clear();
    return out;
  }

  private closeAll(reason: SegmentEndReason, at = this.now()) {
    for (const id of Array.from(this.open.keys())) this.closeFor(id, reason, at);
  }

  getSegments(): RecordedSegment[] {
    return this.segments.map((s) => ({ ...s }));
  }

  /** 현재 상대 시각 (s) */
  currentTRel(): number {
    if (this.recordingStartedAt === null) return 0;
    return (this.now() - this.recordingStartedAt) / 1000;
  }
}

// ---------- 구간 분석 유틸 ----------

export function segmentsForRole(segments: ReadonlyArray<RecordedSegment>, role: SensorRole): RecordedSegment[] {
  return segments.filter((s) => s.role === role);
}

/** 구간들을 시간순 점 목록으로 (그래프용). 구간 사이는 null 로 끊어 보간하지 않게 한다. */
export function seriesWithGaps(
  segments: ReadonlyArray<RecordedSegment>,
  role: SensorRole,
): { t: number[]; v: Array<number | null> } {
  const segs = segmentsForRole(segments, role).sort((a, b) => a.startedAt - b.startedAt);
  const t: number[] = [];
  const v: Array<number | null> = [];
  segs.forEach((s, i) => {
    if (i > 0 && s.tRel.length > 0) {
      // 끊긴 자리 표시
      t.push(s.tRel[0] - 1e-6);
      v.push(null);
    }
    for (let k = 0; k < s.tRel.length; k++) {
      t.push(s.tRel[k]);
      v.push(s.value[k]);
    }
  });
  return { t, v };
}

export interface WindowAnalysis {
  stats: WindowStats | null;
  /** 구간 안에서 포화·범위 근접 등 플래그가 붙은 표본 수 */
  flaggedCount: number;
  flags: SampleFlag[];
  /** 구간 안에 연결 끊김·수신 중단으로 닫힌 경계가 있는지 */
  interrupted: boolean;
  segmentIds: string[];
}

export function analyzeWindow(
  segments: ReadonlyArray<RecordedSegment>,
  role: SensorRole,
  tStart: number,
  tEnd: number,
): WindowAnalysis {
  const lo = Math.min(tStart, tEnd);
  const hi = Math.max(tStart, tEnd);
  const values: number[] = [];
  let flaggedCount = 0;
  let bits = 0;
  let interrupted = false;
  const segmentIds: string[] = [];
  const roleSegs = segmentsForRole(segments, role).sort((x, y) => x.startedAt - y.startedAt);
  // 끊김(연결 해제·수신 중단) 뒤에 다시 시작한 구간의 시작점이 창 안에 있으면 창 안에 공백이 있는 것이다
  for (let i = 1; i < roleSegs.length; i++) {
    const prev = roleSegs[i - 1];
    const cur = roleSegs[i];
    if (prev.deviceId !== cur.deviceId) continue;
    if (prev.endReason !== 'disconnected' && prev.endReason !== 'timeout') continue;
    const startRel = (cur.startedAt - cur.recordingStartedAt) / 1000;
    if (startRel >= lo && startRel <= hi) interrupted = true;
  }
  for (const seg of roleSegs) {
    let used = false;
    for (let k = 0; k < seg.tRel.length; k++) {
      const t = seg.tRel[k];
      if (t < lo || t > hi) continue;
      used = true;
      values.push(seg.value[k]);
      if (seg.flags[k]) {
        flaggedCount += 1;
        bits |= seg.flags[k];
      }
    }
    if (used) segmentIds.push(seg.segmentId);
    if (seg.endedAt !== null && (seg.endReason === 'disconnected' || seg.endReason === 'timeout')) {
      const tEndRel = (seg.endedAt - seg.recordingStartedAt) / 1000;
      if (tEndRel >= lo && tEndRel <= hi) interrupted = true;
    }
  }
  return { stats: computeStats(values), flaggedCount, flags: bitsToFlags(bits), interrupted, segmentIds };
}

export interface PairedWindowResult {
  ok: boolean;
  reasons: string[];
  byRole: Partial<Record<SensorRole, WindowAnalysis>>;
}

/**
 * 여러 역할(예: 전압+전류)이 같은 시간 구간에서 모두 충분한 유효 표본을 가지는지 확인한다.
 * 두 장치는 완벽히 동기화되지 않으므로(장치 시각 미제공, BLE 수신 지연),
 * 같은 관찰 구간의 평균을 한 쌍으로 쓴다.
 */
export function analyzePairedWindow(
  segments: ReadonlyArray<RecordedSegment>,
  roles: SensorRole[],
  tStart: number,
  tEnd: number,
  minN = 5,
): PairedWindowResult {
  const byRole: Partial<Record<SensorRole, WindowAnalysis>> = {};
  const reasons: string[] = [];
  for (const role of roles) {
    const a = analyzeWindow(segments, role, tStart, tEnd);
    byRole[role] = a;
    const label = role === 'current' ? '전류' : '전압';
    if (!a.stats || a.stats.n < minN) {
      reasons.push(`${label} 유효 표본이 부족합니다 (${a.stats?.n ?? 0}개, 최소 ${minN}개).`);
    }
    if (a.interrupted) {
      reasons.push(`${label} 측정이 이 구간 안에서 끊겼습니다. 끊기지 않은 구간을 고르세요.`);
    }
    if (a.flags.includes('saturated')) {
      reasons.push(`${label} 값이 측정 범위를 넘었습니다(포화). 범위 스위치나 회로를 확인하세요.`);
    }
  }
  return { ok: reasons.length === 0, reasons, byRole };
}
