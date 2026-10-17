import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSessionStore } from '@/poe/sessionStore';
import { Notice } from '@/components/common/Notice';
import { ReportView } from '@/report/ReportView';

export function ReportPage({ all = false }: { all?: boolean }) {
  const { sessionId } = useParams();
  const loaded = useSessionStore((s) => s.loaded);
  const sessionMap = useSessionStore((s) => s.sessions);
  const sessions = useMemo(() => Object.values(sessionMap), [sessionMap]);

  if (!loaded) return <p className="muted">불러오는 중…</p>;

  const list = all ? sessions.filter((s) => s.prediction || s.records.length > 0).sort((a, b) => a.inquiryId - b.inquiryId || a.createdAt - b.createdAt) : sessions.filter((s) => s.sessionId === sessionId);

  if (list.length === 0) {
    return (
      <Notice kind="warn" title="보고서로 만들 기록이 없습니다">
        <Link className="btn" to="/">
          홈으로
        </Link>
      </Notice>
    );
  }

  return (
    <div className="stack">
      <div className="row row-between no-print">
        <h1 style={{ margin: 0 }}>{all ? '네 탐구 통합 보고서' : '탐구 보고서'}</h1>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            인쇄 / PDF 저장
          </button>
          <Link className="btn" to="/sessions">
            저장한 탐구
          </Link>
        </div>
      </div>
      {all && (
        <p className="muted no-print" style={{ fontSize: '0.85rem' }}>
          예측이나 기록이 있는 모든 세션을 탐구 순서로 모았습니다. 모의 데이터 세션과 가져온 자료는 각 보고서 머리에 표시됩니다.
        </p>
      )}
      {list.map((s, i) => (
        <div key={s.sessionId} className={i > 0 ? 'report-page-break' : undefined}>
          <ReportView session={s} />
        </div>
      ))}
    </div>
  );
}
