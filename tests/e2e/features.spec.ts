import { test, expect } from '@playwright/test';

test.describe('Exercise library, backup/restore, catch-up', () => {
  test('session-only vs permanent swap, backup export/import round-trip', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await page.waitForTimeout(400);
    await page.click('nav >> text=Antrenman');
    await page.waitForTimeout(200);
    await page.selectOption('#program-select', { label: 'Upper Strength' });
    await page.waitForTimeout(200);

    await page.locator('.workout-card').first().locator('text=Değiştir').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.ftlib-modal')).toHaveCount(1);
    await page.fill('.ftlib-search input', 'Barbell Bench Press');
    await page.waitForTimeout(200);
    await page.locator('.ftlib-pick').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.workout-card').first().locator('strong').first().textContent()).toBe('Barbell Bench Press');
    const programUnchanged = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).programs['Upper Strength'][0].name);
    expect(programUnchanged).toBe('Incline Chest Press');

    await page.locator('.workout-card').first().locator('text=Değiştir').click();
    await page.waitForTimeout(200);
    await page.check('.ftlib-permanent input');
    await page.fill('.ftlib-search input', 'Dumbbell Bench Press');
    await page.waitForTimeout(200);
    await page.locator('.ftlib-pick').first().click();
    await page.waitForTimeout(200);
    const permanentChanged = await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).programs['Upper Strength'][0].name);
    expect(permanentChanged).toBe('Dumbbell Bench Press');

    await page.click('nav >> text=Ayarlar');
    await page.waitForTimeout(200);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=JSON yedeği indir')]);
    const path = await download.path();

    page.once('dialog', (d) => d.accept());
    await page.click('text=Tüm veriyi sıfırla');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).programs['Upper Strength'][0].name)).toBe('Incline Chest Press');

    await page.locator('input[type=file][accept="application/json"]').setInputFiles(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ftxDB')).programs['Upper Strength'][0].name)).toBe('Dumbbell Bench Press');

    expect(errors, errors.join(' | ')).toHaveLength(0);
  });

  test('missed-workout catch-up: pre-selects the missed plan, explicit override still wins', async ({ page, context }) => {
    // Boot once to create the default DB, then seed an extra scheduled day
    // via addInitScript before the next load — this is how "a schedule saved
    // in an earlier session" realistically looks (not a live mutation racing
    // the app's own in-memory state).
    await page.goto('/');
    await page.waitForTimeout(400);
    await page.addInitScript(() => {
      const raw = localStorage.getItem('ftxDB');
      if (!raw) return;
      const db = JSON.parse(raw);
      const y = new Date(); y.setDate(y.getDate() - 1);
      db.schedule[y.getDay()] = 'Lower Strength';
      localStorage.setItem('ftxDB', JSON.stringify(db));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    await expect(page.locator('text=KAÇIRILAN ANTRENMAN')).toHaveCount(1);
    await page.click('text=Bugün telafi et');
    await page.waitForTimeout(200);
    await expect(page.locator('nav button.active')).toContainText('Antrenman');
    await expect(page.locator('#program-select')).toHaveValue('Lower Strength');

    await page.selectOption('#program-select', { label: 'Upper Hypertrophy' });
    await page.waitForTimeout(200);
    await expect(page.locator('#program-select')).toHaveValue('Upper Hypertrophy');
  });
});
