import type { SensorRole } from './types';

/**
 * 장치별로 소프트웨어가 읽을 수 없어서 사용자가 확인해야 하는 정보와
 * 설명서(https://www.vernier.com/manuals/gdx-cur/, https://www.vernier.com/manuals/gdx-volt/)에
 * 적힌 사양을 모아 둔다. SDK 가 보고하는 채널 범위와 함께 범위 초과·해상도 근접 표시에 쓴다.
 *
 * 채널 번호·채널 이름 문자열은 실물 장치에서 확인해야 한다 (docs/hardware-checklist.md).
 */

export interface RangeOption {
  id: string;
  label: string;
  /** 내부 단위(A 또는 V) 기준 최대 절댓값 */
  maxAbs: number;
  /** 설명서에 적힌 해상도 (내부 단위) */
  resolution: number;
}

export interface DeviceProfile {
  orderCodePrefix: string;
  role: SensorRole;
  displayName: string;
  /** 물리 스위치 등 소프트웨어가 바꿀 수 없는 범위 선택이 있으면 그 선택지 */
  physicalRangeSwitch: RangeOption[] | null;
  /** 채널로 범위가 구분되는 장치의 채널별 해상도 (채널 이름 부분 문자열 → 해상도) */
  channelResolution: Array<{ nameIncludes: string; resolution: number; maxAbs: number }>;
  zeroInstruction: string;
  manualUrl: string;
}

export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    orderCodePrefix: 'GDX-CUR',
    role: 'current',
    displayName: 'Go Direct 전류 센서 (GDX-CUR)',
    physicalRangeSwitch: [
      { id: '1A', label: '±1 A 범위 (스위치)', maxAbs: 1.0, resolution: 0.000031 },
      { id: '0.1A', label: '±0.1 A 범위 (스위치)', maxAbs: 0.1, resolution: 0.000003 },
    ],
    channelResolution: [],
    zeroInstruction:
      '빨간 리드와 검은 리드를 서로 직접 연결(단락)한 상태에서 영점을 맞추세요. 회로에 연결된 채로 하지 마세요.',
    manualUrl: 'https://www.vernier.com/manuals/gdx-cur/',
  },
  {
    orderCodePrefix: 'GDX-VOLT',
    role: 'voltage',
    displayName: 'Go Direct 전압 센서 (GDX-VOLT)',
    physicalRangeSwitch: null,
    channelResolution: [
      { nameIncludes: '20', resolution: 0.005, maxAbs: 20 },
      { nameIncludes: '1 V', resolution: 0.0005, maxAbs: 1 },
    ],
    zeroInstruction: '빨간 클립과 검은 클립을 서로 물린(단락) 상태에서 영점을 맞추세요.',
    manualUrl: 'https://www.vernier.com/manuals/gdx-volt/',
  },
];

export function findProfile(orderCode: string, name = ''): DeviceProfile | null {
  const code = (orderCode || '').toUpperCase();
  const nm = (name || '').toUpperCase();
  return (
    DEVICE_PROFILES.find((p) => code.startsWith(p.orderCodePrefix) || nm.startsWith(p.orderCodePrefix)) ?? null
  );
}

/** 단위 문자열로 역할을 추정한다. 역할 검증의 1차 기준은 장치가 보고한 채널 단위다. */
export function roleFromUnit(unit: string): SensorRole | null {
  const u = unit.trim();
  if (u === 'A' || u === 'mA') return 'current';
  if (u === 'V' || u === 'mV') return 'voltage';
  return null;
}
