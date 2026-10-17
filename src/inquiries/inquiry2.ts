import type { InquiryDefinition, MeasurementSlot } from './types';
import { predictedText } from './feedbackUtils';
import { linearFit } from '@/data/stats';
import { recordsForSlot } from '@/poe/sessionLogic';

const steps = [
  '전원을 끈다.',
  '고정 저항 하나를 전원과 직렬로 연결하고, 전류 센서를 저항과 직렬로 끼운다 (빨간 리드가 (+) 쪽).',
  '전압 센서의 빨간 클립과 검은 클립을 저항의 양 끝에 각각 물린다 (저항과 병렬).',
  '전원 전압을 이 단계의 값으로 맞춘 뒤 전원을 켠다.',
  '전압과 전류가 함께 안정된 구간을 골라 한 쌍으로 저장한다. 전원 설정값이 아니라 측정한 저항 양단 전압을 쓴다.',
];

function voltageSlot(n: number, group?: string): MeasurementSlot {
  const alt = group === 'alt';
  return {
    id: alt ? `R2-${n}` : `V${n}`,
    label: alt ? `다른 저항 단계 ${n}` : `전압 단계 ${n}`,
    shortLabel: alt ? `R′${n}` : `${n}`,
    roles: ['voltage', 'current'],
    group,
    groupLabel: alt ? '선택 활동: 다른 고정 저항' : undefined,
    optional: alt,
    steps,
    diagram: { key: 'series-resistor', currentAt: 'A', voltageAcross: 'r1' },
    mockPreset: { currentProbe: 'A', voltageProbe: 'r1', r1: alt ? 220 : 100 },
  };
}

export const inquiry2: InquiryDefinition = {
  id: 2,
  slug: 'voltage-current',
  title: '전압을 높이면 전류는 어떻게 달라질까?',
  question: '저항이 일정할 때 저항 양단의 전압을 높이면 전류는 어떻게 변할까?',
  curriculum: ['[9과14-02]'],
  summary: '고정 저항을 두고 전압을 4~6단계로 바꾸며 저항 양단 전압과 전류를 한 쌍씩 기록해 V–I 그래프를 그린다.',
  requiredSensors: ['voltage', 'current'],
  optionalSensors: [],
  materials: ['고정 저항(예: 100 Ω, 220 Ω, 330 Ω / 정격 확인)', '조절 가능한 저전압 직류 전원(0~3 V)', '전압 센서 1개(GDX-VOLT)', '전류 센서 1개(GDX-CUR)', '연결 도선'],
  safety: [
    '전류 센서는 저항과 직렬, 전압 센서는 저항 양단에 병렬로 연결한다.',
    '전류 센서를 전원 양단에 직접 연결하지 않는다.',
    '저항의 소비 전력(P = V²/R)이 정격의 절반을 넘지 않는 전압 범위에서 실험한다. 준비 화면의 계산표를 확인한다.',
    '전압을 바꿀 때를 제외하고, 배선을 바꾸기 전에는 전원을 끈다.',
  ],
  setupChecklist: [
    { id: 'series', text: '전류 센서가 저항과 직렬로 들어가 있다.' },
    { id: 'parallel', text: '전압 센서의 두 클립이 저항의 양 끝에 물려 있다.' },
    { id: 'power', text: '사용할 최대 전압에서 저항 소비 전력이 정격 안에 있다.' },
    { id: 'range', text: '전류 센서 범위 스위치를 예상 전류(수십 mA)에 맞게 두고 앱에 선택했다.' },
  ],
  predictionIntro:
    '같은 저항에 걸리는 전압을 조금씩 높이면서 전류를 잴 것이다. 가로축을 전압 V, 세로축을 전류 I 로 하는 그래프가 어떤 모양일지 미리 그려 보자.',
  predictionFields: [
    {
      id: 'graph',
      type: 'graph-points',
      label: '예상 V–I 그래프를 점으로 찍어 보자 (마우스로 클릭하거나 키보드로 숫자를 넣을 수 있다)',
      xLabel: '전압 V (V)',
      yLabel: '전류 I (mA)',
      xMax: 4,
      yMax: 40,
      help: '정확한 값보다 모양(직선인지, 휘는지, 어디서 시작하는지)이 중요하다.',
    },
    {
      id: 'double',
      type: 'choice',
      label: '전압을 두 배로 높이면 전류는 어떻게 될까?',
      options: [
        { value: 'double', label: '두 배가 된다' },
        { value: 'less', label: '커지지만 두 배보다 작다' },
        { value: 'more', label: '두 배보다 더 커진다' },
        { value: 'same', label: '변하지 않는다' },
        { value: 'unsure', label: '잘 모르겠다' },
      ],
    },
  ],
  slots: [1, 2, 3, 4, 5, 6].map((n) => voltageSlot(n)).concat([1, 2, 3, 4].map((n) => voltageSlot(n, 'alt'))),
  observationTips: [
    '저항은 바꾸지 않고 전압만 4~6단계로 바꾼다.',
    '두 센서는 완벽히 동기화되지 않으므로, 둘 다 안정된 같은 시간 구간의 평균을 한 쌍으로 쓴다.',
    '전압이나 전류 중 하나라도 끊기거나 표본이 부족하면 그 쌍은 저장되지 않는다.',
  ],
  explanationPrompts: {
    claim: '저항이 일정할 때 전압과 전류의 관계에 대한 나의 주장은?',
    evidence: 'V–I 기록표에서 어떤 쌍들이 이 주장을 뒷받침하는가?',
    concept: '전압이 커지면 전류가 커지는 까닭을 전하가 받는 에너지와 연결해 설명해 보자.',
    change: '예상 그래프와 실제 산점도는 어떻게 달랐는가?',
    further: '저항을 바꾸면 그래프가 어떻게 달라질지, 전구를 쓰면 어떨지 확인하고 싶은 점은?',
  },
  conceptNotes: [
    '고정 저항에서는 전압이 커지면 전류도 거의 비례해 커진다. 점들이 원점 근처에서 시작하는 직선에 가깝게 놓인다.',
    '이 그래프(가로 V, 세로 I)의 기울기는 I/V 이다. 저항은 V/I 이므로 기울기를 그대로 저항이라고 부르지 않는다.',
    '전구는 켜지면서 뜨거워져 저항이 변하므로 고정 저항과 같은 직선이 되지 않는다.',
  ],
  feedback(session) {
    const out: string[] = [];
    const pairs: Array<{ x: number; y: number }> = [];
    for (const slot of inquiry2.slots.filter((s) => !s.optional)) {
      for (const r of recordsForSlot(session, slot.id)) {
        const v = r.stats.voltage?.mean;
        const i = r.stats.current?.mean;
        if (typeof v === 'number' && typeof i === 'number') pairs.push({ x: v, y: i });
      }
    }
    const dbl = predictedText(session, 'double');
    if (pairs.length >= 3) {
      const fit = linearFit(pairs);
      if (fit && fit.r2 > 0.95) {
        out.push('전압이 커질수록 전류도 거의 일정한 비율로 커졌습니다. 처음 그린 예상 그래프의 모양과 비교하면 어떤 점이 같고 다른가요?');
        if (dbl && dbl !== 'double' && dbl !== 'unsure') {
          out.push('예측에서는 전압이 두 배가 되어도 전류가 두 배가 되지 않을 것으로 보았습니다. 기록표에서 전압이 약 두 배인 두 쌍을 골라 전류 비를 직접 계산해 볼까요?');
        }
        if (Math.abs(fit.intercept) > 0.1 * Math.max(...pairs.map((p) => p.y))) {
          out.push('직선이 원점에서 꽤 떨어진 곳을 지납니다. 영점 보정이나 접촉 저항 같은 원인을 생각해 볼 수 있을까요?');
        }
      } else if (fit) {
        out.push('점들이 직선에서 다소 벗어나 있습니다. 어떤 단계에서 전압이나 전류가 덜 안정했는지 표준편차를 확인해 볼까요?');
      }
    } else if (pairs.length > 0) {
      out.push('관계를 말하려면 쌍이 더 필요합니다. 전압 단계를 4개 이상 기록해 볼까요?');
    }
    return out;
  },
  mockDefaults: { topology: 'series', load1: 'resistor', r1: 100, useR2: false, supplyVoltage: 1.5, currentProbe: 'A', voltageProbe: 'r1' },
  comparisonTolerancePct: 5,
};
