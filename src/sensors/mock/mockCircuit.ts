/**
 * 연습 모드(모의 데이터)용 회로 모형.
 * 사용자가 실제 회로에서 손으로 바꾸는 것(전원 전압, 센서 위치, 가지 스위치)만 조작하게 하고,
 * 모의 센서는 이 상태를 읽어 값을 만든다. 실제 장치를 제어하는 것이 아니다.
 */
import { createStore } from 'zustand/vanilla';

export type MockTopology = 'series' | 'parallel';
export type MockCurrentProbe = 'none' | 'shorted' | 'A' | 'B' | 'C' | 'total' | 'branch1' | 'branch2';
export type MockVoltageProbe = 'none' | 'shorted' | 'supply' | 'r1' | 'r2' | 'total';

export interface MockCircuitState {
  topology: MockTopology;
  /** 전원 설정 전압 (V) */
  supplyVoltage: number;
  /** 전원 내부 저항 (Ω) — 전류가 흐르면 단자 전압이 조금 떨어지게 한다 */
  internalResistance: number;
  /** 첫 번째 부하 종류. 전구는 전류에 따라 저항이 커지는 비선형 모형 */
  load1: 'resistor' | 'lamp';
  r1: number;
  r2: number;
  /** 직렬 회로에서 두 번째 저항을 쓰는지 (탐구 3) */
  useR2: boolean;
  mainSwitch: boolean;
  branch1Closed: boolean;
  branch2Closed: boolean;
  currentProbe: MockCurrentProbe;
  voltageProbe: MockVoltageProbe;
  /** 상대 잡음 비율 */
  noise: number;
  /** 모의 연결 끊김 */
  currentDisconnected: boolean;
  voltageDisconnected: boolean;
}

export const defaultMockCircuit: MockCircuitState = {
  topology: 'series',
  supplyVoltage: 3.0,
  internalResistance: 0.8,
  load1: 'resistor',
  r1: 100,
  r2: 100,
  useR2: false,
  mainSwitch: true,
  branch1Closed: true,
  branch2Closed: false,
  currentProbe: 'A',
  voltageProbe: 'supply',
  noise: 0.004,
  currentDisconnected: false,
  voltageDisconnected: false,
};

export const mockCircuitStore = createStore<MockCircuitState>(() => ({ ...defaultMockCircuit }));

export function setMockCircuit(patch: Partial<MockCircuitState>) {
  mockCircuitStore.setState(patch);
}
export function resetMockCircuit(patch: Partial<MockCircuitState> = {}) {
  mockCircuitStore.setState({ ...defaultMockCircuit, ...patch }, true);
}

/** 전구 모형: 차가울 때 저항 R0, 전류가 커지면 저항 증가 */
function lampResistance(r0: number, current: number): number {
  return r0 * (1 + 2.5 * Math.min(Math.abs(current), 0.5));
}

export interface MockSolution {
  /** 전원 단자 전압 */
  terminalVoltage: number;
  seriesCurrent: number;
  v1: number;
  v2: number;
  branch1Current: number;
  branch2Current: number;
  totalCurrent: number;
}

/** 잡음 없는 회로 해 */
export function solveMockCircuit(s: MockCircuitState): MockSolution {
  if (!s.mainSwitch) {
    return {
      terminalVoltage: s.supplyVoltage,
      seriesCurrent: 0,
      v1: 0,
      v2: 0,
      branch1Current: 0,
      branch2Current: 0,
      totalCurrent: 0,
    };
  }
  if (s.topology === 'series') {
    // 전류 센서를 뺀 자리는 안내대로 도선으로 복원했다고 보고 닫힌 회로로 계산한다.
    let r1 = s.r1;
    let i = 0;
    const r2 = s.useR2 ? s.r2 : 0;
    // 전구 비선형 반복 풀이
    for (let k = 0; k < 6; k++) {
      const rl = s.load1 === 'lamp' ? lampResistance(s.r1, i) : s.r1;
      r1 = rl;
      i = s.supplyVoltage / (rl + r2 + s.internalResistance);
    }
    const terminal = s.supplyVoltage - i * s.internalResistance;
    return {
      terminalVoltage: terminal,
      seriesCurrent: i,
      v1: i * r1,
      v2: i * r2,
      branch1Current: i,
      branch2Current: 0,
      totalCurrent: i,
    };
  }
  // 병렬
  let g = 0;
  if (s.branch1Closed) g += 1 / s.r1;
  if (s.branch2Closed) g += 1 / s.r2;
  const rEq = g > 0 ? 1 / g : Infinity;
  const total = g > 0 ? s.supplyVoltage / (rEq + s.internalResistance) : 0;
  const terminal = s.supplyVoltage - total * s.internalResistance;
  const i1 = s.branch1Closed ? terminal / s.r1 : 0;
  const i2 = s.branch2Closed ? terminal / s.r2 : 0;
  return {
    terminalVoltage: terminal,
    seriesCurrent: total,
    v1: terminal,
    v2: terminal,
    branch1Current: i1,
    branch2Current: i2,
    totalCurrent: total,
  };
}

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 전류 센서가 읽을 값 (A) */
export function mockCurrentReading(s: MockCircuitState, sol: MockSolution): number {
  let base: number;
  switch (s.currentProbe) {
    case 'A':
    case 'B':
    case 'C':
      base = sol.seriesCurrent;
      break;
    case 'total':
      base = sol.totalCurrent;
      break;
    case 'branch1':
      base = sol.branch1Current;
      break;
    case 'branch2':
      base = sol.branch2Current;
      break;
    case 'shorted':
    case 'none':
    default:
      base = 0;
  }
  const noiseAbs = Math.max(Math.abs(base) * s.noise, 0.00005);
  const offset = 0.0002; // 영점 보정 연습용 작은 오프셋
  return base + offset + gaussian() * noiseAbs;
}

/** 전압 센서가 읽을 값 (V) */
export function mockVoltageReading(s: MockCircuitState, sol: MockSolution): number {
  let base: number;
  switch (s.voltageProbe) {
    case 'supply':
      base = sol.terminalVoltage;
      break;
    case 'r1':
      base = sol.v1;
      break;
    case 'r2':
      base = sol.v2;
      break;
    case 'total':
      base = s.topology === 'series' ? sol.v1 + sol.v2 : sol.terminalVoltage;
      break;
    case 'shorted':
    case 'none':
    default:
      base = 0;
  }
  const noiseAbs = Math.max(Math.abs(base) * s.noise, 0.002);
  const offset = 0.004;
  return base + offset + gaussian() * noiseAbs;
}
