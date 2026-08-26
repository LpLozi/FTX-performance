import type { PersistedState } from './types';
import { DEFAULT_PROGRAMS, DEFAULT_SCHEDULE } from '../data/programs';
import { DEFAULT_FOODS } from '../data/foods';
import { makeId } from '../lib/id';

export const SCHEMA_VERSION = 1;

export function seedPersistedState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { name: '', heightCm: 181, startWeight: null, startDate: null },
    targets: { kcal: 2400, protein: 190, carb: 230, fat: 70, fiber: 30, water: 4 },
    programs: structuredClone(DEFAULT_PROGRAMS),
    schedule: { ...DEFAULT_SCHEDULE },
    foods: DEFAULT_FOODS.map((f) => ({ id: makeId('food'), ...f })),
    meals: {},
    workouts: [],
    workoutDrafts: {},
    measurements: [],
    photoIndex: [],
    habits: {},
    favoriteMeals: [],
    foodUsage: {},
    coach: { readiness: {}, calorieDecisions: [] },
    exerciseOverrides: {},
    missedWorkoutDecisions: {},
    catchup: null,
    lastSavedWorkout: null,
  };
}
