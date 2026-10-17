import type { InquirySession } from '@/poe/types';
import { useSessionStore } from '@/poe/sessionStore';
import { inquiry2 } from '@/inquiries/inquiry2';
import { recordsForSlot } from '@/poe/sessionLogic';
import { linearFit } from '@/data/stats';
import { ScatterChart, type ScatterPoint } from '@/components/charts/ScatterChart';
import { predicted } from '@/inquiries/feedbackUtils';

interface Props {
  session: InquirySession;
  /** 보고서 등 읽기 전용 */
  readOnly?: boolean;
}

function pairsFor(session: InquirySession, optional: boolean): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  for (const slot of inquiry2.slots.filter((s) => !!s.optional === optional)) {
    for (const r of recordsForSlot(session, slot.id)) {
      const v = r.stats.voltage;
      const i = r.stats.current;
      if (v && i) pts.push({ x: v.mean, y: i.mean * 1000, xErr: v.sd, yErr: i.sd * 1000, label: slot.shortLabel });
    }
  }
  return pts.sort((a, b) => a.x - b.x);
}

export function Inquiry2Results({ session, readOnly = false }: Props) {
  const setExtra = useSessionStore((s) => s.setExtra);
  const showFit = session.extra.showFit === true;
  const showResistance = session.extra.showResistance === true;
  const showAlt = session.extra.showAlt !== false;

  const main = pairsFor(session, false);
  const alt = pairsFor(session, true);
  const predRaw = predicted(session, 'graph');
  const pred = Array.isArray(predRaw) ? (predRaw as Array<{ x: number; y: number }>).filter((p) => typeof p.x === 'number' && typeof p.y === 'number') : [];
  const fit = showFit ? linearFit(main) : null; // 기울기 단위: mA/V
  const fitAlt = showFit && alt.length >= 2 ? linearFit(alt) : null;

  if (main.length === 0 && alt.length === 0) return <p className="muted">아직 저장된 (전압, 전류) 쌍이 없습니다.</p>;

  return (
    <div className="stack">
      <ScatterChart points={main} predicted={pred} fit={fit} xLabel="저항 양단 전압 V (V)" yLabel="전류 I (mA)" title="V–I 산점도 (조건별 평균, 오차 막대 = 표준편차)" />
      {!readOnly && (
        <div className="row">
          <label className="choice" style={{ display: 'inline-flex' }}>
            <input type="checkbox" checked={showFit} onChange={(e) => setExtra(session.sessionId, 'showFit', e.target.checked)} /> 직선 적합 보기 (관찰 후 선택, 원점 강제 없음)
          </label>
          <label className="choice" style={{ display: 'inline-flex' }}>
            <input type="checkbox" checked={showResistance} onChange={(e) => setExtra(session.sessionId, 'showResistance', e.target.checked)} /> 저항 계산 보기 (선택 기능)
          </label>
        </div>
      )}
      {fit && (
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          직선 적합: 기울기 {fit.slope.toFixed(2)} mA/V, 절편 {fit.intercept.toFixed(2)} mA, 결정계수 r² = {fit.r2.toFixed(3)} (점 {fit.n}개). 이 축 설정에서 기울기는 I/V 이며, 저항 그 자체가 아닙니다.
        </p>
      )}
      {showResistance && main.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>단계</th>
                <th className="num">V (V)</th>
                <th className="num">I (mA)</th>
                <th className="num">V / I (Ω)</th>
              </tr>
            </thead>
            <tbody>
              {main.map((p, k) => (
                <tr key={k}>
                  <td>{p.label}</td>
                  <td className="num">{p.x.toFixed(3)}</td>
                  <td className="num">{p.y.toFixed(2)}</td>
                  <td className="num">{p.y !== 0 ? ((p.x / p.y) * 1000).toFixed(1) : '—'}</td>
                </tr>
              ))}
              {fit && fit.slope !== 0 && (
                <tr>
                  <td>직선 기울기로부터 (1 / 기울기)</td>
                  <td className="num" colSpan={2}></td>
                  <td className="num">{((1 / fit.slope) * 1000).toFixed(1)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {alt.length > 0 && showAlt && (
        <div>
          <h4>선택 활동: 다른 고정 저항과 비교</h4>
          <ScatterChart points={alt} fit={fitAlt} xLabel="저항 양단 전압 V (V)" yLabel="전류 I (mA)" pointColor="var(--voltage)" title="다른 저항의 V–I" />
          {fitAlt && (
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              다른 저항 기울기 {fitAlt.slope.toFixed(2)} mA/V (기본 저항 {fit ? fit.slope.toFixed(2) : '—'} mA/V). 기울기가 다른 까닭을 저항 크기와 연결해 보세요.
            </p>
          )}
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        두 센서는 서로 동기화된 장치가 아니므로, 각 점은 같은 관찰 구간에서 두 센서가 각각 안정된 값의 평균입니다. 전구는 고정 저항과 다르게 행동하므로 이 그래프와 같은 저항 특성으로 보지 않습니다.
      </p>
    </div>
  );
}
