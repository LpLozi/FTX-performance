import type { PersistedState, PlanId, ExerciseDef } from '../../core/types';
import { dateKey } from '../../core/selectors';

export function effectiveExercises(persisted: PersistedState, planId: PlanId): ExerciseDef[] {
  const override = persisted.exerciseOverrides[planId];
  const base = persisted.programs[planId] || [];
  if (override && override.updatedAtDateKey === dateKey()) {
    return override.rows.map((r) => ({ name: r.name, sets: r.sets, repRange: r.repRange, targetRir: r.targetRir }));
  }
  return base;
}
