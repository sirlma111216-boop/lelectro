/**
 * 세션(탐구 기록) 스토어. 변경은 IndexedDB 에 디바운스 저장된다.
 */
import { create } from 'zustand';
import type { DataSource } from '@/sensors/types';
import type { RecordedSegment } from '@/data/recording';
import { storage, StorageError } from '@/storage/db';
import * as logic from './sessionLogic';
import type { ConditionRecord, Explanation, InquiryId, InquirySession, PredictionEntry, Stage } from './types';

interface SessionStoreState {
  loaded: boolean;
  loadError: string | null;
  sessions: Record<string, InquirySession>;
  activeSessionId: string | null;
  storageError: string | null;
  lastSavedAt: number | null;

  load(): Promise<void>;
  createSession(inquiryId: InquiryId, source: DataSource): InquirySession;
  setActive(id: string | null): void;
  getSession(id: string): InquirySession | undefined;
  update(id: string, fn: (s: InquirySession) => InquirySession): void;
  setStage(id: string, stage: Stage): { ok: boolean; reason?: string };
  submitPrediction(id: string, entry: PredictionEntry): void;
  addRecord(id: string, record: Omit<ConditionRecord, 'repeat'> & { repeat?: number }): void;
  updateRecord(id: string, recordId: string, patch: Partial<ConditionRecord>): void;
  removeRecord(id: string, recordId: string): void;
  setObservationNotes(id: string, notes: string): void;
  setExplanation(id: string, explanation: Explanation): void;
  setChecklist(id: string, key: string, checked: boolean): void;
  setExtra(id: string, key: string, value: unknown): void;
  complete(id: string): void;
  deleteSession(id: string): Promise<void>;
  importSession(session: InquirySession, segments: RecordedSegment[]): Promise<void>;
  clearAll(): Promise<void>;
  clearStorageError(): void;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(session: InquirySession, set: (p: Partial<SessionStoreState>) => void) {
  const prev = saveTimers.get(session.sessionId);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    session.sessionId,
    setTimeout(async () => {
      saveTimers.delete(session.sessionId);
      try {
        await storage.saveSession(session);
        set({ lastSavedAt: Date.now(), storageError: null });
      } catch (err) {
        set({ storageError: err instanceof StorageError ? err.message : String(err) });
      }
    }, 300),
  );
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  loaded: false,
  loadError: null,
  sessions: {},
  activeSessionId: null,
  storageError: null,
  lastSavedAt: null,

  async load() {
    try {
      const list = await storage.listSessions();
      const sessions: Record<string, InquirySession> = {};
      for (const s of list) sessions[s.sessionId] = s;
      set({ sessions, loaded: true, loadError: null });
    } catch (err) {
      set({ loaded: true, loadError: err instanceof Error ? err.message : String(err) });
    }
  },

  createSession(inquiryId, source) {
    const s = logic.createEmptySession(inquiryId, source);
    set((st) => ({ sessions: { ...st.sessions, [s.sessionId]: s }, activeSessionId: s.sessionId }));
    scheduleSave(s, set);
    return s;
  },

  setActive(id) {
    set({ activeSessionId: id });
  },

  getSession(id) {
    return get().sessions[id];
  },

  update(id, fn) {
    const cur = get().sessions[id];
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    set((st) => ({ sessions: { ...st.sessions, [id]: next } }));
    scheduleSave(next, set);
  },

  setStage(id, stage) {
    const cur = get().sessions[id];
    if (!cur) return { ok: false, reason: '세션이 없습니다.' };
    const check = logic.canEnterStage(cur, stage);
    if (!check.ok) return check;
    get().update(id, (s) => ({ ...s, stage, updatedAt: Date.now() }));
    return { ok: true };
  },

  submitPrediction(id, entry) {
    get().update(id, (s) => logic.applyPrediction(s, entry));
  },

  addRecord(id, record) {
    get().update(id, (s) => logic.addRecord(s, record));
  },

  updateRecord(id, recordId, patch) {
    get().update(id, (s) => logic.updateRecord(s, recordId, patch));
  },

  removeRecord(id, recordId) {
    get().update(id, (s) => logic.removeRecord(s, recordId));
  },

  setObservationNotes(id, notes) {
    get().update(id, (s) => ({ ...s, observationNotes: notes, updatedAt: Date.now() }));
  },

  setExplanation(id, explanation) {
    get().update(id, (s) => logic.setExplanation(s, explanation));
  },

  setChecklist(id, key, checked) {
    get().update(id, (s) => ({ ...s, checklist: { ...s.checklist, [key]: checked }, updatedAt: Date.now() }));
  },

  setExtra(id, key, value) {
    get().update(id, (s) => ({ ...s, extra: { ...s.extra, [key]: value }, updatedAt: Date.now() }));
  },

  complete(id) {
    get().update(id, (s) => ({ ...s, completedAt: s.completedAt ?? Date.now(), stage: 'summary', updatedAt: Date.now() }));
  },

  async deleteSession(id) {
    const timer = saveTimers.get(id);
    if (timer) clearTimeout(timer);
    saveTimers.delete(id);
    set((st) => {
      const next = { ...st.sessions };
      delete next[id];
      return { sessions: next, activeSessionId: st.activeSessionId === id ? null : st.activeSessionId };
    });
    try {
      await storage.deleteSession(id);
    } catch (err) {
      set({ storageError: err instanceof Error ? err.message : String(err) });
    }
  },

  async importSession(session, segments) {
    // 같은 id 가 있으면 새 id 를 부여한다
    let s = session;
    let segs = segments;
    if (get().sessions[s.sessionId]) {
      const newId = logic.newId('session');
      s = { ...s, sessionId: newId };
      segs = segs.map((g) => ({ ...g, sessionId: newId }));
    }
    try {
      await storage.saveSession(s);
      await storage.saveSegments(segs);
      set((st) => ({ sessions: { ...st.sessions, [s.sessionId]: s }, storageError: null }));
    } catch (err) {
      set({ storageError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async clearAll() {
    saveTimers.forEach((t) => clearTimeout(t));
    saveTimers.clear();
    await storage.clearAll();
    set({ sessions: {}, activeSessionId: null, storageError: null });
  },

  clearStorageError() {
    set({ storageError: null });
  },
}));

export function useSession(id: string | null | undefined): InquirySession | undefined {
  return useSessionStore((st) => (id ? st.sessions[id] : undefined));
}
