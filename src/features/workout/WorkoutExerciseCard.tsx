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

type EntryField = 'weight' | 'reps' | 'rir';

export function WorkoutExerciseCard({ planId, exerciseIndex, exercise, previousSets, onSetCompleted, onReplace }: Props) {
  const { state, dispatch } = useStore();
  const draft = state.persisted.workoutDrafts[planId];
  const rows: DraftSetRow[] = draft?.sets[exerciseIndex] || Array.from({ length: exercise.sets }, () => ({}));
  const guide = PROGRAM_EXERCISE_GUIDES[exercise.name] || DEFAULT_GUIDE;
  const keypad = useSetEntryKeypad();
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Record<number, Partial<Record<EntryField, string>>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function fieldKey(setIndex: number, field: EntryField) { return `${setIndex}:${field}`; }
  function currentValue(setIndex: number, field: EntryField) {
    return pendingRef.current[setIndex]?.[field] ?? String(rows[setIndex]?.[field] ?? '');
  }
  function setPending(setIndex: number, field: EntryField, value: string) {
    pendingRef.current[setIndex] = { ...(pendingRef.current[setIndex] || {}), [field]: value };
    const el = inputRefs.current[fieldKey(setIndex, field)];
    if (el && el.value !== value) el.value = value;
  }
  function setField(setIndex: number, field: EntryField, value: string) {
    dispatch({ type: 'SET_DRAFT_SET_FIELD', planId, exerciseIndex, setIndex, field, value });
  }
  function markDone(setIndex: number, checked: boolean) {
    dispatch({ type: 'SET_DRAFT_SET_FIELD', planId, exerciseIndex, setIndex, field: 'done', value: checked });
    if (checked) onSetCompleted(guide.rest, `${exercise.name} • ${setIndex + 1}. set sonrası`);
  }

  function openField(setIndex: number, field: EntryField) {
    keypad.setActive({ exerciseIndex, setIndex, field });
  }

  function previewValue(v: string) {
    if (!keypad.active) return;
    setPending(keypad.active.setIndex, keypad.active.field, v);
  }

  function keypadNext(v: string) {
    if (!keypad.active || !v.trim()) return;
    const { setIndex, field } = keypad.active;
    setPending(setIndex, field, v);

    if (field === 'weight') {
      keypad.setActive({ exerciseIndex, setIndex, field: 'reps' });
      return;
    }
    if (field === 'reps') {
      keypad.setActive({ exerciseIndex, setIndex, field: 'rir' });
      return;
    }

    // One logical commit point per completed set. Keystrokes and Weight→Reps→RIR
    // transitions never touch global app state; only Seti tamamla does.
    const pending = pendingRef.current[setIndex] || {};
    setField(setIndex, 'weight', pending.weight ?? String(rows[setIndex]?.weight ?? ''));
    setField(setIndex, 'reps', pending.reps ?? String(rows[setIndex]?.reps ?? ''));
    setField(setIndex, 'rir', pending.rir ?? v);
    markDone(setIndex, true);
    delete pendingRef.current[setIndex];

    const nextRowExists = setIndex + 1 < rows.length;
    if (nextRowExists) keypad.setActive({ exerciseIndex, setIndex: setIndex + 1, field: 'weight' });
    else keypad.setActive(null);
  }

  function closeKeypad(v: string) {
    if (keypad.active) {
      const { setIndex, field } = keypad.active;
      setPending(setIndex, field, v);
      const pending = pendingRef.current[setIndex] || {};
      (['weight', 'reps', 'rir'] as EntryField[]).forEach((f) => {
        if (pending[f] !== undefined) setField(setIndex, f, pending[f]!);
      });
      delete pendingRef.current[setIndex];
    }
    keypad.setActive(null);
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
                  <td><input ref={(el) => { inputRefs.current[fieldKey(j, 'weight')] = el; }} readOnly inputMode="none" defaultValue={currentValue(j, 'weight')} onFocus={() => openField(j, 'weight')} placeholder="kg" /></td>
                  <td><input ref={(el) => { inputRefs.current[fieldKey(j, 'reps')] = el; }} readOnly inputMode="none" defaultValue={currentValue(j, 'reps')} onFocus={() => openField(j, 'reps')} placeholder="tekrar" /></td>
                  <td><input ref={(el) => { inputRefs.current[fieldKey(j, 'rir')] = el; }} readOnly inputMode="none" defaultValue={currentValue(j, 'rir')} onFocus={() => openField(j, 'rir')} placeholder="RIR" /></td>
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
        initialValue={keypad.active ? currentValue(keypad.active.setIndex, keypad.active.field) : ''}
        onPreview={previewValue}
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
