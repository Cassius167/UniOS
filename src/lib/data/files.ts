/**
 * Binary attachment storage (PDFs, slides, images) in IndexedDB.
 * localStorage is too small for files, so only metadata lives in AppData and
 * the bytes live here under Resource.fileKey. A Supabase build would swap
 * this for Supabase Storage with per-user bucket policies.
 */
const DB = "unios-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const putFile = (key: string, file: Blob) => tx("readwrite", (s) => s.put(file, key));
export const getFile = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteFile = (key: string) => tx("readwrite", (s) => s.delete(key));
export const clearFiles = () => tx("readwrite", (s) => s.clear());
