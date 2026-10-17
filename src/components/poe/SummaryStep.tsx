import { Link } from 'react-router-dom';
import type { InquiryDefinition } from '@/inquiries/types';
import type { InquirySession } from '@/poe/types';
import { useSessionStore } from '@/poe/sessionStore';
import { exportJson, exportRawCsv, exportSummaryCsv } from '@/data/exporters';
import { Notice } from '@/components/common/Notice';
import { SourceBadge } from '@/components/common/SourceBadge';
import { InquiryResults } from '@/components/results';
import { RecordsTable } from '@/components/records/RecordsTable';
import { PredictionView } from './PredictionView';

export function SummaryStep({ session, def }: { session: InquirySession; def: InquiryDefinition }) {
  const complete = useSessionStore((s) => s.complete);
  const recordRoles = def.optionalSensors.length ? (['current', 'voltage'] as const) : def.requiredSensors;
  const ex = session.explanation;
  return (
    <div className="stack">
      {session.source === 'mock' && <Notice kind="mock">이 탐구는 모의 데이터로 진행되었습니다. 실제 측정이 아닙니다.</Notice>}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>예측</h3>
          </div>
          {session.prediction ? (
            <>
              <PredictionView def={def} entry={session.prediction.initial} title="최초 예측" />
              {session.prediction.revisions.map((r, i) => (
                <div key={r.submittedAt} style={{ marginTop: 8 }}>
                  <PredictionView def={def} entry={r} title={`수정 ${i + 1}`} />
                </div>
              ))}
            </>
          ) : (
            <p className="muted">예측 없음</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>측정 결과</h3>
            <SourceBadge source={session.source} />
          </div>
          <InquiryResults session={session} readOnly />
        </div>
      </div>
      <div className="card">
        <h3>기록표</h3>
        <RecordsTable records={session.records} roles={[...recordRoles]} />
      </div>
      <div className="card">
        <h3>설명</h3>
        {ex ? (
          <dl className="grid grid-2" style={{ margin: 0 }}>
            {[
              ['나의 주장', ex.claim],
              ['측정 근거', ex.evidenceText],
              ['과학 개념 설명', ex.conceptExplanation],
              ['처음 예측과 달라진 점', ex.changeFromPrediction],
              ['더 확인하고 싶은 점', ex.furtherQuestions],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {k}
                </dt>
                <dd className="report-answer" style={{ margin: '4px 0 0' }}>
                  {v || '—'}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">설명 없음</p>
        )}
      </div>
      <div className="card">
        <h3>내보내기와 보고서</h3>
        <div className="row">
          <button type="button" className="btn" onClick={() => void exportRawCsv(session)}>
            원자료 CSV
          </button>
          <button type="button" className="btn" onClick={() => exportSummaryCsv(session)}>
            조건별 요약 CSV
          </button>
          <button type="button" className="btn" onClick={() => void exportJson(session)}>
            세션 JSON (다시 가져오기 가능)
          </button>
          <Link className="btn" to={`/report/${session.sessionId}`}>
            인쇄용 보고서 열기
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
          CSV 는 UTF-8(BOM) 로 저장되어 한글과 단위가 깨지지 않습니다. 값 열은 내부 기준 단위(A, V, s)이며 단위 열이 함께 들어 있습니다.
        </p>
      </div>
      <div className="row row-between">
        <span className="muted">{session.completedAt ? `완료 표시: ${new Date(session.completedAt).toLocaleString('ko-KR')}` : '아직 완료로 표시하지 않았습니다.'}</span>
        <div className="row">
          {!session.completedAt && (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => complete(session.sessionId)} data-testid="complete">
              탐구 완료로 표시
            </button>
          )}
          <Link className="btn" to="/">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
