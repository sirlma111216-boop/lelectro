import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { INQUIRIES } from '@/inquiries/registry';
import { useSessionStore } from '@/poe/sessionStore';
import { useSettingsStore } from '@/poe/settingsStore';
import { STAGE_LABEL, type InquiryId, type InquirySession } from '@/poe/types';
import { useSensorManager } from '@/sensors/useSensorManager';
import { detectBluetoothCapability } from '@/sensors/capability';
import { Notice } from '@/components/common/Notice';
import { RoleBadge, SourceBadge } from '@/components/common/SourceBadge';

function latestFor(sessions: InquirySession[], id: InquiryId): InquirySession | undefined {
  return sessions.filter((s) => s.inquiryId === id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function HomePage() {
  const navigate = useNavigate();
  const sessionMap = useSessionStore((s) => s.sessions);
  const sessions = useMemo(() => Object.values(sessionMap), [sessionMap]);
  const loaded = useSessionStore((s) => s.loaded);
  const createSession = useSessionStore((s) => s.createSession);
  const settings = useSettingsStore((s) => s.settings);
  const snap = useSensorManager();
  const cap = detectBluetoothCapability();
  const active = snap.devices.filter((d) => d.state === 'connected' || d.state === 'measuring');

  const startNew = (id: InquiryId) => {
    const s = createSession(id, snap.practiceMode ? 'mock' : 'live');
    navigate(`/inquiry/${id}/${s.sessionId}`);
  };

  return (
    <div className="stack">
      <div>
        <h1>전류와 전압 탐구실</h1>
        <p className="muted" style={{ fontSize: '1.05rem' }}>
          Vernier Go Direct 전류·전압 센서를 브라우저에 연결해, 예측(P) → 관찰(O) → 설명(E) 순서로 네 가지 전기 회로 탐구를 진행합니다.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>센서 연결 상태</h3>
          </div>
          {!cap.canAttempt && !snap.practiceMode && (
            <Notice kind="warn">
              <p>{cap.reason}</p>
              <p style={{ marginBottom: 0 }}>기록 열람·보고서·연습 모드는 이 환경에서도 사용할 수 있습니다.</p>
            </Notice>
          )}
          {cap.canAttempt && active.length === 0 && <p className="muted">연결된 센서가 없습니다. 각 탐구의 ‘실험 준비’ 화면에서 전류·전압 센서를 연결합니다. 연결은 새로고침 후 자동 복구되지 않습니다.</p>}
          {active.length > 0 && (
            <ul>
              {active.map((d) => (
                <li key={d.id}>
                  <RoleBadge role={d.role} /> {d.alias} — {d.info.name} <SourceBadge source={d.info.source} /> {d.state === 'measuring' ? '(측정 중)' : ''}
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
            지원 장치: Go Direct Current Probe (GDX-CUR), Go Direct Voltage Probe (GDX-VOLT). 구형 유선 Vernier 센서는 별도 인터페이스 없이 Bluetooth 로 직접 연결할 수 없습니다. 데스크톱 Chrome·Edge 에서 HTTPS 로 사용하세요.
          </p>
        </div>
        <div className="card" style={snap.practiceMode ? { borderColor: 'var(--mock)' } : undefined}>
          <div className="card-title">
            <h3>연습 모드</h3>
            {snap.practiceMode && <span className="badge badge-mock">켜짐 · 모의 데이터</span>}
          </div>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            센서가 없을 때 앱 사용법을 익히는 모드입니다. 상단의 ‘연습 모드’ 버튼으로 직접 켜야 하며, 켜진 동안 시작한 탐구는 모의 데이터 세션으로 따로 저장되고 모든 화면과 보고서에 ‘모의 데이터’ 로 표시됩니다. 실측 연결이 실패해도 자동으로 전환되지 않습니다.
          </p>
          <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
            지금 새 탐구를 시작하면 <strong>{snap.practiceMode ? '모의 데이터 세션' : '실측 세션'}</strong>으로 만들어집니다.
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        {INQUIRIES.map((def) => {
          const enabled = settings.enabledInquiries.includes(def.id);
          const latest = loaded ? latestFor(sessions, def.id) : undefined;
          const resumable = latest && !latest.completedAt ? latest : undefined;
          return (
            <div key={def.id} className="card inquiry-card" style={enabled ? undefined : { opacity: 0.55 }} data-testid={`inquiry-card-${def.id}`}>
              <div className="row row-between">
                <span className="num">탐구 {def.id} · {def.curriculum.join(' ')}</span>
                <span className="badge">{latest ? (latest.completedAt ? '완료한 기록 있음' : `진행 중 · ${STAGE_LABEL[latest.stage]}`) : '시작 전'}</span>
              </div>
              <h3>{def.title}</h3>
              <p className="question">{def.question}</p>
              <div className="row">
                {def.requiredSensors.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
                {def.optionalSensors.map((r) => (
                  <span key={r} className="badge">
                    선택: {r === 'current' ? '전류' : '전압'} 센서
                  </span>
                ))}
              </div>
              {!enabled && <p className="muted" style={{ fontSize: '0.85rem' }}>교사용 설정에서 이 탐구를 사용하지 않도록 설정했습니다.</p>}
              <div className="row">
                <button type="button" className="btn btn-primary" disabled={!enabled} onClick={() => startNew(def.id)} data-testid={`start-${def.id}`}>
                  새 탐구 시작
                </button>
                {resumable && (
                  <Link className="btn" to={`/inquiry/${def.id}/${resumable.sessionId}`}>
                    저장한 탐구 이어하기 <SourceBadge source={resumable.source} />
                  </Link>
                )}
                {latest?.completedAt && (
                  <Link className="btn btn-ghost" to={`/report/${latest.sessionId}`}>
                    최근 보고서
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        한 탐구를 끝내지 않아도 다른 탐구를 시작할 수 있습니다. 모든 기록은 이 기기의 브라우저 저장소(IndexedDB)에만 저장되며 외부로 전송되지 않습니다. <Link to="/sessions">저장한 탐구 전체 보기</Link>
      </p>
    </div>
  );
}
