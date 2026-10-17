/**
 * V–I 산점도 (SVG, 인쇄 친화). 예상 점·직선 적합을 겹쳐 그릴 수 있다.
 * 직선은 원점을 강제로 지나지 않는다.
 */
import type { LinearFit } from '@/data/stats';

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  xErr?: number;
  yErr?: number;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  predicted?: Array<{ x: number; y: number }>;
  fit?: LinearFit | null;
  xLabel: string;
  yLabel: string;
  xMax?: number;
  yMax?: number;
  width?: number;
  height?: number;
  pointColor?: string;
  title?: string;
}

function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const m = v / base;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * base;
}

function ticks(max: number, count = 5): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => +(i * step).toPrecision(4));
}

export function ScatterChart({
  points,
  predicted = [],
  fit,
  xLabel,
  yLabel,
  xMax,
  yMax,
  width = 520,
  height = 360,
  pointColor = 'var(--current)',
  title,
}: ScatterChartProps) {
  const m = { left: 60, right: 20, top: 24, bottom: 48 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const allX = [...points.map((p) => p.x), ...predicted.map((p) => p.x), 0];
  const allY = [...points.map((p) => p.y), ...predicted.map((p) => p.y), 0];
  const xm = xMax ?? niceMax(Math.max(...allX) * 1.15);
  const ym = yMax ?? niceMax(Math.max(...allY) * 1.15);
  const sx = (x: number) => m.left + (x / xm) * w;
  const sy = (y: number) => m.top + h - (y / ym) * h;

  const fitLine =
    fit && Number.isFinite(fit.slope)
      ? (() => {
          const x0 = 0;
          const x1 = xm;
          const y0 = fit.intercept + fit.slope * x0;
          const y1 = fit.intercept + fit.slope * x1;
          return { x0, y0, x1, y1 };
        })()
      : null;

  const predSorted = [...predicted].sort((a, b) => a.x - b.x);

  return (
    <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? `${yLabel} 대 ${xLabel} 산점도`}>
      {title && (
        <text x={width / 2} y={14} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">
          {title}
        </text>
      )}
      {/* 격자 */}
      {ticks(xm).map((tx) => (
        <g key={`x${tx}`}>
          <line x1={sx(tx)} x2={sx(tx)} y1={m.top} y2={m.top + h} stroke="var(--border)" strokeWidth="1" />
          <text x={sx(tx)} y={m.top + h + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {tx}
          </text>
        </g>
      ))}
      {ticks(ym).map((ty) => (
        <g key={`y${ty}`}>
          <line x1={m.left} x2={m.left + w} y1={sy(ty)} y2={sy(ty)} stroke="var(--border)" strokeWidth="1" />
          <text x={m.left - 6} y={sy(ty) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
            {ty}
          </text>
        </g>
      ))}
      <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke="var(--text-muted)" />
      <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + h} stroke="var(--text-muted)" />
      <text x={m.left + w / 2} y={height - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">
        {xLabel}
      </text>
      <text
        x={14}
        y={m.top + h / 2}
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
        fill="var(--text)"
        transform={`rotate(-90 14 ${m.top + h / 2})`}
      >
        {yLabel}
      </text>

      {/* 예상 그래프 */}
      {predSorted.length > 1 && (
        <polyline
          points={predSorted.map((p) => `${sx(Math.min(p.x, xm))},${sy(Math.min(p.y, ym))}`).join(' ')}
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      )}
      {predSorted.map((p, i) => (
        <rect key={`p${i}`} x={sx(p.x) - 4} y={sy(p.y) - 4} width="8" height="8" fill="var(--surface)" stroke="var(--text-faint)" strokeWidth="2" />
      ))}

      {/* 직선 적합 */}
      {fitLine && (
        <line
          x1={sx(fitLine.x0)}
          y1={sy(fitLine.y0)}
          x2={sx(fitLine.x1)}
          y2={sy(fitLine.y1)}
          stroke="var(--primary)"
          strokeWidth="2"
          clipPath="url(#plotArea)"
        />
      )}
      <defs>
        <clipPath id="plotArea">
          <rect x={m.left} y={m.top} width={w} height={h} />
        </clipPath>
      </defs>

      {/* 측정 점 */}
      {points.map((p, i) => (
        <g key={`m${i}`}>
          {p.yErr ? <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y - p.yErr)} y2={sy(p.y + p.yErr)} stroke={pointColor} strokeWidth="1.5" /> : null}
          {p.xErr ? <line y1={sy(p.y)} y2={sy(p.y)} x1={sx(p.x - p.xErr)} x2={sx(p.x + p.xErr)} stroke={pointColor} strokeWidth="1.5" /> : null}
          <circle cx={sx(p.x)} cy={sy(p.y)} r="5" fill={pointColor} />
          {p.label && (
            <text x={sx(p.x) + 8} y={sy(p.y) - 6} fontSize="10" fill="var(--text-muted)">
              {p.label}
            </text>
          )}
        </g>
      ))}

      {/* 범례 */}
      <g transform={`translate(${m.left + 8}, ${m.top + 6})`} fontSize="11" fill="var(--text-muted)">
        <circle cx="6" cy="6" r="5" fill={pointColor} />
        <text x="16" y="10">
          측정 (조건별 평균)
        </text>
        {predicted.length > 0 && (
          <>
            <rect x="130" y="2" width="8" height="8" fill="var(--surface)" stroke="var(--text-faint)" strokeWidth="2" />
            <text x="144" y="10">
              예상
            </text>
          </>
        )}
        {fitLine && (
          <>
            <line x1="190" x2="210" y1="6" y2="6" stroke="var(--primary)" strokeWidth="2" />
            <text x="214" y="10">
              직선 적합
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
