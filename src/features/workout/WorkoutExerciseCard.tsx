import React, { useRef } from 'react';
import { useStore } from '../../state/StoreProvider';
import { Card, Pill, fmt } from '../../components/ui';
import { PROGRAM_EXERCISE_GUIDES, DEFAULT_GUIDE } from '../../data/exerciseLibrary';
import type { ExerciseDef, PlanId, DraftSetRow } from '../../core/types';
import { SetEntryKeypad, useSetEntryKeypad } from './SetEntryKeypad';
import { exercisePR, exerciseHistory } from '../../core/coachSelectors';
import { LineChart } from '../../components/LineChart';

interface Props {
  planId: PlanId;
  exerciseIndex: number;
  exercise: ExerciseDef;
  previousSets: DraftSetRow[] | undefined;
  onSetCompleted: (restSeconds: number, label: string) => void;
  onReplace: () => void;
}

export function WorkoutExerciseCard({ planId, exerciseIndex, exercise, previousSets, onSetCompleted, onReplace }: Props) {
  const { state, dispatch } = useStore();
  const draft = state.persisted.workoutDrafts[planId];
  const rows: DraftSetRow[] = draft?.sets[exerciseIndex] || Array.from({ length: exercise.sets }, () => ({}));
  const guide = PROGRAM_EXERCISE_GUIDES[exercise.name] || DEFAULT_GUIDE;
  const keypad = useSetEntryKeypad();
  const containerRef = useRef<HTMLDivElement>(null);

  function setField(setIndex: number, field: 'weight' | 'reps' | 'rir', value: string) {
    dispatch({ type: 'SET_DRAFT_SET_FIELD', planId, exerciseIndex, setIndex, field, value });
  }
  function markDone(setIndex: number, checked: boolean) {
    dispatch({ type: 'SET_DRAFT_SET_FIELD', planId, exerciseIndex, setIndex, field: 'done', value: checked });
    if (checked) onSetCompleted(guide.rest, `${exercise.name} • ${setIndex + 1}. set sonrası`);
  }

  function commitActive() {
    if (!keypad.active) return;
    setField(keypad.active.setIndex, keypad.active.field, keypad.value);
  }

  function openField(setIndex: number, field: 'weight' | 'reps' | 'rir') {
    // If the user taps another field directly while the keypad is already open,
    // persist the field they were editing before moving focus.
    if (keypad.active && (keypad.active.setIndex !== setIndex || keypad.active.field !== field)) commitActive();
    keypad.setActive({ exerciseIndex, setIndex, field });
    keypad.setValue(String(rows[setIndex]?.[field] ?? ''));
  }
  function keypadChange(v: string) {
    // Keep keystrokes local. The old implementation dispatched into the global
    // app reducer on EVERY digit, which re-rendered every Store consumer and
    // made iPhone entry visibly laggy. Commit only when moving fields/closing.
    keypad.setValue(v);
  }
  function keypadNext() {
    if (!keypad.active || !keypad.value.trim()) return;
    const { setIndex, field } = keypad.active;
    commitActive();
    if (field === 'weight') {
      keypad.setActive({ exerciseIndex, setIndex, field: 'reps' });
      keypad.setValue(String(rows[setIndex]?.reps ?? ''));
      return;
    }
    if (field === 'reps') {
      keypad.setActive({ exerciseIndex, setIndex, field: 'rir' });
      keypad.setValue(String(rows[setIndex]?.rir ?? ''));
      return;
    }
    // field === 'rir': complete the set and move to the next set's weight.
    markDone(setIndex, true);
    const nextRowExists = setIndex + 1 < rows.length;
    if (nextRowExists) {
      keypad.setActive({ exerciseIndex, setIndex: setIndex + 1, field: 'weight' });
      keypad.setValue(String(rows[setIndex + 1]?.weight ?? ''));
    } else {
      keypad.setActive(null);
    }
  }

  function closeKeypad() {
    commitActive();
    keypad.setActive(null);
  }

  function displayValue(setIndex: number, field: 'weight' | 'reps' | 'rir') {
    const a = keypad.active;
    return a && a.setIndex === setIndex && a.field === field ? keypad.value : String(rows[setIndex]?.[field] ?? '');
  }

  return (
    <Card className="workout-card">
      <div className="exercise-head">
        <div>
          <strong style={{ fontSize: 17 }}>{exercise.name}</strong>
          <div style={{ marginTop: 5 }}>
            <Pill>{exercise.sets} set • {exercise.repRange} tekrar</Pill>{' '}
            <Pill>RIR {exercise.targetRir || '-'}</Pill>{' '}
            <Pill>Dinlenme ~{Math.round(guide.rest / 60 * 10) / 10} dk</Pill>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn secondary small" onClick={onReplace}>Değiştir</button>
          <button className="btn secondary small" onClick={() => dispatch({ type: 'ADD_DRAFT_SET', planId, exerciseIndex })}>+ Set</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }} ref={containerRef}>
        <table className="set-table">
          <thead><tr><th>SET</th><th>ÖNCEKİ</th><th>KG</th><th>TEKRAR</th><th>RIR</th><th>✓</th></tr></thead>
          <tbody>
            {rows.map((row, j) => {
              const prev = previousSets?.[j];
              return (
                <tr key={j}>
                  <td>{j + 1}</td>
                  <td className="muted">{prev ? `${prev.weight ?? '-'} × ${prev.reps ?? '-'}` : '- × -'}</td>
                  <td><input readOnly inputMode="none" value={displayValue(j, 'weight')} onFocus={() => openField(j, 'weight')} placeholder="kg" /></td>
                  <td><input readOnly inputMode="none" value={displayValue(j, 'reps')} onFocus={() => openField(j, 'reps')} placeholder="tekrar" /></td>
                  <td><input readOnly inputMode="none" value={displayValue(j, 'rir')} onFocus={() => openField(j, 'rir')} placeholder="RIR" /></td>
                  <td><input type="checkbox" checked={!!row.done} onChange={(e) => markDone(j, e.target.checked)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="form-guide">
        <summary>▾ Form rehberi &amp; yükleme notu</summary>
        <div className="guide-grid">
          <div className="guide-box"><b>Doğru form</b><div className="muted">{guide.form}</div></div>
          <div className="guide-box"><b>Nasıl yükleneceği</b><div className="muted">{guide.load}</div></div>
        </div>
      </details>
      <details className="form-guide">
        <summary>▾ Performans &amp; PR</summary>
        <ExercisePRSection exerciseName={exercise.name} />
      </details>
      <SetEntryKeypad
        active={keypad.active}
        value={keypad.value}
        onOpen={keypad.setActive}
        onChange={keypadChange}
        onNext={keypadNext}
        onClose={closeKeypad}
        isLastField={keypad.active?.field === 'rir'}
      />
    </Card>
  );
}

const ExercisePRSection = React.memo(function ExercisePRSection({ exerciseName }: { exerciseName: string }) {
  const { state } = useStore();
  const pr = exercisePR(state.persisted.workouts, exerciseName);
  const history = exerciseHistory(state.persisted.workouts, exerciseName);
  return (
    <div>
      <div className="guide-grid">
        <div className="guide-box"><span className="muted small">En ağır set</span><div className="kpi" style={{ fontSize: 18 }}>{pr.bestWeight ? `${fmt(pr.bestWeight, 1)} × ${pr.bestReps}` : '—'}</div></div>
        <div className="guide-box"><span className="muted small">Tahmini 1RM PR</span><div className="kpi" style={{ fontSize: 18 }}>{pr.bestE1rm ? `${fmt(pr.bestE1rm, 1)} kg` : '—'}</div></div>
      </div>
      <div className="guide-box" style={{ marginTop: 8 }}>
        <span className="muted small">Egzersiz geçmişi (tahmini 1RM trendi)</span>
        <LineChart series={[{ values: history.map((h) => h.e1rm), color: '#2563eb' }]} height={130} />
      </div>
    </div>
  );
});
