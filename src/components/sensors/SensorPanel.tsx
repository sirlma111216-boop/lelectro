/**
 * 센서 연결 패널. SDK 는 직접 다루지 않고 sensorManager 만 호출한다.
 * 연결 버튼 클릭 → 곧바로 장치 선택창 (사용자 제스처 유지).
 */
import { useState } from 'react';
import { sensorManager } from '@/sensors/SensorManager';
import { useSensorManager } from '@/sensors/useSensorManager';
import { detectBluetoothCapability } from '@/sensors/capability';
import { SensorError } from '@/sensors/errors';
import { findProfile } from '@/sensors/deviceProfiles';
import type { ManagedDevice, SensorErrorInfo, SensorRole } from '@/sensors/types';
import { Notice } from '@/components/common/Notice';
import { SourceBadge } from '@/components/common/SourceBadge';
import { LiveValue } from './LiveValue';

const STATE_LABEL: Record<ManagedDevice['state'], string> = {
  connecting: '연결 중',
  connected: '연결됨',
  measuring: '측정 중',
  disconnected: '연결 끊김',
  error: '오류',
};

function ErrorBox({ err }: { err: SensorErrorInfo }) {
  return (
    <Notice kind={err.code === 'user_cancelled' ? 'plain' : 'danger'} title={err.message}>
      <p>{err.hint}</p>
      {err.busyPossible && <p className="muted">다른 앱(예: Vernier Graphical Analysis)이나 다른 기기가 이 센서를 사용 중이면 연결되지 않습니다.</p>}
      {err.cause && <p className="faint mono" style={{ fontSize: '0.75rem' }}>원인: {err.cause}</p>}
    </Notice>
  );
}

function DeviceCard({ device, onError }: { device: ManagedDevice; onError: (e: SensorErrorInfo | null) => void }) {
  const [busy, setBusy] = useState(false);
  const profile = findProfile(device.info.orderCode, device.info.name);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof SensorError ? err.info : { code: 'unknown', message: String(err), hint: '', busyPossible: false });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`device-card ${device.role}`} data-testid={`device-card-${device.role}`}>
      <div className="row row-between">
        <div className="row">
          <span className={`state-dot ${device.state}`} />
          <strong>{device.alias}</strong>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {device.info.name} · {device.info.orderCode || '주문코드 미확인'} · SN {device.info.serialNumber || '—'}
          </span>
          <SourceBadge source={device.info.source} />
        </div>
        <span className="badge">{STATE_LABEL[device.state]}</span>
      </div>
      <div className="grid grid-2" style={{ marginTop: 10 }}>
        <div className="stack stack-sm">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor={`alias-${device.id}`}>별칭</label>
            <input id={`alias-${device.id}`} type="text" defaultValue={device.alias} onBlur={(e) => sensorManager.setAlias(device.id, e.target.value)} />
          </div>
          {device.info.channels.length > 1 && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`ch-${device.id}`}>채널</label>
              <select
                id={`ch-${device.id}`}
                value={device.channel.number}
                disabled={device.state === 'measuring' || busy}
                onChange={(e) => void run(() => sensorManager.setChannel(device.id, Number(e.target.value)))}
              >
                {device.info.channels.map((c) => (
                  <option key={c.number} value={c.number}>
                    {c.number}: {c.name} [{c.unit}]
                  </option>
                ))}
              </select>
              <div className="help">측정 중에는 바꿀 수 없습니다. 단위가 다른 채널은 역할에 맞지 않아 선택되지 않습니다.</div>
            </div>
          )}
          {profile?.physicalRangeSwitch && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`range-${device.id}`}>센서 본체의 범위 스위치 (직접 확인)</label>
              <select id={`range-${device.id}`} value={device.declaredRange ?? ''} onChange={(e) => sensorManager.setDeclaredRange(device.id, e.target.value || null)}>
                <option value="">— 아직 확인하지 않음 —</option>
                {profile.physicalRangeSwitch.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="help">이 범위는 소프트웨어로 읽거나 바꿀 수 없습니다. 센서 밑면 스위치를 보고 같은 값을 고르세요. 범위 초과 표시에 쓰입니다.</div>
            </div>
          )}
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            채널 목록: {device.info.channels.map((c) => `${c.name}[${c.unit}]`).join(', ')}
            {device.batteryPct !== null ? ` · 배터리 ${device.batteryPct}%` : ''}
          </div>
        </div>
        <div className="stack stack-sm">
          <LiveValue device={device} compact />
          <div className="row">
            {device.state === 'measuring' && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => sensorManager.zero(device.id))} title={profile?.zeroInstruction}>
                영점 맞추기 (앱 오프셋)
              </button>
            )}
            {device.zero && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => sensorManager.clearZero(device.id)}>
                오프셋 해제
              </button>
            )}
            {(device.state === 'connected' || device.state === 'measuring') && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => sensorManager.disconnect(device.id))}>
                연결 해제
              </button>
            )}
            {device.state === 'disconnected' && device.canReconnect && (
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run(() => sensorManager.reconnect(device.id))}>
                재연결
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void run(() => sensorManager.remove(device.id))}>
              목록에서 제거
            </button>
          </div>
          {profile && device.state === 'measuring' && <div className="help muted" style={{ fontSize: '0.78rem' }}>{profile.zeroInstruction} 앱 오프셋은 이 앱 안에서만 적용되며 장치 자체 교정을 바꾸지 않습니다.</div>}
          {device.zero && (
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              적용 오프셋 {device.role === 'current' ? `${(device.zero.offset * 1000).toFixed(3)} mA` : `${device.zero.offset.toFixed(4)} V`} (보정 전 표본 {device.zero.preValues.length}개 평균)
            </div>
          )}
          {device.error && <ErrorBox err={device.error} />}
        </div>
      </div>
    </div>
  );
}

export interface SensorPanelProps {
  requiredRoles: SensorRole[];
  optionalRoles?: SensorRole[];
  /** 이 세션이 쓰는 출처. live 면 Bluetooth, mock 이면 모의 장치 추가 버튼 */
  source: 'live' | 'mock';
  showPreviewControls?: boolean;
}

export function SensorPanel({ requiredRoles, optionalRoles = [], source, showPreviewControls = true }: SensorPanelProps) {
  const snap = useSensorManager();
  const [error, setError] = useState<SensorErrorInfo | null>(null);
  const cap = detectBluetoothCapability();
  const roles: SensorRole[] = Array.from(new Set([...requiredRoles, ...optionalRoles]));
  const visible = snap.devices.filter((d) => d.info.source === source);

  const connect = (role: SensorRole) => {
    setError(null);
    // 클릭 핸들러에서 바로 호출: 앞에 await 를 두지 않는다.
    const p = source === 'live' ? sensorManager.connectBluetooth(role) : sensorManager.addMockDevice(role);
    p.catch((err) => setError(err instanceof SensorError ? err.info : { code: 'unknown', message: String(err), hint: '', busyPossible: false }));
  };

  return (
    <div className="stack">
      {source === 'live' && !cap.canAttempt && (
        <Notice kind="warn" title="이 환경에서는 Bluetooth 센서를 연결할 수 없습니다">
          <p>{cap.reason}</p>
        </Notice>
      )}
      {source === 'live' && cap.canAttempt && (
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
          Web Bluetooth 사용 가능 (API 있음, 안전한 컨텍스트). 실제 연결 성공 여부는 장치를 선택한 뒤에 알 수 있습니다. 센서 전원을 켜고 버튼을 누르면 브라우저 장치 선택창이 열립니다.
        </p>
      )}
      {source === 'mock' && (
        <Notice kind="mock">모의 장치는 실제 센서가 아닙니다. 모의 데이터로 앱 사용법을 연습합니다.</Notice>
      )}
      <div className="row">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            className={`btn btn-lg btn-${role}`}
            disabled={(source === 'live' && !cap.canAttempt) || snap.pending !== null}
            onClick={() => connect(role)}
            data-testid={`connect-${role}`}
          >
            {snap.pending === role ? '장치 선택 중…' : `${role === 'current' ? '전류' : '전압'} 센서 ${source === 'mock' ? '(모의) 추가' : '연결'}`}
            {optionalRoles.includes(role) && !requiredRoles.includes(role) ? ' (선택)' : ''}
          </button>
        ))}
      </div>
      {error && <ErrorBox err={error} />}
      {visible.length === 0 ? (
        <p className="muted">아직 등록된 {source === 'mock' ? '모의 ' : ''}장치가 없습니다.</p>
      ) : (
        <div className="stack">
          {visible.map((d) => (
            <DeviceCard key={d.id} device={d} onError={setError} />
          ))}
        </div>
      )}
      {showPreviewControls && visible.length > 0 && (
        <div className="row">
          {!snap.measuring ? (
            <button type="button" className="btn" onClick={() => void sensorManager.startMeasuring()} data-testid="preview-start">
              실시간 값 보기 시작 (기록하지 않음)
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void sensorManager.stopMeasuring()} data-testid="preview-stop">
              실시간 값 보기 정지
            </button>
          )}
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            요청 주기 {snap.requestedPeriodMs} ms · 준비 화면의 값은 본 실험 데이터에 들어가지 않습니다.
          </span>
        </div>
      )}
    </div>
  );
}
