import React, { useEffect, useState } from 'react';
import { useStore, elapsedSeconds, formatClock } from '../../state/StoreProvider';
import type { PlanId } from '../../core/types';

export function RestTimer({ endsAt, label, onClear }: { endsAt: number | null; label: string; onClear: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => {
      if (Date.now() >= endsAt) onClear();
      else force((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return (
    <div className="rest-dock">
      <div><div style={{ fontWeight: 800 }}>Dinlenme</div><div className="muted small">{label}</div></div>
      <div className="rest-time">{formatClock(left).slice(3)}</div>
      <button className="btn secondary small" onClick={onClear}>Atla</button>
    </div>
  );
}

export function TimerControls({ planId }: { planId: PlanId }) {
  const { state, dispatch } = useStore();
  const draft = state.persisted.workoutDrafts[planId];
  const [, force] = useState(0);
  useEffect(() => {
    if (!draft?.startedAt || draft.pausedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [draft?.startedAt, draft?.pausedAt]);
  const secs = elapsedSeconds(draft);
  return (
    <div className="timer-controls">
      <div><div className="muted">Antrenman süresi</div><div className="timer">{formatClock(secs)}</div></div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!draft?.startedAt && <button className="btn primary" onClick={() => dispatch({ type: 'START_WORKOUT', planId })}>Başlat</button>}
        {draft?.startedAt && !draft.pausedAt && <button className="btn secondary" onClick={() => dispatch({ type: 'PAUSE_WORKOUT', planId })}>Durdur</button>}
        {draft?.startedAt && draft.pausedAt && <button className="btn primary" onClick={() => dispatch({ type: 'RESUME_WORKOUT', planId })}>Devam Et</button>}
      </div>
    </div>
  );
}
