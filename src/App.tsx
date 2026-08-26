import React from 'react';
import { useStore } from './state/StoreProvider';
import { Panel } from './features/panel/Panel';
import { Nutrition } from './features/nutrition/Nutrition';
import { Workout } from './features/workout/Workout';
import { Measurements } from './features/measurements/Measurements';
import { Photos } from './features/photos/Photos';
import { Settings } from './features/settings/Settings';
import { WorkoutSummaryModal } from './features/workout/WorkoutSummaryModal';

const TABS: { id: any; label: string; icon: string }[] = [
  { id: 'Panel', label: 'Panel', icon: '▦' },
  { id: 'Beslenme', label: 'Beslenme', icon: '🍽' },
  { id: 'Antrenman', label: 'Antrenman', icon: '🏋' },
  { id: 'Ölçümler', label: 'Ölçümler', icon: '📏' },
  { id: 'Fotoğraflar', label: 'Fotoğraflar', icon: '📷' },
  { id: 'Ayarlar', label: 'Ayarlar', icon: '⚙' },
];

const SCREENS: Record<string, React.ComponentType> = {
  Panel, Beslenme: Nutrition, Antrenman: Workout, 'Ölçümler': Measurements, 'Fotoğraflar': Photos, Ayarlar: Settings,
};

export function App() {
  const { state, dispatch } = useStore();
  const Screen = SCREENS[state.ui.tab] || Panel;
  return (
    <div className="app">
      <header>
        <div className="wrap topbar">
          <div className="brand">F<span>O</span>RM<span className="x">X</span></div>
          <div className="muted">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </header>
      <main className="wrap"><Screen /></main>
      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={state.ui.tab === t.id ? 'active' : ''} onClick={() => dispatch({ type: 'SELECT_TAB', tab: t.id })} aria-label={t.label}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
      {state.ui.toast && <div className="toast">{state.ui.toast}</div>}
      <WorkoutSummaryModal />
    </div>
  );
}
