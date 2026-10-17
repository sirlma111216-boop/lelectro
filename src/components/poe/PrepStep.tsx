import type { InquiryDefinition } from '@/inquiries/types';
import type { InquirySession } from '@/poe/types';
import { useSessionStore } from '@/poe/sessionStore';
import { Notice } from '@/components/common/Notice';
import { SensorPanel } from '@/components/sensors/SensorPanel';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { PowerCheckTable } from './PowerCheckTable';

export function PrepStep({ session, def }: { session: InquirySession; def: InquiryDefinition }) {
  const setChecklist = useSessionStore((s) => s.setChecklist);
  const setStage = useSessionStore((s) => s.setStage);
  const source = session.source === 'mock' ? 'mock' : 'live';
  const firstSlot = def.slots[0];
  return (
    <div className="stack">
      {session.source === 'imported' && <Notice kind="warn">가져온 자료 세션입니다. 센서 연결과 새 측정은 할 수 없고 기록 열람과 보고서만 가능합니다.</Notice>}
      <div className="grid grid-2">
        <div className="card">
          <h3>준비물</h3>
          <ul>
            {def.materials.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <h3>안전·연결 안내 (저전압 직류 회로만)</h3>
          <ul>
            {def.safety.map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>앱의 “측정 정지” 버튼은 전원을 물리적으로 차단하지 않습니다.</li>
          </ul>
          {def.id !== 1 && (
            <>
              <h3>예시 조건의 저항 소비 전력</h3>
              <PowerCheckTable />
            </>
          )}
        </div>
        <div className="card">
          <h3>회로 템플릿</h3>
          {firstSlot && <CircuitDiagram spec={firstSlot.diagram} />}
          <p className="circuit-caption">실제 회로를 안내하는 그림입니다. 그림을 바꿔도 장치가 제어되지 않으며, 측정 위치별 자세한 배선은 관찰 단계에서 단계별로 안내합니다.</p>
          <h3 style={{ marginTop: 16 }}>배선 확인 체크리스트</h3>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            앱은 센서값만으로 배선 전체가 올바른지 판별할 수 없습니다. 아래 항목은 직접 눈으로 확인한 뒤 표시하세요 (자동 검증이 아닙니다).
          </p>
          <div className="checklist">
            {def.setupChecklist.map((item) => (
              <label key={item.id}>
                <input type="checkbox" checked={!!session.checklist[item.id]} onChange={(e) => setChecklist(session.sessionId, item.id, e.target.checked)} />
                <span>{item.text}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      {session.source !== 'imported' && (
        <div className="card">
          <div className="card-title">
            <h3>센서 연결 확인</h3>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              필요한 센서: {def.requiredSensors.map((r) => (r === 'current' ? '전류 센서(GDX-CUR)' : '전압 센서(GDX-VOLT)')).join(', ')}
              {def.optionalSensors.length > 0 && ` · 선택: ${def.optionalSensors.map((r) => (r === 'current' ? '전류' : '전압')).join(', ')} 센서`}
            </span>
          </div>
          <SensorPanel requiredRoles={def.requiredSensors} optionalRoles={def.optionalSensors} source={source} />
          <Notice kind="info" className="" title="준비 화면의 값은 본 실험 데이터와 분리됩니다">
            <p>여기서 보는 실시간 값은 연결 확인용이며 기록되지 않습니다. 본 실험 기록은 예측을 제출한 뒤 관찰 단계에서 시작합니다.</p>
          </Notice>
        </div>
      )}
      <div className="row row-between">
        <span className="muted">준비가 되었으면 예측 단계로 이동하세요. 예측 전에는 결과 그래프나 관계식이 공개되지 않습니다.</span>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setStage(session.sessionId, 'predict')} data-testid="go-predict">
          예측 단계로
        </button>
      </div>
    </div>
  );
}
