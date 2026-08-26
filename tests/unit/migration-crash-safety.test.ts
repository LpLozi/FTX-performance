import { test, expect } from 'vitest';
import { migrateFromLegacyFT } from '../../src/core/migrations/fromLegacyFT';
import { migrate } from '../../src/core/migrations';

test('crash-safety: formDB is a string instead of an object', () => {
  expect(() => migrateFromLegacyFT({ formDB: 'not an object' as any })).not.toThrow();
  const { state } = migrateFromLegacyFT({ formDB: 'not an object' as any });
  expect(Array.isArray(state.workouts)).toBe(true);
});

test('crash-safety: workouts array contains null/malformed entries', () => {
  const legacy = { formDB: { workouts: [null, { date: '2026-08-01' }, { date: '2026-08-02', exercises: 'not-an-array' }, undefined] } };
  expect(() => migrateFromLegacyFT(legacy as any)).not.toThrow();
  const { state } = migrateFromLegacyFT(legacy as any);
  expect(state.workouts.length).toBe(4);
  expect(state.workouts[0].type).toBeTruthy(); // fell back to a default rather than crashing
});

test('crash-safety: meals reference a foodIndex that does not exist', () => {
  const legacy = { formDB: { foods: [{ name: 'Yulaf' }], meals: { '2026-08-01': { 'Kahvaltı': [{ foodIndex: 99, qty: 100, unit: 'g' }] } } } };
  expect(() => migrateFromLegacyFT(legacy as any)).not.toThrow();
  const { state, report } = migrateFromLegacyFT(legacy as any);
  // The dangling reference is dropped (not silently invented), and reported as a warning
  // rather than crashing or producing a phantom meal item.
  expect(report.warnings.length).toBeGreaterThan(0);
});

test('crash-safety: measurements/photos are not arrays at all', () => {
  const legacy = { formDB: { measurements: 'oops', photos: { not: 'an array' } } };
  expect(() => migrateFromLegacyFT(legacy as any)).not.toThrow();
  const { state } = migrateFromLegacyFT(legacy as any);
  expect(state.measurements).toEqual([]);
  expect(state.photoIndex).toEqual([]);
});

test('crash-safety: program exercises have missing/wrong-typed fields', () => {
  const legacy = { formDB: { program: { 'Upper Strength': [{ name: null, sets: 'three', reps: undefined }] } } };
  expect(() => migrateFromLegacyFT(legacy as any)).not.toThrow();
  const { state } = migrateFromLegacyFT(legacy as any);
  expect(state.programs['Upper Strength'][0].name).toBeTruthy(); // fell back to a default
  expect(typeof state.programs['Upper Strength'][0].sets).toBe('number');
});

test('crash-safety: completely empty object as legacy formDB', () => {
  expect(() => migrateFromLegacyFT({ formDB: {} })).not.toThrow();
  const { state } = migrateFromLegacyFT({ formDB: {} });
  expect(state.programs['Upper Strength']).toBeTruthy(); // defaults still seeded
});

test('crash-safety: null/undefined everywhere in the legacy bundle', () => {
  expect(() => migrateFromLegacyFT({ formDB: null, FORM_WORKOUT_DRAFT_V1: null, formCatchupWorkoutV1: undefined } as any)).not.toThrow();
});

test('crash-safety: top-level migrate() with garbage ftxRaw falls back safely', () => {
  expect(() => migrate('garbage string' as any, {})).not.toThrow();
  expect(() => migrate(12345 as any, {})).not.toThrow();
  expect(() => migrate([1, 2, 3] as any, {})).not.toThrow();
});
