import type { InquirySession } from '@/poe/types';
import { recordsForSlot } from '@/poe/sessionLogic';
import { relativeDifferencePct } from '@/data/stats';
import { formatMeasurement } from '@/data/units';
import { BarCompare, type Bar } from '@/components/charts/BarCompare';
import { predictedBars } from '@/inquiries/feedbackUtils';

export function Inquiry1Results({ session }: { session: InquirySession }) {
  const slots = ['A', 'B', 'C', 'A2'] as const;
  const bars: Bar[] = [];
  const rows: Array<{ id: string; label: string; mean: number; sd: number; n: number; repeat: number }> = [];
  for (const id of slots) {
    for (const r of recordsForSlot(session, id)) {
      const st = r.stats.current;
      if (!st) continue;
      const label = `${id === 'A2' ? "A′" : id}${r.repeat > 1 ? `#${r.repeat}` : ''}`;
      bars.push({ label, value: st.mean * 1000, sd: st.sd * 1000, color: 'var(--current)' });
      rows.push({ id: r.id, label, mean: st.mean, sd: st.sd, n: st.n, repeat: r.repeat });
    }
  }
  const a = rows.find((r) => r.label.startsWith('A') && !r.label.startsWith('A′'));
  const a2 = rows.find((r) => r.label.startsWith('A′'));
  const b = rows.find((r) => r.label.startsWith('B'));
  const c = rows.find((r) => r.label.startsWith('C'));
  const pred = predictedBars(session, 'bars');
  const predBars: Bar[] = ['A', 'B', 'C'].filter((k) => typeof pred[k] === 'number').map((k) => ({ label: `예상 ${k}`, value: pred[k], color: 'var(--text-faint)', dashed: true }));

  if (rows.length === 0) return <p className="muted">아직 위치별 기록이 없습니다.</p>;

  const cmp = (x?: { mean: number }, y?: { mean: number }) => (x && y ? relativeDifferencePct(x.mean, y.mean) : null);
  return (
    <div className="stack">
      <div className="grid grid-2">
        <div>
          <BarCompare groups={[{ label: '측정: 위치별 평균 전류 (±표준편차)', bars }]} unit="mA" valueFormatter={(v) => v.toFixed(1)} title="위치별 전류" />
        </div>
        <div>
          {predBars.length > 0 ? (
            <BarCompare groups={[{ label: '처음 예측 (상대 크기)', bars: predBars }]} unit="" relative title="처음 예측한 크기 비교" />
          ) : (
            <p className="muted">예측 막대가 없습니다.</p>
          )}
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>비교</th>
            <th className="num">값 1</th>
            <th className="num">값 2</th>
            <th className="num">상대 차이</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A (전구 앞) vs B (전구 뒤)</td>
            <td className="num">{a ? formatMeasurement(a.mean, 'current') : '—'}</td>
            <td className="num">{b ? formatMeasurement(b.mean, 'current') : '—'}</td>
            <td className="num">{cmp(a, b) === null ? '—' : `${cmp(a, b)!.toFixed(1)} %`}</td>
          </tr>
          <tr>
            <td>B (전구 뒤) vs C (돌아가는 구간)</td>
            <td className="num">{b ? formatMeasurement(b.mean, 'current') : '—'}</td>
            <td className="num">{c ? formatMeasurement(c.mean, 'current') : '—'}</td>
            <td className="num">{cmp(b, c) === null ? '—' : `${cmp(b, c)!.toFixed(1)} %`}</td>
          </tr>
          <tr>
            <td>첫 A vs 마지막 A′ (전지·접촉 변화 확인)</td>
            <td className="num">{a ? formatMeasurement(a.mean, 'current') : '—'}</td>
            <td className="num">{a2 ? formatMeasurement(a2.mean, 'current') : '—'}</td>
            <td className="num">{cmp(a, a2) === null ? '—' : `${cmp(a, a2)!.toFixed(1)} %`}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        측정값이 정확히 같지 않다고 해서 바로 “다르다” 는 뜻은 아닙니다. 표준편차(구간 안 값의 흩어짐)와 첫 A·마지막 A′ 의 차이를 함께 보고, 순차 측정으로 생긴 변화인지 생각해 보세요.
      </p>
    </div>
  );
}
