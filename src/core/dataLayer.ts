import type { PersistedState } from './types';
import { migrate, type LegacyBundle, type MigrationReport } from './migrations';
import { seedPersistedState } from './seed';

export const FTX_STORAGE_KEY = 'ftxDB';
export const LEGACY_MAIN_KEY = 'formDB';
const LEGACY_KEYS: (keyof LegacyBundle)[] = [
  'FORM_WORKOUT_DRAFT_V1', 'FORM_LAST_WORKOUT_SAVED_V1', 'formHyroxDraft',
  'formCatchupWorkoutV1', 'formMissedWorkoutDecisionsV1', 'formFavoriteMealsV1',
  'formExerciseLibrarySessionV1',
];
const BACKUP_PREFIX = 'ftxMigrationBackup_';

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function readLegacyBundle(): LegacyBundle {
  const bundle: LegacyBundle = { formDB: safeParse(localStorage.getItem(LEGACY_MAIN_KEY)) };
  for (const key of LEGACY_KEYS) bundle[key] = safeParse(localStorage.getItem(key));
  return bundle;
}

export interface LoadResult {
  state: PersistedState;
  report: MigrationReport;
}

/** Load FTX state, migrating from legacy FT (or upgrading FTX's own older
 * schema) if needed. Never throws — worst case returns a fresh seed so the
 * app always boots. */
export function loadPersistedState(): LoadResult {
  try {
    const ftxRaw = safeParse(localStorage.getItem(FTX_STORAGE_KEY));
    const legacy = ftxRaw ? {} : readLegacyBundle(); // only read legacy if FTX has nothing yet (see migrations/index.ts)
    if (!ftxRaw && legacy.formDB) {
      // One-time safety backup of the raw legacy blob before we touch anything.
      const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
      try { localStorage.setItem(backupKey, JSON.stringify(legacy)); } catch { /* quota — proceed anyway, migration itself doesn't delete legacy keys */ }
    }
    const { state, report } = migrate(ftxRaw, legacy);
    return { state, report };
  } catch (e) {
    console.error('FTX: loadPersistedState failed, booting fresh', e);
    return { state: seedPersistedState(), report: { fromLegacy: false, counts: { workouts: 0, measurements: 0, photos: 0, favoriteMeals: 0, foods: 0, mealDays: 0 }, warnings: [String(e)] } };
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function savePersistedState(state: PersistedState, immediate = false) {
  const write = () => {
    try { localStorage.setItem(FTX_STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error('FTX: save failed', e); }
  };
  if (immediate) { if (saveTimer) clearTimeout(saveTimer); write(); return; }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 150);
}

export function exportBackup(state: PersistedState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<PersistedState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const { state } = migrate(parsed, {});
  return state;
}

// ---------------------------------------------------------------------------
// Photo bytes: IndexedDB. Legacy FT stored photo bytes as base64 directly in
// the main formDB blob; ensurePhotosMigrated() (below) moves them out,
// resumably and idempotently, and NEVER deletes the legacy base64 source —
// see that function's doc comment for the full design.
// ---------------------------------------------------------------------------

const PHOTO_DB_NAME = 'ftxPhotos';
const PHOTO_STORE = 'photos';

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putPhotoBytes(id: string, blob: Blob): Promise<void> {
  const db = await openPhotoDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhotoBytes(id: string): Promise<Blob | null> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhotoBytes(id: string): Promise<void> {
  const db = await openPhotoDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function base64ToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export interface PhotoMigrationResult { checked: number; alreadyPresent: number; migrated: number; failed: number; skippedNoSource: number; }

/**
 * Resumable, idempotent photo-bytes migration. Unlike a one-shot "run once
 * at first boot" migration, this is safe to call on EVERY app boot:
 *  - It re-reads the legacy `formDB` from localStorage fresh each time
 *    (never deleted, so it's always available to retry against).
 *  - For each photoIndex entry with a `legacySourceIndex`, it checks whether
 *    IndexedDB ALREADY has bytes for that id (getPhotoBytes) before writing
 *    anything — already-migrated photos are skipped, so re-running this
 *    never produces duplicates and costs almost nothing once migration is
 *    complete.
 *  - If the app is closed mid-migration (some photos written, some not), the
 *    next boot's call simply picks up exactly where it left off, because the
 *    "have we already done this one" check is IndexedDB's actual content,
 *    not a separate completion flag that could itself get out of sync.
 *  - It NEVER deletes or modifies the legacy `formDB.photos[].data` — that
 *    stays untouched in localStorage regardless of migration outcome.
 */
export async function ensurePhotosMigrated(photoIndex: { id: string; legacySourceIndex?: number }[]): Promise<PhotoMigrationResult> {
  const result: PhotoMigrationResult = { checked: 0, alreadyPresent: 0, migrated: 0, failed: 0, skippedNoSource: 0 };
  const toMigrate = photoIndex.filter((p) => typeof p.legacySourceIndex === 'number');
  if (!toMigrate.length) return result;

  let legacyPhotos: { data?: string }[] = [];
  try {
    const raw = safeParse(localStorage.getItem(LEGACY_MAIN_KEY));
    legacyPhotos = Array.isArray(raw?.photos) ? raw.photos : [];
  } catch {
    return result;
  }
  if (!legacyPhotos.length) return result;

  for (const meta of toMigrate) {
    result.checked++;
    const legacyPhoto = legacyPhotos[meta.legacySourceIndex!];
    if (!legacyPhoto?.data) { result.skippedNoSource++; continue; }
    try {
      const existing = await getPhotoBytes(meta.id);
      if (existing) { result.alreadyPresent++; continue; }
      await putPhotoBytes(meta.id, base64ToBlob(legacyPhoto.data));
      result.migrated++;
    } catch (e) {
      console.error('FTX: photo migration failed for', meta.id, e);
      result.failed++;
    }
  }
  return result;
}
