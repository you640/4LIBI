import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "ForenzDetectiv_DB";
const STORE_NAME = "analyses";
const LEGACY_LOCAL_STORAGE_KEY = "forenz_local_analyses_v1";

export type StoredAnalysis = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  data: unknown;
  errorMessage?: string | null;
  updatedAt?: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;
let migrationDone = false;

export async function initDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  const db = await dbPromise;
  await runLocalStorageMigration(db);
  return db;
}

async function runLocalStorageMigration(db: IDBPDatabase): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  if (typeof localStorage === "undefined") return;

  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, StoredAnalysis>;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    for (const record of Object.values(parsed)) {
      if (!record?.id) continue;
      const existing = await store.get(record.id);
      if (!existing) {
        await store.put({
          ...record,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await tx.done;
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    console.log("[Migration] Dáta úspešne presunuté do IndexedDB.");
  } catch (err) {
    console.error("[Migration] Chyba pri migrácii:", err);
  }
}

/** Reset migration flag and DB handle (tests only). */
export function _resetDbForTests(): void {
  dbPromise = null;
  migrationDone = false;
}

export const storage = {
  async saveAnalysis(id: string, data: Omit<StoredAnalysis, "id"> & { id?: string }) {
    const db = await initDB();
    await db.put(STORE_NAME, {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    });
  },

  async getAnalysis(id: string): Promise<StoredAnalysis | undefined> {
    const db = await initDB();
    return db.get(STORE_NAME, id) as Promise<StoredAnalysis | undefined>;
  },

  async getAllAnalyses(): Promise<StoredAnalysis[]> {
    const db = await initDB();
    return db.getAll(STORE_NAME) as Promise<StoredAnalysis[]>;
  },

  async deleteAnalysis(id: string): Promise<void> {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
  },

  async clearAll(): Promise<void> {
    const db = await initDB();
    await db.clear(STORE_NAME);
  },

  /** Explicitná migrácia (volaná aj z main.tsx pri štarte). */
  async migrateFromLocalStorage(): Promise<void> {
    const db = await initDB();
    await runLocalStorageMigration(db);
  },
};
