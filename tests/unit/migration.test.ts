import { test, expect } from 'vitest';
import { migrateFromLegacyFT } from '../../src/core/migrations/fromLegacyFT';
import { migrate } from '../../src/core/migrations';

function realisticLegacyFormDB() {
  return {
    version: '1.4.0',
    profile: { name: 'Hüseyin', height: 181, startWeight: 93, startDate: '2026-07-19' },
    targets: { kcal: 2400, protein: 190, carb: 230, fat: 70, fiber: 30, water: 4 },
    program: {
      'Upper Strength': [{ name: 'ÖZEL Incline Press', sets: 4, reps: '5-8', rir: '1' }],
    },
    foods: [
      { name: 'Yulaf', category: 'Tahıl', unit: 'g', servingG: 100, kcal: 389, protein: 16.9, carb: 66.3, fat: 6.9, fiber: 10.6 },
      { name: 'Tavuk göğsü (pişmiş)', category: 'Et & Tavuk', unit: 'g', servingG: 100, kcal: 165, protein: 31, carb: 0, fat: 3.6, fiber: 0 },
    ],
    meals: { '2026-08-20': { 'Kahvaltı': [{ foodIndex: 0, qty: 80, unit: 'g' }, { foodIndex: 1, qty: 150, unit: 'g' }] } },
    workouts: [
      { date: '2026-08-18', type: 'Upper Strength', exercises: [{ name: 'ÖZEL Incline Press', sets: 4, repRange: '5-8', targetRir: '1', setData: [{ set: 1, setType: 'working', weight: 80, reps: 6, rir: 1, done: true }], note: '' }], durationSec: 3200, cardio: null, hyrox: null },
    ],
    measurements: [{ date: '2026-08-18', weight: 91.2, waist: 88, neck: 39, chest: 104, armR: 37, armL: 37, thighR: 58, thighL: 58, note: '' }],
    photos: [{ date: '2026-08-18', pose: 'Ön poz', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }],
    habits: { '2026-08-18': { creatine: true, biotin: false, water: 3.5, steps: 8200 } },
    settings: { trainingDays: { 1: 'Upper Strength', 3: 'Lower Strength' }, foodUsage: { 'Yulaf': 12 } },
    coach: { readiness: { '2026-08-18': { sleep: 7, energy: 4, soreness: 2 } }, calorieDecisions: [{ date: '2026-08-01', action: 'accepted', delta: -150 }] },
  };
}

test('migrateFromLegacyFT: preserves every workout, measurement, meal day, and photo count', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const { state, report } = migrateFromLegacyFT(legacy);
  expect(report.counts.workouts).toBe(1);
  expect(report.counts.measurements).toBe(1);
  expect(report.counts.photos).toBe(1);
  expect(report.counts.mealDays).toBe(1);
  expect(state.workouts[0].exercises[0].setData[0].weight).toBe(80);
  expect(state.measurements[0].weight).toBe(91.2);
});

test('migrateFromLegacyFT: never overwrites a customized program, still adds missing default programs', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const { state } = migrateFromLegacyFT(legacy);
  expect(state.programs['Upper Strength'][0].name).toBe('ÖZEL Incline Press');
  expect(state.programs['Lower Strength']).toBeTruthy(); // missing default program should still be present
  expect(state.programs['HYROX Hybrid']).toBeTruthy();
});

test('migrateFromLegacyFT: converts foodIndex references to stable foodIds, resolvable in the new foods array', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const { state } = migrateFromLegacyFT(legacy);
  const item = state.meals['2026-08-20']['Kahvaltı'][0];
  const food = state.foods.find((f) => f.id === item.foodId);
  expect(food?.name).toBe('Yulaf');
});

test('migrateFromLegacyFT: preserves custom schedule (trainingDays)', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const { state } = migrateFromLegacyFT(legacy);
  expect(state.schedule[1]).toBe('Upper Strength');
  expect(state.schedule[3]).toBe('Lower Strength');
});

test('migrateFromLegacyFT: FORM_WORKOUT_DRAFT_V1 becomes workoutDrafts[type], not a navigation-affecting value', () => {
  const legacy = {
    formDB: realisticLegacyFormDB(),
    FORM_WORKOUT_DRAFT_V1: { type: 'Lower Strength', date: '2026-08-25', startedAt: 1000, updatedAt: 2000, exercises: [{ sets: [{ weight: 40, reps: 10, rir: 2, done: false }] }] },
  };
  const { state } = migrateFromLegacyFT(legacy);
  const draft = state.workoutDrafts['Lower Strength'];
  expect(draft.planId).toBe('Lower Strength');
  expect(draft.sets[0][0].weight).toBe(40);
  // Upper Strength (a different plan) must be completely unaffected.
  expect(state.workoutDrafts['Upper Strength']).toBe(undefined);
});

test('migrateFromLegacyFT: formCatchupWorkoutV1 -> catchup', () => {
  const legacy = { formDB: realisticLegacyFormDB(), formCatchupWorkoutV1: { date: '2026-08-25', sourceDate: '2026-08-24', plan: 'Lower Strength' } };
  const { state } = migrateFromLegacyFT(legacy);
  expect(state.catchup).toEqual({ date: '2026-08-25', sourceDate: '2026-08-24', plan: 'Lower Strength' });
});

test('migrateFromLegacyFT: formFavoriteMealsV1 -> favoriteMeals', () => {
  const legacy = { formDB: realisticLegacyFormDB(), formFavoriteMealsV1: [{ name: 'Kahvaltı klasik', items: [{ food: 'Yulaf', qty: 80, unit: 'g' }] }] };
  const { state } = migrateFromLegacyFT(legacy);
  expect(state.favoriteMeals.length).toBe(1);
  expect(state.favoriteMeals[0].items[0].foodName).toBe('Yulaf');
});

test('migrateFromLegacyFT: no legacy data at all -> fresh seed, not an error', () => {
  const { state, report } = migrateFromLegacyFT({});
  expect(report.fromLegacy).toBe(false);
  expect(state.foods.length > 0).toBeTruthy();
  expect(state.workouts.length).toBe(0);
});

test('migrate(): idempotent — running the top-level migrate twice on its own output changes nothing further', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const once = migrate(null, legacy).state;
  const twice = migrate(once, {}).state;
  expect(once.workouts).toEqual(twice.workouts);
  expect(once.programs).toEqual(twice.programs);
  expect(once.foods.length).toBe(twice.foods.length);
});

test('migrate(): once FTX has its own data, legacy FT data is never consulted again (no clobbering)', () => {
  const legacy = { formDB: realisticLegacyFormDB() };
  const first = migrate(null, legacy).state;
  // Simulate the user adding new FTX-only data.
  first.measurements.push({ id: 'x', date: '2026-08-26', weight: 89, waist: null, navel: null, neck: null, chest: null, armR: null, armL: null, thighR: null, thighL: null, note: '' });
  const second = migrate(first, legacy).state;
  expect(second.measurements.length).toBe(2); // FTX data added after first migration must survive a second load
});
