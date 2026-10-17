import { getInquiry } from '@/inquiries/registry';
import type { InquirySession } from '@/poe/types';
import { STAGE_LABEL } from '@/poe/types';
import { SourceBadge } from '@/components/common/SourceBadge';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { RecordsTable } from '@/components/records/RecordsTable';
import { InquiryResults } from '@/components/results';
import { PredictionView } from '@/components/poe/PredictionView';

export function ReportView({ session }: { session: InquirySession }) {
  const def = getInquiry(session.inquiryId);
  if (!def) return null;
  const usedSlots = def.slots.filter((s) => session.records.some((r) => r.slotId === s.id));
  const recordRoles = def.optionalSensors.length ? (['current', 'voltage'] as const) : def.requiredSensors;
  const ex = session.explanation;
  const feedback = def.feedback(session);
  return (
    <article className="report" data-testid={`report-${session.sessionId}`}>
      <header style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="badge">탐구 {def.id}</span>
          {def.curriculum.map((c) => (
            <span key={c} className="badge">
              {c}
            </span>
          ))}
          <SourceBadge source={session.source} big />
        </div>
        <h2 style={{ marginTop: 6 }}>{def.title}</h2>
        <p className="muted">핵심 질문: {def.question}</p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          시작 {new Date(session.createdAt).toLocaleString('ko-KR')} · 마지막 수정 {new Date(session.updatedAt).toLocaleString('ko-KR')} · 상태 {session.completedAt ? '완료' : STAGE_LABEL[session.stage]}
          {session.source === 'mock' && ' · 이 보고서의 모든 측정값은 모의 데이터입니다'}
          {session.source === 'imported' && ` · 가져온 자료 (원래 출처: ${session.originalSource === 'mock' ? '모의 데이터' : session.originalSource === 'live' ? '실측' : '알 수 없음'})`}
        </p>
      </header>

      <section>
        <h3>1. 예측 (P)</h3>
        {session.prediction ? (
          <>
            <PredictionView def={def} entry={session.prediction.initial} title="최초 예측" />
            {session.prediction.revisions.map((r, i) => (
              <div key={r.submittedAt} style={{ marginTop: 6 }}>
                <PredictionView def={def} entry={r} title={`수정 ${i + 1}`} />
              </div>
            ))}
          </>
        ) : (
          <p className="muted">예측 없음</p>
        )}
      </section>

      <section>
        <h3>2. 실험 회로와 측정 위치</h3>
        <div className="grid grid-2">
          {(usedSlots.length ? usedSlots : def.slots.slice(0, 1)).slice(0, 4).map((s) => (
            <div key={s.id}>
              <CircuitDiagram spec={s.diagram} />
              <p className="circuit-caption">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>3. 관찰 결과 (O)</h3>
        <InquiryResults session={session} readOnly />
        <h4 style={{ marginTop: 10 }}>기록표</h4>
        <RecordsTable records={session.records} roles={[...recordRoles]} />
        {session.observationNotes && (
          <>
            <h4 style={{ marginTop: 10 }}>관찰 메모</h4>
            <div className="report-answer">{session.observationNotes}</div>
          </>
        )}
      </section>

      <section>
        <h3>4. 설명 (E)</h3>
        {ex ? (
          <div className="stack stack-sm">
            {[
              ['나의 주장', ex.claim],
              ['뒷받침하는 측정 근거', ex.evidenceText],
              ['과학 개념을 이용한 설명', ex.conceptExplanation],
              ['처음 예측과 달라진 점', ex.changeFromPrediction],
              ['추가로 확인하고 싶은 점', ex.furtherQuestions],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {k}
                </div>
                <div className="report-answer">{v || '—'}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">설명 없음</p>
        )}
        {feedback.length > 0 && (
          <>
            <h4 style={{ marginTop: 10 }}>생각해 볼 질문 (규칙 기반)</h4>
            <ul>
              {feedback.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="faint" style={{ fontSize: '0.75rem' }}>
        전류와 전압 탐구실 · 2022 개정 교육과정 {def.curriculum.join(', ')} 참고 · 교육부·Vernier 공식 인증 앱이 아님 · 세션 {session.sessionId}
      </p>
    </article>
  );
}
