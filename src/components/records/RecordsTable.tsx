import type { ConditionRecord } from '@/poe/types';
import type { SensorRole } from '@/sensors/types';
import { formatMeasurement, formatSeconds } from '@/data/units';
import { SourceBadge } from '@/components/common/SourceBadge';

export interface RecordsTableProps {
  records: ConditionRecord[];
  roles: SensorRole[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEditNote?: (id: string, note: string) => void;
  compact?: boolean;
}

export function describeRecord(r: ConditionRecord): string {
  const parts: string[] = [];
  for (const role of ['current', 'voltage'] as SensorRole[]) {
    const st = r.stats[role];
    if (!st) continue;
    parts.push(`${role === 'current' ? '전류' : '전압'} 평균 ${formatMeasurement(st.mean, role)} (표준편차 ${formatMeasurement(st.sd, role)}, n=${st.n})`);
  }
  return `${r.label}${r.repeat > 1 ? ` #${r.repeat}` : ''}: ${parts.join(', ')}`;
}

export function RecordsTable({ records, roles, selectable = false, selectedIds = [], onToggle, onDelete, onEditNote, compact = false }: RecordsTableProps) {
  if (records.length === 0) {
    return <p className="muted">아직 저장한 기록이 없습니다.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="data" data-testid="records-table">
        <thead>
          <tr>
            {selectable && <th></th>}
            <th>조건 / 위치</th>
            <th>출처</th>
            <th className="num">구간 (s)</th>
            {roles.map((role) => (
              <th key={role} className="num" style={{ color: role === 'current' ? 'var(--current)' : 'var(--voltage)' }}>
                {role === 'current' ? '전류 평균 (mA)' : '전압 평균 (V)'}
              </th>
            ))}
            {roles.map((role) => (
              <th key={`${role}-sd`} className="num">
                {role === 'current' ? '표준편차 (mA)' : '표준편차 (V)'}
              </th>
            ))}
            <th className="num">표본 수</th>
            {!compact && <th>메모 / 주의</th>}
            {(onDelete || onEditNote) && <th></th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const selected = selectedIds.includes(r.id);
            return (
              <tr key={r.id} className={selected ? 'selected' : ''}>
                {selectable && (
                  <td>
                    <input type="checkbox" checked={selected} onChange={() => onToggle?.(r.id)} aria-label={`${r.label} 선택`} />
                  </td>
                )}
                <td>
                  <strong>{r.label}</strong>
                  {r.repeat > 1 && <span className="badge" style={{ marginLeft: 4 }}>반복 {r.repeat}</span>}
                </td>
                <td>
                  <SourceBadge source={r.source} />
                </td>
                <td className="num">
                  {formatSeconds(r.window.tStart)} ~ {formatSeconds(r.window.tEnd)}
                </td>
                {roles.map((role) => {
                  const st = r.stats[role];
                  return (
                    <td key={role} className="num">
                      {st ? (role === 'current' ? (st.mean * 1000).toFixed(2) : st.mean.toFixed(3)) : '—'}
                      {st?.flags.includes('saturated') && <span className="badge badge-danger" style={{ marginLeft: 4 }}>포화</span>}
                      {st?.flags.includes('near_range') && <span className="badge badge-warn" style={{ marginLeft: 4 }}>범위 근접</span>}
                    </td>
                  );
                })}
                {roles.map((role) => {
                  const st = r.stats[role];
                  return (
                    <td key={`${role}-sd`} className="num">
                      {st ? (role === 'current' ? (st.sd * 1000).toFixed(2) : st.sd.toFixed(4)) : '—'}
                    </td>
                  );
                })}
                <td className="num">{Object.values(r.stats).map((s) => s?.n).filter(Boolean).join(' / ') || '—'}</td>
                {!compact && (
                  <td>
                    {onEditNote ? (
                      <input type="text" defaultValue={r.note} placeholder="메모" aria-label={`${r.label} 메모`} onBlur={(e) => onEditNote(r.id, e.target.value)} />
                    ) : (
                      r.note
                    )}
                    {r.warnings.length > 0 && (
                      <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                        {r.warnings.join(' · ')}
                      </div>
                    )}
                  </td>
                )}
                {(onDelete || onEditNote) && (
                  <td>
                    {onDelete && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDelete(r.id)} aria-label={`${r.label} 기록 삭제`}>
                        삭제
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
