import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInquiry } from '@/inquiries/registry';
import { useSessionStore } from '@/poe/sessionStore';
import { STAGE_LABEL } from '@/poe/types';
import { parseSessionBundle } from '@/data/sessionJson';
import { exportJson, exportRawCsv, exportSummaryCsv } from '@/data/exporters';
import { storage } from '@/storage/db';
import { Notice } from '@/components/common/Notice';
import { SourceBadge } from '@/components/common/SourceBadge';

export function SessionsPage() {
  const sessionMap = useSessionStore((s) => s.sessions);
  const sessions = useMemo(() => Object.values(sessionMap).sort((a, b) => b.updatedAt - a.updatedAt), [sessionMap]);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const importSession = useSessionStore((s) => s.importSession);
  const clearAll = useSessionStore((s) => s.clearAll);
  const [importMsg, setImportMsg] = useState<{ kind: 'info' | 'warn' | 'danger'; lines: string[] } | null>(null);
  const [quota, setQuota] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File) => {
    const text = await file.text();
    const res = parseSessionBundle(text);
    if (!res.ok || !res.session || !res.segments) {
      setImportMsg({ kind: 'danger', lines: ['가져오기 실패: 구조·단위·버전 검증에 실패했습니다.', ...res.errors] });
      return;
    }
    try {
      await importSession(res.session, res.segments);
      setImportMsg({ kind: res.warnings.length ? 'warn' : 'info', lines: ['가져오기 완료. 출처는 "가져온 자료" 로 표시됩니다.', ...res.warnings] });
    } catch (err) {
      setImportMsg({ kind: 'danger', lines: [err instanceof Error ? err.message : String(err)] });
    }
  };

  const onClearAll = async () => {
    const typed = window.prompt('모든 탐구 기록·원자료·설정을 이 기기에서 삭제합니다. 되돌릴 수 없습니다.\n계속하려면 "초기화" 라고 입력하세요.');
    if (typed !== '초기화') return;
    await clearAll();
  };

  const checkQuota = async () => {
    const q = await storage.estimateQuota();
    setQuota(q ? `사용 ${(q.usage / 1024 / 1024).toFixed(1)} MB / 할당 ${(q.quota / 1024 / 1024).toFixed(0)} MB` : '이 브라우저는 저장 공간 정보를 제공하지 않습니다.');
  };

  return (
    <div className="stack">
      <h1>저장한 탐구</h1>
      <div className="card">
        <div className="row">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            세션 JSON 가져오기
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} />
          <button type="button" className="btn" onClick={() => void checkQuota()}>
            저장 공간 확인
          </button>
          <Link className="btn" to="/report/all">
            통합 보고서
          </Link>
          <button type="button" className="btn btn-danger" onClick={() => void onClearAll()}>
            전체 초기화…
          </button>
        </div>
        {quota && <p className="muted" style={{ marginTop: 8 }}>{quota}</p>}
        {importMsg && (
          <div style={{ marginTop: 8 }}>
            <Notice kind={importMsg.kind}>
              <ul style={{ marginBottom: 0 }}>
                {importMsg.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}
      </div>
      <div className="card">
        {sessions.length === 0 ? (
          <p className="muted">저장한 탐구가 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>탐구</th>
                  <th>출처</th>
                  <th>단계</th>
                  <th>기록 수</th>
                  <th>마지막 수정</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const def = getInquiry(s.inquiryId);
                  return (
                    <tr key={s.sessionId}>
                      <td>
                        <strong>탐구 {s.inquiryId}</strong> {def?.title}
                      </td>
                      <td>
                        <SourceBadge source={s.source} />
                      </td>
                      <td>{s.completedAt ? '완료' : STAGE_LABEL[s.stage]}</td>
                      <td className="num">{s.records.length}</td>
                      <td>{new Date(s.updatedAt).toLocaleString('ko-KR')}</td>
                      <td>
                        <div className="row">
                          <Link className="btn btn-sm" to={`/inquiry/${s.inquiryId}/${s.sessionId}`}>
                            열기
                          </Link>
                          <Link className="btn btn-sm" to={`/report/${s.sessionId}`}>
                            보고서
                          </Link>
                          <button type="button" className="btn btn-sm" onClick={() => void exportJson(s)}>
                            JSON
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => void exportRawCsv(s)}>
                            원자료 CSV
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => exportSummaryCsv(s)}>
                            요약 CSV
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              if (window.confirm('이 탐구 기록과 원자료를 삭제할까요? 되돌릴 수 없습니다.')) void deleteSession(s.sessionId);
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
