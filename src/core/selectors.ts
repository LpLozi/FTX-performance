import type { Food, MealItem, DateKey, Workout, SetEntry, Weekday, PlanId } from './types';

const NUTRIENT_KEYS = ['kcal', 'protein', 'carb', 'fat', 'fiber'] as const;
export type Totals = Record<(typeof NUTRIENT_KEYS)[number], number>;

export function gramsFor(item: MealItem, food: Food | undefined): number {
  if (!food) return 0;
  return item.unit === 'g' ? Number(item.qty) : Number(item.qty) * Number(food.servingG || 100);
}

export function nutrientTotals(items: MealItem[], foods: Food[]): Totals {
  const totals: Totals = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  const byId = new Map(foods.map((f) => [f.id, f]));
  for (const item of items || []) {
    const food = byId.get(item.foodId);
    if (!food) continue;
    const ratio = gramsFor(item, food) / 100;
    for (const k of NUTRIENT_KEYS) totals[k] += Number(food[k] || 0) * ratio;
  }
  return totals;
}

export function estimateBodyFat(input: { waist?: number | null; neck?: number | null; heightCm?: number | null }): number | null {
  const w = Number(input.waist), n = Number(input.neck), h = Number(input.heightCm);
  if (!w || !n || !h || w <= n) return null;
  const wi = w / 2.54, ni = n / 2.54, hi = h / 2.54;
  const density = 1.0324 - 0.19077 * Math.log10(wi - ni) + 0.15456 * Math.log10(hi);
  const bf = 495 / density - 450;
  return Number.isFinite(bf) && bf > 2 && bf < 60 ? bf : null;
}

function repRangeBounds(repRange: string) {
  const nums = [...String(repRange || '').matchAll(/\d+/g)].map((m) => +m[0]);
  return { lo: nums[0] || 6, hi: nums[1] || nums[0] || 12 };
}

export function bestSet(exerciseEntry: { setData: SetEntry[] } | undefined): SetEntry | null {
  const sets = (exerciseEntry?.setData || []).filter((s) => s.done || s.weight || s.reps);
  if (!sets.length) return null;
  return sets.reduce((a, b) => ((Number(b.weight) || 0) * (Number(b.reps) || 0) > (Number(a.weight) || 0) * (Number(a.reps) || 0) ? b : a));
}

export function progressionSuggestion(exerciseName: string, repRange: string, history: { setData: SetEntry[] }[]) {
  const { lo, hi } = repRangeBounds(repRange);
  const last = history.at(-1);
  const prev = history.at(-2);
  const lastBest = last ? bestSet(last) : null;
  if (!lastBest) return { tag: 'REFERANS' as const, text: `${lo}-${hi} tekrar, 1-2 RIR ile temiz başlangıç.` };
  const kg = Number(lastBest.weight) || 0, reps = Number(lastBest.reps) || 0, rir = Number(lastBest.rir);
  const prevBest = prev ? bestSet(prev) : null;
  const score = (s: SetEntry | null) => (s ? (Number(s.weight) || 0) * (Number(s.reps) || 0) : 0);
  if (prevBest && score(lastBest) < score(prevBest) * 0.92) {
    return { tag: 'KORU' as const, text: `Performans düşmüş görünüyor. ${kg ? kg + ' kg civarında kal' : 'Kilo artırma'}; formu koru.` };
  }
  if (reps >= hi && (!Number.isFinite(rir) || rir >= 1)) {
    const inc = /squat|deadlift|leg press|row/i.test(exerciseName) ? 5 : 2.5;
    return { tag: 'ARTIR' as const, text: `Üst tekrar sınırına ulaştın. Form temizse ${kg + inc} kg dene.` };
  }
  return { tag: 'TEKRAR +1' as const, text: `${kg} kg ile başla, geçen seferden +1 tekrar hedefle.` };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export function dateKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function addDays(key: DateKey, n: number): DateKey {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function weekBounds(d: Date = new Date()): [DateKey, DateKey] {
  const day = (d.getDay() + 6) % 7; // Monday-first
  const start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return [dateKey(start), dateKey(end)];
}

export function matchScheduleToWorkouts(
  year: number, month: number, workouts: Workout[],
  schedule: Partial<Record<Weekday, PlanId>>,
  today: DateKey = dateKey(new Date())
) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const slots: { date: DateKey; plan: PlanId }[] = [];
  for (let n = 1; n <= lastDay; n++) {
    const d = new Date(year, month, n);
    const plan = schedule[d.getDay() as Weekday];
    if (plan) slots.push({ date: dateKey(d), plan });
  }
  const used = new Set<number>();
  const matched = new Map<DateKey, Workout>();
  for (const slot of slots) {
    if (slot.date > today) continue;
    let ix = workouts.findIndex((w, i) => !used.has(i) && w.date === slot.date && w.type === slot.plan);
    if (ix < 0) {
      const [a, b] = weekBounds(new Date(`${slot.date}T12:00:00`));
      const upper = b < today ? b : today;
      ix = workouts.findIndex((w, i) => !used.has(i) && w.type === slot.plan && w.date >= a && w.date <= upper);
    }
    if (ix >= 0) { used.add(ix); matched.set(slot.date, workouts[ix]); }
  }
  return { slots, matched };
}

export function readinessScore(entry: { sleep: number | null; energy: number | null; soreness: number | null } | undefined) {
  if (!entry || !Number(entry.sleep) || !Number(entry.energy) || !Number(entry.soreness)) {
    return { score: null as number | null, label: 'Henüz girilmedi', advice: 'Uyku, enerji ve kas ağrısını gir; bugünkü yük önerisi buna göre ayarlansın.' };
  }
  const score = Math.round(Math.min(1, Number(entry.sleep) / 7.5) * 40 + (Number(entry.energy) / 5) * 35 + ((6 - Number(entry.soreness)) / 5) * 25);
  if (score >= 75) return { score, label: 'Hazır', advice: 'Normal planı uygula. Hedef RIR ve progressive overload önerisini koru.' };
  if (score >= 55) return { score, label: 'Orta', advice: "Aynı hareketleri koru; failure'dan kaçın, gerekirse hedef RIR'a +1 ekle." };
  return { score, label: 'Düşük', advice: 'Bugün yükü ~%5-10 azaltmak veya setleri RIR 2-3 civarında bırakmak daha mantıklı.' };
}

export function workoutVolume(w: Workout): number {
  return (w.exercises || []).reduce((sum, e) => sum + (e.setData || []).filter((s) => s.setType !== 'warmup' && Number(s.weight) > 0 && Number(s.reps) > 0).reduce((a, s) => a + Number(s.weight) * Number(s.reps), 0), 0);
}
export function workoutSetCount(w: Workout): number {
  return (w.exercises || []).reduce((sum, e) => sum + (e.setData || []).filter((s) => s.setType !== 'warmup' && Number(s.weight) > 0 && Number(s.reps) > 0).length, 0);
}
