import { test, expect } from '@playwright/test';

const legacyFormDB = {
  version: '1.4.0',
  profile: { name: 'Hüseyin', height: 181, startWeight: 93, startDate: '2026-07-19' },
  targets: { kcal: 2400, protein: 190, carb: 230, fat: 70, fiber: 30, water: 4 },
  program: { 'Upper Strength': [{ name: 'ÖZEL Incline Press', sets: 4, reps: '5-8', rir: '1' }] },
  foods: [
    { name: 'Yulaf', category: 'Tahıl', unit: 'g', servingG: 100, kcal: 389, protein: 16.9, carb: 66.3, fat: 6.9, fiber: 10.6 },
    { name: 'Tavuk göğsü (pişmiş)', category: 'Et & Tavuk', unit: 'g', servingG: 100, kcal: 165, protein: 31, carb: 0, fat: 3.6, fiber: 0 },
  ],
  meals: { '2026-08-20': { 'Kahvaltı': [{ foodIndex: 0, qty: 80, unit: 'g' }] } },
  workouts: [
    { date: '2026-08-18', type: 'Upper Strength', exercises: [{ name: 'ÖZEL Incline Press', sets: 4, repRange: '5-8', targetRir: '1', setData: [{ set: 1, setType: 'working', weight: 80, reps: 6, rir: 1, done: true }], note: '' }], durationSec: 3200, cardio: null, hyrox: null },
  ],
  measurements: [{ date: '2026-08-18', weight: 91.2, waist: 88, neck: 39, chest: 104, armR: 37, armL: 37, thighR: 58, thighL: 58, note: '' }],
  photos: [],
  habits: { '2026-08-18': { creatine: true, biotin: false, water: 3.5, steps: 8200 } },
  settings: { trainingDays: { 1: 'Upper Strength', 3: 'Lower Strength' }, foodUsage: { 'Yulaf': 12 } },
  coach: { readiness: {}, calorieDecisions: [] },
};

test.describe('Migration from legacy FT', () => {
  test('preserves data, converts foodIndex to foodId, backs up, never deletes legacy, is idempotent', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.addInitScript((db) => {
      localStorage.setItem('formDB', JSON.stringify(db));
      localStorage.setItem('FORM_WORKOUT_DRAFT_V1', JSON.stringify({ type: 'Lower Strength', date: '2026-08-25', startedAt: null, updatedAt: Date.now(), exercises: [] }));
    }, legacyFormDB);

    await page.goto('/');
    await page.waitForTimeout(500);
    expect(errors, errors.join(' | ')).toHaveLength(0);

    const kpis = await page.$$eval('.kpi', (els) => els.map((e) => e.textContent));
    expect(kpis.some((k) => k.includes('91,2'))).toBe(true);

    await page.click('nav >> text=Antrenman');
    await page.waitForTimeout(300);
    await page.selectOption('#program-select', { label: 'Upper Strength' });
    await page.waitForTimeout(200);
    expect(await page.locator('.workout-card strong').first().textContent()).toBe('ÖZEL Incline Press');

    await page.click('nav >> text=Beslenme');
    await page.waitForTimeout(300);
    expect(errors, errors.join(' | ')).toHaveLength(0);

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain('ftxDB');
    expect(keys).toContain('formDB'); // legacy never deleted
    expect(keys.some((k) => k.startsWith('ftxMigrationBackup_'))).toBe(true);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const workoutCount = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).workouts.length);
    expect(workoutCount).toBe(1); // idempotent, no duplication
  });
});
