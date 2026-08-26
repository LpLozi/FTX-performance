import React from 'react';
import { useStore } from '../../state/StoreProvider';
import { workoutSummary } from '../../core/coachSelectors';
import { fmt } from '../../components/ui';

export function WorkoutSummaryModal() {
  const { state, dispatch } = useStore();
  const { persisted, ui } = state;
  if (!ui.workoutSummaryOpen || !persisted.lastSavedWorkout) return null;

  const index = persisted.workouts.findIndex((w) => w.date === persisted.lastSavedWorkout!.date && w.type === persisted.lastSavedWorkout!.type);
  if (index < 0) return null;
  const w = persisted.workouts[index];
  const s = workoutSummary(persisted.workouts, index);

  const close = () => dispatch({ type: 'CLOSE_WORKOUT_SUMMARY' });

  return (
    <div className="ftlib-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="ftlib-modal" role="dialog" aria-modal="true">
        <div className="ftlib-head">
          <div>
            <span className="ftlib-eyebrow">ANTRENMAN ÖZETİ</span>
            <h3>{w.type} tamamlandı</h3>
          </div>
          <button className="ftlib-close" onClick={close}>×</button>
        </div>
        <div className="grid g2" style={{ marginTop: 10 }}>
          <div><span className="muted small">Süre</span><div className="kpi">{s.durationMin} dk</div></div>
          <div><span className="muted small">Çalışma seti</span><div className="kpi">{s.sets}</div></div>
          <div><span className="muted small">Toplam hacim</span><div className="kpi">{fmt(s.volume / 1000, 1)} ton</div></div>
          <div><span className="muted small">Önceki seansa göre</span><div className="kpi">{s.deltaPct == null ? 'İlk kayıt' : `${s.deltaPct >= 0 ? '+' : ''}${fmt(s.deltaPct, 1)}%`}</div></div>
        </div>
        {s.cardioMin > 0 && <div className="note" style={{ marginTop: 10 }}>Kardiyo: {s.cardioMin} dk{s.cardioKcal ? ` • ~${s.cardioKcal} kcal` : ''}</div>}
        {s.prs.length > 0 ? (
          <div className="note" style={{ marginTop: 10, borderLeftColor: '#e0a53a', background: '#fff8ec' }}>
            <b>🏆 Yeni rekor{s.prs.length > 1 ? 'lar' : ''}</b>
            <div className="stack" style={{ gap: 3, marginTop: 4 }}>{s.prs.map((p, i) => <span key={i} className="muted small">{p}</span>)}</div>
          </div>
        ) : (
          <div className="muted small" style={{ marginTop: 10 }}>PR çıkmadı; bu kötü bir antrenman demek değil. Hacim ve teknik de ilerlemenin parçası.</div>
        )}
        <button className="btn primary" style={{ width: '100%', marginTop: 14 }} onClick={close}>Kapat</button>
      </div>
    </div>
  );
}
