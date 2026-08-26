import type { ExerciseDef, PlanId, Weekday } from '../core/types';

export const DEFAULT_PROGRAMS: Record<PlanId, ExerciseDef[]> = {
  'Upper Strength': [
    { name: 'Incline Chest Press', sets: 3, repRange: '6-8', targetRir: '1-2' },
    { name: 'Lat Pulldown', sets: 3, repRange: '6-8', targetRir: '1-2' },
    { name: 'Machine Chest Press', sets: 3, repRange: '8-10', targetRir: '1-2' },
    { name: 'Seated Cable Row', sets: 3, repRange: '8-10', targetRir: '1-2' },
    { name: 'Machine Shoulder Press', sets: 3, repRange: '8-10', targetRir: '1-2' },
    { name: 'Lateral Raise', sets: 3, repRange: '12-15', targetRir: '1' },
    { name: 'Cable / Biceps Curl', sets: 2, repRange: '10-12', targetRir: '1' },
    { name: 'Triceps Pushdown', sets: 2, repRange: '10-12', targetRir: '1' },
  ],
  'Lower Strength': [
    { name: 'Back Squat', sets: 3, repRange: '6-8', targetRir: '2' },
    { name: 'Romanian Deadlift', sets: 3, repRange: '8-10', targetRir: '2' },
    { name: 'Leg Press', sets: 3, repRange: '10', targetRir: '1-2' },
    { name: 'Leg Curl', sets: 3, repRange: '10-12', targetRir: '1-2' },
    { name: 'Calf Raise', sets: 3, repRange: '12-15', targetRir: '1' },
    { name: 'Cable Crunch', sets: 3, repRange: '10-15', targetRir: '1-2' },
  ],
  'Upper Hypertrophy': [
    { name: 'Incline Dumbbell Press', sets: 3, repRange: '8-12', targetRir: '1-2' },
    { name: 'Neutral / Close Grip Lat Pulldown', sets: 3, repRange: '8-12', targetRir: '1-2' },
    { name: 'Cable Fly — Low to High', sets: 3, repRange: '12-15', targetRir: '1-2' },
    { name: 'Chest Supported Row', sets: 3, repRange: '10-12', targetRir: '1-2' },
    { name: 'Lateral Raise', sets: 4, repRange: '12-20', targetRir: '0-1' },
    { name: 'Reverse Pec Deck', sets: 3, repRange: '12-15', targetRir: '1' },
    { name: 'Hammer Curl', sets: 3, repRange: '10-15', targetRir: '1' },
    { name: 'Overhead Cable Triceps Extension', sets: 3, repRange: '10-15', targetRir: '1' },
  ],
  'HYROX Hybrid': [],
};

export const DEFAULT_SCHEDULE: Partial<Record<Weekday, PlanId>> = {
  0: 'Upper Strength',
  2: 'Lower Strength',
  4: 'Upper Hypertrophy',
  5: 'HYROX Hybrid',
};

export const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export interface HyroxSegmentDef {
  key: string;
  name: string;
  target: string;
  unit?: string;
  recommendation?: string;
}

export const HYROX_SEGMENTS: HyroxSegmentDef[] = [
  { key: 'run1', name: 'Koşu', target: '500 m' },
  { key: 'ski', name: 'SkiErg', target: '500 m' },
  { key: 'run2', name: 'Koşu', target: '500 m' },
  { key: 'push', name: 'Sled Push', target: '25 m', unit: 'kg', recommendation: '120 kg toplam (sled dahil)' },
  { key: 'run3', name: 'Koşu', target: '500 m' },
  { key: 'pull', name: 'Sled Pull', target: '25 m', unit: 'kg', recommendation: '80 kg toplam (sled dahil)' },
  { key: 'run4', name: 'Koşu', target: '500 m' },
  { key: 'row', name: 'RowErg', target: '500 m' },
  { key: 'run5', name: 'Koşu', target: '500 m' },
  { key: 'carry', name: 'Farmer Carry', target: '100 m', unit: 'kg', recommendation: '2 × 24 kg' },
  { key: 'lunge', name: 'Sandbag Walking Lunge', target: '40–50 m', unit: 'kg', recommendation: '20 kg' },
  { key: 'wall', name: 'Wall Ball', target: '30–50 tekrar', unit: 'kg', recommendation: '6 kg' },
];

export function todayWorkout(schedule: Partial<Record<Weekday, PlanId>>, date = new Date()): PlanId | null {
  return schedule[date.getDay() as Weekday] ?? null;
}

export function nextWorkout(schedule: Partial<Record<Weekday, PlanId>>, date = new Date()) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    const p = schedule[d.getDay() as Weekday];
    if (p) return { day: DAY_NAMES[d.getDay()], plan: p };
  }
  return null;
}
