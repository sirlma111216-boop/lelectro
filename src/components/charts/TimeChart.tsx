/**
 * 실시간 시간 그래프 (uPlot, canvas).
 * - 구간 사이의 null 은 끊김으로 그려지며 보간하지 않는다.
 * - 드래그로 안정 구간을 고르면 onSelectWindow 가 불린다 (줌이 아니다).
 * - 표본 수집과 화면 갱신은 분리되어 있다: 데이터는 props 로 들어오고, 부모가 갱신 주기를 정한다.
 */
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { SensorRole } from '@/sensors/types';
import { displayUnit, toDisplayValue } from '@/data/units';

export interface TimeChartProps {
  role: SensorRole;
  t: number[];
  /** 내부 단위 값. null 은 끊김 */
  v: Array<number | null>;
  /** 표시할 x 범위 (초). 없으면 데이터 전체 */
  xRange?: { min: number; max: number } | null;
  /** 선택된 안정 구간 */
  window?: { tStart: number; tEnd: number } | null;
  onSelectWindow?: (tStart: number, tEnd: number) => void;
  height?: number;
  title?: string;
}

const COLORS: Record<SensorRole, string> = {
  current: getComputedStyleVar('--current', '#c2410c'),
  voltage: getComputedStyleVar('--voltage', '#1d4ed8'),
};

function getComputedStyleVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function TimeChart({ role, t, v, xRange, window: win, onSelectWindow, height = 220, title }: TimeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const selectCbRef = useRef(onSelectWindow);
  selectCbRef.current = onSelectWindow;
  const suppressSelectHook = useRef(false);

  // 차트 생성/파괴 (한 번)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const unit = displayUnit(role);
    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height,
      title,
      cursor: {
        drag: { x: true, y: false, setScale: false },
      },
      select: { show: true, left: 0, top: 0, width: 0, height: 0 },
      scales: {
        x: { time: false },
        y: { auto: true },
      },
      axes: [
        { label: '시간 (s)', labelSize: 20, size: 40 },
        { label: `${role === 'current' ? '전류' : '전압'} (${unit})`, labelSize: 20, size: 60 },
      ],
      series: [
        { label: 't (s)' },
        {
          label: `${role === 'current' ? '전류' : '전압'} (${unit})`,
          stroke: COLORS[role],
          width: 2,
          spanGaps: false,
          points: { show: false },
          value: (_u, val) => (val == null ? '—' : `${val.toFixed(role === 'current' ? 2 : 3)} ${unit}`),
        },
      ],
      hooks: {
        setSelect: [
          (u) => {
            if (suppressSelectHook.current) return;
            if (u.select.width <= 2) return;
            const a = u.posToVal(u.select.left, 'x');
            const b = u.posToVal(u.select.left + u.select.width, 'x');
            selectCbRef.current?.(Math.min(a, b), Math.max(a, b));
          },
        ],
      },
      legend: { show: false },
    };
    const plot = new uPlot(opts, [[0], [null]], el);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      if (!plotRef.current) return;
      plotRef.current.setSize({ width: el.clientWidth || 600, height });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
    // role/height/title 은 마운트 시 고정
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, height, title]);

  // 데이터 갱신
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const ys = v.map((x) => (x == null ? null : toDisplayValue(x, role)));
    const xs = t.length ? t : [0];
    const data: uPlot.AlignedData = [xs, t.length ? ys : [null]];
    plot.setData(data, false);
    if (xRange) {
      plot.setScale('x', { min: xRange.min, max: xRange.max });
    } else if (t.length > 1) {
      plot.setScale('x', { min: t[0], max: t[t.length - 1] });
    } else {
      plot.setScale('x', { min: 0, max: 10 });
    }
    // y 범위: 자동 (데이터가 있을 때), 없으면 기본
    const valid = ys.filter((y): y is number => y != null);
    if (valid.length > 0) {
      let min = Math.min(...valid);
      let max = Math.max(...valid);
      if (min === max) {
        min -= 1;
        max += 1;
      }
      const pad = (max - min) * 0.15;
      plot.setScale('y', { min: Math.min(0, min - pad), max: max + pad });
    } else {
      plot.setScale('y', { min: 0, max: role === 'current' ? 100 : 5 });
    }
    // 선택 구간 표시 (hook 재발화 방지)
    suppressSelectHook.current = true;
    if (win) {
      const left = plot.valToPos(win.tStart, 'x');
      const right = plot.valToPos(win.tEnd, 'x');
      const l = Math.max(0, Math.min(left, right));
      const r = Math.min(plot.bbox.width / devicePixelRatio, Math.max(left, right));
      plot.setSelect({ left: l, top: 0, width: Math.max(0, r - l), height: plot.bbox.height / devicePixelRatio }, false);
    } else {
      plot.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
    }
    suppressSelectHook.current = false;
  }, [t, v, xRange, win, role]);

  return <div className="chart-box" ref={containerRef} data-testid={`time-chart-${role}`} />;
}
