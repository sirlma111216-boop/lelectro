import type { InquirySession } from '@/poe/types';
import { meanOf } from '@/poe/sessionLogic';
import { relativeDifferencePct } from '@/data/stats';
import { BarCompare, type BarGroup } from '@/components/charts/BarCompare';

export function Inquiry3Results({ session }: { session: InquirySession }) {
  const groups: BarGroup[] = [];
  const rows: Array<{ label: string; v1: number | null; v2: number | null; vt: number | null }> = [];
  for (const g of ['A', 'B'] as const) {
    const v1 = meanOf(session, `${g}-V1`, 'voltage');
    const v2 = meanOf(session, `${g}-V2`, 'voltage');
    const vt = meanOf(session, `${g}-Vtotal`, 'voltage');
    const label = g === 'A' ? '조건 A: 같은 저항' : '조건 B: 다른 저항';
    if (v1 === null && v2 === null && vt === null) continue;
    rows.push({ label, v1, v2, vt });
    const bars: BarGroup['bars'] = [];
    if (v1 !== null || v2 !== null) {
      bars.push({
        label: 'V1 + V2 (쌓음)',
        parts: [
          { label: 'V1', value: v1 ?? 0, color: 'var(--voltage)' },
          { label: 'V2', value: v2 ?? 0, color: '#60a5fa' },
        ],
      });
    }
    if (vt !== null) bars.push({ label: 'V전체', value: vt, color: '#1e3a8a' });
    groups.push({ label, bars });
  }
  if (groups.length === 0) return <p className="muted">아직 전압 기록이 없습니다.</p>;
  const hasNegative = rows.some((r) => [r.v1, r.v2, r.vt].some((v) => v !== null && v < 0));
  return (
    <div className="stack">
      <BarCompare groups={groups} unit="V" valueFormatter={(v) => v.toFixed(2)} title="부분 전압을 쌓은 막대와 전체 전압 막대" height={340} />
      <table className="data">
        <thead>
          <tr>
            <th>조건</th>
            <th className="num">V1 (V)</th>
            <th className="num">V2 (V)</th>
            <th className="num">V1 + V2 (V)</th>
            <th className="num">V전체 (V)</th>
            <th className="num">차이</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sum = r.v1 !== null && r.v2 !== null ? r.v1 + r.v2 : null;
            const diff = sum !== null && r.vt !== null ? relativeDifferencePct(sum, r.vt) : null;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.v1?.toFixed(3) ?? '—'}</td>
                <td className="num">{r.v2?.toFixed(3) ?? '—'}</td>
                <td className="num">{sum?.toFixed(3) ?? '—'}</td>
                <td className="num">{r.vt?.toFixed(3) ?? '—'}</td>
                <td className="num">{diff === null ? '—' : `${(sum! - r.vt!).toFixed(3)} V (${diff.toFixed(1)} %)`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasNegative && (
        <p className="notice notice-warn">음수 전압이 있습니다. 절댓값으로 바꾸지 않고 그대로 두었습니다. 전압 센서 빨간·검은 클립의 연결 방향을 확인한 뒤 필요하면 다시 측정하세요.</p>
      )}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        실제 측정 차이는 그대로 표시합니다. 세 번의 측정 사이에 전원 전압이 조금 달라졌을 수 있다는 점도 함께 생각해 보세요.
      </p>
    </div>
  );
}
