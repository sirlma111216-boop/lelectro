import type { InquiryDefinition, MeasurementSlot } from './types';
import { closeEnough, meanOf, predictedText } from './feedbackUtils';

type Where = 'total' | 'branch1' | 'branch2';

function currentSlot(group: 'A' | 'B' | 'C', where: Where): MeasurementSlot {
  const groupLabel = group === 'A' ? '조건 A: 가지 하나만' : group === 'B' ? '조건 B: 같은 저항 가지 두 개' : '조건 C: 다른 저항 가지 두 개';
  const branches = group === 'A' ? { b1: true, b2: false } : { b1: true, b2: true };
  const whereLabel = where === 'total' ? 'I전체 (전원 바로 옆)' : where === 'branch1' ? 'I1 (가지 1)' : 'I2 (가지 2)';
  const placeText =
    where === 'total'
      ? '전원 (+) 와 가지가 갈라지는 점 사이'
      : where === 'branch1'
        ? '가지 1 의 스위치와 저항 사이'
        : '가지 2 의 스위치와 저항 사이';
  return {
    id: `${group}-${where === 'total' ? 'Itotal' : where === 'branch1' ? 'I1' : 'I2'}`,
    label: `${groupLabel} · ${whereLabel}`,
    shortLabel: `${group}·${where === 'total' ? 'I전' : where === 'branch1' ? 'I1' : 'I2'}`,
    roles: ['current'],
    optionalRoles: ['voltage'],
    group,
    groupLabel,
    steps: [
      '전원을 끈다.',
      `${placeText}의 도선을 떼어 내고 그 자리에 전류 센서를 직렬로 끼운다 (빨간 리드가 (+) 쪽).`,
      '이전에 센서가 있던 자리는 반드시 도선으로 다시 이어서 열린 회로가 남지 않게 한다.',
      group === 'A' ? '가지 2 의 스위치는 연 채로 둔다.' : '두 가지의 스위치를 모두 닫는다.',
      '전원을 켜고 안정되면 저장한다. 전압 센서가 있으면 전원 양단 전압을 함께 기록할 수 있다.',
    ],
    diagram: { key: 'parallel-two', currentAt: where, branches, equalResistors: group !== 'C', voltageAcross: 'supply' },
    mockPreset: {
      topology: 'parallel',
      branch1Closed: branches.b1,
      branch2Closed: branches.b2,
      r1: 100,
      r2: group === 'C' ? 220 : 100,
      currentProbe: where,
      voltageProbe: 'supply',
    },
  };
}

const openBranchSlot: MeasurementSlot = {
  id: 'B-I1-open2',
  label: '선택: 가지 2 를 열었을 때 가지 1 전류',
  shortLabel: 'I1(2열)',
  roles: ['current'],
  optionalRoles: ['voltage'],
  group: 'B',
  groupLabel: '조건 B: 같은 저항 가지 두 개',
  optional: true,
  steps: ['전류 센서를 가지 1 에 둔 채로 전원을 끄고 가지 2 의 스위치를 연다.', '전원을 켜고 가지 1 의 전류가 어떻게 달라지는지 저장한다.'],
  diagram: { key: 'parallel-two', currentAt: 'branch1', branches: { b1: true, b2: false }, equalResistors: true, voltageAcross: 'supply' },
  mockPreset: { topology: 'parallel', branch1Closed: true, branch2Closed: false, r1: 100, r2: 100, currentProbe: 'branch1', voltageProbe: 'supply' },
};

export const inquiry4: InquiryDefinition = {
  id: 4,
  slug: 'parallel-current',
  title: '병렬 가지를 추가하면 전체 전류는 어떻게 달라질까?',
  question: '병렬 회로에서 가지를 하나 더 연결하면 전체 전류와 각 가지의 전류는 어떻게 되는가?',
  curriculum: ['[9과14-03]'],
  summary: '가지 하나 → 같은 저항 가지 두 개 → 다른 저항 가지 두 개로 바꿔 가며 전체 전류와 가지 전류를 잰다.',
  requiredSensors: ['current'],
  optionalSensors: ['voltage'],
  materials: ['저전압 전원(1.5~3 V)', '가지마다 스위치와 저항이 있는 병렬 회로(저항 예: 100 Ω, 100 Ω, 220 Ω)', '전류 센서 1개(GDX-CUR)', '전압 센서 1개(GDX-VOLT, 선택)', '연결 도선'],
  safety: [
    '전류 센서는 끊은 자리에 직렬로 넣는다. 전원 양단에 직접 연결하지 않는다.',
    '센서를 옮길 때는 전원을 끄고, 센서를 뺀 자리를 도선으로 복원한다.',
    '가지가 늘면 전체 전류가 커진다. 전원의 전류 제한과 센서 범위를 확인한다.',
  ],
  setupChecklist: [
    { id: 'parallel', text: '두 가지가 같은 두 점(전원 양쪽)에 연결되어 있다.' },
    { id: 'switch', text: '각 가지에 스위치가 있어 독립적으로 열고 닫을 수 있다.' },
    { id: 'restore', text: '센서를 뺀 자리를 도선으로 이어 열린 회로가 없다.' },
    { id: 'range', text: '전류 센서 범위 스위치를 확인하고 앱에 선택했다.' },
  ],
  predictionIntro: '가지 하나만 연결했다가 가지를 하나 더 연결할 것이다. 전체 전류와 원래 있던 가지의 전류가 어떻게 될지 예상해 보자.',
  predictionFields: [
    {
      id: 'total_change',
      type: 'choice',
      label: '같은 저항의 가지를 하나 더 연결하면 전체 전류는?',
      options: [
        { value: 'up', label: '커진다' },
        { value: 'down', label: '작아진다' },
        { value: 'same', label: '변하지 않는다' },
      ],
    },
    {
      id: 'existing_branch',
      type: 'choice',
      label: '가지가 추가되면 원래 있던 가지 1 의 전류는?',
      options: [
        { value: 'up', label: '커진다' },
        { value: 'down', label: '작아진다' },
        { value: 'same', label: '거의 변하지 않는다' },
      ],
    },
    {
      id: 'diff_split',
      type: 'choice',
      label: '두 가지의 저항이 다르면(R2 가 더 큼) 전류는 어떻게 나뉠까?',
      options: [
        { value: 'half', label: '반씩 나뉜다' },
        { value: 'smaller_more', label: '저항이 작은 가지(R1)에 더 많이 흐른다' },
        { value: 'bigger_more', label: '저항이 큰 가지(R2)에 더 많이 흐른다' },
      ],
    },
    {
      id: 'constant_source',
      type: 'choice',
      label: '"전원에서는 언제나 일정한 전류가 나온다" 는 생각에 대해',
      options: [
        { value: 'agree', label: '동의한다' },
        { value: 'disagree', label: '동의하지 않는다' },
        { value: 'unsure', label: '잘 모르겠다' },
      ],
    },
    { id: 'reason', type: 'text', label: '그렇게 생각한 이유' },
  ],
  slots: [
    currentSlot('A', 'total'),
    currentSlot('B', 'total'),
    currentSlot('B', 'branch1'),
    currentSlot('B', 'branch2'),
    openBranchSlot,
    currentSlot('C', 'total'),
    currentSlot('C', 'branch1'),
    currentSlot('C', 'branch2'),
  ],
  observationTips: [
    '조건 A(가지 하나)의 전체 전류를 먼저 재고, 조건 B·C 에서는 I전체 → I1 → I2 순서로 잰다.',
    '전압 센서가 있으면 전원 양단 전압을 함께 기록해 전압이 유지되는지 확인한다. 전압을 재지 않았다면 그 조건은 확인되지 않은 것이다.',
    '한 가지를 열었다 닫으며 다른 가지의 전류가 어떻게 되는지 관찰해 보자.',
  ],
  explanationPrompts: {
    claim: '병렬 회로에서 전체 전류와 가지 전류의 관계에 대한 나의 주장은?',
    evidence: 'I전체, I1, I2 중 어떤 측정값이 주장을 뒷받침하는가?',
    concept: '가지를 더 연결했을 때 전체 전류가 달라진 까닭을 전하가 지나는 길의 수와 연결해 설명해 보자.',
    change: '처음 예측(전체 전류 변화, 가지 1 의 변화, 전원 전류가 일정하다는 생각)과 달라진 점은?',
    further: '가지를 세 개로 늘리면? 한 가지를 열면 다른 가지는 어떻게 될까?',
  },
  conceptNotes: [
    '병렬 회로에서 전체 전류는 각 가지 전류를 더한 값과 거의 같다.',
    '가지를 추가하면 전하가 지나갈 길이 늘어 전체 전류가 커지고, 전원 전압이 유지되면 원래 가지의 전류는 거의 그대로다.',
    '저항이 다르면 저항이 작은 가지에 더 많은 전류가 흐른다. 전원은 "일정한 전류" 를 내보내는 것이 아니다.',
  ],
  feedback(session) {
    const out: string[] = [];
    const tol = 8;
    const iA = meanOf(session, 'A-Itotal', 'current');
    const iB = meanOf(session, 'B-Itotal', 'current');
    const i1 = meanOf(session, 'B-I1', 'current');
    const i2 = meanOf(session, 'B-I2', 'current');
    const total = predictedText(session, 'total_change');
    const constant = predictedText(session, 'constant_source');
    if (iB !== null && i1 !== null && i2 !== null) {
      if (closeEnough(i1 + i2, iB, tol)) out.push('I1 + I2 가 I전체와 거의 같습니다. 이 관계를 전하가 갈라졌다가 다시 모이는 그림으로 설명해 볼까요?');
      else out.push('I1 + I2 와 I전체의 차이가 큽니다. 세 측정 사이에 센서를 뺀 자리를 도선으로 복원했는지, 전원 전압이 달라지지 않았는지 확인해 볼까요?');
    }
    if (iA !== null && iB !== null) {
      if (iB > iA * 1.2) {
        out.push('가지를 추가하자 전체 전류가 커졌습니다.' + (total !== 'up' ? ' 처음 예측과 다른 결과인데, 전원에서 나오는 전류가 일정하다는 생각과 어떻게 연결되나요?' : ' 이 결과를 전하가 지나갈 길의 수로 설명할 수 있을까요?'));
        if (constant === 'agree') out.push('처음에는 "전원에서는 언제나 일정한 전류가 나온다" 에 동의했습니다. 조건 A 와 B 의 전체 전류를 비교해 생각을 다시 적어 볼까요?');
      } else if (closeEnough(iA, iB, tol)) {
        out.push('가지를 추가했는데 전체 전류가 거의 같습니다. 가지 2 의 스위치가 실제로 닫혀 있었는지, 센서를 뺀 자리가 열린 채로 남지 않았는지 확인해 볼까요?');
      }
    }
    const i1A = meanOf(session, 'A-Itotal', 'current');
    if (i1A !== null && i1 !== null && closeEnough(i1A, i1, tol)) {
      out.push('가지 하나일 때의 전류와 가지가 둘일 때 가지 1 의 전류가 거의 같습니다. 가지가 추가되어도 가지 1 에 걸리는 전압은 어떻게 되었을까요?');
    }
    const c1 = meanOf(session, 'C-I1', 'current');
    const c2 = meanOf(session, 'C-I2', 'current');
    if (c1 !== null && c2 !== null && closeEnough(c1, c2, 10) === false) {
      out.push(`저항이 다른 두 가지의 전류가 서로 다릅니다 (${c1 > c2 ? 'R1 쪽이 더 큼' : 'R2 쪽이 더 큼'}). 어느 가지의 저항이 작은지와 연결해 설명해 볼까요?`);
    }
    const hasVoltage = session.records.some((r) => r.stats.voltage);
    if (!hasVoltage && session.records.length > 0) {
      out.push('이번 측정에서는 전원 전압을 재지 않았습니다. "전원 전압이 유지되었다" 고 말하려면 무엇을 더 재야 할까요?');
    }
    return out;
  },
  mockDefaults: { topology: 'parallel', load1: 'resistor', r1: 100, r2: 100, branch1Closed: true, branch2Closed: false, supplyVoltage: 3, currentProbe: 'total', voltageProbe: 'supply' },
  comparisonTolerancePct: 8,
};
