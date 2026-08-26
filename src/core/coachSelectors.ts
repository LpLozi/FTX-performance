import type { Workout, Measurement, PersistedState, LoggedExercise, SetEntry, Food, MealItem, CalorieDecision, DateKey, PlanId, ExerciseDef, ReadinessEntry } from './types';
import { dateKey, addDays, weekBounds, nutrientTotals, estimateBodyFat, workoutVolume, workoutSetCount, readinessScore } from './selectors';

// ---------------------------------------------------------------------------
// PR tracking / exercise history (PR1, G1)
// ---------------------------------------------------------------------------

function workingSets(ex: LoggedExercise | undefined): SetEntry[] {
  return (ex?.setData || []).filter((s) => s.setType !== 'warmup' && Number(s.weight) > 0 && Number(s.reps) > 0);
}

/** Epley estimated 1RM. */
export function e1rm(s: SetEntry): number {
  return Number(s.weight) > 0 && Number(s.reps) > 0 ? Number(s.weight) * (1 + Number(s.reps) / 30) : 0;
}

export interface ExercisePR { bestWeight: number; bestReps: number; bestE1rm: number; bestVolume: number; }

/** Scans ALL history for an exercise name (across every workout, any plan)
 * and returns the all-time PRs — heaviest single set, best estimated 1RM,
 * and best single-session volume for that exercise. */
export function exercisePR(workouts: Workout[], exerciseName: string): ExercisePR {
  let bestWeight = 0, bestReps = 0, bestE1rm = 0, bestVolume = 0;
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.name === exerciseName);
    if (!ex) continue;
    const sets = workingSets(ex);
    let sessionVolume = 0;
    for (const s of sets) {
      const weight = Number(s.weight), reps = Number(s.reps);
      if (weight > bestWeight) { bestWeight = weight; bestReps = reps; }
      else if (weight === bestWeight && reps > bestReps) bestReps = reps;
      bestE1rm = Math.max(bestE1rm, e1rm(s));
      sessionVolume += weight * reps;
    }
    bestVolume = Math.max(bestVolume, sessionVolume);
  }
  return { bestWeight, bestReps, bestE1rm, bestVolume };
}

export interface ExerciseHistoryPoint { date: DateKey; e1rm: number; bestWeight: number; bestReps: number; }

/** Chronological (oldest -> newest) e1RM trend for one exercise, for the
 * history chart (G1). */
export function exerciseHistory(workouts: Workout[], exerciseName: string): ExerciseHistoryPoint[] {
  return [...workouts]
    .filter((w) => w.exercises.some((e) => e.name === exerciseName))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => {
      const ex = w.exercises.find((e) => e.name === exerciseName)!;
      const sets = workingSets(ex);
      if (!sets.length) return null;
      const best = sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
      return { date: w.date, e1rm: e1rm(best), bestWeight: Number(best.weight), bestReps: Number(best.reps) };
    })
    .filter((x): x is ExerciseHistoryPoint => x !== null);
}

/** New PRs achieved BY a specific just-saved workout, compared to everything
 * before it in the array (by insertion order — the workout at `index`). Used
 * by the post-save summary modal (W6). */
export function newPRsForWorkout(workouts: Workout[], index: number): string[] {
  const current = workouts[index];
  if (!current) return [];
  const before = workouts.slice(0, index);
  const out: string[] = [];
  for (const ex of current.exercises) {
    const cur = workingSets(ex);
    if (!cur.length) continue;
    const prevSets = before.flatMap((w) => w.exercises.filter((e) => e.name === ex.name).flatMap(workingSets));
    const curWeight = Math.max(...cur.map((s) => Number(s.weight)));
    const curE1rm = Math.max(...cur.map(e1rm));
    const prevWeight = prevSets.length ? Math.max(...prevSets.map((s) => Number(s.weight))) : 0;
    const prevE1rm = prevSets.length ? Math.max(...prevSets.map(e1rm)) : 0;
    if (curWeight > prevWeight) out.push(`${ex.name}: ağırlık PR ${fmt1(curWeight)} kg`);
    else if (curE1rm > prevE1rm + 0.5) out.push(`${ex.name}: e1RM PR ${fmt1(curE1rm)} kg`);
  }
  return out;
}

function fmt1(n: number) { return Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }); }

// ---------------------------------------------------------------------------
// Workout summary (W6)
// ---------------------------------------------------------------------------

export interface WorkoutSummary {
  durationMin: number; sets: number; volume: number; cardioMin: number; cardioKcal: number;
  deltaPct: number | null; prs: string[];
}

export function workoutSummary(workouts: Workout[], index: number): WorkoutSummary {
  const w = workouts[index];
  const vol = workoutVolume(w);
  const sets = workoutSetCount(w);
  const prevSameType = workouts.slice(0, index).filter((x) => x.type === w.type).at(-1);
  const prevVol = prevSameType ? workoutVolume(prevSameType) : null;
  const deltaPct = prevVol ? ((vol - prevVol) / prevVol) * 100 : null;
  return {
    durationMin: Math.round((w.durationSec || 0) / 60),
    sets, volume: vol,
    cardioMin: w.cardio?.minutes || 0,
    cardioKcal: w.cardio?.kcal || 0,
    deltaPct,
    prs: newPRsForWorkout(workouts, index),
  };
}

// ---------------------------------------------------------------------------
// Muscle group volume (V1)
// ---------------------------------------------------------------------------

const MUSCLE_LABELS: Record<string, string> = { chest: 'Göğüs', back: 'Sırt', shoulders: 'Omuz', quads: 'Quadriceps', hamstrings: 'Hamstring', biceps: 'Biceps', triceps: 'Triceps', calves: 'Baldır', abs: 'Karın', other: 'Diğer' };
export function muscleLabel(key: string): string { return MUSCLE_LABELS[key] || key; }

export function muscleFor(exerciseName: string): string {
  // Ported verbatim (regex order included) from legacy FT's coach-refine.js
  // muscle() — the FINAL authoritative version (loads after coach-plus.js
  // and REPLACES its muscleFor() for actual rendering). Order matters:
  // shoulders is checked before chest so "Shoulder Press" resolves to
  // shoulders even though it contains "press".
  const n = String(exerciseName || '').toLowerCase();
  if (/squat|leg press|hack|bulgarian/.test(n)) return 'quads';
  if (/romanian|leg curl/.test(n)) return 'hamstrings';
  if (/shoulder|lateral|reverse pec/.test(n)) return 'shoulders';
  if (/chest|fly|press/.test(n)) return 'chest';
  if (/pulldown|row|lat /.test(n) || n.startsWith('lat')) return 'back';
  if (/triceps/.test(n)) return 'triceps';
  if (/curl/.test(n)) return 'biceps';
  if (/calf/.test(n)) return 'calves';
  if (/crunch|knee.*raise|leg raise/.test(n)) return 'abs';
  return 'other';
}

export interface MuscleVolumeRow { muscle: string; label: string; planned: number; done: number; pct: number; }

/** Planned (from this week's scheduled programs) vs actually-completed sets
 * per muscle group, for the current Monday-first week. */
export function muscleWeeklyVolume(persisted: PersistedState, today = new Date()): MuscleVolumeRow[] {
  const planned: Record<string, number> = {};
  Object.values(persisted.schedule).forEach((planId) => {
    const exercises = persisted.programs[planId as PlanId] || [];
    exercises.forEach((e: ExerciseDef) => {
      const m = muscleFor(e.name);
      if (m === 'other') return;
      planned[m] = (planned[m] || 0) + Number(e.sets || 0);
    });
  });
  const [start, end] = weekBounds(today);
  const done: Record<string, number> = {};
  persisted.workouts.filter((w) => w.date >= start && w.date <= end).forEach((w) => {
    w.exercises.forEach((e) => {
      const m = muscleFor(e.name);
      if (m === 'other') return;
      done[m] = (done[m] || 0) + workingSets(e).length;
    });
  });
  return Object.keys(planned).map((m) => {
    const p = planned[m] || 0, d = done[m] || 0;
    return { muscle: m, label: muscleLabel(m), planned: p, done: d, pct: p ? Math.min(110, (d / p) * 100) : 0 };
  });
}

// ---------------------------------------------------------------------------
// Calorie coach (C1)
// ---------------------------------------------------------------------------

function mean(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export interface WeightTrend { recentAvg: number | null; prevAvg: number | null; delta: number | null; ratePct: number | null; recentN: number; prevN: number; }

export function weightTrend(measurements: Measurement[], today: DateKey = dateKey()): WeightTrend {
  const recentStart = addDays(today, -6);
  const prevEnd = addDays(recentStart, -1);
  const prevStart = addDays(prevEnd, -6);
  const rows = measurements.filter((m) => m.date && Number(m.weight) > 0);
  const recent = rows.filter((m) => m.date >= recentStart && m.date <= today).map((m) => Number(m.weight));
  const prev = rows.filter((m) => m.date >= prevStart && m.date <= prevEnd).map((m) => Number(m.weight));
  const recentAvg = mean(recent), prevAvg = mean(prev);
  const delta = recentAvg != null && prevAvg != null ? recentAvg - prevAvg : null;
  const ratePct = recentAvg != null && prevAvg ? ((recentAvg - prevAvg) / prevAvg) * 100 : null;
  return { recentAvg, prevAvg, delta, ratePct, recentN: recent.length, prevN: prev.length };
}

export type CalorieCoachStatus = 'cooldown' | 'collecting' | 'suggest' | 'stable';
export interface CalorieCoachResult { status: CalorieCoachStatus; delta?: number; text: string; }

function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
}

/** 7-day weight-trend based calorie target suggestion, with a 7-day cooldown
 * after any accept/dismiss decision — ported from FT's calorieCoach(). */
export function calorieCoachSuggestion(
  persisted: Pick<PersistedState, 'measurements' | 'meals' | 'foods' | 'coach'>,
  today: DateKey = dateKey()
): CalorieCoachResult {
  const lastDecision = [...persisted.coach.calorieDecisions].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastDecision && daysBetween(lastDecision.date, today) < 7) {
    return { status: 'cooldown', text: 'Son kalori koçu kararından sonra 7 günlük gözlem süresi devam ediyor.' };
  }
  const trend = weightTrend(persisted.measurements, today);
  let loggedDays = 0;
  for (let i = 0; i < 14; i++) {
    const k = addDays(today, -i);
    const items = Object.values(persisted.meals[k] || {}).flat();
    if (items.length) loggedDays++;
  }
  if (trend.recentN < 2 || trend.prevN < 2 || loggedDays < 8) {
    return { status: 'collecting', text: `Kalori koçu veri topluyor • beslenme ${loggedDays}/8 gün • kilo ${trend.prevN + trend.recentN}/4+ ölçüm` };
  }
  const rate = trend.ratePct!;
  if (rate > -0.15) {
    return { status: 'suggest', delta: -150, text: `Son iki 7 günlük ortalamada kilo trendi ${rate >= 0 ? '+' : ''}${fmt1(rate)}%. Yağ kaybı hedefi için günlük kaloriyi 150 kcal azaltmayı değerlendirebilirsin.` };
  }
  if (rate < -0.9) {
    return { status: 'suggest', delta: 100, text: `Kilo trendi haftalık yaklaşık ${fmt1(rate)}%. Kas ve performans korunumu için günlük kaloriyi 100 kcal artırmayı değerlendirebilirsin.` };
  }
  return { status: 'stable', text: `Kilo trendi hedeflenen kontrollü aralıkta (${fmt1(rate)}%). Kalori hedefini değiştirmeye gerek görünmüyor.` };
}

// ---------------------------------------------------------------------------
// "Günü kurtar" rescue meal suggestion (N1)
// ---------------------------------------------------------------------------

export interface RescuePlanItem { foodId: string; qty: number; unit: string; }
export interface RescuePlan { items: RescuePlanItem[]; kcal: number; protein: number; }

function foodMacros(food: Food, qty: number, unit: string) {
  const grams = unit === 'g' ? qty : qty * Number(food.servingG || 100);
  const r = grams / 100;
  return { kcal: Number(food.kcal || 0) * r, protein: Number(food.protein || 0) * r };
}

/** Legacy fallback candidates (coach-plus.js's rescueCandidates()) — used to
 * pad the pool when the user has fewer than 5 foods with recorded usage, so
 * "Günü kurtar" still has enough options for a brand-new profile. */
const RESCUE_FALLBACK_NAMES = ['Whey protein', 'Süzme yoğurt', 'Tavuk göğsü (pişmiş)', 'Ton balığı suda', 'Lor peyniri', 'Skyr', 'Hindi göğsü (pişmiş)'];

/** Suggests 1-2 food combinations (from the user's most-used foods, padded
 * with legacy's fixed fallback list when usage history is thin) that fit
 * the remaining protein/kcal budget for today, scored closest-fit-first —
 * ported verbatim from FT's rescueCandidates()/rescuePlans()/foodMacros(). */
export function rescueMealPlans(persisted: Pick<PersistedState, 'foods' | 'foodUsage' | 'targets' | 'meals'>, today: DateKey = dateKey()): { plans: RescuePlan[]; needProtein: number; budgetKcal: number } {
  const totals = nutrientTotals(Object.values(persisted.meals[today] || {}).flat(), persisted.foods);
  const needProtein = Math.max(0, persisted.targets.protein - totals.protein);
  const budgetKcal = Math.max(0, persisted.targets.kcal - totals.kcal);

  let base = persisted.foods
    .map((f) => ({ f, usage: persisted.foodUsage[f.name] || 0 }))
    .filter((x) => x.usage > 0)
    .sort((a, b) => b.usage - a.usage);
  if (base.length < 5) {
    const fallbackSet = new Set(RESCUE_FALLBACK_NAMES);
    const already = new Set(base.map((x) => x.f.id));
    const fallback = persisted.foods
      .filter((f) => fallbackSet.has(f.name) && !already.has(f.id))
      .map((f) => ({ f, usage: 0 }));
    base = [...base, ...fallback];
  }
  const candidates = base
    .filter((x) => Number(x.f.protein) > 0 && Number(x.f.kcal) > 0 && (Number(x.f.protein) / Number(x.f.kcal)) * 100 >= 4)
    .slice(0, 14);

  const singles: RescuePlan[] = [];
  for (const { f } of candidates) {
    const amounts = f.unit === 'g' ? [80, 100, 150, 200, 250] : [1, 1.5, 2];
    for (const q of amounts) {
      const m = foodMacros(f, q, f.unit === 'g' ? 'g' : f.unit);
      singles.push({ items: [{ foodId: f.id, qty: q, unit: f.unit === 'g' ? 'g' : f.unit }], kcal: m.kcal, protein: m.protein });
    }
  }
  const all = [...singles];
  for (let a = 0; a < singles.length; a++) {
    for (let b = a + 1; b < singles.length; b++) {
      if (singles[a].items[0].foodId === singles[b].items[0].foodId) continue;
      const kcal = singles[a].kcal + singles[b].kcal, protein = singles[a].protein + singles[b].protein;
      if (kcal > budgetKcal * 1.35 || protein > needProtein * 1.7) continue;
      all.push({ items: [...singles[a].items, ...singles[b].items], kcal, protein });
    }
  }
  const scored = all.map((p) => {
    const over = Math.max(0, p.kcal - budgetKcal), pShort = Math.max(0, needProtein - p.protein), pOver = Math.max(0, p.protein - needProtein * 1.25);
    const score = pShort * 11 + Math.abs(budgetKcal - p.kcal) * 0.28 + over * 4 + pOver * 2 + p.items.length * 4;
    return { p, score };
  }).sort((a, b) => a.score - b.score);

  const seen = new Set<string>();
  const out: RescuePlan[] = [];
  for (const { p } of scored) {
    const key = p.items.map((i) => i.foodId).sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length === 3) break;
  }
  return { plans: out, needProtein, budgetKcal };
}

// ---------------------------------------------------------------------------
// Cardio finisher MET-based kcal estimate (CF1) — ported verbatim from
// legacy FT's app-base.html estimateCardio() + currentWeight().
// ---------------------------------------------------------------------------

export function currentWeight(measurements: Measurement[], profileStartWeight: number | null): number {
  const last = [...measurements].filter((m) => m.weight).at(-1);
  return Number(last?.weight || profileStartWeight || 80);
}

/** estimateCardio()'s MET selection — speed/incline-dependent for Yürüyüş
 * and Koşu, fixed for the rest. Exact type list from app-base.html's
 * cardioSection(): Yürüyüş, Eğimli yürüyüş, Koşu, Bisiklet, Eliptik, Kürek,
 * İp atlama, Merdiven / StairMaster. */
export function cardioMet(type: string, speed: number, incline: number): number {
  let met = 5;
  if (type === 'Yürüyüş') met = speed >= 6 ? 5 : speed >= 5 ? 3.8 : 3.2;
  if (type === 'Eğimli yürüyüş') met = 5 + Math.min(5, incline * 0.25) + (speed >= 5.5 ? 1 : 0);
  if (type === 'Koşu') met = speed >= 12 ? 12 : speed >= 10 ? 10 : speed >= 8 ? 8.3 : 7;
  if (type === 'Bisiklet') met = 6.8;
  if (type === 'Eliptik') met = 5.5;
  if (type === 'Kürek') met = 7;
  if (type === 'İp atlama') met = 11.5;
  if (type.includes('Merdiven')) met = 8.8;
  return met;
}
export function cardioIntensityMultiplier(intensity: 'Hafif' | 'Orta' | 'Yüksek'): number {
  return intensity === 'Hafif' ? 0.8 : intensity === 'Yüksek' ? 1.25 : 1;
}
/** kcal = round(met * intensityMult * 3.5 * weightKg / 200 * minutes) — exact formula. */
export function cardioKcal(type: string, minutes: number, speed: number, incline: number, intensity: 'Hafif' | 'Orta' | 'Yüksek', weightKg: number): number {
  const met = cardioMet(type, speed, incline);
  const mult = cardioIntensityMultiplier(intensity);
  return Math.round(met * mult * 3.5 * (weightKg || 80) / 200 * (minutes || 0));
}
export const CARDIO_TYPES = ['Yürüyüş', 'Eğimli yürüyüş', 'Koşu', 'Bisiklet', 'Eliptik', 'Kürek', 'İp atlama', 'Merdiven / StairMaster'];

/** 7-day rolling average of the weight series, ported from legacy's
 * drawWeightTrend() (`avgs` calculation) — used alongside the raw weight
 * line in the Ölçümler trend chart (M2). */
export function weightRollingAverage(measurements: { date: DateKey; weight: number | null }[]): (number | null)[] {
  const rows = [...measurements].filter((m) => m.date && Number(m.weight) > 0).sort((a, b) => a.date.localeCompare(b.date));
  return rows.map((r, i) => {
    const start = addDays(r.date, -6);
    const windowVals = rows.filter((x, j) => j <= i && x.date >= start && x.date <= r.date).map((x) => Number(x.weight));
    return mean(windowVals) ?? Number(r.weight);
  });
}

// ---------------------------------------------------------------------------
// Weekly nutrition card (N2)
// ---------------------------------------------------------------------------

export interface WeeklyCalorieSummary { total: number; target: number; avg: number; diff: number; }
export function weeklyCalorieSummary(persisted: Pick<PersistedState, 'meals' | 'foods' | 'targets'>, today: DateKey = dateKey()): WeeklyCalorieSummary {
  const [start] = weekBounds(new Date(`${today}T12:00:00`));
  let total = 0, daysPassed = 0;
  for (let k = start; k <= today; k = addDays(k, 1)) {
    total += nutrientTotals(Object.values(persisted.meals[k] || {}).flat(), persisted.foods).kcal;
    daysPassed++;
  }
  const target = persisted.targets.kcal * 7;
  return { total, target, avg: daysPassed ? total / daysPassed : 0, diff: total - target };
}

// ---------------------------------------------------------------------------
// Full weekly report for Panel (P2)
// ---------------------------------------------------------------------------

export interface WeeklyReport {
  workoutsDone: number; workoutsPlannedThrough: number;
  proteinDays: number; loggedDays: number; avgKcal: number | null; avgProtein: number | null;
  totalSets: number; totalVolume: number; cardioMinutes: number;
  weightTrend: WeightTrend;
  verdict: string;
}

export function fullWeeklyReport(persisted: PersistedState, today: DateKey = dateKey()): WeeklyReport {
  const [start] = weekBounds(new Date(`${today}T12:00:00`));
  const workouts = persisted.workouts.filter((w) => w.date >= start && w.date <= today);
  let plannedThrough = 0;
  for (let k = start; k <= today; k = addDays(k, 1)) {
    const d = new Date(`${k}T12:00:00`);
    if (persisted.schedule[d.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6]) plannedThrough++;
  }
  const days: { kcal: number; protein: number }[] = [];
  for (let k = start; k <= today; k = addDays(k, 1)) {
    const items = Object.values(persisted.meals[k] || {}).flat();
    if (items.length) days.push(nutrientTotals(items, persisted.foods));
  }
  const avgKcal = mean(days.map((d) => d.kcal));
  const avgProtein = mean(days.map((d) => d.protein));
  const proteinDays = days.filter((d) => d.protein >= persisted.targets.protein * 0.9).length;
  const totalSets = workouts.reduce((a, w) => a + workoutSetCount(w), 0);
  const totalVolume = workouts.reduce((a, w) => a + workoutVolume(w), 0);
  const cardioMinutes = workouts.reduce((a, w) => a + (w.cardio?.minutes || 0), 0);
  const trend = weightTrend(persisted.measurements, today);

  let verdict = 'Veri birikiyor';
  if (workouts.length >= Math.max(1, plannedThrough) && days.length >= 3) verdict = 'Plan korunabilir';
  if (plannedThrough && workouts.length < plannedThrough - 1) verdict = 'Antrenman devamlılığına odaklan';
  if (days.length >= 4 && proteinDays / days.length < 0.6) verdict = 'Protein devamlılığını düzelt';

  return { workoutsDone: workouts.length, workoutsPlannedThrough: plannedThrough, proteinDays, loggedDays: days.length, avgKcal, avgProtein, totalSets, totalVolume, cardioMinutes, weightTrend: trend, verdict };
}

export { readinessScore };

// ---------------------------------------------------------------------------
// Progressive overload — ported verbatim from legacy FT's coach-refine.js
// refinedRec() (the FINAL authoritative version; it overrides coach-plus.js's
// own progressive() for actual rendering). PR1/G1 sections above already
// port exercisePR/exerciseHistory; this section covers the "next target
// weight" recommendation shown per exercise.
// ---------------------------------------------------------------------------

/** pSets(): legacy's "primary sets" — working-type sets if any exist,
 * otherwise falls back to all non-warmup logged sets. Distinct from the
 * plain workingSets()/allSets() used elsewhere (which don't do this
 * working-vs-backoff/drop distinction). */
export function primarySets(ex: LoggedExercise | undefined): SetEntry[] {
  const all = workingSets(ex);
  const primary = all.filter((s) => !s.setType || s.setType === 'working');
  return primary.length ? primary : all;
}

function repRangeBoundsLegacy(repRange: string) {
  const m = String(repRange || '').match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])] as const;
  const n = Number(String(repRange || '').match(/\d+/)?.[0] || 0);
  return [n || 8, n || 12] as const;
}

/** step(): legacy's per-exercise weight increment. */
export function loadStep(exerciseName: string, weight: number): number {
  if (/lateral|curl|triceps|fly/i.test(exerciseName)) return weight < 15 ? 1 : 2;
  return 2.5;
}
/** snap(): legacy's 0.5 kg rounding. */
export function snapLoad(v: number): number {
  return Math.round(v * 2) / 2;
}
/** readinessLow(): legacy's boolean gate — readiness score below 55. */
export function isReadinessLow(entry: ReadinessEntry | undefined): boolean {
  const r = readinessScore(entry);
  return r.score != null && r.score < 55;
}

export interface RefinedRecommendation { tone: 'neutral' | 'good' | 'mid'; title: string; text: string; target: number | null; }

/** refinedRec(): exact port. `history` is this exercise's logged instances
 * for THIS plan type, in chronological order (oldest first) — same scope
 * legacy uses (`db.workouts.filter(w=>w.type===type && ...)`). */
export function refinedRecommendation(
  exerciseName: string,
  repRange: string,
  historyForPlan: { exercises: LoggedExercise[] }[],
  readiness: ReadinessEntry | undefined
): RefinedRecommendation {
  const last = historyForPlan.at(-1);
  const ex = last?.exercises.find((e) => e.name === exerciseName);
  if (!ex) {
    return { tone: 'neutral', title: 'İlk referansı oluştur', text: 'Bugünkü çalışma setlerini kaydet; sonraki seansta FORM ana setlere göre yük önerisi verecek.', target: null };
  }
  const sets = primarySets(ex);
  if (!sets.length) {
    return { tone: 'neutral', title: 'Referans set bekleniyor', text: 'Progressive overload için kg ve tekrar içeren en az bir çalışma seti gerekli.', target: null };
  }
  const [min, max] = repRangeBoundsLegacy(repRange);
  const base = Math.max(...sets.map((s) => Number(s.weight)));
  const reps = sets.map((s) => Number(s.reps));
  const rirs = sets.map((s) => Number(s.rir)).filter((r) => Number.isFinite(r));
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const allMax = reps.every((r) => r >= max);
  const low = reps.some((r) => r < Math.max(1, min - 1));

  let target = base, tone: RefinedRecommendation['tone'] = 'neutral', title = 'Aynı kiloyu koru';
  let text = `Ana setler: ${sets.map((s) => `${s.weight}×${s.reps}`).join(' • ')}`;
  if (allMax && (avgRir == null || avgRir >= 1)) {
    target = snapLoad(base + loadStep(exerciseName, base));
    tone = 'good'; title = `${fmt1(target)} kg dene`;
    text = `Ana çalışma setleri ${max}+ tekrara ulaştı. Küçük ve kontrollü yük artışı öneriliyor.`;
  } else if (low) {
    target = snapLoad(base * 0.95);
    tone = 'mid'; title = `${fmt1(target)} kg civarı`;
    text = 'Ana çalışma setlerinden biri hedef tekrar bandının belirgin altında. Önce temiz tekrarları geri kazan.';
  } else {
    text = `${fmt1(base)} kg ile toplam tekrarı artır; ana setleri ${max} tekrara yaklaştır.`;
  }
  if (isReadinessLow(readiness) && target) {
    target = snapLoad(target * 0.95);
    tone = 'mid'; title = `Toparlanma: ${fmt1(target)} kg`;
    text = 'Bugünkü hazırlık düşük. Normal progressive hedef yerine yaklaşık %5 daha kontrollü yük kullan.';
  }
  return { tone, title, text, target };
}
