import React, { useMemo, useState } from 'react';
import { useStore } from '../../state/StoreProvider';
import { EXERCISE_LIBRARY, LIBRARY_CATEGORIES, categoryMatch } from '../../data/exerciseLibrary';

interface Props {
  mode: 'add' | 'replace';
  index: number;
  onClose: () => void;
}

const norm = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function ExerciseLibraryModal({ mode, index, onClose }: Props) {
  const { state, dispatch } = useStore();
  const planId = state.ui.selectedPlanId;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tümü');
  const [permanent, setPermanent] = useState(false);

  const results = useMemo(() => {
    const q = norm(query);
    return EXERCISE_LIBRARY.filter((e) => categoryMatch(e, category) && (!q || norm([e.name, e.category, e.equipment, e.primary, e.secondary, e.aliases].join(' ')).includes(q))).slice(0, 80);
  }, [query, category]);

  function pick(name: string) {
    const ex = EXERCISE_LIBRARY.find((e) => e.name === name);
    if (!ex) return;
    dispatch({
      type: 'SWAP_EXERCISE',
      planId,
      index,
      newExercise: { name: ex.name, sets: 3, repRange: ex.reps, targetRir: ex.rir },
      permanent,
    });
    onClose();
  }

  return (
    <div className="ftlib-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ftlib-modal" role="dialog" aria-modal="true">
        <div className="ftlib-head">
          <div>
            <span className="ftlib-eyebrow">FTX HAREKET KÜTÜPHANESİ</span>
            <h3>{mode === 'replace' ? 'Hareketi değiştir' : 'Hareket ekle'}</h3>
            <p>{EXERCISE_LIBRARY.length}+ hareket • form rehberi dahil</p>
          </div>
          <button className="ftlib-close" onClick={onClose}>×</button>
        </div>
        <div className="ftlib-search"><input autoFocus placeholder="Hareket, kas veya ekipman ara…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="ftlib-chips">
          {LIBRARY_CATEGORIES.map((c) => <button key={c} className={c === category ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}
        </div>
        <label className="ftlib-permanent">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
          <span><b>Programda kalıcı olsun</b><small>Kapalıysa değişiklik yalnızca bugüne uygulanır.</small></span>
        </label>
        <div className="ftlib-results">
          {results.length ? results.map((e) => (
            <article key={e.name} className="ftlib-result">
              <button className="ftlib-pick" onClick={() => pick(e.name)}>
                <span><b>{e.name}</b><small>{e.category} • {e.equipment} • {e.primary}</small></span>
                <strong>Seç</strong>
              </button>
              <details>
                <summary>Form ve yükleme rehberi</summary>
                <div className="ftlib-guide">
                  <p><b>Doğru form:</b> {e.form}</p>
                  <p><b>Dikkat:</b> {e.caution}</p>
                  <p><b>Yükleme:</b> {e.load}</p>
                </div>
              </details>
            </article>
          )) : <div className="ftlib-empty"><b>Sonuç bulunamadı.</b></div>}
        </div>
      </div>
    </div>
  );
}
