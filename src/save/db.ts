// セーブは IndexedDB（Service Worker キャッシュには絶対に入れない）。
// indexedDB グローバルにのみ依存するので、テストでは fake-indexeddb で差し替えられる。

import { migrate, type SaveData } from './schema.ts'

const DB_NAME = 'orekadqm'
const STORE = 'save'
const KEY = 'slot0'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('indexedDB tx failed'))
        t.oncomplete = () => db.close()
      }),
  )
}

/** 保存済みセーブを読み込む（無ければ null）。 */
export async function loadSave(): Promise<SaveData | null> {
  try {
    const raw = await tx<unknown>('readonly', (s) => s.get(KEY))
    return migrate(raw ?? null)
  } catch {
    return null
  }
}

/** セーブを書き込む。 */
export async function writeSave(save: SaveData): Promise<void> {
  save.savedAt = Date.now()
  await tx('readwrite', (s) => s.put(save, KEY))
}

/** セーブを削除する（デバッグ/最初からやり直し用）。 */
export async function clearSave(): Promise<void> {
  await tx('readwrite', (s) => s.delete(KEY))
}
