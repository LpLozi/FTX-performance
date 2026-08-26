import type { PersistedState } from '../types';
import { seedPersistedState, SCHEMA_VERSION } from '../seed';
import { migrateFromLegacyFT, type LegacyBundle, type MigrationReport } from './fromLegacyFT';

export type { LegacyBundle, MigrationReport };

function isFtxShaped(x: any): x is PersistedState {
  return !!x && typeof x === 'object' && typeof x.schemaVersion === 'number' && Array.isArray(x.foods) && !!x.programs;
}

/** Bring FTX's own persisted state up to the current schema. Additive only —
 * never drops a field that already has user data, only fills in what's
 * missing. Running this twice on the same input must be a no-op (idempotent). */
function upgradeFtxSchema(state: PersistedState): PersistedState {
  const seed = seedPersistedState();
  const out: PersistedState = { ...seed, ...state };
  out.profile = { ...seed.profile, ...state.profile };
  out.targets = { ...seed.targets, ...state.targets };
  out.programs = { ...seed.programs, ...state.programs };
  out.schedule = Object.keys(state.schedule || {}).length ? state.schedule : seed.schedule;
  out.foods = state.foods?.length ? state.foods : seed.foods;
  out.coach = { readiness: state.coach?.readiness || {}, calorieDecisions: state.coach?.calorieDecisions || [] };
  out.workoutDrafts = state.workoutDrafts || {};
  out.exerciseOverrides = state.exerciseOverrides || {};
  out.missedWorkoutDecisions = state.missedWorkoutDecisions || {};
  out.meals = state.meals || {};
  out.workouts = state.workouts || [];
  out.measurements = state.measurements || [];
  out.photoIndex = state.photoIndex || [];
  out.habits = state.habits || {};
  out.favoriteMeals = state.favoriteMeals || [];
  out.foodUsage = state.foodUsage || {};
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

/**
 * Single migration entry point.
 *  - `ftxRaw`: whatever is currently under FTX's own storage key (or null on
 *    first run / after a reset).
 *  - `legacy`: the bundle of legacy FT localStorage values, read once by the
 *    dataLayer. Only consulted when there is no FTX data yet, so a legacy
 *    import can never clobber data the user has already created in FTX.
 */
export function migrate(ftxRaw: unknown, legacy: LegacyBundle): { state: PersistedState; report: MigrationReport } {
  if (isFtxShaped(ftxRaw)) {
    return { state: upgradeFtxSchema(ftxRaw), report: { fromLegacy: false, counts: { workouts: ftxRaw.workouts?.length || 0, measurements: ftxRaw.measurements?.length || 0, photos: ftxRaw.photoIndex?.length || 0, favoriteMeals: ftxRaw.favoriteMeals?.length || 0, foods: ftxRaw.foods?.length || 0, mealDays: Object.keys(ftxRaw.meals || {}).length }, warnings: [] } };
  }
  return migrateFromLegacyFT(legacy);
}
