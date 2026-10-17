import type { InquiryDefinition } from './types';
import { closeEnough, includesAny, meanOf, predictedBars, predictedText } from './feedbackUtils';

const CLAIM = '전구가 켜지면서 전류를 사용하므로 전구 뒤의 전류가 작아질 것이다.';

const commonSteps = (where: string) => [
  '전원(또는 스위치)을 끈다.',
  `${where} 도선을 하나 떼어 낸다.`,
  '떼어 낸 두 끝 사이에 전류 센서를 직렬로 끼운다. 빨간 리드가 전지 (+) 쪽을 향하게 한다.',
  '이전 측정 위치에 센서가 있었다면 그 자리는 도선으로 다시 이어 닫힌 회로를 만든다.',
  '배선을 확인한 뒤 전원을 켜고 값이 안정되면 안정 구간을 저장한다.',
];

export const inquiry1: InquiryDefinition = {
  id: 1,
  slug: 'lamp-current',
  title: '전구를 지나면 전류가 줄어들까?',
  question: '전구 앞(A), 전구 뒤(B), 전지로 돌아가는 구간(C)의 전류 크기는 어떻게 다를까?',
  curriculum: ['[9과14-02]'],
  summary: '분기 없는 하나의 닫힌 회로에서 전류 센서를 세 위치에 차례로 넣어 전류 크기를 비교한다.',
  requiredSensors: ['current'],
  optionalSensors: [],
  materials: ['저전압 전원 또는 전지(1.5~3 V)', '정격이 맞는 전구', '스위치', '전류 센서 1개(GDX-CUR)', '연결 도선'],
  safety: [
    '전류 센서는 반드시 회로에 직렬로 넣는다. 전원 양단에 직접 연결하면 안 된다.',
    '배선을 바꾸기 전에 항상 전원을 끈다.',
    '전구 정격 전압과 예상 전류를 확인하고, 전류 센서 범위 스위치(±1 A / ±0.1 A)를 예상 전류에 맞춘다.',
    '앱의 "측정 정지" 는 전원을 끄지 않는다. 전원은 직접 끈다.',
  ],
  setupChecklist: [
    { id: 'closed', text: '전지–스위치–전구가 하나의 닫힌 회로로 연결되어 있다 (분기 없음).' },
    { id: 'series', text: '전류 센서는 끊은 자리에 직렬로 들어가 있다.' },
    { id: 'range', text: '전류 센서의 범위 스위치를 확인하고 앱에 같은 값을 선택했다.' },
    { id: 'lamp', text: '전구 정격이 전원 전압에 맞는다.' },
  ],
  predictionIntro:
    '전류 센서를 A(전구 앞), B(전구 뒤), C(전지로 돌아가는 구간)에 차례로 넣어 전류를 측정할 예정이다. 측정하기 전에 세 위치의 전류 크기를 예상해 보자.',
  predictionFields: [
    {
      id: 'bars',
      type: 'bars',
      label: '세 위치의 전류 크기를 막대 높이로 비교해 보자 (크기 비교만 하면 된다)',
      items: [
        { id: 'A', label: 'A 전구 앞' },
        { id: 'B', label: 'B 전구 뒤' },
        { id: 'C', label: 'C 전지로 돌아감' },
      ],
    },
    {
      id: 'claim_stance',
      type: 'choice',
      label: `다음 주장에 대해 어떻게 생각하나요? "${CLAIM}"`,
      options: [
        { value: 'agree', label: '동의한다' },
        { value: 'partly', label: '부분적으로 동의한다' },
        { value: 'disagree', label: '동의하지 않는다' },
      ],
    },
    { id: 'claim_reason', type: 'text', label: '그렇게 생각한 이유를 적어 보자', placeholder: '예: 전구가 빛을 내려면 ... 때문에' },
  ],
  slots: [
    {
      id: 'A',
      label: 'A: 전구 앞',
      shortLabel: 'A',
      roles: ['current'],
      steps: commonSteps('전지 (+) 와 전구 사이의'),
      diagram: { key: 'series-lamp', currentAt: 'A' },
      mockPreset: { currentProbe: 'A' },
    },
    {
      id: 'B',
      label: 'B: 전구 뒤',
      shortLabel: 'B',
      roles: ['current'],
      steps: commonSteps('전구와 스위치(또는 전지 −) 사이의'),
      diagram: { key: 'series-lamp', currentAt: 'B' },
      mockPreset: { currentProbe: 'B' },
    },
    {
      id: 'C',
      label: 'C: 전지로 돌아가는 구간',
      shortLabel: 'C',
      roles: ['current'],
      steps: commonSteps('전지 (−) 로 돌아가는'),
      diagram: { key: 'series-lamp', currentAt: 'C' },
      mockPreset: { currentProbe: 'C' },
    },
    {
      id: 'A2',
      label: 'A 재확인: 전구 앞 (마지막)',
      shortLabel: 'A′',
      roles: ['current'],
      steps: [...commonSteps('전지 (+) 와 전구 사이의'), '처음 A 측정과 비교하기 위한 재확인이다. 전지가 소모되거나 접촉이 달라졌을 수 있다.'],
      diagram: { key: 'series-lamp', currentAt: 'A' },
      mockPreset: { currentProbe: 'A' },
    },
  ],
  observationTips: [
    'A → B → C → A(재확인) 순서로 측정한다.',
    '순차 측정이므로 측정 사이에 전지 상태나 접촉 상태가 달라질 수 있다. 관찰 메모에 남기자.',
    '값이 완전히 같지 않더라도 곧바로 "다르다" 고 결론 내리지 말고 표준편차와 반복 측정을 함께 보자.',
  ],
  explanationPrompts: {
    claim: '전구 앞·뒤·돌아가는 구간의 전류 크기에 대해 내가 주장하는 것은?',
    evidence: '기록표에서 어떤 측정값이 이 주장을 뒷받침하는가? (측정값을 인용해 보자)',
    concept: '전류와, 전구에서 빛·열로 바뀌는 에너지는 어떻게 다른가?',
    change: '처음 예측과 달라진 점이 있다면 무엇인가? 달라지지 않았다면 그 이유는?',
    further: '더 확인하고 싶은 점은? (예: 전구를 두 개로 하면?)',
  },
  conceptNotes: [
    '전류는 전하가 흐르는 양이다. 분기 없는 회로에서는 어느 지점에서나 같은 양의 전하가 지나간다.',
    '전구에서 줄어드는 것은 전류가 아니라 전하가 가진 에너지(전압으로 나타남)다. 전하 자체가 전구에서 사라지지 않는다.',
    '측정값의 작은 차이는 전지 소모, 접촉 저항, 센서 해상도 때문일 수 있다.',
  ],
  feedback(session) {
    const out: string[] = [];
    const tol = 5;
    const a = meanOf(session, 'A', 'current', 'first');
    const b = meanOf(session, 'B', 'current');
    const c = meanOf(session, 'C', 'current');
    const a2 = meanOf(session, 'A2', 'current');
    const bars = predictedBars(session, 'bars');
    const stance = predictedText(session, 'claim_stance');
    const reason = predictedText(session, 'claim_reason');

    if (a !== null && b !== null) {
      const same = closeEnough(a, b, tol);
      const predictedSmallerB = (bars.A ?? 0) - (bars.B ?? 0) >= 2;
      if (same && (predictedSmallerB || stance === 'agree')) {
        out.push('예측에서는 전구 뒤(B)의 전류가 더 작을 것으로 보았는데, 측정에서는 A와 B가 거의 같았습니다. 전구에서 줄어든 것은 전류일까요, 아니면 다른 무엇일까요?');
      }
      if (same === false) {
        out.push('A와 B의 평균이 꽤 다르게 나왔습니다. 두 측정 사이에 전지·접촉·범위 스위치가 달라지지 않았는지, 표준편차는 얼마나 되는지 확인해 볼까요?');
      }
    }
    if (a !== null && a2 !== null && closeEnough(a, a2, tol) === false) {
      out.push('처음 A와 마지막 A′ 가 서로 다릅니다. 측정 순서 때문에 달라질 수 있는 것(전지 상태, 접촉)을 어떻게 확인할 수 있을까요?');
    }
    if (a !== null && b !== null && c !== null && closeEnough(a, c, tol) && closeEnough(b, c, tol)) {
      out.push('세 위치의 전류가 거의 같습니다. 이 결과를 "전하가 사라진다/소모된다" 는 모형으로 설명할 수 있을까요, 없을까요?');
    }
    if (includesAny(reason, ['사라', '소모', '없어', '다 써'])) {
      out.push('예측 이유에 전류가 "소모된다·사라진다" 는 표현이 있습니다. 전구에서 실제로 바뀌는 것이 전류(전하의 흐름)인지, 에너지인지 구분해서 설명해 볼까요?');
    }
    if (session.records.length > 0 && out.length === 0) {
      out.push('측정값과 처음 예측을 나란히 놓고, 어떤 점이 같고 어떤 점이 달랐는지 한 문장으로 적어 볼까요?');
    }
    return out;
  },
  mockDefaults: { topology: 'series', load1: 'lamp', r1: 12, useR2: false, supplyVoltage: 3, currentProbe: 'A', voltageProbe: 'none' },
  comparisonTolerancePct: 5,
};
