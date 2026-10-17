/**
 * 실제 회로를 안내하는 회로도 (SVG). 네 탐구의 검증된 회로 템플릿만 제공한다.
 * 그림 속 스위치나 전원 설정을 바꿔도 실제 장치는 제어되지 않는다 — 사용자가 실제 회로를 바꾼 뒤 측정한다.
 */
import type { DiagramSpec } from '@/inquiries/types';
import { Ammeter, Battery, Lamp, Node, PositionMarker, Resistor, Switch, VariableSupply, Voltmeter, Wire } from './primitives';

function SeriesLamp({ currentAt }: { currentAt?: DiagramSpec['currentAt'] }) {
  // 고리: (60,40)-(340,40)-(340,220)-(60,220). 전지 왼쪽, 전구 위, 스위치 오른쪽.
  const pos = { A: { x: 130, y: 40 }, B: { x: 270, y: 40 }, C: { x: 200, y: 220 } } as const;
  const active = currentAt && currentAt in pos ? (currentAt as keyof typeof pos) : null;
  const gapAt = active ? pos[active] : null;
  return (
    <svg className="circuit" viewBox="0 0 400 260" role="img" aria-label="전지, 스위치, 전구가 직렬로 연결된 회로. 전류 센서 위치 A, B, C">
      {/* 위쪽 도선 (전구 포함), 센서 위치에는 틈을 둔다 */}
      <Wire d={`M 60 40 L ${gapAt && active === 'A' ? gapAt.x - 30 : 184} 40`} />
      {active === 'A' && <Wire d="M 160 40 L 184 40" />}
      <Wire d={`M 216 40 L ${active === 'B' ? 240 : 340} 40`} />
      {active === 'B' && <Wire d="M 300 40 L 340 40" />}
      <Wire d="M 340 40 L 340 115" />
      <Wire d="M 340 145 L 340 220" />
      <Wire d={`M 340 220 L ${active === 'C' ? 230 : 60} 220`} />
      {active === 'C' && <Wire d="M 170 220 L 60 220" />}
      <Wire d="M 60 220 L 60 152" />
      <Wire d="M 60 108 L 60 40" />
      <Battery x={60} y={130} />
      <Lamp x={200} y={40} />
      <Switch x={340} y={130} closed vertical />
      {(['A', 'B', 'C'] as const).map((k) =>
        k === active ? (
          <Ammeter key={k} x={pos[k].x} y={pos[k].y} redSide={k === 'C' ? 'right' : 'left'} label={`전류 센서 (${k})`} />
        ) : (
          <PositionMarker key={k} x={pos[k].x} y={pos[k].y} label={k} active={false} />
        ),
      )}
      <text x="200" y="250" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        A: 전구 앞 · B: 전구 뒤 · C: 전지로 돌아가는 구간
      </text>
    </svg>
  );
}

function SeriesResistor({ currentAt, voltageAcross }: { currentAt?: DiagramSpec['currentAt']; voltageAcross?: DiagramSpec['voltageAcross'] }) {
  const showA = !!currentAt;
  return (
    <svg className="circuit" viewBox="0 0 400 260" role="img" aria-label="가변 전원과 고정 저항이 직렬로 연결되고, 전류 센서가 직렬, 전압 센서가 저항 양단에 연결된 회로">
      <Wire d={`M 60 40 L ${showA ? 100 : 178} 40`} />
      {showA && <Wire d="M 160 40 L 178 40" />}
      <Wire d="M 222 40 L 340 40 L 340 220 L 60 220 L 60 152" />
      <Wire d="M 60 108 L 60 40" />
      <VariableSupply x={60} y={130} />
      <Resistor x={200} y={40} label="고정 저항 R" />
      {showA && <Ammeter x={130} y={40} label="전류 센서 (직렬)" />}
      {voltageAcross === 'r1' && <Voltmeter red={{ x: 176, y: 40 }} black={{ x: 224, y: 40 }} box={{ x: 200, y: 120 }} label="전압 센서 (저항 양단)" />}
      <text x="200" y="250" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        전류 센서는 저항과 직렬, 전압 센서는 저항의 두 끝에 병렬로 연결한다
      </text>
    </svg>
  );
}

function SeriesTwoResistors({ voltageAcross, equalResistors }: { voltageAcross?: DiagramSpec['voltageAcross']; equalResistors?: boolean }) {
  const r1 = { x: 140, y: 40 };
  const r2 = { x: 270, y: 40 };
  const pts = {
    r1: { red: { x: r1.x - 24, y: 40 }, black: { x: r1.x + 24, y: 40 } },
    r2: { red: { x: r2.x - 24, y: 40 }, black: { x: r2.x + 24, y: 40 } },
    total: { red: { x: r1.x - 24, y: 40 }, black: { x: r2.x + 24, y: 40 } },
  } as const;
  const sel = voltageAcross && voltageAcross in pts ? (voltageAcross as keyof typeof pts) : null;
  return (
    <svg className="circuit" viewBox="0 0 400 260" role="img" aria-label="전원과 저항 두 개가 직렬로 연결된 회로. 전압 센서 리드를 물릴 두 점이 표시됨">
      <Wire d="M 60 40 L 118 40" />
      <Wire d="M 162 40 L 248 40" />
      <Wire d="M 292 40 L 340 40 L 340 115" />
      <Wire d="M 340 145 L 340 220 L 60 220 L 60 152" />
      <Wire d="M 60 108 L 60 40" />
      <Battery x={60} y={130} />
      <Resistor x={r1.x} y={r1.y} label="R1" />
      <Resistor x={r2.x} y={r2.y} label={equalResistors ? 'R2 (= R1)' : 'R2 (≠ R1)'} />
      <Switch x={340} y={130} closed vertical />
      {sel && <Voltmeter red={pts[sel].red} black={pts[sel].black} box={{ x: 200, y: 130 }} label={sel === 'r1' ? 'V1 (R1 양단)' : sel === 'r2' ? 'V2 (R2 양단)' : 'V전체 (두 저항 전체 양단)'} />}
      <text x="200" y="250" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        빨간 클립: 전원 (+) 쪽 점 · 검은 클립: (−) 쪽 점 (전압은 두 점 사이의 차이)
      </text>
    </svg>
  );
}

function ParallelTwo({ currentAt, branches, equalResistors, voltageAcross }: { currentAt?: DiagramSpec['currentAt']; branches?: { b1: boolean; b2: boolean }; equalResistors?: boolean; voltageAcross?: DiagramSpec['voltageAcross'] }) {
  const b1 = branches?.b1 ?? true;
  const b2 = branches?.b2 ?? true;
  const top = 60;
  const bottom = 200;
  const bx = 80;
  const x1 = 220;
  const x2 = 320;
  return (
    <svg className="circuit" viewBox="0 0 420 270" role="img" aria-label="전원에 두 개의 가지가 병렬로 연결된 회로. 각 가지에 스위치와 저항이 있다">
      {/* 위 레일 */}
      <Wire d={`M ${bx} ${top} L ${currentAt === 'total' ? 120 : x1} ${top}`} />
      {currentAt === 'total' && <Wire d={`M 180 ${top} L ${x1} ${top}`} />}
      <Wire d={`M ${x1} ${top} L ${x2} ${top}`} />
      {/* 아래 레일 */}
      <Wire d={`M ${bx} ${bottom} L ${x2} ${bottom}`} />
      {/* 전지 */}
      <Wire d={`M ${bx} ${top} L ${bx} 108`} />
      <Wire d={`M ${bx} 152 L ${bx} ${bottom}`} />
      <Battery x={bx} y={130} />
      {/* 가지 1 */}
      <Wire d={`M ${x1} ${top} L ${x1} 85`} />
      <Wire d={`M ${x1} 115 L ${x1} ${currentAt === 'branch1' ? 108 : 138}`} />
      {currentAt === 'branch1' && <Wire d={`M ${x1} 158 L ${x1} 138`} />}
      <Wire d={`M ${x1} 182 L ${x1} ${bottom}`} />
      <Switch x={x1} y={100} closed={b1} vertical label="S1" />
      <Resistor x={x1} y={160} label="R1" horizontal={false} />
      {/* 가지 2 */}
      <Wire d={`M ${x2} ${top} L ${x2} 85`} />
      <Wire d={`M ${x2} 115 L ${x2} ${currentAt === 'branch2' ? 108 : 138}`} />
      {currentAt === 'branch2' && <Wire d={`M ${x2} 158 L ${x2} 138`} />}
      <Wire d={`M ${x2} 182 L ${x2} ${bottom}`} />
      <Switch x={x2} y={100} closed={b2} vertical label="S2" />
      <Resistor x={x2} y={160} label={equalResistors ? 'R2 (= R1)' : 'R2 (≠ R1)'} horizontal={false} />
      <Node x={x1} y={top} />
      <Node x={x1} y={bottom} />
      {/* 전류 센서 */}
      {currentAt === 'total' && <Ammeter x={150} y={top} label="전류 센서 (I전체)" />}
      {currentAt === 'branch1' && <Ammeter x={x1} y={133} vertical redSide="top" label="I1" />}
      {currentAt === 'branch2' && <Ammeter x={x2} y={133} vertical redSide="top" label="I2" />}
      {currentAt !== 'total' && <PositionMarker x={150} y={top} label="I전" active={false} />}
      {currentAt !== 'branch1' && <PositionMarker x={x1 - 22} y={130} label="I1" active={false} />}
      {currentAt !== 'branch2' && <PositionMarker x={x2 + 22} y={130} label="I2" active={false} />}
      {voltageAcross === 'supply' && <Voltmeter red={{ x: 110, y: top }} black={{ x: 110, y: bottom }} box={{ x: 150, y: 140 }} label="전압 센서 (선택)" />}
      <text x="210" y="258" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        센서를 뺀 자리는 도선으로 다시 잇는다 · 스위치는 손으로 조작
      </text>
    </svg>
  );
}

export function CircuitDiagram({ spec }: { spec: DiagramSpec }) {
  switch (spec.key) {
    case 'series-lamp':
      return <SeriesLamp currentAt={spec.currentAt} />;
    case 'series-resistor':
      return <SeriesResistor currentAt={spec.currentAt} voltageAcross={spec.voltageAcross} />;
    case 'series-two-resistors':
      return <SeriesTwoResistors voltageAcross={spec.voltageAcross} equalResistors={spec.equalResistors} />;
    case 'parallel-two':
      return <ParallelTwo currentAt={spec.currentAt} branches={spec.branches} equalResistors={spec.equalResistors} voltageAcross={spec.voltageAcross} />;
    default:
      return null;
  }
}
