import { useState } from 'react';
import type { InquiryDefinition, PredictionField } from '@/inquiries/types';
import type { InquirySession, PredictionValues } from '@/poe/types';
import { latestPrediction } from '@/poe/sessionLogic';
import { useSessionStore } from '@/poe/sessionStore';
import { Notice } from '@/components/common/Notice';
import { PredictionGraphInput, type GraphPoint } from '@/components/charts/PredictionGraphInput';
import { BarCompare } from '@/components/charts/BarCompare';
import { CONFIDENCE_LABEL, PredictionView } from './PredictionView';

function FieldInput({ field, value, onChange }: { field: PredictionField; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.type) {
    case 'choice':
      return (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{field.label}</legend>
          <div className="choice-list">
            {field.options.map((o) => (
              <label key={o.value} className={`choice ${value === o.value ? 'selected' : ''}`}>
                <input type="radio" name={field.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
          {field.help && <div className="help">{field.help}</div>}
        </fieldset>
      );
    case 'text':
      return (
        <div className="field">
          <label htmlFor={`pf-${field.id}`}>{field.label}</label>
          <textarea id={`pf-${field.id}`} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          {field.help && <div className="help">{field.help}</div>}
        </div>
      );
    case 'bars': {
      const v = (value && typeof value === 'object' ? (value as Record<string, number>) : {}) as Record<string, number>;
      return (
        <div className="field">
          <label>{field.label}</label>
          <div className="grid grid-2">
            <div className="stack stack-sm">
              {field.items.map((it) => (
                <div key={it.id}>
                  <label htmlFor={`pf-${field.id}-${it.id}`} style={{ fontWeight: 500 }}>
                    {it.label}: {v[it.id] ?? '—'}
                  </label>
                  <input id={`pf-${field.id}-${it.id}`} type="range" min={0} max={10} step={1} value={v[it.id] ?? 5} onChange={(e) => onChange({ ...v, [it.id]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
            <BarCompare
              groups={[{ label: '예상 크기 비교', bars: field.items.map((it) => ({ label: it.label, value: v[it.id] ?? 0, color: 'var(--current)' })) }]}
              unit=""
              relative
              height={220}
            />
          </div>
          {field.help && <div className="help">{field.help}</div>}
        </div>
      );
    }
    case 'graph-points':
      return (
        <div className="field">
          <label>{field.label}</label>
          <PredictionGraphInput value={Array.isArray(value) ? (value as GraphPoint[]) : []} onChange={(pts) => onChange(pts)} xLabel={field.xLabel} yLabel={field.yLabel} xMax={field.xMax} yMax={field.yMax} />
          {field.help && <div className="help">{field.help}</div>}
        </div>
      );
    default:
      return null;
  }
}

function validate(def: InquiryDefinition, values: PredictionValues, reason: string): string[] {
  const errs: string[] = [];
  for (const f of def.predictionFields) {
    const v = values[f.id];
    if (f.type === 'choice' && !v) errs.push(`"${f.label}" 을(를) 선택하세요.`);
    if (f.type === 'bars') {
      const obj = (v ?? {}) as Record<string, number>;
      if (f.items.some((it) => typeof obj[it.id] !== 'number')) errs.push(`"${f.label}" 의 막대를 모두 조정하세요.`);
    }
    if (f.type === 'graph-points' && (!Array.isArray(v) || v.length < 2)) errs.push(`"${f.label}" 에 점을 2개 이상 찍으세요.`);
  }
  if (!reason.trim()) errs.push('예측 이유를 적어 주세요.');
  return errs;
}

export function PredictStep({ session, def }: { session: InquirySession; def: InquiryDefinition }) {
  const submit = useSessionStore((s) => s.submitPrediction);
  const setStage = useSessionStore((s) => s.setStage);
  const latest = latestPrediction(session);
  const [editing, setEditing] = useState(!session.prediction);
  const [values, setValues] = useState<PredictionValues>(() => {
    const init: PredictionValues = { ...(latest?.values ?? {}) };
    // 막대 비교는 모두 같은 높이(5)에서 시작한다 — "같다" 는 예측도 조작 없이 표현할 수 있게
    for (const f of def.predictionFields) {
      if (f.type === 'bars' && !init[f.id]) init[f.id] = Object.fromEntries(f.items.map((it) => [it.id, 5]));
    }
    return init;
  });
  const [reason, setReason] = useState(latest?.reason ?? '');
  const [confidence, setConfidence] = useState(latest?.confidence ?? 3);
  const [errors, setErrors] = useState<string[]>([]);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const onSubmit = () => {
    const errs = validate(def, values, reason);
    setErrors(errs);
    if (errs.length) return;
    submit(session.sessionId, { values, reason: reason.trim(), confidence, submittedAt: Date.now() });
    setEditing(false);
    setJustSubmitted(true);
  };

  return (
    <div className="stack">
      <Notice kind="info" title="예측 (P)">
        <p>{def.predictionIntro}</p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          예측이 틀려도 감점되지 않습니다. 중요한 것은 측정 근거를 바탕으로 설명을 다듬는 과정입니다. 최초 예측은 그대로 보존되고 수정은 별도 이력으로 남습니다.
        </p>
      </Notice>

      {session.prediction && !editing && (
        <div className="card">
          <div className="card-title">
            <h3>제출한 예측</h3>
            {justSubmitted && <span className="badge badge-ok">저장됨</span>}
          </div>
          <PredictionView def={def} entry={session.prediction.initial} title="최초 예측 (보존)" />
          {session.prediction.revisions.map((r, i) => (
            <div key={r.submittedAt} style={{ marginTop: 8 }}>
              <PredictionView def={def} entry={r} title={`수정 ${i + 1}`} />
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setStage(session.sessionId, 'observe')} data-testid="go-observe">
              관찰 단계로 (본 실험 기록 시작)
            </button>
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              예측 수정하기 (이력으로 저장)
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="card">
          <h3>{session.prediction ? '예측 수정' : '나의 예측'}</h3>
          {def.predictionFields.map((f) => (
            <FieldInput key={f.id} field={f} value={values[f.id]} onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))} />
          ))}
          <div className="field">
            <label htmlFor="pred-reason">예측 이유</label>
            <textarea id="pred-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="왜 그렇게 생각했는지, 어떤 경험이나 개념을 근거로 했는지 적어 보자" data-testid="pred-reason" />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>확신 정도</legend>
            <div className="row">
              {[1, 2, 3, 4, 5].map((c) => (
                <label key={c} className={`choice ${confidence === c ? 'selected' : ''}`}>
                  <input type="radio" name="confidence" checked={confidence === c} onChange={() => setConfidence(c)} />
                  {c} · {CONFIDENCE_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>
          {errors.length > 0 && (
            <Notice kind="warn">
              <ul style={{ marginBottom: 0 }}>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-lg" onClick={onSubmit} data-testid="submit-prediction">
              {session.prediction ? '수정 제출' : '예측 제출'}
            </button>
            {session.prediction && (
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                취소
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
