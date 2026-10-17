import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { APP_NAME, APP_VERSION } from './version';
import { useSensorManager } from '@/sensors/useSensorManager';
import { sensorManager } from '@/sensors/SensorManager';
import { useSessionStore } from '@/poe/sessionStore';
import { Notice } from '@/components/common/Notice';

function SensorStatusChip() {
  const snap = useSensorManager();
  const active = snap.devices.filter((d) => d.state === 'connected' || d.state === 'measuring');
  const current = active.filter((d) => d.role === 'current').length;
  const voltage = active.filter((d) => d.role === 'voltage').length;
  const mock = active.some((d) => d.info.source === 'mock');
  return (
    <span className="badge" title="연결된 센서" data-testid="sensor-status">
      <span className={`state-dot ${snap.measuring ? 'measuring' : active.length ? 'connected' : ''}`} />
      {active.length === 0 ? '센서 연결 없음' : `전류 ${current} · 전압 ${voltage}${snap.measuring ? ' · 측정 중' : ''}${mock ? ' · 모의' : ''}`}
    </span>
  );
}

function PracticeToggle() {
  const snap = useSensorManager();
  const on = snap.practiceMode;
  const toggle = () => {
    if (!on) {
      const ok = window.confirm(
        '연습 모드를 켭니다.\n\n연습 모드에서는 실제 센서 대신 모의 데이터를 사용하며, 모든 화면과 보고서에 "모의 데이터" 로 표시됩니다. 실제 측정 실패 시 자동으로 전환되지 않습니다.',
      );
      if (!ok) return;
    }
    sensorManager.setPracticeMode(!on);
  };
  return (
    <button type="button" className={`btn btn-sm ${on ? 'badge-mock' : ''}`} onClick={toggle} data-testid="practice-toggle" aria-pressed={on}>
      {on ? '연습 모드 켜짐 (모의 데이터)' : '연습 모드'}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const snap = useSensorManager();
  const storageError = useSessionStore((s) => s.storageError);
  const clearStorageError = useSessionStore((s) => s.clearStorageError);
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden />
            {APP_NAME}
          </Link>
          <nav className="nav" aria-label="주요 메뉴">
            <NavLink to="/" end>
              홈
            </NavLink>
            <NavLink to="/sessions">저장한 탐구</NavLink>
            <NavLink to="/report/all">통합 보고서</NavLink>
            <NavLink to="/teacher">교사용 설정</NavLink>
          </nav>
          <div className="header-right">
            <SensorStatusChip />
            <PracticeToggle />
          </div>
        </div>
        {snap.practiceMode && <div className="mock-banner">연습 모드 — 지금 보이는 측정값은 모의 데이터입니다. 실제 센서 값이 아닙니다.</div>}
      </header>
      {storageError && (
        <div style={{ maxWidth: 'var(--content-max)', margin: '12px auto 0', padding: '0 16px' }}>
          <Notice kind="danger" title="저장 오류">
            <p>{storageError}</p>
            <button type="button" className="btn btn-sm" onClick={clearStorageError}>
              닫기
            </button>
          </Notice>
        </div>
      )}
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        {APP_NAME} v{APP_VERSION} · 2022 개정 교육과정 중학교 과학 ‘전기와 자기’ [9과14-02], [9과14-03] 참고 · 교육부·Vernier 공식 인증 앱이 아닙니다 · 데이터는 이 기기에만 저장됩니다
      </footer>
    </div>
  );
}
