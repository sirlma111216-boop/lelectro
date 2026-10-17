import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getInquiry } from '@/inquiries/registry';
import { useSession, useSessionStore } from '@/poe/sessionStore';
import { canEnterStage } from '@/poe/sessionLogic';
import { STAGE_LABEL, STAGE_ORDER, type Stage } from '@/poe/types';
import { useSensorManager } from '@/sensors/useSensorManager';
import { Notice } from '@/components/common/Notice';
import { SourceBadge } from '@/components/common/SourceBadge';
import { PrepStep } from '@/components/poe/PrepStep';
import { PredictStep } from '@/components/poe/PredictStep';
import { ObserveStep } from '@/components/poe/ObserveStep';
import { ExplainStep } from '@/components/poe/ExplainStep';
import { SummaryStep } from '@/components/poe/SummaryStep';

export function InquiryPage() {
  const { inquiryId, sessionId } = useParams();
  const def = getInquiry(inquiryId);
  const session = useSession(sessionId);
  const loaded = useSessionStore((s) => s.loaded);
  const setStage = useSessionStore((s) => s.setStage);
  const snap = useSensorManager();

  if (!def) return <Notice kind="danger">존재하지 않는 탐구입니다. <Link to="/">홈으로</Link></Notice>;
  if (!loaded) return <p className="muted">기록을 불러오는 중…</p>;
  if (!session) {
    return (
      <Notice kind="warn" title="세션을 찾을 수 없습니다">
        <p>저장된 탐구 기록이 없거나 삭제되었습니다.</p>
        <Link className="btn" to="/">
          홈으로
        </Link>
      </Notice>
    );
  }
  if (session.inquiryId !== def.id) return <Notice kind="danger">세션과 탐구가 맞지 않습니다.</Notice>;

  const stageViews: Record<Stage, ReactElement> = {
    prep: <PrepStep session={session} def={def} />,
    predict: <PredictStep session={session} def={def} />,
    observe: <ObserveStep session={session} def={def} />,
    explain: <ExplainStep session={session} def={def} />,
    summary: <SummaryStep session={session} def={def} />,
  };

  const modeMismatch = (session.source === 'mock' && !snap.practiceMode) || (session.source === 'live' && snap.practiceMode);

  return (
    <div className="stack">
      <div className="card">
        <div className="row row-between">
          <div>
            <div className="row" style={{ marginBottom: 4 }}>
              <span className="badge">탐구 {def.id}</span>
              {def.curriculum.map((c) => (
                <span key={c} className="badge">
                  {c}
                </span>
              ))}
              <SourceBadge source={session.source} />
              {session.completedAt && <span className="badge badge-ok">완료</span>}
            </div>
            <h1 style={{ marginBottom: 4 }}>{def.title}</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              핵심 질문: {def.question}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              현재 단계
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }} data-testid="current-stage">
              {STAGE_LABEL[session.stage]}
            </div>
          </div>
        </div>
        <nav className="stage-nav" aria-label="POE 단계" style={{ marginTop: 12 }}>
          {STAGE_ORDER.map((st) => {
            const check = canEnterStage(session, st);
            return (
              <button
                key={st}
                type="button"
                className={session.stage === st ? 'current' : ''}
                disabled={!check.ok}
                title={check.ok ? undefined : check.reason}
                onClick={() => setStage(session.sessionId, st)}
                aria-current={session.stage === st ? 'step' : undefined}
                data-testid={`stage-${st}`}
              >
                {STAGE_LABEL[st]}
              </button>
            );
          })}
        </nav>
        {modeMismatch && session.source !== 'imported' && (
          <Notice kind="warn" className="" title={session.source === 'mock' ? '이 탐구는 모의 데이터 세션입니다' : '이 탐구는 실측 세션입니다'}>
            <p>
              {session.source === 'mock'
                ? '모의 센서를 쓰려면 상단의 연습 모드를 켜세요. 실측 센서의 값은 이 세션에 기록되지 않습니다.'
                : '연습 모드가 켜져 있습니다. 실제 센서로 기록하려면 연습 모드를 끄세요. 모의 데이터는 이 세션에 기록되지 않습니다.'}
            </p>
          </Notice>
        )}
      </div>
      {stageViews[session.stage]}
    </div>
  );
}
