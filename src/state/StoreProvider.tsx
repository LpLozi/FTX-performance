import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { AppState } from '../core/types';
import { reducer, type Action } from '../core/reducer';
import { loadPersistedState, savePersistedState, ensurePhotosMigrated } from '../core/dataLayer';
import { todayWorkout } from '../data/programs';
import { dateKey } from '../core/selectors';

export interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export const StoreContext = createContext<StoreValue | null>(null);

function buildInitialState(): AppState {
  const { state: persisted } = loadPersistedState();
  const initialPlan = todayWorkout(persisted.schedule) && persisted.programs[todayWorkout(persisted.schedule)!]
    ? todayWorkout(persisted.schedule)!
    : Object.keys(persisted.programs)[0];
  return {
    persisted,
    ui: {
      tab: 'Panel',
      selectedPlanId: initialPlan,
      selectedMeal: 'Kahvaltı',
      toast: null,
      nutritionFilter: 'Tümü',
      nutritionShowAll: false,
      openWorkoutModal: null,
      libraryReplaceIndex: null,
      photoCompare: null,
      workoutSummaryOpen: false,
    },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as any, buildInitialState);

  // Keep a ref to the latest persisted state so the hide/pagehide flush below
  // (registered ONCE, not per-render) never writes a stale closure value.
  // The earlier version captured `state.persisted` in the listener's closure
  // and re-registered a NEW visibilitychange listener on every render without
  // ever removing the old ones (a listener leak) — and because effect
  // cleanup/re-registration is asynchronous relative to the exact instant a
  // tab is hidden, it was possible for a stale listener to fire with old data
  // and overwrite newer localStorage content right at navigation/unload time.
  // A ref sidesteps both problems: there is only ever one listener, and it
  // always reads the truly-latest state at the moment it fires.
  const persistedRef = useRef(state.persisted);
  useEffect(() => { persistedRef.current = state.persisted; }, [state.persisted]);

  useEffect(() => { savePersistedState(state.persisted); }, [state.persisted]);

  // Photo-bytes migration is resumable and idempotent (see dataLayer's
  // ensurePhotosMigrated doc comment) — it is deliberately called on EVERY
  // boot, not gated behind "was this a fresh migration", so an interruption
  // on any previous boot (tab closed mid-write) is picked back up here. It
  // runs once per mount, off the initial render path (doesn't block paint),
  // and never touches the legacy base64 source data.
  useEffect(() => {
    let cancelled = false;
    ensurePhotosMigrated(state.persisted.photoIndex).then((result) => {
      if (cancelled) return;
      if (result.migrated > 0) {
        console.info('FTX: photo migration progressed', result);
      }
      if (result.failed > 0) {
        console.warn('FTX: some legacy photos failed to migrate to IndexedDB', result);
      }
    }).catch((e) => console.error('FTX: ensurePhotosMigrated threw', e));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on unmount/hide so a draft in-flight during page close is not lost
  // to the debounce window — this is what makes "refresh mid-workout" safe.
  // Registered exactly once for the lifetime of the app.
  useEffect(() => {
    const flush = () => savePersistedState(persistedRef.current, true);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!state.ui.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 1800);
    return () => clearTimeout(t);
  }, [state.ui.toast]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function elapsedSeconds(draft: { startedAt: number | null; pausedAt: number | null; pausedTotalMs: number } | null | undefined): number {
  if (!draft?.startedAt) return 0;
  const pausedNow = draft.pausedAt ? Date.now() - draft.pausedAt : 0;
  return Math.max(0, Math.floor((Date.now() - draft.startedAt - draft.pausedTotalMs - pausedNow) / 1000));
}
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = totalSeconds % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
}
export { dateKey };
