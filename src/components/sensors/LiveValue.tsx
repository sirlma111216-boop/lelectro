import type { ManagedDevice } from '@/sensors/types';
import { displayUnit, toDisplayValue } from '@/data/units';
import { SourceBadge } from '@/components/common/SourceBadge';

const FLAG_LABEL = { saturated: '포화·범위 초과', near_range: '범위 근접', near_resolution: '해상도 부근' } as const;

/**
 * 실시간 측정값 표시. 끊김·수신 없음·측정 전 상태에서는 숫자 대신 상태를 보여 준다
 * (이전 값을 실시간 값처럼 남겨 두지 않는다).
 */
export function LiveValue({ device, compact = false }: { device: ManagedDevice; compact?: boolean }) {
  const unit = displayUnit(device.role);
  let text: string;
  let invalid = false;
  if (device.state === 'disconnected') {
    text = '연결 끊김';
    invalid = true;
  } else if (device.state === 'error') {
    text = '오류';
    invalid = true;
  } else if (device.stale) {
    text = '수신 없음';
    invalid = true;
  } else if (device.state !== 'measuring' || !device.latest) {
    text = '측정 대기';
    invalid = true;
  } else {
    const v = toDisplayValue(device.latest.value, device.role);
    text = v.toFixed(device.role === 'current' ? 1 : 3);
  }
  return (
    <div className={`live-value ${device.role}`} data-testid={`live-${device.role}`} aria-live="polite">
      <div className="row row-between">
        <span className="label">{device.alias}</span>
        <SourceBadge source={device.info.source} />
      </div>
      <div className={`value ${invalid ? 'invalid' : ''}`} style={compact ? { fontSize: '1.8rem' } : undefined}>
        {text}
        {!invalid && <span style={{ fontSize: '0.45em', marginLeft: 6, fontWeight: 600 }}>{unit}</span>}
      </div>
      <div className="meta">
        {device.channel.name} · 장치 단위 {device.channel.unit}
        {device.appliedPeriodMs ? ` · 적용 주기 ${device.appliedPeriodMs} ms` : ''}
        {device.zero ? ' · 앱 오프셋 적용' : ''}
        {device.latest?.flags.length ? (
          <>
            {' · '}
            {device.latest.flags.map((f) => (
              <span key={f} className={`badge ${f === 'saturated' ? 'badge-danger' : 'badge-warn'}`} style={{ marginLeft: 4 }}>
                {FLAG_LABEL[f]}
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
