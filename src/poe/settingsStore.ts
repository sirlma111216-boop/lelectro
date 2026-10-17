import { create } from 'zustand';
import { storage } from '@/storage/db';
import { DEFAULT_TEACHER_SETTINGS, type TeacherSettings } from './settings';

const KEY = 'teacher-settings';

interface SettingsState {
  settings: TeacherSettings;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<TeacherSettings>): Promise<void>;
  reset(): Promise<void>;
}

function sanitize(raw: unknown): TeacherSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TEACHER_SETTINGS };
  const r = raw as Partial<TeacherSettings>;
  return {
    ...DEFAULT_TEACHER_SETTINGS,
    ...r,
    schemaVersion: 1,
    enabledInquiries: Array.isArray(r.enabledInquiries)
      ? (r.enabledInquiries.filter((x) => [1, 2, 3, 4].includes(x as number)) as TeacherSettings['enabledInquiries'])
      : DEFAULT_TEACHER_SETTINGS.enabledInquiries,
    defaultPeriodMs: Math.min(1000, Math.max(10, Number(r.defaultPeriodMs) || DEFAULT_TEACHER_SETTINGS.defaultPeriodMs)),
    minSamplesPerWindow: Math.max(2, Number(r.minSamplesPerWindow) || DEFAULT_TEACHER_SETTINGS.minSamplesPerWindow),
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_TEACHER_SETTINGS },
  loaded: false,
  async load() {
    try {
      const raw = await storage.getSetting<TeacherSettings>(KEY);
      set({ settings: sanitize(raw), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  async update(patch) {
    const next = sanitize({ ...get().settings, ...patch });
    set({ settings: next });
    try {
      await storage.setSetting(KEY, next);
    } catch {
      /* 저장 실패는 세션 스토어의 저장 오류 표시와 별개로 조용히 넘어간다 */
    }
  },
  async reset() {
    set({ settings: { ...DEFAULT_TEACHER_SETTINGS } });
    try {
      await storage.setSetting(KEY, DEFAULT_TEACHER_SETTINGS);
    } catch {
      /* ignore */
    }
  },
}));
