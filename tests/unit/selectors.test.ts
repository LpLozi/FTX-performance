import { test, expect } from 'vitest';
import { nutrientTotals, estimateBodyFat, progressionSuggestion, matchScheduleToWorkouts, weekBounds, addDays } from '../../src/core/selectors';

test('nutrientTotals: grams-based food', () => {
  const foods = [{ id: 'f1', name: 'Yulaf', category: 'Tahıl', brand: '', unit: 'g', servingG: 100, kcal: 389, protein: 16.9, carb: 66.3, fat: 6.9, fiber: 10.6 }];
  const t = nutrientTotals([{ foodId: 'f1', qty: 50, unit: 'g' }], foods);
  expect(Math.round(t.kcal)).toBe(195);
});

test('nutrientTotals: count-based food (servingG per unit)', () => {
  const foods = [{ id: 'f1', name: 'Yumurta', category: '', brand: '', unit: 'adet', servingG: 50, kcal: 143, protein: 12.6, carb: 0.7, fat: 9.5, fiber: 0 }];
  const t = nutrientTotals([{ foodId: 'f1', qty: 2, unit: 'adet' }], foods);
  expect(Math.round(t.kcal)).toBe(143); // 2x50g = 100g = exactly the per-100g value
});

test('nutrientTotals: missing foodId skipped without throwing', () => {
  const t = nutrientTotals([{ foodId: 'nope', qty: 10, unit: 'g' }], []);
  expect(t.kcal).toBe(0);
});

test('estimateBodyFat: plausible result for typical inputs', () => {
  const bf = estimateBodyFat({ waist: 85, neck: 38, heightCm: 181 });
  expect(bf! > 5 && bf! < 30).toBeTruthy();
});

test('estimateBodyFat: null when waist <= neck', () => {
  expect(estimateBodyFat({ waist: 30, neck: 38, heightCm: 181 })).toBe(null);
});

test('progressionSuggestion: no history -> REFERANS', () => {
  const r = progressionSuggestion('Back Squat', '6-8', []);
  expect(r.tag).toBe('REFERANS');
});

test('progressionSuggestion: at top of rep range with RIR left -> ARTIR', () => {
  const history = [{ setData: [{ set: 1, setType: 'working' as const, weight: 100, reps: 8, rir: 2, done: true }] }];
  const r = progressionSuggestion('Back Squat', '6-8', history);
  expect(r.tag).toBe('ARTIR');
});

test('matchScheduleToWorkouts: same-week catch-up counts as done', () => {
  const schedule = { 3: 'Lower Strength' };
  const workouts = [{ id: '1', date: '2026-08-28', type: 'Lower Strength', exercises: [], durationSec: 0, cardio: null, hyrox: null }];
  const { matched } = matchScheduleToWorkouts(2026, 7, workouts as any, schedule, '2026-08-31');
  expect(matched.has('2026-08-26')).toBeTruthy();
});

test('weekBounds/addDays basic sanity', () => {
  const [start, end] = weekBounds(new Date('2026-08-26T12:00:00'));
  expect(start).toBe('2026-08-24');
  expect(end).toBe('2026-08-30');
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
});
