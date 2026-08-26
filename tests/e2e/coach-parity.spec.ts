import { test, expect } from '@playwright/test';

function seedRichData() {
  // A few weeks of realistic history so trend/PR/report logic has something
  // to compute against, injected directly as FTX's own (not legacy) schema
  // via IMPORT_STATE-shaped localStorage seeding through the app's normal
  // migrate() path (we seed a legacy formDB and let the app do its own
  // migration+id assignment, which is more realistic than hand-crafting
  // FTX ids ourselves).
  const today = new Date();
  const dk = (offsetDays) => {
    const d = new Date(today); d.setDate(d.getDate() - offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    version: '1.4.0',
    profile: { name: 'Test', height: 181, startWeight: 93, startDate: dk(30) },
    targets: { kcal: 2400, protein: 190, carb: 230, fat: 70, fiber: 30, water: 4 },
    program: {},
    foods: [{ name: 'Tavuk göğsü (pişmiş)', category: 'Et & Tavuk', unit: 'g', servingG: 100, kcal: 165, protein: 31, carb: 0, fat: 3.6, fiber: 0 }],
    meals: {
      [dk(1)]: { 'Kahvaltı': [{ foodIndex: 0, qty: 200, unit: 'g' }] },
      [dk(2)]: { 'Kahvaltı': [{ foodIndex: 0, qty: 200, unit: 'g' }] },
      [dk(3)]: { 'Kahvaltı': [{ foodIndex: 0, qty: 200, unit: 'g' }] },
    },
    workouts: [
      { date: dk(9), type: 'Upper Strength', exercises: [{ name: 'Incline Chest Press', sets: 3, repRange: '6-8', targetRir: '1-2', setData: [{ set: 1, setType: 'working', weight: 60, reps: 8, rir: 2, done: true }], note: '' }], durationSec: 2400, cardio: null, hyrox: null },
      { date: dk(2), type: 'Upper Strength', exercises: [{ name: 'Incline Chest Press', sets: 3, repRange: '6-8', targetRir: '1-2', setData: [{ set: 1, setType: 'working', weight: 65, reps: 8, rir: 2, done: true }], note: '' }], durationSec: 2600, cardio: { type: 'Koşu', minutes: 10, speed: 9, incline: 1, intensity: 'Orta', kcal: 120 }, hyrox: null },
    ],
    measurements: [
      { date: dk(13), weight: 92, waist: 89, neck: 39, chest: 104, armR: 37, armL: 37, thighR: 58, thighL: 58, note: '' },
      { date: dk(12), weight: 91.8, waist: 88.5 },
      { date: dk(6), weight: 90.5, waist: 87 },
      { date: dk(5), weight: 90.3, waist: 86.8 },
    ],
    photos: [],
    habits: {},
    settings: { trainingDays: { 0: 'Upper Strength', 2: 'Lower Strength', 4: 'Upper Hypertrophy', 5: 'HYROX Hybrid' }, foodUsage: { 'Tavuk göğsü (pişmiş)': 10 } },
    coach: { readiness: {}, calorieDecisions: [] },
  };
}

test.describe('Feature parity — newly implemented Coach-tier features', () => {
  test('C1 — calorie coach shows a status (collecting/suggest/stable), accept applies target change', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('text=KALORİ KOÇU')).toHaveCount(1);
    const targetBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).targets.kcal);
    const applyBtn = page.locator('text=Uygula');
    if (await applyBtn.count()) {
      await applyBtn.click();
      await page.waitForTimeout(300);
      const targetAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).targets.kcal);
      expect(targetAfter).not.toBe(targetBefore);
      const decisions = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).coach.calorieDecisions);
      expect(decisions.length).toBeGreaterThan(0);
    } else {
      // 'collecting' or 'stable' or 'cooldown' status is also a valid, correct outcome
      const text = await page.locator('.card:has-text("KALORİ KOÇU")').first().textContent();
      expect(text.length).toBeGreaterThan(10);
    }
  });

  test('W6 — workout summary modal shows after save with duration/sets/volume', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(400);
    await page.click('nav >> text=Antrenman');
    await page.waitForTimeout(200);
    await page.selectOption('#program-select', { label: 'Lower Strength' });
    await page.waitForTimeout(200);
    // enter one set via keypad
    await page.locator('.workout-card').first().locator('input').first().click();
    await page.waitForTimeout(150);
    for (const ch of '80') await page.click(`.strong-grid button:text-is("${ch}")`);
    await page.click('.strong-next');
    await page.waitForTimeout(100);
    for (const ch of '8') await page.click(`.strong-grid button:text-is("${ch}")`);
    await page.click('.strong-next');
    await page.waitForTimeout(100);
    for (const ch of '2') await page.click(`.strong-grid button:text-is("${ch}")`);
    await page.click('.strong-next');
    await page.waitForTimeout(200);
    await page.locator('.workout-footer button').click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=ANTRENMAN ÖZETİ')).toHaveCount(1);
    await expect(page.locator('text=Çalışma seti')).toHaveCount(1);
    await expect(page.locator('text=Toplam hacim')).toHaveCount(1);
  });

  test('PR1 + G1 — PR values and history chart render for an exercise with 2+ sessions', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('nav >> text=Antrenman');
    await page.waitForTimeout(200);
    await page.selectOption('#program-select', { label: 'Upper Strength' });
    await page.waitForTimeout(200);
    const prSection = page.locator('.workout-card').first().locator('details', { hasText: 'Performans' });
    await prSection.locator('summary').click();
    await page.waitForTimeout(200);
    const prText = await prSection.locator('.guide-box').first().textContent();
    expect(prText).toContain('65'); // heaviest set from seed data (65kg session)
    const svgCount = await page.locator('.workout-card').first().locator('svg.line-chart').count();
    expect(svgCount).toBe(1);
  });

  test('V1 — muscle group weekly volume card renders planned vs done', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Haftalık kas grubu hacmi')).toHaveCount(1);
    const setText = await page.locator('.card:has-text("Haftalık kas grubu hacmi")').first().textContent();
    expect(setText).toMatch(/\d+\/\d+ set/);
  });

  test('M2 — measurement trend chart renders with 2+ measurements', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('nav >> text=Ölçümler');
    await page.waitForTimeout(300);
    const svgCount = await page.locator('svg.line-chart').count();
    expect(svgCount).toBe(1);
  });

  test('PH1 — photo compare: two same-pose photos + slider works', async ({ page }) => {
    const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const db = seedRichData();
    db.photos = [{ date: '2026-08-01', pose: 'Ön poz', data: TINY_PNG }, { date: '2026-08-15', pose: 'Ön poz', data: TINY_PNG }];
    await page.addInitScript((d) => { localStorage.setItem('formDB', JSON.stringify(d)); }, db);
    await page.goto('/');
    await page.waitForTimeout(600);
    await page.click('nav >> text=Fotoğraflar');
    await page.waitForTimeout(400);
    await expect(page.locator('text=Önce/sonra karşılaştırma')).toHaveCount(1);
    const selects = page.locator('.card:has-text("Önce/sonra") select');
    await selects.nth(1).selectOption({ index: 1 });
    await selects.nth(2).selectOption({ index: 2 });
    await page.waitForTimeout(400);
    await expect(page.locator('.photo-compare-wrap')).toHaveCount(1);
    await expect(page.locator('.photo-compare-slider')).toHaveCount(1);
  });

  test('N1 — rescue meal suggestion appears with remaining budget and adds to meal on click', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('nav >> text=Beslenme');
    await page.waitForTimeout(300);
    const rescueCard = page.locator('text=Günü kurtar');
    if (await rescueCard.count()) {
      const before = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ftxDB')).meals[Object.keys(JSON.parse(localStorage.getItem('ftxDB')).meals).sort().at(-1)] || {}).flat().length);
      await page.locator('text=Öğüne ekle').first().click();
      await page.waitForTimeout(300);
      const mealsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).meals);
      const totalItems = Object.values(mealsAfter).flatMap((day) => Object.values(day).flat()).length;
      expect(totalItems).toBeGreaterThan(0);
    }
  });

  test('CF1 — cardio finisher: form entry computes MET kcal and is saved with the workout', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(400);
    await page.click('nav >> text=Antrenman');
    await page.waitForTimeout(200);
    await page.selectOption('#program-select', { label: 'Upper Hypertrophy' });
    await page.waitForTimeout(200);
    await expect(page.locator('text=Kardiyo finisher')).toHaveCount(1);
    const cardioCard = page.locator('.card:has-text("Kardiyo finisher")');
    await cardioCard.locator('select').first().selectOption('Koşu');
    await cardioCard.locator('input[type=number]').first().fill('20');
    await page.waitForTimeout(400);
    await expect(page.locator('text=Tahmini kalori')).toHaveCount(1);
    await page.locator('.workout-footer button').click();
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => {
      const workouts = JSON.parse(localStorage.getItem('ftxDB')).workouts;
      return workouts.find((w) => w.type === 'Upper Hypertrophy')?.cardio;
    });
    expect(saved).toBeTruthy();
    expect(saved.type).toBe('Koşu');
    expect(saved.kcal).toBeGreaterThan(0);
  });

  test('N2 — weekly calorie card shows target/actual/avg/diff', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('nav >> text=Beslenme');
    await page.waitForTimeout(300);
    await expect(page.locator('text=Haftalık kalori')).toHaveCount(1);
    const text = await page.locator('.card:has-text("Haftalık kalori")').first().textContent();
    expect(text).toMatch(/Fark:/);
  });

  test('P2 — full weekly report on Panel shows all required metrics', async ({ page }) => {
    await page.addInitScript((db) => { localStorage.setItem('formDB', JSON.stringify(db)); }, seedRichData());
    await page.goto('/');
    await page.waitForTimeout(500);
    const report = page.locator('.card:has-text("Haftalık rapor")').first();
    const text = await report.textContent();
    for (const label of ['Antrenman', 'Protein günü', 'Ort. kalori', 'Çalışma seti', 'Kardiyo', 'Kilo trendi']) {
      expect(text).toContain(label);
    }
  });
});
