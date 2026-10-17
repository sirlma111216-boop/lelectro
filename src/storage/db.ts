/**
 * IndexedDB 저장소 (idb 사용).
 * - sessions: 세션 요약·예측·기록표·설명 (원자료 제외)
 * - segments: 원자료 구간 (세션별)
 * - settings: 교사용 설정, 앱 설정
 * Bluetooth 연결 자체는 저장되지 않으며 새로고침 후 자동 복구되지 않는다.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RecordedSegment } from '@/data/recording';
import type { InquirySession } from '@/poe/types';

export const DB_NAME = 'elect-lab';
export const DB_VERSION = 1;

interface ElectDB extends DBSchema {
  sessions: {
    key: string;
    value: InquirySession;
    indexes: { 'by-inquiry': number; 'by-updated': number };
  };
  segments: {
    key: string;
    value: RecordedSegment;
    indexes: { 'by-session': string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown; updatedAt: number };
  };
}

export type StorageErrorCode = 'quota' | 'unavailable' | 'unknown';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

function wrap(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return new StorageError('quota', '기기 저장 공간이 부족해 저장하지 못했습니다. 오래된 탐구를 내보낸 뒤 삭제하세요.');
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || /indexeddb/i.test(msg)) {
    return new StorageError('unavailable', '이 브라우저에서 기기 내 저장소(IndexedDB)를 사용할 수 없습니다. 시크릿 모드이거나 저장소가 차단되었을 수 있습니다.');
  }
  return new StorageError('unknown', `저장 중 오류: ${msg}`);
}

let dbPromise: Promise<IDBPDatabase<ElectDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ElectDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ElectDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        sessions.createIndex('by-inquiry', 'inquiryId');
        sessions.createIndex('by-updated', 'updatedAt');
        const segments = db.createObjectStore('segments', { keyPath: 'segmentId' });
        segments.createIndex('by-session', 'sessionId');
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    }).catch((err) => {
      dbPromise = null;
      throw wrap(err);
    });
  }
  return dbPromise;
}

/** 테스트에서 DB 연결을 끊고 다시 열게 한다 */
export async function closeDbForTests() {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
}

export const storage = {
  async saveSession(session: InquirySession): Promise<void> {
    try {
      const db = await getDb();
      await db.put('sessions', session);
    } catch (err) {
      throw wrap(err);
    }
  },

  async loadSession(sessionId: string): Promise<InquirySession | undefined> {
    try {
      const db = await getDb();
      return await db.get('sessions', sessionId);
    } catch (err) {
      throw wrap(err);
    }
  },

  async listSessions(): Promise<InquirySession[]> {
    try {
      const db = await getDb();
      const all = await db.getAllFromIndex('sessions', 'by-updated');
      return all.reverse();
    } catch (err) {
      throw wrap(err);
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(['sessions', 'segments'], 'readwrite');
      await tx.objectStore('sessions').delete(sessionId);
      const segStore = tx.objectStore('segments');
      const keys = await segStore.index('by-session').getAllKeys(sessionId);
      await Promise.all(keys.map((k) => segStore.delete(k)));
      await tx.done;
    } catch (err) {
      throw wrap(err);
    }
  },

  async saveSegments(segments: RecordedSegment[]): Promise<void> {
    if (segments.length === 0) return;
    try {
      const db = await getDb();
      const tx = db.transaction('segments', 'readwrite');
      await Promise.all(segments.map((s) => tx.store.put(s)));
      await tx.done;
    } catch (err) {
      throw wrap(err);
    }
  },

  async loadSegments(sessionId: string): Promise<RecordedSegment[]> {
    try {
      const db = await getDb();
      const segs = await db.getAllFromIndex('segments', 'by-session', sessionId);
      return segs.sort((a, b) => a.startedAt - b.startedAt);
    } catch (err) {
      throw wrap(err);
    }
  },

  async getSetting<T>(key: string): Promise<T | undefined> {
    try {
      const db = await getDb();
      const row = await db.get('settings', key);
      return row?.value as T | undefined;
    } catch (err) {
      throw wrap(err);
    }
  },

  async setSetting(key: string, value: unknown): Promise<void> {
    try {
      const db = await getDb();
      await db.put('settings', { key, value, updatedAt: Date.now() });
    } catch (err) {
      throw wrap(err);
    }
  },

  /** 전체 초기화. 호출 전 UI 에서 확인 절차를 거쳐야 한다. */
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(['sessions', 'segments', 'settings'], 'readwrite');
      await Promise.all([
        tx.objectStore('sessions').clear(),
        tx.objectStore('segments').clear(),
        tx.objectStore('settings').clear(),
      ]);
      await tx.done;
    } catch (err) {
      throw wrap(err);
    }
  },

  async estimateQuota(): Promise<{ usage: number; quota: number } | null> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
      }
    } catch {
      /* ignore */
    }
    return null;
  },
};
