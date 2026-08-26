// Domain types. This file is the single definition of "what data looks like"
// in FTX. Every other module (reducer, migrations, dataLayer, components)
// imports from here — never redefines a shape locally.

export type PlanId = string; // e.g. 'Upper Strength', 'HYROX Hybrid'
export type DateKey = string; // 'YYYY-MM-DD'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Date#getDay()

export interface ExerciseDef {
  name: string;
  sets: number;
  repRange: string; // '6-8'
  targetRir: string; // '1-2'
}

export interface SetEntry {
  set: number;
  setType: 'warmup' | 'working' | 'backoff' | 'drop';
  weight: number | null;
  reps: number | null;
  rir: number | null;
  done: boolean;
}

export interface LoggedExercise {
  name: string;
  sets: number;
  repRange: string;
  targetRir: string;
  setData: SetEntry[];
  note: string;
}

export interface CardioLog {
  type: string;
  minutes: number;
  speed: number;
  incline: number;
  intensity: 'Hafif' | 'Orta' | 'Yüksek';
  kcal: number;
}

export interface HyroxSegmentLog {
  key: string;
  name: string;
  target: string;
  unit?: string;
  seconds: number;
  weight: number;
}

export interface Workout {
  id: string;
  date: DateKey;
  type: PlanId;
  exercises: LoggedExercise[];
  durationSec: number;
  cardio: CardioLog | null;
  hyrox: { segments: HyroxSegmentLog[] } | null;
  rpe?: number | null;
}

/** A draft is scoped to exactly one plan. Switching plans never touches
 * another plan's draft — that is the architectural fix for the original
 * "program switch loses your sets" bug class. */
export interface DraftSetRow {
  weight?: string;
  reps?: string;
  rir?: string;
  done?: boolean;
  setType?: SetEntry['setType'];
}
export interface WorkoutDraft {
  planId: PlanId;
  date: DateKey;
  startedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
  sets: Record<number, DraftSetRow[]>; // exerciseIndex -> rows, values kept as text while editing
  notes: Record<number, string>;
  cardio: Partial<CardioLog> | null;
  hyrox: Record<string, { seconds?: number; weight?: number }> | null;
  updatedAt: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string; // 'g' or a count unit like 'adet'
  servingG: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
}

export interface MealItem {
  foodId: string;
  qty: number;
  unit: string;
}

export type MealName = 'Kahvaltı' | 'Öğle' | 'Akşam' | 'Ara Öğün' | 'Antrenman Öncesi' | 'Antrenman Sonrası';

export interface Measurement {
  id: string;
  date: DateKey;
  weight: number | null;
  waist: number | null;
  navel: number | null;
  neck: number | null;
  chest: number | null;
  armR: number | null;
  armL: number | null;
  thighR: number | null;
  thighL: number | null;
  note: string;
}

export interface PhotoMeta {
  id: string;
  date: DateKey;
  pose: string;
  /** Index of this photo in the original legacy FT `formDB.photos[]` array,
   * if this entry came from a migration. Lets ensurePhotosMigrated() re-match
   * a legacy base64 photo to its IndexedDB byte record on ANY later boot —
   * not just the one boot where migration first ran — so a migration that
   * was interrupted (tab closed mid-write) can safely resume on next open. */
  legacySourceIndex?: number;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  items: { foodName: string; qty: number; unit: string }[];
}

export interface ExerciseOverrideRow {
  name: string;
  sets: number;
  repRange: string;
  targetRir: string;
  origin: number | null; // index into the plan's permanent base list, or null if session-only
}

export interface ExerciseOverrideSession {
  base: ExerciseOverrideRow[]; // permanent rows for this plan (mirrors programs[planId] when no session active)
  rows: ExerciseOverrideRow[]; // what's actually shown today (may include session-only swaps)
  updatedAtDateKey: DateKey; // session-only rows expire when this isn't today
}

export interface ReadinessEntry {
  sleep: number | null;
  energy: number | null;
  soreness: number | null;
}

export interface CalorieDecision {
  date: DateKey;
  action: 'accepted' | 'dismissed';
  delta: number;
  from?: number;
  to?: number;
}

export interface CatchupState {
  date: DateKey;
  sourceDate: DateKey;
  plan: PlanId;
}

/** Everything in here is written to persistent storage (localStorage +
 * IndexedDB for photo bytes). Nothing in UiState ever ends up here. */
export interface PersistedState {
  schemaVersion: number;
  profile: { name: string; heightCm: number; startWeight: number | null; startDate: DateKey | null };
  targets: { kcal: number; protein: number; carb: number; fat: number; fiber: number; water: number };
  programs: Record<PlanId, ExerciseDef[]>;
  schedule: Partial<Record<Weekday, PlanId>>;
  foods: Food[];
  meals: Record<DateKey, Partial<Record<MealName, MealItem[]>>>;
  workouts: Workout[];
  workoutDrafts: Record<PlanId, WorkoutDraft | null>;
  measurements: Measurement[];
  photoIndex: PhotoMeta[];
  habits: Record<DateKey, { creatine?: boolean; biotin?: boolean; water?: number; steps?: number }>;
  favoriteMeals: FavoriteMeal[];
  foodUsage: Record<string, number>;
  coach: {
    readiness: Record<DateKey, ReadinessEntry>;
    calorieDecisions: CalorieDecision[];
  };
  exerciseOverrides: Record<PlanId, ExerciseOverrideSession | null>;
  missedWorkoutDecisions: Record<DateKey, 'skip' | 'caught-up'>;
  catchup: CatchupState | null;
  lastSavedWorkout: { at: number; date: DateKey; type: PlanId } | null;
}

/** Ephemeral, per-session UI state. Never persisted. */
export interface UiState {
  tab: 'Panel' | 'Beslenme' | 'Antrenman' | 'Ölçümler' | 'Fotoğraflar' | 'Ayarlar';
  selectedPlanId: PlanId;
  selectedMeal: MealName;
  toast: string | null;
  nutritionFilter: string;
  nutritionShowAll: boolean;
  openWorkoutModal: 'library-add' | 'library-replace' | null;
  libraryReplaceIndex: number | null;
  photoCompare: { pose: string; a: string | null; b: string | null } | null;
  /** Whether the post-save workout summary modal (W6) is open. Purely a
   * view-state flag — the DATA it displays (the just-saved workout) already
   * lives in PersistedState.lastSavedWorkout / workouts, so nothing new is
   * duplicated here. */
  workoutSummaryOpen: boolean;
}

export interface AppState {
  persisted: PersistedState;
  ui: UiState;
}
