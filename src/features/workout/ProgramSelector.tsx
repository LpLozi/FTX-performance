import React from 'react';
import { useStore } from '../../state/StoreProvider';
import { todayWorkout, nextWorkout, DAY_NAMES } from '../../data/programs';

export function ProgramSelector({ disabled }: { disabled: boolean }) {
  const { state, dispatch } = useStore();
  const { persisted, ui } = state;
  const planned = todayWorkout(persisted.schedule);
  const n = nextWorkout(persisted.schedule);
  return (
    <div>
      <label>{planned ? 'Bugünün programı' : 'Programı seç'}</label>
      <select
        id="program-select"
        disabled={disabled}
        value={ui.selectedPlanId}
        onChange={(e) => dispatch({ type: 'SELECT_PLAN', planId: e.target.value })}
      >
        {Object.keys(persisted.programs).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <div className="note" style={{ marginTop: 6 }}>
        {planned ? (
          <>
            <b>{DAY_NAMES[new Date().getDay()]}:</b> {planned}
            <br /><span className="muted">Planlı program otomatik açıldı; istersen başka programı da seçebilirsin.</span>
          </>
        ) : (
          <>
            <b>Bugün planlı antrenman yok.</b>
            <br /><span className="muted">Programlar yine açık.{n ? ` Sıradaki planlı gün: ${n.day} • ${n.plan}.` : ''}</span>
          </>
        )}
      </div>
    </div>
  );
}
