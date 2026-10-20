// IndexedDB 统一封装：纯本地离线存储，覆盖花海 App 全部业务实体
// EXPORTS: DB, STORES, idb

export const STORES = [
  'accounts',
  'gesture',
  'transactions',
  'tasks',
  'pomodoros',
  'diaries',
  'memos',
  'habits',
  'checkins',
  'health',
  'periods',
  'goals',
  'countdowns',
  'events',
  'reviews',
  'marks',
] as const;

export type StoreName = (typeof STORES)[number];

const DB_NAME = 'huahai';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('accounts'))
        db.createObjectStore('accounts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('gesture'))
        db.createObjectStore('gesture', { keyPath: 'id' });
      for (const s of [
        'transactions',
        'tasks',
        'pomodoros',
        'diaries',
        'memos',
        'habits',
        'checkins',
        'health',
        'periods',
        'goals',
        'countdowns',
        'events',
        'reviews',
        'marks',
      ]) {
        if (!db.objectStoreNames.contains(s))
          db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    let result: T;
    try {
      const r = fn(os);
      if (r) {
        r.onsuccess = () => {
          result = r.result as T;
        };
      }
    } catch (e) {
      reject(e);
    }
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idb = {
  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    await withStore(store, 'readwrite', (os) => os.put(value));
  },
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return withStore<T | undefined>(store, 'readonly', (os) => os.get(key));
  },
  async getAll<T>(store: StoreName): Promise<T[]> {
    return withStore<T[]>(store, 'readonly', (os) => os.getAll());
  },
  async delete(store: StoreName, key: string): Promise<void> {
    await withStore(store, 'readwrite', (os) => os.delete(key));
  },
  async clear(store: StoreName): Promise<void> {
    await withStore(store, 'readwrite', (os) => os.clear());
  },
  async putAll<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const v of values) os.put(v);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const DB = { name: DB_NAME, version: DB_VERSION, stores: STORES };
