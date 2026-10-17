/**
 * 비교 막대 그래프 (SVG). 부분값을 쌓은 막대와 전체 막대를 나란히 놓을 수 있다.
 * 음수 값도 그대로 그린다 (절댓값으로 바꾸지 않음).
 */
import type { ReactElement } from 'react';
export interface BarPart {
  label: string;
  value: number;
  color: string;
}

export interface Bar {
  label: string;
  /** 단일 값 막대 */
  value?: number;
  sd?: number;
  color?: string;
  /** 쌓은 막대 */
  parts?: BarPart[];
  /** 예상값 등 점선 표시 */
  dashed?: boolean;
}

export interface BarGroup {
  label: string;
  bars: Bar[];
}

export interface BarCompareProps {
  groups: BarGroup[];
  unit: string;
  valueFormatter?: (v: number) => string;
  width?: number;
  height?: number;
  title?: string;
  /** 0~1 상대 크기 모드 (예측 막대용) */
  relative?: boolean;
}

function barTotal(b: Bar): number {
  if (b.parts) return b.parts.reduce((a, p) => a + p.value, 0);
  return b.value ?? 0;
}

export function BarCompare({ groups, unit, valueFormatter, width = 520, height = 300, title, relative = false }: BarCompareProps) {
  const m = { left: 56, right: 16, top: 28, bottom: 56 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const fmt = valueFormatter ?? ((v: number) => v.toFixed(2));

  const totals = groups.flatMap((g) => g.bars.map(barTotal));
  const partsVals = groups.flatMap((g) => g.bars.flatMap((b) => (b.parts ? b.parts.map((p) => p.value) : [])));
  const sds = groups.flatMap((g) => g.bars.map((b) => (b.sd ?? 0) + Math.abs(barTotal(b))));
  const maxV = Math.max(0.0001, ...totals, ...partsVals, ...sds);
  const minV = Math.min(0, ...totals, ...partsVals);
  const span = maxV - minV || 1;
  const sy = (v: number) => m.top + h - ((v - minV) / span) * h;
  const zeroY = sy(0);

  const nBars = groups.reduce((a, g) => a + g.bars.length, 0) + groups.length;
  const slot = w / Math.max(nBars, 1);
  const barW = Math.min(64, slot * 0.7);

  let cursor = m.left + slot * 0.5;
  const rendered: ReactElement[] = [];
  const groupLabels: ReactElement[] = [];

  groups.forEach((g, gi) => {
    const start = cursor;
    g.bars.forEach((b, bi) => {
      const x = cursor - barW / 2;
      if (b.parts) {
        let acc = 0;
        b.parts.forEach((p, pi) => {
          const y0 = sy(acc);
          const y1 = sy(acc + p.value);
          rendered.push(
            <g key={`g${gi}b${bi}p${pi}`}>
              <rect x={x} y={Math.min(y0, y1)} width={barW} height={Math.abs(y1 - y0)} fill={p.color} opacity={0.9} stroke="var(--surface)" />
              {Math.abs(y1 - y0) > 14 && (
                <text x={cursor} y={(y0 + y1) / 2 + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">
                  {p.label} {fmt(p.value)}
                </text>
              )}
            </g>,
          );
          acc += p.value;
        });
        rendered.push(
          <text key={`g${gi}b${bi}t`} x={cursor} y={sy(acc) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
            {relative ? '' : `${fmt(acc)} ${unit}`}
          </text>,
        );
      } else {
        const v = b.value ?? 0;
        const y = sy(v);
        rendered.push(
          <g key={`g${gi}b${bi}`}>
            <rect
              x={x}
              y={Math.min(y, zeroY)}
              width={barW}
              height={Math.abs(zeroY - y)}
              fill={b.dashed ? 'var(--surface)' : (b.color ?? 'var(--primary)')}
              stroke={b.color ?? 'var(--primary)'}
              strokeWidth={b.dashed ? 2 : 0}
              strokeDasharray={b.dashed ? '6 4' : undefined}
              opacity={0.9}
            />
            {b.sd ? <line x1={cursor} x2={cursor} y1={sy(v - b.sd)} y2={sy(v + b.sd)} stroke="var(--text)" strokeWidth="1.5" /> : null}
            {b.sd ? <line x1={cursor - 6} x2={cursor + 6} y1={sy(v + b.sd)} y2={sy(v + b.sd)} stroke="var(--text)" strokeWidth="1.5" /> : null}
            {b.sd ? <line x1={cursor - 6} x2={cursor + 6} y1={sy(v - b.sd)} y2={sy(v - b.sd)} stroke="var(--text)" strokeWidth="1.5" /> : null}
            <text x={cursor} y={(v >= 0 ? y : zeroY) - (b.sd ? 10 : 6) - (v >= 0 && b.sd ? (sy(v) - sy(v + b.sd)) : 0)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
              {relative ? '' : `${fmt(v)} ${unit}`}
            </text>
          </g>,
        );
      }
      rendered.push(
        <text key={`g${gi}b${bi}l`} x={cursor} y={m.top + h + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          {b.label}
        </text>,
      );
      cursor += slot;
    });
    const end = cursor - slot;
    groupLabels.push(
      <text key={`gl${gi}`} x={(start + end) / 2} y={m.top + h + 36} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">
        {g.label}
      </text>,
    );
    cursor += slot; // 그룹 간격
  });

  return (
    <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? '비교 막대 그래프'}>
      {title && (
        <text x={width / 2} y={16} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">
          {title}
        </text>
      )}
      <line x1={m.left} x2={m.left + w} y1={zeroY} y2={zeroY} stroke="var(--text-muted)" />
      <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + h} stroke="var(--text-muted)" />
      {!relative && (
        <text x={m.left - 8} y={m.top + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
          {fmt(maxV)}
        </text>
      )}
      {!relative && minV < 0 && (
        <text x={m.left - 8} y={m.top + h} textAnchor="end" fontSize="11" fill="var(--text-muted)">
          {fmt(minV)}
        </text>
      )}
      <text x={m.left - 8} y={zeroY + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
        0
      </text>
      <text x={m.left - 44} y={m.top + h / 2} textAnchor="middle" fontSize="11" fill="var(--text-muted)" transform={`rotate(-90 ${m.left - 44} ${m.top + h / 2})`}>
        {relative ? '상대 크기' : unit}
      </text>
      {rendered}
      {groupLabels}
    </svg>
  );
}
