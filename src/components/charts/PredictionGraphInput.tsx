/**
 * 예상 그래프 입력: 그래프 영역을 클릭해 점을 찍거나, 아래 표에 키보드로 숫자를 넣는다.
 */
import { useId, useRef } from 'react';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface PredictionGraphInputProps {
  value: GraphPoint[];
  onChange: (points: GraphPoint[]) => void;
  xLabel: string;
  yLabel: string;
  xMax: number;
  yMax: number;
  maxPoints?: number;
  disabled?: boolean;
}

const W = 480;
const H = 320;
const M = { left: 56, right: 16, top: 16, bottom: 44 };

export function PredictionGraphInput({ value, onChange, xLabel, yLabel, xMax, yMax, maxPoints = 8, disabled = false }: PredictionGraphInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId();
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;
  const sx = (x: number) => M.left + (x / xMax) * w;
  const sy = (y: number) => M.top + h - (y / yMax) * h;
  const sorted = [...value].sort((a, b) => a.x - b.x);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    if (px < M.left || px > M.left + w || py < M.top || py > M.top + h) return;
    const x = +(((px - M.left) / w) * xMax).toFixed(2);
    const y = +(((M.top + h - py) / h) * yMax).toFixed(1);
    // 가까운 기존 점이 있으면 옮긴다
    const near = value.findIndex((p) => Math.hypot(sx(p.x) - px, sy(p.y) - py) < 12);
    if (near >= 0) {
      const next = value.slice();
      next[near] = { x, y };
      onChange(next);
      return;
    }
    if (value.length >= maxPoints) return;
    onChange([...value, { x, y }]);
  };

  const update = (i: number, key: 'x' | 'y', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const next = value.slice();
    next[i] = { ...next[i], [key]: key === 'x' ? Math.max(0, Math.min(xMax, n)) : Math.max(0, Math.min(yMax, n)) };
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const add = () => {
    if (value.length >= maxPoints) return;
    onChange([...value, { x: 0, y: 0 }]);
  };

  const xTicks = Array.from({ length: 5 }, (_, i) => +((xMax / 4) * i).toFixed(2));
  const yTicks = Array.from({ length: 5 }, (_, i) => +((yMax / 4) * i).toFixed(1));

  return (
    <div className="stack stack-sm">
      <svg
        ref={svgRef}
        className="svg-chart"
        viewBox={`0 0 ${W} ${H}`}
        onClick={handleClick}
        role="img"
        aria-labelledby={`${id}-desc`}
        style={{ cursor: disabled ? 'default' : 'crosshair', border: '1px solid var(--border)', borderRadius: 8, maxWidth: 560 }}
      >
        <title id={`${id}-desc`}>예상 그래프 입력 영역. 클릭해 점을 찍거나 아래 표에 값을 입력하세요.</title>
        {xTicks.map((tx) => (
          <g key={`x${tx}`}>
            <line x1={sx(tx)} x2={sx(tx)} y1={M.top} y2={M.top + h} stroke="var(--border)" />
            <text x={sx(tx)} y={M.top + h + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {tx}
            </text>
          </g>
        ))}
        {yTicks.map((ty) => (
          <g key={`y${ty}`}>
            <line x1={M.left} x2={M.left + w} y1={sy(ty)} y2={sy(ty)} stroke="var(--border)" />
            <text x={M.left - 6} y={sy(ty) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {ty}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={M.left + w} y1={M.top + h} y2={M.top + h} stroke="var(--text-muted)" />
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + h} stroke="var(--text-muted)" />
        <text x={M.left + w / 2} y={H - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">
          {xLabel}
        </text>
        <text x={14} y={M.top + h / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)" transform={`rotate(-90 14 ${M.top + h / 2})`}>
          {yLabel}
        </text>
        {sorted.length > 1 && (
          <polyline points={sorted.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="6 4" />
        )}
        {value.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="7" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
            <text x={sx(p.x)} y={sy(p.y) - 11} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="table-wrap">
        <table className="data" aria-label="예상 점 표 (키보드 입력)">
          <thead>
            <tr>
              <th>점</th>
              <th>{xLabel}</th>
              <th>{yLabel}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {value.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <input type="number" step="0.1" min={0} max={xMax} value={p.x} disabled={disabled} aria-label={`점 ${i + 1} ${xLabel}`} onChange={(e) => update(i, 'x', e.target.value)} style={{ width: 100 }} />
                </td>
                <td>
                  <input type="number" step="0.5" min={0} max={yMax} value={p.y} disabled={disabled} aria-label={`점 ${i + 1} ${yLabel}`} onChange={(e) => update(i, 'y', e.target.value)} style={{ width: 100 }} />
                </td>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={() => remove(i)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {value.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  아직 점이 없습니다. 그래프를 클릭하거나 ‘점 추가’ 를 누르세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="btn btn-sm" onClick={add} disabled={disabled || value.length >= maxPoints}>
          점 추가 (키보드 입력)
        </button>
      </div>
    </div>
  );
}
