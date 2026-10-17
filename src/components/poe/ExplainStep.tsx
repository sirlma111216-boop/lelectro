import { useEffect, useRef, useState } from 'react';
import type { InquiryDefinition } from '@/inquiries/types';
import type { Explanation, InquirySession } from '@/poe/types';
import { useSessionStore } from '@/poe/sessionStore';
import { useSettingsStore } from '@/poe/settingsStore';
import { Notice } from '@/components/common/Notice';
import { RecordsTable, describeRecord } from '@/components/records/RecordsTable';
import { InquiryResults } from '@/components/results';
import { ConceptModel } from '@/components/circuits/ConceptModel';
import { PredictionView } from './PredictionView';

const empty = (): Explanation => ({ claim: '', evidenceRecordIds: [], evidenceText: '', conceptExplanation: '', changeFromPrediction: '', furtherQuestions: '', updatedAt: 0 });

export function ExplainStep({ session, def }: { session: InquirySession; def: InquiryDefinition }) {
  const setExplanation = useSessionStore((s) => s.setExplanation);
  const setStage = useSessionStore((s) => s.setStage);
  const hintTiming = useSettingsStore((s) => s.settings.hintTiming);
  const [form, setForm] = useState<Explanation>(session.explanation ?? empty());
  const [saved, setSaved] = useState<boolean>(!!session.explanation);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (patch: Partial<Explanation>) => {
    const next = { ...form, ...patch, updatedAt: Date.now() };
    setForm(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setExplanation(session.sessionId, next);
      setSaved(true);
    }, 500);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toggleEvidence = (id: string) => {
    const has = form.evidenceRecordIds.includes(id);
    update({ evidenceRecordIds: has ? form.evidenceRecordIds.filter((x) => x !== id) : [...form.evidenceRecordIds, id] });
  };
  const quoteSelected = () => {
    const lines = session.records.filter((r) => form.evidenceRecordIds.includes(r.id)).map((r) => `- ${describeRecord(r)}`);
    if (lines.length === 0) return;
    update({ evidenceText: `${form.evidenceText.trim()}${form.evidenceText.trim() ? '\n' : ''}${lines.join('\n')}` });
  };

  const feedback = def.feedback(session);
  const showHints = hintTiming === 'after_prediction' || (hintTiming === 'after_observation' && session.records.length > 0);
  const recordRoles = def.optionalSensors.length ? (['current', 'voltage'] as const) : def.requiredSensors;
  const p = def.explanationPrompts;

  return (
    <div className="stack">
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>관찰 결과 (기록표에서)</h3>
          </div>
          <InquiryResults session={session} />
          <h4 style={{ marginTop: 12 }}>기록표 — 설명에 인용할 측정값을 선택</h4>
          <RecordsTable records={session.records} roles={[...recordRoles]} selectable selectedIds={form.evidenceRecordIds} onToggle={toggleEvidence} compact />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={quoteSelected} disabled={form.evidenceRecordIds.length === 0} data-testid="quote-evidence">
              선택한 측정값을 근거 칸에 인용
            </button>
          </div>
          {session.observationNotes && (
            <>
              <h4 style={{ marginTop: 12 }}>관찰 메모</h4>
              <div className="report-answer">{session.observationNotes}</div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title row-between">
            <h3>설명 (E)</h3>
            <span className={`badge ${saved ? 'badge-ok' : ''}`}>{saved ? '저장됨' : '입력 중…'}</span>
          </div>
          {session.prediction && <PredictionView def={def} entry={session.prediction.initial} title="처음 예측 (비교용)" />}
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="ex-claim">나의 주장</label>
            <textarea id="ex-claim" value={form.claim} onChange={(e) => update({ claim: e.target.value })} placeholder={p.claim} data-testid="ex-claim" />
          </div>
          <div className="field">
            <label htmlFor="ex-evidence">이를 뒷받침하는 측정 근거</label>
            <textarea id="ex-evidence" value={form.evidenceText} onChange={(e) => update({ evidenceText: e.target.value })} placeholder={p.evidence} data-testid="ex-evidence" />
          </div>
          <div className="field">
            <label htmlFor="ex-concept">과학 개념을 이용한 설명</label>
            <textarea id="ex-concept" value={form.conceptExplanation} onChange={(e) => update({ conceptExplanation: e.target.value })} placeholder={p.concept} />
          </div>
          <div className="field">
            <label htmlFor="ex-change">처음 예측과 달라진 점</label>
            <textarea id="ex-change" value={form.changeFromPrediction} onChange={(e) => update({ changeFromPrediction: e.target.value })} placeholder={p.change} />
          </div>
          <div className="field">
            <label htmlFor="ex-further">추가로 확인하고 싶은 점</label>
            <textarea id="ex-further" value={form.furtherQuestions} onChange={(e) => update({ furtherQuestions: e.target.value })} placeholder={p.further} />
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>생각해 볼 질문 (규칙 기반 자동 질문)</h3>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            기록표의 수치와 선택형 예측을 단순한 규칙으로 비교해 만든 질문입니다. 서술형 답변의 뜻을 평가하거나 채점하는 것이 아니며, 예측의 정오를 따지지 않습니다.
          </p>
          {feedback.length === 0 ? (
            <p className="muted">아직 비교할 기록이 충분하지 않습니다.</p>
          ) : (
            <ul>
              {feedback.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>개념 모형과 힌트</h3>
          {showHints ? (
            <>
              <ConceptModel inquiryId={def.id} />
              <ul style={{ marginTop: 8 }}>
                {def.conceptNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          ) : (
            <Notice kind="plain">{hintTiming === 'never' ? '교사 설정에 따라 힌트를 공개하지 않습니다.' : '교사 설정에 따라 관찰 기록을 저장한 뒤에 힌트가 공개됩니다.'}</Notice>
          )}
        </div>
      </div>

      <div className="row row-between">
        <span className="muted">설명은 입력할 때마다 자동 저장됩니다.</span>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!form.claim.trim()}
          onClick={() => {
            setExplanation(session.sessionId, { ...form, updatedAt: Date.now() });
            setStage(session.sessionId, 'summary');
          }}
          data-testid="go-summary"
        >
          탐구 정리로
        </button>
      </div>
    </div>
  );
}
