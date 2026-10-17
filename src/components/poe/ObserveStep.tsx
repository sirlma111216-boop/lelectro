/**
 * 관찰 (O) 단계. 본 실험 기록은 예측 제출 후에만 가능하다.
 * 표본 수집(Recorder, 센서 관리자 이벤트)과 화면 갱신(250ms 묶음)을 분리한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InquiryDefinition, MeasurementSlot } from '@/inquiries/types';
import type { ConditionRecord, InquirySession, RoleMeta, RoleStats } from '@/poe/types';
import type { SensorRole } from '@/sensors/types';
import { useSessionStore } from '@/poe/sessionStore';
import { useSettingsStore } from '@/poe/settingsStore';
import { newId } from '@/poe/sessionLogic';
import { sensorManager } from '@/sensors/SensorManager';
import { useSensorManager } from '@/sensors/useSensorManager';
import { resetMockCircuit, setMockCircuit } from '@/sensors/mock/mockCircuit';
import { Recorder, analyzePairedWindow, seriesWithGaps, type RecordedSegment } from '@/data/recording';
import { storage } from '@/storage/db';
import { formatMeasurement, formatSeconds } from '@/data/units';
import { Notice } from '@/components/common/Notice';
import { SourceBadge } from '@/components/common/SourceBadge';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { TimeChart } from '@/components/charts/TimeChart';
import { LiveValue } from '@/components/sensors/LiveValue';
import { SensorPanel } from '@/components/sensors/SensorPanel';
import { MockControlPanel } from '@/components/sensors/MockControlPanel';
import { RecordsTable } from '@/components/records/RecordsTable';

const LIVE_WINDOW_S = 20;
const UI_REFRESH_MS = 250;
const PERSIST_MS = 2000;

function slotRoles(slot: MeasurementSlot): SensorRole[] {
  return Array.from(new Set([...slot.roles, ...(slot.optionalRoles ?? [])]));
}

export function ObserveStep({ session, def }: { session: InquirySession; def: InquiryDefinition }) {
  const store = useSessionStore();
  const settings = useSettingsStore((s) => s.settings);
  const snap = useSensorManager();
  const source = session.source === 'mock' ? 'mock' : 'live';
  const readOnly = session.source === 'imported';

  const [slotId, setSlotId] = useState<string>(() => def.slots.find((s) => !session.records.some((r) => r.slotId === s.id))?.id ?? def.slots[0].id);
  const slot = def.slots.find((s) => s.id === slotId) ?? def.slots[0];
  const [label, setLabel] = useState(slot.label);
  const [segments, setSegments] = useState<RecordedSegment[]>([]);
  const [ready, setReady] = useState(false);
  const [window_, setWindow] = useState<{ tStart: number; tEnd: number } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState(session.observationNotes);
  const [showSensors, setShowSensors] = useState(false);
  const [recordNote, setRecordNote] = useState('');
  const [tick, setTick] = useState(0);
  const [recording, setRecording] = useState(false);

  const recorderRef = useRef<Recorder | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedByUs = useRef(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    const dirty = rec.takeDirtySegments();
    if (dirty.length === 0) return;
    try {
      await storage.saveSegments(dirty);
    } catch (err) {
      useSessionStore.setState({ storageError: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (!refreshTimer.current) {
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        const rec = recorderRef.current;
        if (rec) setSegments(rec.getSegments());
        setTick((t) => t + 1);
      }, UI_REFRESH_MS);
    }
    if (!persistTimer.current) {
      persistTimer.current = setTimeout(() => {
        persistTimer.current = null;
        void persist();
      }, PERSIST_MS);
    }
  }, [persist]);

  // Recorder 생명주기 (세션당 하나). StrictMode 의 이중 마운트에도 구독은 하나만 남는다.
  useEffect(() => {
    let cancelled = false;
    const sessionId = session.sessionId;
    storage
      .loadSegments(sessionId)
      .catch(() => [] as RecordedSegment[])
      .then((existing) => {
        if (cancelled) return;
        recorderRef.current = new Recorder(
          {
            sessionId,
            source: session.source,
            subscribeEvents: (cb) => sensorManager.subscribeEvents(cb),
            getDeviceMeta: (id) => {
              const d = sensorManager.getDevice(id);
              return d ? { name: `${d.alias} / ${d.info.name}`, channelName: d.channel.name, declaredRange: d.declaredRange, periodMs: d.appliedPeriodMs } : null;
            },
            onChange: scheduleRefresh,
          },
          existing,
        );
        setSegments(existing);
        setReady(true);
        // 준비 화면의 실시간 보기가 켜져 있으면 끈다. 본 실험 기록은 "측정 시작" 으로 명시적으로 시작한다.
        if (sensorManager.isMeasuring()) void sensorManager.stopMeasuring();
      });
    return () => {
      cancelled = true;
      const rec = recorderRef.current;
      if (rec) {
        rec.stop();
        const dirty = rec.takeDirtySegments();
        if (dirty.length) void storage.saveSegments(dirty).catch(() => undefined);
      }
      recorderRef.current = null;
      if (startedByUs.current) {
        startedByUs.current = false;
        void sensorManager.stopMeasuring();
      }
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      refreshTimer.current = null;
      persistTimer.current = null;
    };
  }, [session.sessionId, session.source, scheduleRefresh]);

  // 연습 모드: 탐구 기본 모의 회로 적용, 슬롯 변경 시 프리셋 적용
  useEffect(() => {
    if (source === 'mock') resetMockCircuit(def.mockDefaults);
  }, [source, def]);
  useEffect(() => {
    if (source === 'mock' && slot.mockPreset) setMockCircuit(slot.mockPreset);
    setLabel(slot.label);
    setWindow(null);
  }, [slot, source]);

  // 측정 중 실시간 x 범위 갱신용 틱
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setTick((t) => t + 1), UI_REFRESH_MS);
    return () => clearInterval(id);
  }, [recording]);

  const activeDevices = useMemo(
    () => snap.devices.filter((d) => d.info.source === source && (d.state === 'connected' || d.state === 'measuring' || d.state === 'disconnected' || d.state === 'error')),
    [snap.devices, source],
  );
  const missingRequired = slot.roles.filter((r) => !sensorManager.getActiveDeviceForRole(r, source));
  const availableOptional = (slot.optionalRoles ?? []).filter((r) => !!sensorManager.getActiveDeviceForRole(r, source));

  const start = async () => {
    const rec = recorderRef.current;
    if (!rec || !session.prediction) return;
    setSaveMsg(null);
    rec.start();
    setRecording(true);
    startedByUs.current = true;
    await sensorManager.startMeasuring(settings.defaultPeriodMs);
    scheduleRefresh();
  };
  const stop = async () => {
    await sensorManager.stopMeasuring();
    recorderRef.current?.stop();
    setRecording(false);
    startedByUs.current = false;
    setSegments(recorderRef.current?.getSegments() ?? []);
    void persist();
  };

  const series = useMemo(() => {
    const roles = slotRoles(slot);
    const out: Partial<Record<SensorRole, { t: number[]; v: Array<number | null> }>> = {};
    for (const r of roles) out[r] = seriesWithGaps(segments, r);
    return out;
  }, [segments, slot]);

  const latestT = useMemo(() => {
    let m = 0;
    for (const s of segments) if (s.tRel.length) m = Math.max(m, s.tRel[s.tRel.length - 1]);
    return m;
  }, [segments]);

  const nowRel = recorderRef.current?.currentTRel() ?? latestT;
  const xRange = recording && recorderRef.current?.isRecording ? { min: Math.max(0, nowRel - LIVE_WINDOW_S), max: nowRel + 0.5 } : null;
  void tick;

  const rolesForAnalysis: SensorRole[] = [...slot.roles, ...availableOptional];
  const analysis = useMemo(() => {
    if (!window_) return null;
    const a = analyzePairedWindow(segments, rolesForAnalysis, window_.tStart, window_.tEnd, settings.minSamplesPerWindow);
    // 이미 저장한 기록과 겹치는 구간은 다른 조건의 기록으로 다시 쓰지 않는다
    const overlap = session.records.find((r) => r.window.tStart < window_.tEnd && r.window.tEnd > window_.tStart);
    if (overlap) {
      a.ok = false;
      a.reasons.push(`이 구간은 이미 "${overlap.label}" 기록에 사용되었습니다. 측정을 이어가며 새 구간을 고르세요.`);
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, window_, slot.id, availableOptional.join(','), settings.minSamplesPerWindow, session.records]);

  const quickWindow = (seconds: number) => {
    const end = latestT;
    setWindow({ tStart: Math.max(0, end - seconds), tEnd: end });
  };

  const saveRecord = () => {
    if (!analysis || !analysis.ok || !window_) return;
    const stats: Partial<Record<SensorRole, RoleStats>> = {};
    const meta: Partial<Record<SensorRole, RoleMeta>> = {};
    const warnings: string[] = [];
    const usedSegmentIds = new Set<string>();
    for (const role of rolesForAnalysis) {
      const a = analysis.byRole[role];
      if (!a?.stats) {
        if (slot.roles.includes(role)) return;
        continue;
      }
      stats[role] = { mean: a.stats.mean, sd: a.stats.sd, n: a.stats.n, min: a.stats.min, max: a.stats.max, siUnit: role === 'current' ? 'A' : 'V', flags: a.flags };
      a.segmentIds.forEach((id) => usedSegmentIds.add(id));
      const seg = segments.find((s) => a.segmentIds.includes(s.segmentId) && s.role === role);
      if (seg) {
        meta[role] = { deviceId: seg.deviceId, deviceName: seg.deviceName, channelName: seg.channelName, originalUnit: seg.originalUnit, declaredRange: seg.declaredRange, zeroOffset: seg.zeroOffset, periodMs: seg.periodMs };
        if (role === 'current' && seg.declaredRange === null && source === 'live') warnings.push('전류 센서 범위 스위치 미확인');
      }
      if (a.flags.includes('near_range')) warnings.push(`${role === 'current' ? '전류' : '전압'} 범위 근접 표본 포함`);
      if (a.flags.includes('near_resolution')) warnings.push(`${role === 'current' ? '전류' : '전압'} 값이 센서 해상도 부근`);
    }
    for (const role of slot.optionalRoles ?? []) {
      if (!stats[role]) warnings.push(`${role === 'current' ? '전류' : '전압'}은 측정하지 않음`);
    }
    const record: Omit<ConditionRecord, 'repeat'> = {
      id: newId('rec'),
      slotId: slot.id,
      label: label.trim() || slot.label,
      source: session.source,
      window: { tStart: window_.tStart, tEnd: window_.tEnd },
      segmentIds: Array.from(usedSegmentIds),
      stats,
      meta,
      note: recordNote.trim(),
      createdAt: Date.now(),
      warnings,
    };
    try {
      store.addRecord(session.sessionId, record);
      setSaveMsg(`"${record.label}" 기록을 저장했습니다.`);
      setWindow(null);
      setRecordNote('');
      // 다음 슬롯으로 자동 이동 (반복 측정은 사용자가 다시 선택)
      const idx = def.slots.findIndex((s) => s.id === slot.id);
      const next = def.slots.slice(idx + 1).find((s) => !s.optional);
      if (next) setSlotId(next.id);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const onNotes = (v: string) => {
    setNotes(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => store.setObservationNotes(session.sessionId, v), 400);
  };

  const recordRoles: SensorRole[] = def.optionalSensors.length ? ['current', 'voltage'] : def.requiredSensors;
  const interruptions = segments.filter((s) => s.endReason === 'disconnected' || s.endReason === 'timeout');

  if (!session.prediction) {
    return (
      <Notice kind="warn" title="예측을 먼저 제출하세요">
        <p>본 실험 기록은 예측을 제출한 뒤에 시작할 수 있습니다.</p>
        <button type="button" className="btn btn-primary" onClick={() => store.setStage(session.sessionId, 'predict')}>
          예측 단계로
        </button>
      </Notice>
    );
  }

  return (
    <div className="stack">
      {readOnly && <Notice kind="warn">가져온 자료 세션은 새로 측정할 수 없습니다. 기록표와 그래프만 볼 수 있습니다.</Notice>}
      {source === 'mock' && <Notice kind="mock">연습 모드: 아래 모든 값과 기록은 모의 데이터입니다.</Notice>}

      <div className="observe-layout">
        {/* 왼쪽: 회로도와 측정 위치 */}
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h3>측정 위치 / 조건</h3>
            </div>
            <div className="field">
              <label htmlFor="slot-select">지금 측정할 위치</label>
              <select id="slot-select" value={slot.id} onChange={(e) => setSlotId(e.target.value)} data-testid="slot-select">
                {def.slots.map((s) => {
                  const n = session.records.filter((r) => r.slotId === s.id).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.optional ? ' (선택)' : ''}
                      {n > 0 ? ` — 기록 ${n}개` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <CircuitDiagram spec={slot.diagram} />
            <p className="circuit-caption">실제 회로 안내 그림. 앱에서 그림을 바꿔도 장치는 제어되지 않습니다.</p>
            <h4 style={{ marginTop: 10 }}>배선 순서</h4>
            <ol style={{ fontSize: '0.92rem' }}>
              {slot.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {def.observationTips.length > 0 && (
              <details>
                <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                  관찰 유의점
                </summary>
                <ul style={{ fontSize: '0.85rem' }}>
                  {def.observationTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {source === 'mock' && !readOnly && <MockControlPanel def={def} />}
        </div>

        {/* 오른쪽: 측정값과 실시간 그래프 */}
        <div className="stack">
          <div className="card">
            <div className="card-title row-between">
              <h3>측정</h3>
              <div className="row">
                <SourceBadge source={session.source} />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  요청 주기 {settings.defaultPeriodMs} ms
                </span>
              </div>
            </div>
            {missingRequired.length > 0 && !readOnly && (
              <Notice kind="warn" title="필요한 센서가 연결되어 있지 않습니다">
                <p>이 위치를 측정하려면 {missingRequired.map((r) => (r === 'current' ? '전류 센서' : '전압 센서')).join(', ')}가 필요합니다.</p>
                <button type="button" className="btn btn-sm" onClick={() => setShowSensors((v) => !v)}>
                  {showSensors ? '센서 패널 닫기' : '센서 연결 패널 열기'}
                </button>
              </Notice>
            )}
            {(showSensors || ((activeDevices.length === 0 || missingRequired.length > 0) && !readOnly)) && (
              <div style={{ marginBottom: 12 }}>
                <SensorPanel requiredRoles={def.requiredSensors} optionalRoles={def.optionalSensors} source={source} showPreviewControls={false} />
              </div>
            )}
            {activeDevices.length > 0 && (
              <div className="row" style={{ marginBottom: 12 }}>
                {activeDevices
                  .filter((d) => slotRoles(slot).includes(d.role))
                  .map((d) => (
                    <LiveValue key={d.id} device={d} />
                  ))}
                {activeDevices.length > 0 && !showSensors && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowSensors(true)}>
                    센서 설정
                  </button>
                )}
              </div>
            )}
            {!readOnly && (
              <div className="row">
                {!recording ? (
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => void start()} disabled={!ready || missingRequired.length > 0} data-testid="measure-start">
                    측정 시작
                  </button>
                ) : (
                  <button type="button" className="btn btn-danger btn-lg" onClick={() => void stop()} data-testid="measure-stop">
                    측정 정지
                  </button>
                )}
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  측정 정지는 전원을 끄지 않습니다. 센서를 옮기기 전에 전원을 직접 끄세요.
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title row-between">
              <h3>시간 그래프</h3>
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                그래프를 드래그해 안정 구간을 고르세요
              </span>
            </div>
            {slotRoles(slot).map((role) => {
              const s = series[role];
              if (!s) return null;
              return (
                <div key={role} style={{ marginBottom: 8 }}>
                  <TimeChart role={role} t={s.t} v={s.v} xRange={xRange} window={window_} onSelectWindow={(a, b) => setWindow({ tStart: a, tEnd: b })} />
                </div>
              );
            })}
            {interruptions.length > 0 && (
              <p className="muted" style={{ fontSize: '0.8rem' }}>
                끊긴 구간: {interruptions.map((s) => `${s.role === 'current' ? '전류' : '전압'} ${formatSeconds((s.endedAt! - s.recordingStartedAt) / 1000)} (${s.endReason === 'disconnected' ? '연결 끊김' : '수신 없음'})`).join(', ')} — 끊긴 사이는 보간하지 않고 재연결 후 새 구간으로 기록합니다.
              </p>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>안정 구간 선택과 기록 저장</h3>
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                빠른 선택:
              </span>
              {[2, 3, 5].map((s) => (
                <button key={s} type="button" className="btn btn-sm" onClick={() => quickWindow(s)} disabled={latestT <= 0} data-testid={`quick-window-${s}`}>
                  마지막 {s}초
                </button>
              ))}
              {window_ && (
                <span className="mono" style={{ fontSize: '0.85rem' }}>
                  선택: {formatSeconds(window_.tStart)} ~ {formatSeconds(window_.tEnd)}
                </span>
              )}
            </div>
            {analysis && (
              <div className="stack stack-sm" style={{ marginBottom: 8 }}>
                <div className="row">
                  {rolesForAnalysis.map((role) => {
                    const a = analysis.byRole[role];
                    return (
                      <div key={role} className="panel" style={{ minWidth: 220 }}>
                        <strong style={{ color: role === 'current' ? 'var(--current)' : 'var(--voltage)' }}>{role === 'current' ? '전류' : '전압'}</strong>
                        <div className="mono">
                          평균 {formatMeasurement(a?.stats?.mean, role)} · 표준편차 {formatMeasurement(a?.stats?.sd, role)} · n = {a?.stats?.n ?? 0}
                        </div>
                        {a?.flags.length ? <div className="muted" style={{ fontSize: '0.78rem' }}>플래그: {a.flags.join(', ')}</div> : null}
                      </div>
                    );
                  })}
                </div>
                {!analysis.ok && (
                  <Notice kind="warn">
                    <ul style={{ marginBottom: 0 }}>
                      {analysis.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </div>
            )}
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="cond-label">조건 이름</label>
                <input id="cond-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} data-testid="cond-label" />
              </div>
              <div className="field">
                <label htmlFor="rec-note">이 기록의 메모 (선택)</label>
                <input id="rec-note" type="text" value={recordNote} onChange={(e) => setRecordNote(e.target.value)} placeholder="예: 전지 교체 직후, 접촉 흔들림" />
              </div>
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={saveRecord} disabled={readOnly || !analysis || !analysis.ok} data-testid="save-record">
                이 구간을 기록표에 저장
              </button>
              {saveMsg && <span className="badge badge-ok">{saveMsg}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 기록표와 관찰 메모 */}
      <div className="observe-bottom grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>조건별 기록표</h3>
            <SourceBadge source={session.source} />
          </div>
          <RecordsTable
            records={session.records}
            roles={recordRoles}
            onDelete={readOnly ? undefined : (id) => store.removeRecord(session.sessionId, id)}
            onEditNote={readOnly ? undefined : (id, note) => store.updateRecord(session.sessionId, id, { note })}
          />
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            표준편차는 선택한 구간 안 값의 흩어짐이며 센서의 정확도나 신뢰구간이 아닙니다. 같은 위치를 다시 측정하면 반복 번호가 붙습니다.
          </p>
        </div>
        <div className="card">
          <h3>관찰 메모</h3>
          <textarea value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="본 것, 이상했던 점, 전지·접촉 상태 변화 등을 적어 두자" readOnly={readOnly} data-testid="obs-notes" />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => store.setStage(session.sessionId, 'explain')} data-testid="go-explain">
              설명 단계로
            </button>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              기록은 자동 저장됩니다. 측정 중에도 주기적으로 저장합니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
