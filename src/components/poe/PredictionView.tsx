import type { InquiryDefinition, PredictionField } from '@/inquiries/types';
import type { PredictionEntry } from '@/poe/types';

const CONFIDENCE_LABEL = ['', '전혀 확신 없음', '조금 확신', '보통', '꽤 확신', '매우 확신'];

function fieldValueText(field: PredictionField, value: unknown): string {
  switch (field.type) {
    case 'choice': {
      const opt = field.options.find((o) => o.value === value);
      return opt ? opt.label : '(선택 안 함)';
    }
    case 'text':
      return typeof value === 'string' && value.trim() ? value : '(작성 안 함)';
    case 'bars': {
      if (!value || typeof value !== 'object') return '(입력 안 함)';
      const v = value as Record<string, number>;
      return field.items.map((it) => `${it.label}: ${v[it.id] ?? '—'}`).join(' · ');
    }
    case 'graph-points': {
      if (!Array.isArray(value) || value.length === 0) return '(점 없음)';
      return (value as Array<{ x: number; y: number }>).map((p) => `(${p.x}, ${p.y})`).join(' ');
    }
    default:
      return '';
  }
}

export function PredictionView({ def, entry, title }: { def: InquiryDefinition; entry: PredictionEntry; title: string }) {
  return (
    <div className="panel">
      <div className="row row-between">
        <strong>{title}</strong>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {new Date(entry.submittedAt).toLocaleString('ko-KR')} · 확신 정도: {CONFIDENCE_LABEL[entry.confidence] ?? entry.confidence}
        </span>
      </div>
      <dl style={{ margin: '8px 0 0', fontSize: '0.92rem' }}>
        {def.predictionFields.map((f) => (
          <div key={f.id} style={{ marginBottom: 6 }}>
            <dt className="muted" style={{ fontSize: '0.8rem' }}>
              {f.label}
            </dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{fieldValueText(f, entry.values[f.id])}</dd>
          </div>
        ))}
        <div>
          <dt className="muted" style={{ fontSize: '0.8rem' }}>
            예측 이유
          </dt>
          <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.reason || '(작성 안 함)'}</dd>
        </div>
      </dl>
    </div>
  );
}

export { CONFIDENCE_LABEL };
