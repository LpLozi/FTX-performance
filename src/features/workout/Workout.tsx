import React, { useState } from 'react';
import { useStore, elapsedSeconds, formatClock, dateKey } from '../../state/StoreProvider';
import { Card, Pill, fmt } from '../../components/ui';
import { ProgramSelector } from './ProgramSelector';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import { RestTimer, TimerControls } from './WorkoutTimers';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { effectiveExercises } from './effectiveExercises';
import { HYROX_SEGMENTS } from '../../data/programs';
import { cardioKcal, CARDIO_TYPES, currentWeight, refinedRecommendation } from '../../core/coachSelectors';

const CARDIO_INTENSITIES: Array<'Hafif' | 'Orta' | 'Yüksek'> = ['Hafif', 'Orta', 'Yüksek'];

function CardioFinisher({ planId }: { planId: string }) {
  const { state, dispatch } = useStore();
  const draft = state.persisted.workoutDrafts[planId];
  const cardio = draft?.cardio || {};
  const weightKg = currentWeight(state.persisted.measurements, state.persisted.profile.startWeight);
  const set = (field: string, value: any) => dispatch({ type: 'SET_DRAFT_CARDIO', planId, field, value });
  const estimatedKcal = cardio.type && cardio.minutes ? cardioKcal(cardio.type, Number(cardio.minutes), Number(cardio.speed) || 0, Number(cardio.incline) || 0, (cardio.intensity as any) || 'Orta', weightKg) : 0;

  // Keep the persisted draft's kcal estimate in sync with type/minutes/speed/
  // incline/intensity so SAVE_WORKOUT (which just copies draft.cardio
  // verbatim into the saved workout) captures the MET-based estimate
  // without needing a second action.
  React.useEffect(() => {
    if (estimatedKcal > 0 && cardio.kcal !== estimatedKcal) set('kcal', estimatedKcal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedKcal]);

  return (
    <Card>
      <h2>Kardiyo finisher</h2>
      <div className="grid g2">
        <div><label>Tür</label><select value={cardio.type || ''} onChange={(e) => set('type', e.target.value)}><option value="">Seç</option>{CARDIO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label>Süre (dk)</label><input type="number" value={cardio.minutes ?? ''} onChange={(e) => set('minutes', Number(e.target.value))} /></div>
        <div><label>Hız (km/sa)</label><input type="number" step="0.1" value={cardio.speed ?? ''} onChange={(e) => set('speed', Number(e.target.value))} /></div>
        <div><label>Eğim (%)</label><input type="number" step="0.5" value={cardio.incline ?? ''} onChange={(e) => set('incline', Number(e.target.value))} /></div>
        <div><label>Yoğunluk</label><select value={cardio.intensity || 'Orta'} onChange={(e) => set('intensity', e.target.value)}>{CARDIO_INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      </div>
      {estimatedKcal > 0 && <div className="note" style={{ marginTop: 10 }}>Tahmini kalori: <b>~{estimatedKcal} kcal</b> (MET tabanlı, kaydettiğinde antrenmana eklenecek)</div>}
    </Card>
  );
}

function applyLoadToWorkingSets(dispatch: any, planId: string, exerciseIndex: number, weight: number, exercise: { sets: number }, currentRows: { setType?: string }[] | undefined) {
  // Mirrors legacy's coachApplyLoad (coach-refine.js's version, which —
  // unlike coach-plus.js's earlier one — only fills setType==='working'
  // rows, not every non-warmup row). Reuses the existing SET_DRAFT_SET_FIELD
  // action in a loop; no new reducer action is introduced.
  const rows: { setType?: string }[] = currentRows && currentRows.length
    ? currentRows
    : Array.from({ length: exercise.sets || 1 }, (): { setType?: string } => ({}));
  rows.forEach((row, j) => {
    const type = row.setType || 'working';
    if (type === 'working') dispatch({ type: 'SET_DRAFT_SET_FIELD', planId, exerciseIndex, setIndex: j, field: 'weight', value: String(weight) });
  });
}

function NormalWorkoutScreen() {
  const { state, dispatch } = useStore();
  const planId = state.ui.selectedPlanId;
  const { persisted } = state;
  const draft = persisted.workoutDrafts[planId];
  const exercises = effectiveExercises(persisted, planId);
  const history = persisted.workouts.filter((w) => w.type === planId);
  const last = history.at(-1);
  const [rest, setRest] = useState<{ endsAt: number; label: string } | null>(null);
  const [modal, setModal] = useState<{ mode: 'add' | 'replace'; index: number } | null>(null);

  return (
    <div className="stack">
      <Card>
        <div className="row">
          <ProgramSelector disabled={!!draft?.startedAt} />
          <div>
            <label>Tarih</label>
            <input type="date" value={draft?.date || dateKey()} onChange={(e) => dispatch({ type: 'SET_WORKOUT_DATE', planId, date: e.target.value })} />
          </div>
        </div>
        {last && <div className="note" style={{ marginTop: 10 }}>Son {planId}: {last.date}. Önceki performans set satırlarında gösteriliyor.</div>}
        <TimerControls planId={planId} />
      </Card>
      <RestTimer endsAt={rest?.endsAt ?? null} label={rest?.label ?? ''} onClear={() => setRest(null)} />
      {exercises.map((ex, i) => (
        <WorkoutExerciseCard
          key={`${planId}-${i}`}
          planId={planId}
          exerciseIndex={i}
          exercise={ex}
          previousSets={last?.exercises?.[i]?.setData?.map((s) => ({ weight: s.weight != null ? String(s.weight) : '', reps: s.reps != null ? String(s.reps) : '' }))}
          onSetCompleted={(seconds, label) => setRest({ endsAt: Date.now() + seconds * 1000, label })}
          onReplace={() => setModal({ mode: 'replace', index: i })}
        />
      ))}
      <CardioFinisher planId={planId} />
      <Card>
        <h2>Bugünün ilerleme önerisi</h2>
        <div className="list">
          {exercises.map((ex, i) => {
            const rec = refinedRecommendation(ex.name, ex.repRange, history, persisted.coach.readiness[draft?.date || dateKey()]);
            return (
              <div key={i} className={`item coach-load-${rec.tone}`}>
                <div><strong>{ex.name}</strong><div className="muted small">{rec.title}: {rec.text}</div></div>
                {rec.target != null && <button className="btn secondary small" onClick={() => applyLoadToWorkingSets(dispatch, planId, i, rec.target!, exercises[i], draft?.sets[i])}>Kg'yi uygula</button>}
              </div>
            );
          })}
        </div>
      </Card>
      <div className="workout-footer">
        <button className="btn primary" style={{ width: '100%' }} onClick={() => dispatch({ type: 'SAVE_WORKOUT', planId })}>Antrenmanı bitir ve kaydet</button>
      </div>
      {modal && <ExerciseLibraryModal mode={modal.mode} index={modal.index} onClose={() => setModal(null)} />}
    </div>
  );
}

function HyroxScreen() {
  const { state, dispatch } = useStore();
  const draft = state.persisted.workoutDrafts['HYROX Hybrid'];
  const secs = elapsedSeconds(draft);
  return (
    <div className="stack">
      <Card>
        <ProgramSelector disabled={!!draft?.startedAt} />
        <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
          <div><h2 style={{ margin: 0 }}>HYROX Hybrid</h2><div className="muted">1–2. hafta başlangıç bloğu • koşular 500 m</div></div>
          <div style={{ textAlign: 'right' }}><div className="muted">Süre</div><div className="timer">{formatClock(secs)}</div></div>
        </div>
        <button className="btn primary" style={{ width: '100%', marginTop: 12 }} disabled={!!draft?.startedAt} onClick={() => dispatch({ type: 'START_WORKOUT', planId: 'HYROX Hybrid' })}>
          {draft?.startedAt ? 'Antrenman başladı' : 'Antrenmanı başlat'}
        </button>
      </Card>
      {HYROX_SEGMENTS.map((seg, i) => (
        <Card key={seg.key}>
          <div className="exercise-head">
            <div>
              <strong>{i + 1}. {seg.name}</strong>
              <div className="muted">Hedef: {seg.target}</div>
              {seg.recommendation && <div className="muted small"><b>Tavsiye ağırlık:</b> {seg.recommendation}</div>}
            </div>
            <Pill>{seg.name === 'Koşu' ? 'Compromised run' : 'İstasyon'}</Pill>
          </div>
          <div className="row">
            <div>
              <label>Süre (sn)</label>
              <input type="number" inputMode="numeric" value={draft?.hyrox?.[seg.key]?.seconds ?? ''} onChange={(e) => dispatch({ type: 'SET_DRAFT_HYROX_FIELD', segmentKey: seg.key, field: 'seconds', value: Number(e.target.value) })} />
            </div>
            {seg.unit && (
              <div>
                <label>Ağırlık (kg)</label>
                <input type="number" inputMode="decimal" step="0.5" value={draft?.hyrox?.[seg.key]?.weight ?? ''} onChange={(e) => dispatch({ type: 'SET_DRAFT_HYROX_FIELD', segmentKey: seg.key, field: 'weight', value: Number(e.target.value) })} />
              </div>
            )}
          </div>
        </Card>
      ))}
      <Card>
        <div className="note"><b>İlk 2 hafta:</b> amaç yarış simülasyonu değil. Bloğu kontrollü tamamla.</div>
        <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={() => dispatch({ type: 'SAVE_HYROX', segments: HYROX_SEGMENTS })}>Antrenmanı bitir ve kaydet</button>
      </Card>
    </div>
  );
}

export function Workout() {
  const { state } = useStore();
  if (state.ui.selectedPlanId === 'HYROX Hybrid') return <HyroxScreen />;
  return <NormalWorkoutScreen />;
}
