import { test, expect } from '@playwright/test';

// A 1x1 red pixel PNG as base64 — small, deterministic, easy to byte-compare.
const TINY_PNG_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function legacyFormDBWithPhotos() {
  return {
    version: '1.4.0',
    profile: { name: 'Test', height: 181, startWeight: 90, startDate: '2026-07-01' },
    targets: { kcal: 2400, protein: 190, carb: 230, fat: 70, fiber: 30, water: 4 },
    program: {},
    foods: [],
    meals: {},
    workouts: [],
    measurements: [],
    photos: [
      { date: '2026-08-01', pose: 'Ön poz', data: TINY_PNG_B64 },
      { date: '2026-08-15', pose: 'Yan poz', data: TINY_PNG_B64 },
    ],
    habits: {},
    settings: { trainingDays: {}, foodUsage: {} },
    coach: { readiness: {}, calorieDecisions: [] },
  };
}

test.describe('Legacy photo -> IndexedDB migration (P1)', () => {
  test('migration is actually invoked on boot, bytes land in IndexedDB, source is never deleted', async ({ page }) => {
    await page.addInitScript((db) => {
      localStorage.setItem('formDB', JSON.stringify(db));
    }, legacyFormDBWithPhotos());

    await page.goto('/');
    await page.waitForTimeout(600); // ensurePhotosMigrated() runs async on mount

    const photoIndex = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).photoIndex);
    expect(photoIndex).toHaveLength(2);

    const idbCounts = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('ftxPhotos', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').getAllKeys();
        req.onsuccess = () => resolve(req.result.length);
        req.onerror = () => reject(req.error);
      });
    });
    expect(idbCounts).toBe(2); // both legacy photos actually written to IndexedDB

    // Source untouched.
    const legacyStillHasData = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('formDB'));
      return db.photos.every((p) => !!p.data);
    });
    expect(legacyStillHasData).toBe(true);

    // Second boot: no duplicates, no re-write (idempotent).
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const idbCountsAfterReload = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('ftxPhotos', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').getAllKeys();
        req.onsuccess = () => resolve(req.result.length);
        req.onerror = () => reject(req.error);
      });
    });
    expect(idbCountsAfterReload).toBe(2); // still exactly 2, not 4
  });

  test('an interrupted migration (one photo never written) resumes and completes on next boot', async ({ page }) => {
    await page.addInitScript((db) => {
      localStorage.setItem('formDB', JSON.stringify(db));
    }, legacyFormDBWithPhotos());

    await page.goto('/');
    await page.waitForTimeout(600);

    // Simulate "interrupted": manually delete ONE of the two migrated photos
    // from IndexedDB, as if the tab had closed before that write completed.
    const photoIndex = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).photoIndex);
    const idToDelete = photoIndex[1].id;
    await page.evaluate(async (id) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('ftxPhotos', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }, idToDelete);

    const countAfterSimulatedInterruption = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('ftxPhotos', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').getAllKeys();
        req.onsuccess = () => resolve(req.result.length);
        req.onerror = () => reject(req.error);
      });
    });
    expect(countAfterSimulatedInterruption).toBe(1); // one "lost" to simulate interruption

    // Next boot must notice the gap and re-migrate just that one photo.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const countAfterResume = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('ftxPhotos', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').getAllKeys();
        req.onsuccess = () => resolve(req.result.length);
        req.onerror = () => reject(req.error);
      });
    });
    expect(countAfterResume).toBe(2); // fully healed back to 2
  });

  test('Photos screen actually displays a migrated legacy photo (display flow works post-migration)', async ({ page }) => {
    await page.addInitScript((db) => {
      localStorage.setItem('formDB', JSON.stringify(db));
    }, legacyFormDBWithPhotos());
    await page.goto('/');
    await page.waitForTimeout(600);
    await page.click('nav >> text=Fotoğraflar');
    await page.waitForTimeout(400);
    const imgCount = await page.locator('.photo-card img').count();
    expect(imgCount).toBe(2);
    const src = await page.locator('.photo-card img').first().getAttribute('src');
    expect(src?.startsWith('blob:')).toBe(true); // real object URL from a real IndexedDB blob
  });
});
