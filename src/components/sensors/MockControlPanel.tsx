/**
 * 연습 모드 전용: 모의 회로 조작 패널.
 * 실제 회로에서 손으로 바꾸는 것(전원 전압, 센서 위치, 스위치)만 조작한다.
 */
import { useStore } from 'zustand';
import { mockCircuitStore, setMockCircuit, type MockCurrentProbe, type MockVoltageProbe } from '@/sensors/mock/mockCircuit';
import type { InquiryDefinition } from '@/inquiries/types';
import { Notice } from '@/components/common/Notice';

const CURRENT_OPTS: Record<'series' | 'parallel', Array<{ v: MockCurrentProbe; l: string }>> = {
  series: [
    { v: 'A', l: 'A (전구/저항 앞)' },
    { v: 'B', l: 'B (전구/저항 뒤)' },
    { v: 'C', l: 'C (전지로 돌아가는 구간)' },
    { v: 'shorted', l: '리드 단락 (영점용)' },
    { v: 'none', l: '회로에서 분리' },
  ],
  parallel: [
    { v: 'total', l: 'I전체 (전원 옆)' },
    { v: 'branch1', l: 'I1 (가지 1)' },
    { v: 'branch2', l: 'I2 (가지 2)' },
    { v: 'shorted', l: '리드 단락 (영점용)' },
    { v: 'none', l: '회로에서 분리' },
  ],
};
const VOLTAGE_OPTS: Array<{ v: MockVoltageProbe; l: string }> = [
  { v: 'supply', l: '전원 양단' },
  { v: 'r1', l: 'R1 양단' },
  { v: 'r2', l: 'R2 양단' },
  { v: 'total', l: '두 저항 전체 양단' },
  { v: 'shorted', l: '클립 단락 (영점용)' },
  { v: 'none', l: '회로에서 분리' },
];

export function MockControlPanel({ def }: { def: InquiryDefinition }) {
  const s = useStore(mockCircuitStore);
  return (
    <div className="card" style={{ borderColor: 'var(--mock)' }} data-testid="mock-panel">
      <div className="card-title">
        <h3 style={{ color: 'var(--mock)' }}>모의 회로 조작 (연습 모드)</h3>
        <span className="badge badge-mock">모의 데이터</span>
      </div>
      <Notice kind="mock">실제 장치가 아닙니다. 실제 수업에서는 손으로 회로를 바꾸고 센서를 옮긴 뒤 측정합니다.</Notice>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div className="stack stack-sm">
          <div className="field">
            <label htmlFor="mock-v">전원 설정 전압: {s.supplyVoltage.toFixed(1)} V</label>
            <input id="mock-v" type="range" min={0} max={6} step={0.1} value={s.supplyVoltage} onChange={(e) => setMockCircuit({ supplyVoltage: Number(e.target.value) })} />
          </div>
          <label className="choice" style={{ display: 'inline-flex' }}>
            <input type="checkbox" checked={s.mainSwitch} onChange={(e) => setMockCircuit({ mainSwitch: e.target.checked })} /> 전원 스위치 켜짐
          </label>
          {s.topology === 'parallel' && (
            <div className="row">
              <label className="choice">
                <input type="checkbox" checked={s.branch1Closed} onChange={(e) => setMockCircuit({ branch1Closed: e.target.checked })} /> 가지 1 스위치 닫힘
              </label>
              <label className="choice">
                <input type="checkbox" checked={s.branch2Closed} onChange={(e) => setMockCircuit({ branch2Closed: e.target.checked })} /> 가지 2 스위치 닫힘
              </label>
            </div>
          )}
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="mock-r1">{def.id === 1 ? '전구 저항 모형 (Ω)' : 'R1 (Ω)'}</label>
              <input id="mock-r1" type="number" min={1} max={10000} value={s.r1} onChange={(e) => setMockCircuit({ r1: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            {(s.useR2 || s.topology === 'parallel') && (
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="mock-r2">R2 (Ω)</label>
                <input id="mock-r2" type="number" min={1} max={10000} value={s.r2} onChange={(e) => setMockCircuit({ r2: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
            )}
          </div>
        </div>
        <div className="stack stack-sm">
          <div className="field">
            <label htmlFor="mock-ip">전류 센서 위치</label>
            <select id="mock-ip" value={s.currentProbe} onChange={(e) => setMockCircuit({ currentProbe: e.target.value as MockCurrentProbe })}>
              {CURRENT_OPTS[s.topology].map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mock-vp">전압 센서 위치</label>
            <select id="mock-vp" value={s.voltageProbe} onChange={(e) => setMockCircuit({ voltageProbe: e.target.value as MockVoltageProbe })}>
              {VOLTAGE_OPTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label className="choice">
              <input type="checkbox" checked={s.currentDisconnected} onChange={(e) => setMockCircuit({ currentDisconnected: e.target.checked })} /> 전류 센서 연결 끊김 시뮬레이션
            </label>
            <label className="choice">
              <input type="checkbox" checked={s.voltageDisconnected} onChange={(e) => setMockCircuit({ voltageDisconnected: e.target.checked })} /> 전압 센서 연결 끊김 시뮬레이션
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
