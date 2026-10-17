import { resistorPowerCheck } from '@/poe/settings';
import { useSettingsStore } from '@/poe/settingsStore';

/** 예시 조건에서 저항의 소비 전력과 정격 여유를 계산해 보여 준다 (안내용 계산, 자동 보호 아님) */
export function PowerCheckTable() {
  const settings = useSettingsStore((s) => s.settings);
  const voltages = Array.from(new Set([1.5, settings.exampleSupplyVoltage, 3])).sort((a, b) => a - b);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>저항 (Ω)</th>
            {voltages.map((v) => (
              <th key={v} className="num">
                {v} V 일 때 전류 / 전력
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {settings.exampleResistors.map((r) => (
            <tr key={r}>
              <td>{r} Ω</td>
              {voltages.map((v) => {
                const c = resistorPowerCheck(v, r, settings.resistorRatedPowerW);
                const cls = c.level === 'ok' ? 'badge-ok' : c.level === 'caution' ? 'badge-warn' : 'badge-danger';
                return (
                  <td key={v} className="num">
                    {(c.current * 1000).toFixed(1)} mA / {(c.power * 1000).toFixed(0)} mW{' '}
                    <span className={`badge ${cls}`}>{c.level === 'ok' ? '여유' : c.level === 'caution' ? '정격 근접' : '정격 초과'}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        정격 {settings.resistorRatedPowerW} W 기준. 소비 전력이 정격의 절반 이하이면 “여유” 로 표시합니다. 전구 실험은 전구 정격과 예상 전류를 따로 확인하세요.
      </p>
    </div>
  );
}
