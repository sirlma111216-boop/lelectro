import { INQUIRIES } from '@/inquiries/registry';
import { HINT_TIMING_LABEL, type HintTiming } from '@/poe/settings';
import { useSettingsStore } from '@/poe/settingsStore';
import type { InquiryId } from '@/poe/types';
import { Notice } from '@/components/common/Notice';
import { PowerCheckTable } from '@/components/poe/PowerCheckTable';

export function TeacherPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);

  const toggleInquiry = (id: InquiryId) => {
    const has = settings.enabledInquiries.includes(id);
    const next = has ? settings.enabledInquiries.filter((x) => x !== id) : [...settings.enabledInquiries, id].sort();
    void update({ enabledInquiries: next as InquiryId[] });
  };

  return (
    <div className="stack">
      <h1>교사용 설정</h1>
      <Notice kind="plain">
        이 화면은 같은 기기에서 수업 흐름을 맞추기 위한 편의 설정입니다. 서버 인증이 없으므로 보안 기능이나 부정행위 방지 기능이 아니며, 학생도 열어 볼 수 있습니다. 설정은 이 기기에만 저장됩니다.
      </Notice>
      <div className="grid grid-2">
        <div className="card">
          <h3>사용할 탐구</h3>
          <div className="checklist">
            {INQUIRIES.map((q) => (
              <label key={q.id}>
                <input type="checkbox" checked={settings.enabledInquiries.includes(q.id)} onChange={() => toggleInquiry(q.id)} />
                <span>
                  탐구 {q.id}. {q.title} <span className="muted">({q.curriculum.join(', ')})</span>
                </span>
              </label>
            ))}
          </div>
          <h3 style={{ marginTop: 16 }}>힌트(개념 노트) 공개 시점</h3>
          <div className="choice-list">
            {(Object.keys(HINT_TIMING_LABEL) as HintTiming[]).map((k) => (
              <label key={k} className={`choice ${settings.hintTiming === k ? 'selected' : ''}`}>
                <input type="radio" name="hint" checked={settings.hintTiming === k} onChange={() => void update({ hintTiming: k })} />
                {HINT_TIMING_LABEL[k]}
              </label>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            어떤 설정이든 예측 제출 전에는 정답 그래프·관계식·힌트를 공개하지 않습니다.
          </p>
        </div>
        <div className="card">
          <h3>기본 측정 조건</h3>
          <div className="field">
            <label htmlFor="period">기본 측정 주기 (ms)</label>
            <input id="period" type="number" min={10} max={1000} step={10} value={settings.defaultPeriodMs} onChange={(e) => void update({ defaultPeriodMs: Number(e.target.value) })} />
            <div className="help">정적인 회로 탐구에는 100~200 ms 가 적당합니다. 실제 적용 주기는 장치가 허용하는 최소 주기 이상으로 맞춰지며 측정 화면에 표시됩니다. SDK 의 주기 단위는 ms 입니다.</div>
          </div>
          <div className="field">
            <label htmlFor="minn">안정 구간 평균에 필요한 최소 표본 수</label>
            <input id="minn" type="number" min={2} max={200} value={settings.minSamplesPerWindow} onChange={(e) => void update({ minSamplesPerWindow: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="volt">예시 전원 전압 (V)</label>
            <input id="volt" type="number" min={0.5} max={6} step={0.5} value={settings.exampleSupplyVoltage} onChange={(e) => void update({ exampleSupplyVoltage: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="res">예시 고정 저항 (Ω, 쉼표로 구분)</label>
            <input
              id="res"
              type="text"
              defaultValue={settings.exampleResistors.join(', ')}
              onBlur={(e) => {
                const list = e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
                if (list.length) void update({ exampleResistors: list });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="rated">저항 정격 전력 (W)</label>
            <input id="rated" type="number" min={0.05} max={5} step={0.05} value={settings.resistorRatedPowerW} onChange={(e) => void update({ resistorRatedPowerW: Number(e.target.value) })} />
          </div>
          <h4>예시 조건의 소비 전력</h4>
          <PowerCheckTable />
          <button type="button" className="btn" onClick={() => void reset()} style={{ marginTop: 12 }}>
            기본값으로 되돌리기
          </button>
        </div>
      </div>
    </div>
  );
}
