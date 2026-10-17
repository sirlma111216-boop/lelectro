/**
 * 회로도 SVG 기본 요소. 좌표계는 각 회로도 컴포넌트가 정한다.
 * 색: 전류 센서(주황), 전압 센서(파랑), 빨간 리드/검은 리드는 실제 색을 따른다.
 */
export const WIRE = 'var(--text)';
export const RED = '#dc2626';
export const BLACK = '#111827';

export function Wire({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={WIRE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
}

/** 전지: 세로 방향, (x, y) 중심. 위쪽이 (+) */
export function Battery({ x, y, label = '전원' }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <line x1={x} y1={y - 22} x2={x} y2={y - 8} stroke={WIRE} strokeWidth="2.5" />
      <line x1={x - 14} y1={y - 8} x2={x + 14} y2={y - 8} stroke={WIRE} strokeWidth="3" />
      <line x1={x - 7} y1={y} x2={x + 7} y2={y} stroke={WIRE} strokeWidth="3" />
      <line x1={x - 14} y1={y + 8} x2={x + 14} y2={y + 8} stroke={WIRE} strokeWidth="3" />
      <line x1={x - 7} y1={y + 16} x2={x + 7} y2={y + 16} stroke={WIRE} strokeWidth="3" />
      <line x1={x} y1={y + 16} x2={x} y2={y + 22} stroke={WIRE} strokeWidth="2.5" />
      <text x={x - 22} y={y - 10} fontSize="12" fontWeight="700" fill={RED}>
        +
      </text>
      <text x={x - 22} y={y + 22} fontSize="12" fontWeight="700" fill={WIRE}>
        −
      </text>
      <text x={x - 20} y={y + 42} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/** 가변 전원: 원 안에 화살표 */
export function VariableSupply({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="18" fill="var(--surface)" stroke={WIRE} strokeWidth="2.5" />
      <line x1={x - 10} y1={y + 10} x2={x + 10} y2={y - 10} stroke={WIRE} strokeWidth="2" />
      <polygon points={`${x + 10},${y - 10} ${x + 2},${y - 9} ${x + 9},${y - 2}`} fill={WIRE} />
      <text x={x} y={y - 24} fontSize="12" fontWeight="700" fill={RED} textAnchor="middle">
        +
      </text>
      <text x={x} y={y + 34} fontSize="12" fontWeight="700" fill={WIRE} textAnchor="middle">
        −
      </text>
      <text x={x - 26} y={y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">
        가변 전원
      </text>
    </g>
  );
}

/** 전구: 가로 도선 위 (x, y) 중심 */
export function Lamp({ x, y, label = '전구' }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="16" fill="#fff7cc" stroke={WIRE} strokeWidth="2.5" />
      <line x1={x - 11} y1={y - 11} x2={x + 11} y2={y + 11} stroke={WIRE} strokeWidth="2" />
      <line x1={x + 11} y1={y - 11} x2={x - 11} y2={y + 11} stroke={WIRE} strokeWidth="2" />
      <text x={x} y={y - 24} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/** 저항: 가로 (horizontal=true) 또는 세로 사각형, 중심 (x, y) */
export function Resistor({ x, y, label, horizontal = true }: { x: number; y: number; label: string; horizontal?: boolean }) {
  const w = horizontal ? 44 : 16;
  const h = horizontal ? 16 : 44;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="var(--surface)" stroke={WIRE} strokeWidth="2.5" />
      <text x={horizontal ? x : x + 16} y={horizontal ? y - 14 : y + 4} fontSize="11" fontWeight="600" fill="var(--text)" textAnchor={horizontal ? 'middle' : 'start'}>
        {label}
      </text>
    </g>
  );
}

/** 스위치: 두 점 사이, closed 면 이어짐 */
export function Switch({ x, y, closed, vertical = false, label }: { x: number; y: number; closed: boolean; vertical?: boolean; label?: string }) {
  const len = 30;
  if (vertical) {
    return (
      <g>
        <circle cx={x} cy={y - len / 2} r="3" fill={WIRE} />
        <circle cx={x} cy={y + len / 2} r="3" fill={WIRE} />
        <line x1={x} y1={y - len / 2} x2={closed ? x : x + 14} y2={closed ? y + len / 2 : y + len / 2 - 6} stroke={WIRE} strokeWidth="2.5" />
        {label && (
          <text x={x + 10} y={y + 4} fontSize="10" fill="var(--text-muted)">
            {label}
            {closed ? ' 닫힘' : ' 열림'}
          </text>
        )}
      </g>
    );
  }
  return (
    <g>
      <circle cx={x - len / 2} cy={y} r="3" fill={WIRE} />
      <circle cx={x + len / 2} cy={y} r="3" fill={WIRE} />
      <line x1={x - len / 2} y1={y} x2={closed ? x + len / 2 : x + len / 2 - 6} y2={closed ? y : y - 14} stroke={WIRE} strokeWidth="2.5" />
      {label && (
        <text x={x} y={y + 18} fontSize="10" fill="var(--text-muted)" textAnchor="middle">
          {label}
          {closed ? ' 닫힘' : ' 열림'}
        </text>
      )}
    </g>
  );
}

/** 측정 위치 표시 (원 + 글자). active 면 강조 */
export function PositionMarker({ x, y, label, active, color = 'var(--current)' }: { x: number; y: number; label: string; active: boolean; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={active ? 13 : 10} fill={active ? color : 'var(--surface)'} stroke={color} strokeWidth="2" />
      <text x={x} y={y + 4} fontSize="11" fontWeight="700" textAnchor="middle" fill={active ? '#fff' : color}>
        {label}
      </text>
    </g>
  );
}

/**
 * 전류 센서(직렬 삽입). 가로 도선 위 (x, y) 에 끼운 것으로 그린다.
 * 도선은 센서 양쪽 리드로 이어지고, 빨간 리드가 flowFrom 쪽을 향한다.
 */
export function Ammeter({ x, y, vertical = false, label = '전류 센서', redSide = 'left' }: { x: number; y: number; vertical?: boolean; label?: string; redSide?: 'left' | 'right' | 'top' | 'bottom' }) {
  const bw = 46;
  const bh = 30;
  if (vertical) {
    const redTop = redSide === 'top';
    return (
      <g>
        <line x1={x} y1={y - 28} x2={x} y2={y - bh / 2} stroke={redTop ? RED : BLACK} strokeWidth="3" />
        <line x1={x} y1={y + bh / 2} x2={x} y2={y + 28} stroke={redTop ? BLACK : RED} strokeWidth="3" />
        <rect x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx="6" fill="var(--current)" />
        <text x={x} y={y + 5} fontSize="14" fontWeight="800" fill="#fff" textAnchor="middle">
          A
        </text>
        <text x={x + bw / 2 + 6} y={y + 4} fontSize="10" fill="var(--current)" fontWeight="700">
          {label}
        </text>
      </g>
    );
  }
  const redLeft = redSide === 'left';
  return (
    <g>
      <line x1={x - 30} y1={y} x2={x - bw / 2} y2={y} stroke={redLeft ? RED : BLACK} strokeWidth="3" />
      <line x1={x + bw / 2} y1={y} x2={x + 30} y2={y} stroke={redLeft ? BLACK : RED} strokeWidth="3" />
      <rect x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx="6" fill="var(--current)" />
      <text x={x} y={y + 5} fontSize="14" fontWeight="800" fill="#fff" textAnchor="middle">
        A
      </text>
      <text x={x} y={y + bh / 2 + 13} fontSize="10" fill="var(--current)" fontWeight="700" textAnchor="middle">
        {label}
      </text>
      <text x={x - 30} y={y - 6} fontSize="9" fill={redLeft ? RED : BLACK} textAnchor="middle">
        {redLeft ? '빨강' : '검정'}
      </text>
      <text x={x + 30} y={y - 6} fontSize="9" fill={redLeft ? BLACK : RED} textAnchor="middle">
        {redLeft ? '검정' : '빨강'}
      </text>
    </g>
  );
}

/**
 * 전압 센서: 두 점 (x1,y1)=빨간 클립, (x2,y2)=검은 클립 에 리드를 물리고
 * 본체는 (bx, by) 에 둔다. 전압은 반드시 두 점 사이의 차이로 그린다.
 */
export function Voltmeter({ red, black, box, label = '전압 센서' }: { red: { x: number; y: number }; black: { x: number; y: number }; box: { x: number; y: number }; label?: string }) {
  const bw = 46;
  const bh = 30;
  return (
    <g>
      <path d={`M ${red.x} ${red.y} Q ${(red.x + box.x) / 2} ${(red.y + box.y) / 2 + 10} ${box.x - 10} ${box.y - bh / 2}`} fill="none" stroke={RED} strokeWidth="2.5" />
      <path d={`M ${black.x} ${black.y} Q ${(black.x + box.x) / 2} ${(black.y + box.y) / 2 + 10} ${box.x + 10} ${box.y - bh / 2}`} fill="none" stroke={BLACK} strokeWidth="2.5" />
      <circle cx={red.x} cy={red.y} r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
      <circle cx={black.x} cy={black.y} r="6" fill={BLACK} stroke="#fff" strokeWidth="1.5" />
      <text x={red.x} y={red.y - 10} fontSize="9" fill={RED} textAnchor="middle" fontWeight="700">
        빨간 클립
      </text>
      <text x={black.x} y={black.y - 10} fontSize="9" fill={BLACK} textAnchor="middle" fontWeight="700">
        검은 클립
      </text>
      <rect x={box.x - bw / 2} y={box.y - bh / 2} width={bw} height={bh} rx="6" fill="var(--voltage)" />
      <text x={box.x} y={box.y + 5} fontSize="14" fontWeight="800" fill="#fff" textAnchor="middle">
        V
      </text>
      <text x={box.x} y={box.y + bh / 2 + 13} fontSize="10" fill="var(--voltage)" fontWeight="700" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export function Node({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3.5" fill={WIRE} />;
}
