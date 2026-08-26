import { test, expect } from '@playwright/test';

async function gotoWorkout(page) {
  await page.click('nav >> text=Antrenman');
  await page.waitForTimeout(200);
}
async function selectProgram(page, name) {
  await page.selectOption('#program-select', { label: name });
  await page.waitForTimeout(200);
}
async function firstExerciseName(page) {
  return page.locator('.workout-card strong').first().textContent();
}
async function enterSetViaKeypad(page, cardIndex, weight, reps, rir) {
  const card = page.locator('.workout-card').nth(cardIndex);
  await card.locator('input').first().click();
  await page.waitForTimeout(150);
  for (const ch of String(weight)) await page.click(`.strong-grid button:text-is("${ch}")`);
  await page.click('.strong-next');
  await page.waitForTimeout(100);
  for (const ch of String(reps)) await page.click(`.strong-grid button:text-is("${ch}")`);
  await page.click('.strong-next');
  await page.waitForTimeout(100);
  for (const ch of String(rir)) await page.click(`.strong-grid button:text-is("${ch}")`);
  await page.click('.strong-next');
  await page.waitForTimeout(150);
}

test.describe('workoutDrafts architecture — per-plan isolation (core acceptance criteria)', () => {
  test('switching plans never loses set data; HYROX round-trip; save clears only that plan; reload preserves draft + timer', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await page.waitForTimeout(400);
    expect(errors, errors.join(' | ')).toHaveLength(0);

    await gotoWorkout(page);
    await expect(page.locator('#program-select')).toHaveCount(1);

    await selectProgram(page, 'Lower Strength');
    expect(await firstExerciseName(page)).toBe('Back Squat');
    await enterSetViaKeypad(page, 0, '100', '8', '2');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('100');

    await selectProgram(page, 'Upper Strength');
    expect(await firstExerciseName(page)).toBe('Incline Chest Press');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('');
    await enterSetViaKeypad(page, 0, '60', '10', '1');

    await selectProgram(page, 'Lower Strength');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('100');

    await selectProgram(page, 'Upper Strength');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('60');

    await selectProgram(page, 'HYROX Hybrid');
    await expect(page.locator('text=HYROX Hybrid')).toHaveCount(1);
    await expect(page.locator('text=Wall Ball')).toHaveCount(1);

    await selectProgram(page, 'Upper Strength');
    expect(await firstExerciseName(page)).toBe('Incline Chest Press');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('60');

    await page.click('.timer-controls >> text=Başlat');
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await gotoWorkout(page);
    await selectProgram(page, 'Upper Strength');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('60');
    await expect(page.locator('.timer-controls >> text=Durdur')).toHaveCount(1);

    await page.locator('.workout-footer button').click();
    await page.waitForTimeout(300);
    // A workout-summary modal opens after save (W6 feature) — close it, same as a real user would.
    const summaryClose = page.locator('.ftlib-modal button:has-text("Kapat")');
    if (await summaryClose.count()) { await summaryClose.click(); await page.waitForTimeout(200); }
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('');

    await selectProgram(page, 'Lower Strength');
    expect(await page.locator('.workout-card').first().locator('input').first().inputValue()).toBe('100');

    expect(errors, errors.join(' | ')).toHaveLength(0);
  });
});
