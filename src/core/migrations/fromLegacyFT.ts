import type { PersistedState, Food, MealItem, Workout, Measurement, WorkoutDraft, FavoriteMeal, ExerciseOverrideSession, DateKey } from '../types';
import { seedPersistedState } from '../seed';
import { makeId } from '../../lib/id';

/** Raw shape of everything legacy FT could have in localStorage. All fields
 * optional/unknown-shaped on purpose — real production data is messy and this
 * function must never throw on missing/malformed fields. */
export interface LegacyBundle {
  formDB?: any;
  FORM_WORKOUT_DRAFT_V1?: any;
  FORM_LAST_WORKOUT_SAVED_V1?: any;
  formHyroxDraft?: any;
  formCatchupWorkoutV1?: any;
  formMissedWorkoutDecisionsV1?: any;
  formFavoriteMealsV1?: any;
  formExerciseLibrarySessionV1?: any;
  // Deliberately NOT migrated (see FTX-plan.md ¤1.8/6.2): aylin*, formDB_backup_pre_program_fix
}

function todayKey(): DateKey {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface MigrationReport {
  fromLegacy: boolean;
  counts: {
    workouts: number;
    measurements: number;
    photos: number;
    favoriteMeals: number;
    foods: number;
    mealDays: number;
  };
  warnings: string[];
}

export function migrateFromLegacyFT(legacy: LegacyBundle): { state: PersistedState; report: MigrationReport } {
  const warnings: string[] = [];
  const seed = seedPersistedState();
  const raw = legacy.formDB;

  if (!raw || typeof raw !== 'object') {
    return { state: seed, report: { fromLegacy: false, counts: { workouts: 0, measurements: 0, photos: 0, favoriteMeals: 0, foods: seed.foods.length, mealDays: 0 }, warnings } };
  }

  const state: PersistedState = structuredClone(seed);
  state.profile = { ...seed.profile, ...(raw.profile || {}), heightCm: raw.profile?.height ?? seed.profile.heightCm };
  state.targets = { ...seed.targets, ...(raw.targets || {}) };

  // Programs: merge, never overwrite an existing (possibly customized) plan.
  state.programs = { ...seed.programs };
  if (raw.program && typeof raw.program === 'object') {
    for (const [planId, exercises] of Object.entries<any>(raw.program)) {
      if (Array.isArray(exercises)) {
        state.programs[planId] = exercises.map((e: any) => ({
          name: e?.name ?? 'Bilinmeyen hareket',
          sets: Number(e?.sets) || 1,
          repRange: String(e?.reps ?? e?.repRange ?? ''),
          targetRir: String(e?.rir ?? e?.targetRir ?? ''),
        }));
      }
    }
  }
  state.schedule = raw.settings?.trainingDays && Object.keys(raw.settings.trainingDays).length
    ? Object.fromEntries(Object.entries(raw.settings.trainingDays).map(([k, v]) => [Number(k), v as string]))
    : seed.schedule;

  // Foods: id-assign every legacy food (by array position, so meal item
  // foodIndex references can be resolved below), keep every one the user had
  // — including edits to preloaded foods — and only add genuinely missing
  // defaults by name.
  const legacyFoods: any[] = Array.isArray(raw.foods) ? raw.foods : [];
  const idByLegacyIndex = new Map<number, string>();
  const migratedFoods: Food[] = legacyFoods.map((lf, i) => {
    const id = makeId('food');
    idByLegacyIndex.set(i, id);
    return {
      id,
      name: lf?.name ?? 'Besin',
      category: lf?.category ?? 'Diğer',
      brand: lf?.brand ?? 'Genel',
      unit: lf?.unit ?? 'g',
      servingG: Number(lf?.servingG) || 100,
      kcal: Number(lf?.kcal) || 0,
      protein: Number(lf?.protein) || 0,
      carb: Number(lf?.carb) || 0,
      fat: Number(lf?.fat) || 0,
      fiber: Number(lf?.fiber) || 0,
    };
  });
  const existingNames = new Set(migratedFoods.map((f) => f.name.toLocaleLowerCase('tr-TR')));
  const missingDefaults = seed.foods.filter((f) => !existingNames.has(f.name.toLocaleLowerCase('tr-TR')));
  state.foods = migratedFoods.length ? [...migratedFoods, ...missingDefaults] : seed.foods;

  function resolveFoodId(foodIndex: number): string | null {
    const id = idByLegacyIndex.get(foodIndex);
    if (id) return id;
    warnings.push(`meal item referenced missing legacy foodIndex ${foodIndex}`);
    return null;
  }

  // Meals: foodIndex -> foodId
  state.meals = {};
  let mealDays = 0;
  if (raw.meals && typeof raw.meals === 'object') {
    for (const [date, meals] of Object.entries<any>(raw.meals)) {
      if (!meals || typeof meals !== 'object') continue;
      const dayOut: Record<string, MealItem[]> = {};
      let any = false;
      for (const [mealName, items] of Object.entries<any>(meals)) {
        if (!Array.isArray(items)) continue;
        const out: MealItem[] = [];
        for (const it of items) {
          const foodId = resolveFoodId(Number(it?.foodIndex));
          if (foodId) out.push({ foodId, qty: Number(it?.qty) || 0, unit: it?.unit ?? 'g' });
        }
        if (out.length) { dayOut[mealName] = out; any = true; }
      }
      if (any) { state.meals[date] = dayOut; mealDays++; }
    }
  }

  // Workouts: preserved verbatim, id-assigned, HYROX shape normalized.
  state.workouts = (Array.isArray(raw.workouts) ? raw.workouts : []).map((w: any): Workout => ({
    id: makeId('workout'),
    date: w?.date ?? todayKey(),
    type: w?.type ?? 'Upper Strength',
    exercises: Array.isArray(w?.exercises) ? w.exercises.map((e: any) => ({
      name: e?.name ?? '',
      sets: Number(e?.sets) || 0,
      repRange: String(e?.repRange ?? ''),
      targetRir: String(e?.targetRir ?? ''),
      setData: Array.isArray(e?.setData) ? e.setData.map((s: any) => ({
        set: Number(s?.set) || 0,
        setType: s?.setType ?? 'working',
        weight: s?.weight ?? null,
        reps: s?.reps ?? null,
        rir: s?.rir ?? null,
        done: !!s?.done,
      })) : [],
      note: e?.note ?? '',
    })) : [],
    durationSec: Number(w?.durationSec) || 0,
    cardio: w?.cardio ?? null,
    hyrox: w?.hyrox ?? null,
    rpe: w?.rpe ?? null,
  }));

  state.measurements = (Array.isArray(raw.measurements) ? raw.measurements : []).map((m: any): Measurement => ({
    id: makeId('measurement'),
    date: m?.date ?? todayKey(),
    weight: m?.weight ?? null,
    waist: m?.waist ?? null,
    navel: m?.navel ?? null,
    neck: m?.neck ?? null,
    chest: m?.chest ?? null,
    armR: m?.armR ?? null,
    armL: m?.armL ?? null,
    thighR: m?.thighR ?? null,
    thighL: m?.thighL ?? null,
    note: m?.note ?? '',
  }));

  // Photos: metadata only here — actual bytes are migrated separately, on
  // every app boot (not just this one), by dataLayer.ensurePhotosMigrated().
  // legacySourceIndex is what lets that resumable process re-match a legacy
  // base64 photo to this entry on any later boot, so an interrupted
  // migration (tab closed mid-write) safely continues next time instead of
  // being silently skipped forever.
  state.photoIndex = (Array.isArray(raw.photos) ? raw.photos : []).map((p: any, i: number) => ({
    id: makeId('photo'),
    date: p?.date ?? todayKey(),
    pose: p?.pose ?? 'Ön poz',
    legacySourceIndex: i,
  }));

  state.habits = raw.habits && typeof raw.habits === 'object' ? raw.habits : {};
  state.foodUsage = raw.settings?.foodUsage && typeof raw.settings.foodUsage === 'object' ? raw.settings.foodUsage : {};
  state.coach = {
    readiness: raw.coach?.readiness && typeof raw.coach.readiness === 'object' ? raw.coach.readiness : {},
    calorieDecisions: Array.isArray(raw.coach?.calorieDecisions) ? raw.coach.calorieDecisions : [],
  };

  // --- Scattered legacy localStorage keys, folded into the one persisted state ---

  // FORM_WORKOUT_DRAFT_V1 (single draft, tagged with a `type`) -> workoutDrafts[type]
  const legacyDraft = legacy.FORM_WORKOUT_DRAFT_V1;
  if (legacyDraft && typeof legacyDraft === 'object' && legacyDraft.type) {
    const draft: WorkoutDraft = {
      planId: legacyDraft.type,
      date: legacyDraft.date ?? todayKey(),
      startedAt: legacyDraft.startedAt ?? null,
      pausedAt: null,
      pausedTotalMs: 0,
      sets: {},
      notes: {},
      cardio: legacyDraft.cardio ?? null,
      hyrox: null,
      updatedAt: legacyDraft.updatedAt ?? Date.now(),
    };
    (legacyDraft.exercises || []).forEach((e: any, i: number) => {
      if (e?.sets?.length) draft.sets[i] = e.sets.map((s: any) => ({ weight: s.weight, reps: s.reps, rir: s.rir, done: !!s.done }));
      if (e?.note) draft.notes[i] = e.note;
    });
    state.workoutDrafts[draft.planId] = draft;
  }

  // formHyroxDraft -> workoutDrafts['HYROX Hybrid']
  const legacyHyrox = legacy.formHyroxDraft;
  if (legacyHyrox && typeof legacyHyrox === 'object' && Object.keys(legacyHyrox).length) {
    const existing = state.workoutDrafts['HYROX Hybrid'];
    state.workoutDrafts['HYROX Hybrid'] = {
      planId: 'HYROX Hybrid',
      date: todayKey(),
      startedAt: existing?.startedAt ?? null,
      pausedAt: null,
      pausedTotalMs: 0,
      sets: {},
      notes: {},
      cardio: null,
      hyrox: legacyHyrox,
      updatedAt: Date.now(),
    };
  }

  // formCatchupWorkoutV1 -> catchup
  if (legacy.formCatchupWorkoutV1 && typeof legacy.formCatchupWorkoutV1 === 'object') {
    const c = legacy.formCatchupWorkoutV1;
    if (c.date && c.plan) state.catchup = { date: c.date, sourceDate: c.sourceDate ?? c.date, plan: c.plan };
  }

  // formMissedWorkoutDecisionsV1 -> missedWorkoutDecisions
  if (legacy.formMissedWorkoutDecisionsV1 && typeof legacy.formMissedWorkoutDecisionsV1 === 'object') {
    state.missedWorkoutDecisions = legacy.formMissedWorkoutDecisionsV1;
  }

  // formFavoriteMealsV1 -> favoriteMeals
  if (Array.isArray(legacy.formFavoriteMealsV1)) {
    state.favoriteMeals = legacy.formFavoriteMealsV1.map((fav: any): FavoriteMeal => ({
      id: makeId('favmeal'),
      name: fav?.name ?? 'Favori öğün',
      items: Array.isArray(fav?.items) ? fav.items.map((it: any) => ({ foodName: it.food, qty: Number(it.qty) || 0, unit: it.unit ?? 'g' })) : [],
    }));
  }

  // formExerciseLibrarySessionV1 -> exerciseOverrides, only if still "today"
  if (legacy.formExerciseLibrarySessionV1 && typeof legacy.formExerciseLibrarySessionV1 === 'object') {
    const today = todayKey();
    for (const [planId, session] of Object.entries<any>(legacy.formExerciseLibrarySessionV1)) {
      const updatedDate = session?.updatedAt ? new Date(session.updatedAt) : null;
      const updatedKey = updatedDate ? `${updatedDate.getFullYear()}-${String(updatedDate.getMonth() + 1).padStart(2, '0')}-${String(updatedDate.getDate()).padStart(2, '0')}` : null;
      const isToday = updatedKey === today;
      const toRows = (rows: any[]) => (rows || []).map((r: any) => ({ name: r.name, sets: Number(r.sets) || 1, repRange: String(r.reps ?? r.repRange ?? ''), targetRir: String(r.rir ?? r.targetRir ?? ''), origin: Number.isInteger(r.__origin) ? r.__origin : null }));
      const entry: ExerciseOverrideSession = { base: toRows(session.base), rows: isToday ? toRows(session.rows) : toRows(session.base), updatedAtDateKey: isToday ? today : today };
      state.exerciseOverrides[planId] = entry;
    }
  }

  const report: MigrationReport = {
    fromLegacy: true,
    counts: {
      workouts: state.workouts.length,
      measurements: state.measurements.length,
      photos: state.photoIndex.length,
      favoriteMeals: state.favoriteMeals.length,
      foods: state.foods.length,
      mealDays,
    },
    warnings,
  };
  return { state, report };
}
