import type { InquirySession } from '@/poe/types';
import { meanOf } from '@/poe/sessionLogic';
import { relativeDifferencePct } from '@/data/stats';
import { BarCompare, type BarGroup } from '@/components/charts/BarCompare';
import { formatMeasurement } from '@/data/units';

export function Inquiry4Results({ session }: { session: InquirySession }) {
  const iA = meanOf(session, 'A-Itotal', 'current');
  const vA = meanOf(session, 'A-Itotal', 'voltage');
  const groups: BarGroup[] = [];
  if (iA !== null) groups.push({ label: '조건 A: 가지 하나', bars: [{ label: 'I전체', value: iA * 1000, color: 'var(--current)' }] });
  const rows: Array<{ label: string; it: number | null; i1: number | null; i2: number | null; v: number | null }> = [];
  for (const g of ['B', 'C'] as const) {
    const it = meanOf(session, `${g}-Itotal`, 'current');
    const i1 = meanOf(session, `${g}-I1`, 'current');
    const i2 = meanOf(session, `${g}-I2`, 'current');
    const v = meanOf(session, `${g}-Itotal`, 'voltage') ?? meanOf(session, `${g}-I1`, 'voltage') ?? meanOf(session, `${g}-I2`, 'voltage');
    const label = g === 'B' ? '조건 B: 같은 저항 가지 두 개' : '조건 C: 다른 저항 가지 두 개';
    if (it === null && i1 === null && i2 === null) continue;
    rows.push({ label, it, i1, i2, v });
    const bars: BarGroup['bars'] = [];
    if (i1 !== null || i2 !== null) {
      bars.push({
        label: 'I1 + I2 (쌓음)',
        parts: [
          { label: 'I1', value: (i1 ?? 0) * 1000, color: 'var(--current)' },
          { label: 'I2', value: (i2 ?? 0) * 1000, color: '#fb923c' },
        ],
      });
    }
    if (it !== null) bars.push({ label: 'I전체', value: it * 1000, color: '#7c2d12' });
    groups.push({ label, bars });
  }
  const open1 = meanOf(session, 'B-I1-open2', 'current');
  const b1 = meanOf(session, 'B-I1', 'current');
  const voltageMeasured = vA !== null || rows.some((r) => r.v !== null);

  if (groups.length === 0) return <p className="muted">아직 전류 기록이 없습니다.</p>;
  return (
    <div className="stack">
      <BarCompare groups={groups} unit="mA" valueFormatter={(v) => v.toFixed(1)} title="전체 전류와 가지 전류" height={340} />
      <table className="data">
        <thead>
          <tr>
            <th>조건</th>
            <th className="num">I전체 (mA)</th>
            <th className="num">I1 (mA)</th>
            <th className="num">I2 (mA)</th>
            <th className="num">I1 + I2 (mA)</th>
            <th className="num">차이</th>
            <th className="num">전원 전압 (V)</th>
          </tr>
        </thead>
        <tbody>
          {iA !== null && (
            <tr>
              <td>조건 A: 가지 하나</td>
              <td className="num">{(iA * 1000).toFixed(2)}</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">{vA !== null ? vA.toFixed(3) : '측정 안 함'}</td>
            </tr>
          )}
          {rows.map((r) => {
            const sum = r.i1 !== null && r.i2 !== null ? r.i1 + r.i2 : null;
            const diff = sum !== null && r.it !== null ? relativeDifferencePct(sum, r.it) : null;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.it !== null ? (r.it * 1000).toFixed(2) : '—'}</td>
                <td className="num">{r.i1 !== null ? (r.i1 * 1000).toFixed(2) : '—'}</td>
                <td className="num">{r.i2 !== null ? (r.i2 * 1000).toFixed(2) : '—'}</td>
                <td className="num">{sum !== null ? (sum * 1000).toFixed(2) : '—'}</td>
                <td className="num">{diff === null ? '—' : `${diff.toFixed(1)} %`}</td>
                <td className="num">{r.v !== null ? r.v.toFixed(3) : '측정 안 함'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul style={{ fontSize: '0.9rem' }}>
        {iA !== null && rows[0]?.it !== null && rows[0]?.it !== undefined && (
          <li>
            가지 추가 전후 전체 전류: {formatMeasurement(iA, 'current')} → {formatMeasurement(rows[0].it, 'current')} (조건 A → {rows[0].label.slice(0, 4)})
          </li>
        )}
        {b1 !== null && open1 !== null && (
          <li>
            가지 2 를 열었을 때 가지 1 전류: {formatMeasurement(b1, 'current')} (둘 다 닫힘) → {formatMeasurement(open1, 'current')} (가지 2 열림)
          </li>
        )}
        <li>
          {voltageMeasured
            ? '전원 전압을 함께 측정했으므로, 조건마다 전압이 유지되었는지 위 표에서 확인할 수 있습니다.'
            : '전원 전압은 측정하지 않았습니다. "전원 전압이 유지되었다" 는 조건은 이 기록으로는 확인되지 않은 것입니다.'}
        </li>
      </ul>
    </div>
  );
}
