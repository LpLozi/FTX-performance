import { test, expect } from 'vitest';
import { reducer } from '../../src/core/reducer';
import { seedPersistedState } from '../../src/core/seed';

function initialState() {
  const persisted = seedPersistedState();
  return { persisted, ui: { tab: 'Antrenman', selectedPlanId: 'Upper Strength', selectedMeal: 'Kahvaltı', toast: null, nutritionFilter: 'Tümü', nutritionShowAll: false, openWorkoutModal: null, libraryReplaceIndex: null, photoCompare: null } };
}

test('SELECT_PLAN only changes ui.selectedPlanId, never touches workoutDrafts', () => {
  let state = initialState();
  state = reducer(state, { type: 'SET_DRAFT_SET_FIELD', planId: 'Upper Strength', exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' });
  const before = state.persisted.workoutDrafts;
  state = reducer(state, { type: 'SELECT_PLAN', planId: 'Lower Strength' });
  expect(state.ui.selectedPlanId).toBe('Lower Strength');
  expect(state.persisted.workoutDrafts).toBe(before); // identity must be unchanged by SELECT_PLAN
});

test('drafts for different plans are fully isolated', () => {
  let state = initialState();
  state = reducer(state, { type: 'SET_DRAFT_SET_FIELD', planId: 'Upper Strength', exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' });
  state = reducer(state, { type: 'SET_DRAFT_SET_FIELD', planId: 'Lower Strength', exerciseIndex: 0, setIndex: 0, field: 'weight', value: '100' });
  expect(state.persisted.workoutDrafts['Upper Strength'].sets[0][0].weight).toBe('60');
  expect(state.persisted.workoutDrafts['Lower Strength'].sets[0][0].weight).toBe('100');
});

test('SAVE_WORKOUT clears only the saved plan draft, leaves others untouched', () => {
  let state = initialState();
  state = reducer(state, { type: 'SET_DRAFT_SET_FIELD', planId: 'Upper Strength', exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' });
  state = reducer(state, { type: 'SET_DRAFT_SET_FIELD', planId: 'Lower Strength', exerciseIndex: 0, setIndex: 0, field: 'weight', value: '100' });
  state = reducer(state, { type: 'SAVE_WORKOUT', planId: 'Upper Strength' });
  expect(state.persisted.workoutDrafts['Upper Strength']).toBe(null);
  expect(state.persisted.workoutDrafts['Lower Strength'].sets[0][0].weight).toBe('100');
  expect(state.persisted.workouts.length).toBe(1);
  expect(state.persisted.workouts[0].type).toBe('Upper Strength');
});

test('START_CATCHUP sets selection once; a later explicit SELECT_PLAN always wins (no background hook can fight it)', () => {
  let state = initialState();
  state = reducer(state, { type: 'START_CATCHUP', sourceDate: '2026-08-20', plan: 'Lower Strength' });
  expect(state.ui.selectedPlanId).toBe('Lower Strength');
  state = reducer(state, { type: 'SELECT_PLAN', planId: 'Upper Hypertrophy' });
  expect(state.ui.selectedPlanId).toBe('Upper Hypertrophy'); // explicit selection after catch-up must win
});

test('SWAP_EXERCISE non-permanent only changes today (exerciseOverrides), never mutates programs', () => {
  let state = initialState();
  const before = state.persisted.programs['Upper Strength'];
  state = reducer(state, { type: 'SWAP_EXERCISE', planId: 'Upper Strength', index: 0, newExercise: { name: 'Dumbbell Bench Press', sets: 3, repRange: '8-12', targetRir: '1-2' }, permanent: false });
  expect(state.persisted.programs['Upper Strength']).toBe(before);
  expect(state.persisted.exerciseOverrides['Upper Strength'].rows[0].name).toBe('Dumbbell Bench Press');
});

test('SWAP_EXERCISE permanent updates programs directly', () => {
  let state = initialState();
  state = reducer(state, { type: 'SWAP_EXERCISE', planId: 'Upper Strength', index: 0, newExercise: { name: 'Dumbbell Bench Press', sets: 3, repRange: '8-12', targetRir: '1-2' }, permanent: true });
  expect(state.persisted.programs['Upper Strength'][0].name).toBe('Dumbbell Bench Press');
});

test('ADD_MEAL_ITEM / REMOVE_MEAL_ITEM round-trip', () => {
  let state = initialState();
  const foodId = state.persisted.foods[0].id;
  state = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-08-25', meal: 'Kahvaltı', foodId, qty: 100, unit: 'g' });
  expect(state.persisted.meals['2026-08-25'].Kahvaltı.length).toBe(1);
  state = reducer(state, { type: 'REMOVE_MEAL_ITEM', date: '2026-08-25', meal: 'Kahvaltı', index: 0 });
  expect(state.persisted.meals['2026-08-25'].Kahvaltı.length).toBe(0);
});

test('RESET_STATE returns a fresh seed, discarding all persisted data', () => {
  let state = initialState();
  state = reducer(state, { type: 'ADD_MEASUREMENT', measurement: { date: '2026-08-25', weight: 90, waist: null, navel: null, neck: null, chest: null, armR: null, armL: null, thighR: null, thighL: null, note: '' } });
  expect(state.persisted.measurements.length).toBe(1);
  state = reducer(state, { type: 'RESET_STATE' });
  expect(state.persisted.measurements.length).toBe(0);
});
