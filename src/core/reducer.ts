import type { AppState, PlanId, WorkoutDraft, MealName } from './types';
import { seedPersistedState } from './seed';
import { dateKey } from './selectors';
import { makeId } from '../lib/id';

export type Action =
  | { type: 'SELECT_TAB'; tab: AppState['ui']['tab'] }
  // The ONLY action that ever sets ui.selectedPlanId. Every other feature
  // that needs to know "what plan is active" reads ui.selectedPlanId; none
  // of them may write it. This is dispatched from exactly one component
  // (features/workout/ProgramSelector.tsx) plus once on initial app load.
  | { type: 'SELECT_PLAN'; planId: PlanId }
  | { type: 'SET_WORKOUT_DATE'; planId: PlanId; date: string }
  | { type: 'START_WORKOUT'; planId: PlanId }
  | { type: 'PAUSE_WORKOUT'; planId: PlanId }
  | { type: 'RESUME_WORKOUT'; planId: PlanId }
  | { type: 'RESET_WORKOUT_TIMER'; planId: PlanId }
  | { type: 'SET_DRAFT_SET_FIELD'; planId: PlanId; exerciseIndex: number; setIndex: number; field: 'weight' | 'reps' | 'rir' | 'done' | 'setType'; value: any }
  | { type: 'ADD_DRAFT_SET'; planId: PlanId; exerciseIndex: number }
  | { type: 'REMOVE_DRAFT_SET'; planId: PlanId; exerciseIndex: number }
  | { type: 'SET_DRAFT_NOTE'; planId: PlanId; exerciseIndex: number; note: string }
  | { type: 'SET_DRAFT_CARDIO'; planId: PlanId; field: string; value: any }
  | { type: 'SET_DRAFT_HYROX_FIELD'; segmentKey: string; field: 'seconds' | 'weight'; value: number }
  | { type: 'SAVE_WORKOUT'; planId: PlanId }
  | { type: 'SAVE_HYROX'; segments: { key: string; name: string; target: string; unit?: string }[] }
  | { type: 'SWAP_EXERCISE'; planId: PlanId; index: number; newExercise: { name: string; sets: number; repRange: string; targetRir: string }; permanent: boolean }
  | { type: 'SKIP_EXERCISE_TODAY'; planId: PlanId; index: number }
  | { type: 'SELECT_MEAL'; meal: MealName }
  | { type: 'ADD_MEAL_ITEM'; date: string; meal: MealName; foodId: string; qty: number; unit: string }
  | { type: 'REMOVE_MEAL_ITEM'; date: string; meal: MealName; index: number }
  | { type: 'ADD_CUSTOM_FOOD'; food: Omit<import('./types').Food, 'id'> }
  | { type: 'SET_TARGETS'; targets: Partial<AppState['persisted']['targets']> }
  | { type: 'SET_PROFILE'; profile: Partial<AppState['persisted']['profile']> }
  | { type: 'ADD_MEASUREMENT'; measurement: Omit<import('./types').Measurement, 'id'> }
  | { type: 'SET_HABIT'; date: string; key: string; value: any }
  | { type: 'ADD_PHOTO_META'; meta: import('./types').PhotoMeta }
  | { type: 'REMOVE_PHOTO_META'; id: string }
  | { type: 'SAVE_FAVORITE_MEAL'; name: string; date: string; meal: MealName }
  | { type: 'APPLY_FAVORITE_MEAL'; id: string; date: string; meal: MealName }
  | { type: 'REMOVE_FAVORITE_MEAL'; id: string }
  | { type: 'SET_READINESS'; date: string; field: 'sleep' | 'energy' | 'soreness'; value: number }
  | { type: 'ACCEPT_CALORIE_SUGGESTION'; delta: number }
  | { type: 'DISMISS_CALORIE_SUGGESTION' }
  // Catch-up is applied exactly once, by explicit user action (the "Bugün
  // telafi et" button). It dispatches SELECT_PLAN itself — there is no
  // separate background mechanism that can re-apply or fight the user's
  // subsequent choice, unlike legacy FT's per-render `applyCatch()` hook.
  | { type: 'START_CATCHUP'; sourceDate: string; plan: PlanId }
  | { type: 'SKIP_MISSED'; date: string }
  | { type: 'CLEAR_CATCHUP' }
  | { type: 'IMPORT_STATE'; persisted: AppState['persisted'] }
  | { type: 'RESET_STATE' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_TOAST'; message: string }
  | { type: 'CLOSE_WORKOUT_SUMMARY' }
  | { type: 'SET_PHOTO_COMPARE'; pose: string; a: string | null; b: string | null };

function ensureDraft(state: AppState, planId: PlanId): WorkoutDraft {
  const existing = state.persisted.workoutDrafts[planId];
  if (existing) return existing;
  return {
    planId,
    date: dateKey(),
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    sets: {},
    notes: {},
    cardio: null,
    hyrox: planId === 'HYROX Hybrid' ? {} : null,
    updatedAt: Date.now(),
  };
}

function withDraft(state: AppState, planId: PlanId, mutate: (d: WorkoutDraft) => WorkoutDraft): AppState {
  const draft = mutate(ensureDraft(state, planId));
  return { ...state, persisted: { ...state.persisted, workoutDrafts: { ...state.persisted.workoutDrafts, [planId]: draft } } };
}

export function reducer(state: AppState, action: Action): AppState {
  const { persisted, ui } = state;
  switch (action.type) {
    case 'SELECT_TAB':
      return { ...state, ui: { ...ui, tab: action.tab } };

    case 'SELECT_PLAN':
      // Deliberately does NOT touch workoutDrafts at all. Each plan's draft
      // lives at workoutDrafts[planId] and is only ever written by actions
      // scoped to that planId, so switching the selection can never lose or
      // mix up another plan's in-progress set data.
      return { ...state, ui: { ...ui, selectedPlanId: action.planId } };

    case 'SET_WORKOUT_DATE':
      return withDraft(state, action.planId, (d) => ({ ...d, date: action.date, updatedAt: Date.now() }));

    case 'START_WORKOUT':
      return withDraft(state, action.planId, (d) => (d.startedAt ? d : { ...d, startedAt: Date.now(), pausedAt: null, pausedTotalMs: 0, updatedAt: Date.now() }));

    case 'PAUSE_WORKOUT':
      return withDraft(state, action.planId, (d) => (!d.startedAt || d.pausedAt ? d : { ...d, pausedAt: Date.now(), updatedAt: Date.now() }));

    case 'RESUME_WORKOUT':
      return withDraft(state, action.planId, (d) => (!d.pausedAt ? d : { ...d, pausedTotalMs: d.pausedTotalMs + (Date.now() - d.pausedAt), pausedAt: null, updatedAt: Date.now() }));

    case 'RESET_WORKOUT_TIMER':
      return withDraft(state, action.planId, (d) => ({ ...d, startedAt: null, pausedAt: null, pausedTotalMs: 0, updatedAt: Date.now() }));

    case 'SET_DRAFT_SET_FIELD':
      return withDraft(state, action.planId, (d) => {
        const rows = d.sets[action.exerciseIndex] ? [...d.sets[action.exerciseIndex]] : [];
        rows[action.setIndex] = { ...(rows[action.setIndex] || {}), [action.field]: action.value };
        return { ...d, sets: { ...d.sets, [action.exerciseIndex]: rows }, updatedAt: Date.now() };
      });

    case 'ADD_DRAFT_SET':
      return withDraft(state, action.planId, (d) => {
        const rows = d.sets[action.exerciseIndex] ? [...d.sets[action.exerciseIndex]] : [];
        rows.push({ weight: '', reps: '', rir: '', done: false, setType: 'working' });
        return { ...d, sets: { ...d.sets, [action.exerciseIndex]: rows }, updatedAt: Date.now() };
      });

    case 'REMOVE_DRAFT_SET':
      return withDraft(state, action.planId, (d) => {
        const rows = d.sets[action.exerciseIndex] ? [...d.sets[action.exerciseIndex]] : [];
        if (rows.length <= 1) return d;
        rows.pop();
        return { ...d, sets: { ...d.sets, [action.exerciseIndex]: rows }, updatedAt: Date.now() };
      });

    case 'SET_DRAFT_NOTE':
      return withDraft(state, action.planId, (d) => ({ ...d, notes: { ...d.notes, [action.exerciseIndex]: action.note }, updatedAt: Date.now() }));

    case 'SET_DRAFT_CARDIO':
      return withDraft(state, action.planId, (d) => ({ ...d, cardio: { ...(d.cardio || {}), [action.field]: action.value }, updatedAt: Date.now() }));

    case 'SET_DRAFT_HYROX_FIELD':
      return withDraft(state, 'HYROX Hybrid', (d) => ({ ...d, hyrox: { ...(d.hyrox || {}), [action.segmentKey]: { ...(d.hyrox?.[action.segmentKey] || {}), [action.field]: action.value } }, updatedAt: Date.now() }));

    case 'SAVE_WORKOUT': {
      const draft = persisted.workoutDrafts[action.planId];
      const program = persisted.programs[action.planId] || [];
      const durationSec = draft?.startedAt ? Math.max(0, Math.floor((Date.now() - draft.startedAt - draft.pausedTotalMs) / 1000)) : 0;
      const exercises = program.map((ex, i) => ({
        name: ex.name, sets: ex.sets, repRange: ex.repRange, targetRir: ex.targetRir,
        setData: (draft?.sets[i] || []).map((s, j) => ({
          set: j + 1, setType: s.setType || 'working',
          weight: s.weight ? Number(s.weight) : null, reps: s.reps ? Number(s.reps) : null, rir: s.rir !== undefined && s.rir !== '' ? Number(s.rir) : null, done: !!s.done,
        })).filter((s) => s.weight || s.reps || s.done),
        note: draft?.notes[i] || '',
      }));
      const workout = { id: makeId('workout'), date: draft?.date || dateKey(), type: action.planId, exercises, durationSec, cardio: (draft?.cardio as any) || null, hyrox: null };
      return {
        ...state,
        persisted: {
          ...persisted,
          workouts: [...persisted.workouts, workout],
          workoutDrafts: { ...persisted.workoutDrafts, [action.planId]: null },
          lastSavedWorkout: { at: Date.now(), date: workout.date, type: action.planId },
        },
        ui: { ...ui, toast: 'Antrenman kaydedildi', workoutSummaryOpen: true },
      };
    }

    case 'SAVE_HYROX': {
      const draft = persisted.workoutDrafts['HYROX Hybrid'];
      const durationSec = draft?.startedAt ? Math.max(0, Math.floor((Date.now() - draft.startedAt - draft.pausedTotalMs) / 1000)) : 0;
      const segments = action.segments.map((seg) => ({ ...seg, seconds: Number(draft?.hyrox?.[seg.key]?.seconds) || 0, weight: Number(draft?.hyrox?.[seg.key]?.weight) || 0 }));
      const workout = { id: makeId('workout'), date: draft?.date || dateKey(), type: 'HYROX Hybrid', exercises: [], durationSec, cardio: null, hyrox: { segments } };
      return {
        ...state,
        persisted: {
          ...persisted,
          workouts: [...persisted.workouts, workout],
          workoutDrafts: { ...persisted.workoutDrafts, 'HYROX Hybrid': null },
          lastSavedWorkout: { at: Date.now(), date: workout.date, type: 'HYROX Hybrid' },
        },
        ui: { ...ui, toast: 'HYROX Hybrid kaydedildi', workoutSummaryOpen: true },
      };
    }

    case 'SWAP_EXERCISE': {
      if (action.permanent) {
        const list = [...(persisted.programs[action.planId] || [])];
        list[action.index] = { name: action.newExercise.name, sets: action.newExercise.sets, repRange: action.newExercise.repRange, targetRir: action.newExercise.targetRir };
        return { ...state, persisted: { ...persisted, programs: { ...persisted.programs, [action.planId]: list } } };
      }
      // Session-only: today's rows change, base (permanent) program does not.
      const base = persisted.exerciseOverrides[action.planId]?.base
        ?? (persisted.programs[action.planId] || []).map((e, i) => ({ ...e, origin: i }));
      const rows = persisted.exerciseOverrides[action.planId]?.rows
        ?? (persisted.programs[action.planId] || []).map((e, i) => ({ ...e, origin: i }));
      const newRows = [...rows];
      newRows[action.index] = { ...action.newExercise, origin: rows[action.index]?.origin ?? null };
      return {
        ...state,
        persisted: {
          ...persisted,
          exerciseOverrides: { ...persisted.exerciseOverrides, [action.planId]: { base, rows: newRows, updatedAtDateKey: dateKey() } },
        },
        ui: { ...ui, toast: 'Hareket değiştirildi' },
      };
    }

    case 'SKIP_EXERCISE_TODAY': {
      const rows = persisted.exerciseOverrides[action.planId]?.rows
        ?? (persisted.programs[action.planId] || []).map((e, i) => ({ ...e, origin: i }));
      if (rows.length <= 1) return { ...state, ui: { ...ui, toast: 'Antrenmanda en az bir hareket kalmalı' } };
      const base = persisted.exerciseOverrides[action.planId]?.base ?? (persisted.programs[action.planId] || []).map((e, i) => ({ ...e, origin: i }));
      const newRows = rows.filter((_, i) => i !== action.index);
      return {
        ...state,
        persisted: { ...persisted, exerciseOverrides: { ...persisted.exerciseOverrides, [action.planId]: { base, rows: newRows, updatedAtDateKey: dateKey() } } },
        ui: { ...ui, toast: 'Hareket yalnızca bugün atlandı' },
      };
    }

    case 'SELECT_MEAL':
      return { ...state, ui: { ...ui, selectedMeal: action.meal } };

    case 'ADD_MEAL_ITEM': {
      const day = { ...(persisted.meals[action.date] || {}) };
      const items = [...(day[action.meal] || []), { foodId: action.foodId, qty: action.qty, unit: action.unit }];
      day[action.meal] = items;
      const food = persisted.foods.find((f) => f.id === action.foodId);
      const foodUsage = food ? { ...persisted.foodUsage, [food.name]: (persisted.foodUsage[food.name] || 0) + 1 } : persisted.foodUsage;
      return { ...state, persisted: { ...persisted, meals: { ...persisted.meals, [action.date]: day }, foodUsage } };
    }

    case 'REMOVE_MEAL_ITEM': {
      const day = { ...(persisted.meals[action.date] || {}) };
      day[action.meal] = (day[action.meal] || []).filter((_, i) => i !== action.index);
      return { ...state, persisted: { ...persisted, meals: { ...persisted.meals, [action.date]: day } } };
    }

    case 'ADD_CUSTOM_FOOD':
      return { ...state, persisted: { ...persisted, foods: [...persisted.foods, { id: makeId('food'), ...action.food }] } };

    case 'SET_TARGETS':
      return { ...state, persisted: { ...persisted, targets: { ...persisted.targets, ...action.targets } } };

    case 'SET_PROFILE':
      return { ...state, persisted: { ...persisted, profile: { ...persisted.profile, ...action.profile } } };

    case 'ADD_MEASUREMENT':
      return { ...state, persisted: { ...persisted, measurements: [...persisted.measurements, { id: makeId('measurement'), ...action.measurement }] } };

    case 'SET_HABIT': {
      const day = { ...(persisted.habits[action.date] || {}), [action.key]: action.value };
      return { ...state, persisted: { ...persisted, habits: { ...persisted.habits, [action.date]: day } } };
    }

    case 'ADD_PHOTO_META':
      return { ...state, persisted: { ...persisted, photoIndex: [...persisted.photoIndex, action.meta] } };

    case 'REMOVE_PHOTO_META':
      return { ...state, persisted: { ...persisted, photoIndex: persisted.photoIndex.filter((p) => p.id !== action.id) } };

    case 'SAVE_FAVORITE_MEAL': {
      const items = persisted.meals[action.date]?.[action.meal] || [];
      if (!items.length) return { ...state, ui: { ...ui, toast: 'Bu öğünde kayıt yok' } };
      const named = items.map((it) => {
        const f = persisted.foods.find((food) => food.id === it.foodId);
        return { foodName: f?.name || '', qty: it.qty, unit: it.unit };
      }).filter((x) => x.foodName);
      return { ...state, persisted: { ...persisted, favoriteMeals: [...persisted.favoriteMeals, { id: makeId('favmeal'), name: action.name, items: named }] } };
    }

    case 'APPLY_FAVORITE_MEAL': {
      const fav = persisted.favoriteMeals.find((f) => f.id === action.id);
      if (!fav) return state;
      const day = { ...(persisted.meals[action.date] || {}) };
      const existing = day[action.meal] || [];
      const toAdd: { foodId: string; qty: number; unit: string }[] = [];
      for (const it of fav.items) {
        const food = persisted.foods.find((f) => f.name === it.foodName);
        if (food) toAdd.push({ foodId: food.id, qty: it.qty, unit: it.unit });
      }
      day[action.meal] = [...existing, ...toAdd];
      return { ...state, persisted: { ...persisted, meals: { ...persisted.meals, [action.date]: day } } };
    }

    case 'REMOVE_FAVORITE_MEAL':
      return { ...state, persisted: { ...persisted, favoriteMeals: persisted.favoriteMeals.filter((f) => f.id !== action.id) } };

    case 'SET_READINESS': {
      const day = { ...(persisted.coach.readiness[action.date] || { sleep: null, energy: null, soreness: null }), [action.field]: action.value };
      return { ...state, persisted: { ...persisted, coach: { ...persisted.coach, readiness: { ...persisted.coach.readiness, [action.date]: day } } } };
    }

    case 'ACCEPT_CALORIE_SUGGESTION': {
      const kcal = Math.max(1200, persisted.targets.kcal + action.delta);
      return {
        ...state,
        persisted: {
          ...persisted,
          targets: { ...persisted.targets, kcal },
          coach: { ...persisted.coach, calorieDecisions: [...persisted.coach.calorieDecisions, { date: dateKey(), action: 'accepted', delta: action.delta, from: persisted.targets.kcal, to: kcal }] },
        },
        ui: { ...ui, toast: `Yeni hedef: ${kcal} kcal` },
      };
    }

    case 'DISMISS_CALORIE_SUGGESTION':
      return { ...state, persisted: { ...persisted, coach: { ...persisted.coach, calorieDecisions: [...persisted.coach.calorieDecisions, { date: dateKey(), action: 'dismissed', delta: 0 }] } } };

    case 'START_CATCHUP':
      // Explicit, one-shot user action. Sets both the catchup record AND the
      // selection in the same dispatch — there is no separate hook that will
      // re-fire this on a later render, unlike legacy FT's applyCatch().
      return { ...state, persisted: { ...persisted, catchup: { date: dateKey(), sourceDate: action.sourceDate, plan: action.plan } }, ui: { ...ui, selectedPlanId: action.plan } };

    case 'SKIP_MISSED':
      return { ...state, persisted: { ...persisted, missedWorkoutDecisions: { ...persisted.missedWorkoutDecisions, [action.date]: 'skip' } } };

    case 'CLEAR_CATCHUP':
      return { ...state, persisted: { ...persisted, catchup: null } };

    case 'IMPORT_STATE':
      return { ...state, persisted: action.persisted };

    case 'RESET_STATE':
      return { ...state, persisted: seedPersistedState() };

    case 'SET_TOAST':
      return { ...state, ui: { ...ui, toast: action.message } };

    case 'CLEAR_TOAST':
      return { ...state, ui: { ...ui, toast: null } };

    case 'CLOSE_WORKOUT_SUMMARY':
      return { ...state, ui: { ...ui, workoutSummaryOpen: false } };

    case 'SET_PHOTO_COMPARE':
      return { ...state, ui: { ...ui, photoCompare: { pose: action.pose, a: action.a, b: action.b } } };

    default:
      return state;
  }
}
