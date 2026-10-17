import type { InquiryDefinition, MeasurementSlot } from './types';
import { closeEnough, meanOf, predictedText } from './feedbackUtils';

function slot(group: 'A' | 'B', which: 'V1' | 'V2' | 'Vtotal'): MeasurementSlot {
  const equal = group === 'A';
  const groupLabel = equal ? '조건 A: 같은 저항 두 개' : '조건 B: 서로 다른 저항 두 개';
  const across = which === 'V1' ? 'r1' : which === 'V2' ? 'r2' : 'total';
  const where =
    which === 'V1'
      ? '첫 번째 저항(R1)의 양 끝'
      : which === 'V2'
        ? '두 번째 저항(R2)의 양 끝'
        : '두 저항 전체의 양 끝 (R1 의 바깥쪽 끝과 R2 의 바깥쪽 끝)';
  return {
    id: `${group}-${which}`,
    label: `${groupLabel} · ${which === 'Vtotal' ? 'V전체' : which}`,
    shortLabel: `${group}·${which === 'Vtotal' ? 'V전' : which}`,
    roles: ['voltage'],
    group,
    groupLabel,
    steps: [
      '전원을 끈 상태에서 두 저항을 전원과 직렬로 연결한다.',
      `전압 센서의 빨간 클립을 ${where} 중 전원 (+) 에 가까운 점에, 검은 클립을 (−) 에 가까운 점에 물린다.`,
      '전압은 두 점 사이의 차이이므로 반드시 두 점에 물려야 한다.',
      '전원을 켜고 값이 안정되면 저장한다. 값이 음수로 나오면 두 클립의 방향을 확인한다.',
    ],
    diagram: { key: 'series-two-resistors', voltageAcross: across, equalResistors: equal },
    mockPreset: { useR2: true, r1: 100, r2: equal ? 100 : 220, voltageProbe: across, currentProbe: 'none' },
  };
}

export const inquiry3: InquiryDefinition = {
  id: 3,
  slug: 'series-voltage',
  title: '직렬 회로의 전압은 어떻게 나뉠까?',
  question: '저항 두 개를 직렬로 연결하면 전체 전압과 각 저항 양단의 전압은 어떤 관계일까?',
  curriculum: ['[9과14-03]'],
  summary: '같은 저항 두 개와 다른 저항 두 개를 직렬로 연결하고 V1, V2, V전체를 차례로 재어 비교한다.',
  requiredSensors: ['voltage'],
  optionalSensors: [],
  materials: ['저전압 전원(1.5~3 V)', '저항 두 개(같은 값 2개 + 다른 값 1개, 예: 100 Ω, 100 Ω, 220 Ω)', '전압 센서 1개(GDX-VOLT)', '연결 도선'],
  safety: [
    '전압 센서는 측정하려는 부품의 양단에 병렬로 연결한다.',
    '배선을 바꾸기 전에 전원을 끈다.',
    '저항의 소비 전력이 정격 안에 있는지 준비 화면의 계산표로 확인한다.',
  ],
  setupChecklist: [
    { id: 'series', text: '두 저항이 전원과 하나의 고리(직렬)로 연결되어 있다.' },
    { id: 'leads', text: '전압 센서 빨간·검은 클립이 측정 대상의 양 끝 두 점에 물려 있다.' },
    { id: 'values', text: '조건 A 는 같은 저항 두 개, 조건 B 는 서로 다른 저항 두 개를 썼다.' },
  ],
  predictionIntro: '전원 전압이 같을 때, 직렬로 연결한 두 저항 각각에 걸리는 전압과 전체 전압을 예상해 보자.',
  predictionFields: [
    {
      id: 'same_split',
      type: 'choice',
      label: '같은 저항 두 개일 때 V1 과 V2 는?',
      options: [
        { value: 'equal', label: '서로 같다' },
        { value: 'v1', label: 'V1 이 더 크다' },
        { value: 'v2', label: 'V2 가 더 크다' },
      ],
    },
    {
      id: 'diff_split',
      type: 'choice',
      label: '서로 다른 저항 두 개(R2 가 더 큼)일 때는?',
      options: [
        { value: 'bigger', label: '저항이 큰 쪽(R2)의 전압이 더 크다' },
        { value: 'smaller', label: '저항이 작은 쪽(R1)의 전압이 더 크다' },
        { value: 'equal', label: '저항과 상관없이 같다' },
      ],
    },
    {
      id: 'sum',
      type: 'choice',
      label: 'V전체 와 V1 + V2 를 비교하면?',
      options: [
        { value: 'equal', label: '거의 같다' },
        { value: 'total_bigger', label: 'V전체 가 더 크다' },
        { value: 'sum_bigger', label: 'V1 + V2 가 더 크다' },
      ],
    },
    {
      id: 'always_half',
      type: 'choice',
      label: '"직렬이면 언제나 전압이 반씩 나뉜다" 는 생각에 대해',
      options: [
        { value: 'agree', label: '동의한다' },
        { value: 'depends', label: '저항에 따라 다르다' },
        { value: 'disagree', label: '동의하지 않는다' },
      ],
    },
    { id: 'reason', type: 'text', label: '그렇게 생각한 이유' },
  ],
  slots: [slot('A', 'V1'), slot('A', 'V2'), slot('A', 'Vtotal'), slot('B', 'V1'), slot('B', 'V2'), slot('B', 'Vtotal')],
  observationTips: [
    '각 조건에서 V1 → V2 → V전체 순서로 측정한다.',
    '클립 방향이 반대면 음수가 나온다. 절댓값으로 바꾸지 말고 연결 방향을 확인한 뒤 다시 측정한다.',
    '측정값의 차이는 그대로 둔다. 합이 정확히 같지 않아도 그 차이가 얼마나 되는지 보는 것이 중요하다.',
  ],
  explanationPrompts: {
    claim: '직렬 회로에서 전체 전압과 부분 전압의 관계에 대한 나의 주장은?',
    evidence: '기록표의 V1, V2, V전체 값 중 어떤 것이 주장을 뒷받침하는가?',
    concept: '전압이 "나뉜다" 는 것은 전하가 각 저항을 지나며 무엇을 잃는다는 뜻일까?',
    change: '같은 저항일 때와 다른 저항일 때, 처음 예측과 달라진 점은?',
    further: '저항을 세 개로 하면? 저항 값을 더 크게 바꾸면?',
  },
  conceptNotes: [
    '직렬 회로에서 각 저항 양단 전압을 더하면 전체 전압과 거의 같다.',
    '저항이 같으면 전압이 비슷하게 나뉘고, 저항이 다르면 저항이 큰 쪽에 더 큰 전압이 걸린다.',
    '"언제나 반씩" 은 저항이 같을 때만 맞는 말이다.',
  ],
  feedback(session) {
    const out: string[] = [];
    const tol = 5;
    for (const g of ['A', 'B'] as const) {
      const v1 = meanOf(session, `${g}-V1`, 'voltage');
      const v2 = meanOf(session, `${g}-V2`, 'voltage');
      const vt = meanOf(session, `${g}-Vtotal`, 'voltage');
      const label = g === 'A' ? '같은 저항(A)' : '다른 저항(B)';
      if ([v1, v2, vt].some((v) => v !== null && v < 0)) {
        out.push(`${label} 조건에 음수 전압이 있습니다. 전압 센서의 빨간·검은 클립 방향이 서로 다르게 연결된 것은 아닐까요?`);
      }
      if (v1 !== null && v2 !== null && vt !== null) {
        const same = closeEnough(v1 + v2, vt, tol);
        if (same) out.push(`${label} 조건에서 V1 + V2 가 V전체와 거의 같습니다. 이 결과를 전하의 에너지로 어떻게 설명할 수 있을까요?`);
        else out.push(`${label} 조건에서 V1 + V2 와 V전체의 차이가 큽니다. 세 측정 사이에 전원 전압이 달라지지 않았는지, 클립이 정확한 두 점에 물렸는지 확인해 볼까요?`);
      }
    }
    const a1 = meanOf(session, 'A-V1', 'voltage');
    const a2 = meanOf(session, 'A-V2', 'voltage');
    const b1 = meanOf(session, 'B-V1', 'voltage');
    const b2 = meanOf(session, 'B-V2', 'voltage');
    const half = predictedText(session, 'always_half');
    if (a1 !== null && a2 !== null && b1 !== null && b2 !== null) {
      const aEqual = closeEnough(a1, a2, 10);
      const bEqual = closeEnough(b1, b2, 10);
      if (aEqual && bEqual === false) {
        out.push('같은 저항일 때는 전압이 비슷하게 나뉘었지만 다른 저항일 때는 그렇지 않았습니다. "직렬이면 언제나 반씩" 이라는 생각은 어떤 경우에만 맞을까요?');
        if (half === 'agree') out.push('처음에는 "언제나 반씩 나뉜다" 에 동의했습니다. 조건 B 의 결과를 보고 생각이 어떻게 달라졌나요?');
      }
    }
    return out;
  },
  mockDefaults: { topology: 'series', load1: 'resistor', r1: 100, r2: 100, useR2: true, supplyVoltage: 3, currentProbe: 'none', voltageProbe: 'r1' },
  comparisonTolerancePct: 5,
};
