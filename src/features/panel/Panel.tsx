import React, { useMemo, useState } from 'react';
import { useStore, dateKey } from '../../state/StoreProvider';
import { Card, ProgressBar, fmt } from '../../components/ui';
import { nutrientTotals, estimateBodyFat, matchScheduleToWorkouts, readinessScore, weekBounds, addDays } from '../../core/selectors';
import { calorieCoachSuggestion, fullWeeklyReport, muscleWeeklyVolume } from '../../core/coachSelectors';
import { todayWorkout } from '../../data/programs';

export function Panel() {
  const { state, dispatch } = useStore();
  const { persisted } = state;
  const today = dateKey();
  const todayMeals = Object.values(persisted.meals[today] || {}).flat();
  const totals = nutrientTotals(todayMeals, persisted.foods);
  const latest = [...persisted.measurements].sort((a, b) => b.date.localeCompare(a.date))[0];
  const bf = latest ? estimateBodyFat({ waist: latest.waist, neck: latest.neck, heightCm: persisted.profile.heightCm }) : null;
  const plan = todayWorkout(persisted.schedule);
  const now = new Date();
  const monthStats = matchScheduleToWorkouts(now.getFullYear(), now.getMonth(), persisted.workouts, persisted.schedule);
  const habits = persisted.habits[today] || {};
  const readiness = readinessScore(persisted.coach.readiness[today]);

  const goToWorkout = () => {
    dispatch({ type: 'SELECT_PLAN', planId: plan && persisted.programs[plan] ? plan : Object.keys(persisted.programs)[0] });
    dispatch({ type: 'SELECT_TAB', tab: 'Antrenman' });
  };

  // Missed-workout detection: any scheduled day this week, before today,
  // with no matching workout and no recorded skip/caught-up decision.
  const missed = useMemo(() => {
    const [start] = weekBounds(new Date());
    const out: { date: string; plan: string }[] = [];
    for (let k = start; k < today; k = addDays(k, 1)) {
      const d = new Date(`${k}T12:00:00`);
      const scheduled = persisted.schedule[d.getDay() as any];
      if (!scheduled) continue;
      const decided = persisted.missedWorkoutDecisions[k];
      const done = persisted.workouts.some((w) => w.date === k && w.type === scheduled);
      if (!done && decided !== 'skip' && decided !== 'caught-up') out.push({ date: k, plan: scheduled });
    }
    return out.at(-1) || null;
  }, [persisted.schedule, persisted.workouts, persisted.missedWorkoutDecisions, today]);

  const weekly = useMemo(() => fullWeeklyReport(persisted, today), [persisted, today]);
  const calorieCoach = useMemo(() => calorieCoachSuggestion(persisted, today), [persisted.measurements, persisted.meals, persisted.coach.calorieDecisions, today]);
  const muscleVolume = useMemo(() => muscleWeeklyVolume(persisted), [persisted.programs, persisted.schedule, persisted.workouts]);

  return (
    <div className="stack">
      <div className="hero">
        <div className="hero-mark">F</div>
        <div>
          <h1>FTX Performance</h1>
          <p>Antrenman, beslenme ve vücut kompozisyonunu tek merkezden takip et.</p>
          <span className="hero-tag">{plan ? `Bugün: ${plan}` : 'Bugün dinlenme günü'}</span>
        </div>
      </div>

      {missed && (
        <Card className="missed-card">
          <span className="chip">KAÇIRILAN ANTRENMAN</span>
          <h3 style={{ marginTop: 7 }}>{missed.date} • {missed.plan}</h3>
          <div className="muted small">Programı otomatik kaydırmıyoruz.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn primary" onClick={() => { dispatch({ type: 'START_CATCHUP', sourceDate: missed.date, plan: missed.plan }); dispatch({ type: 'SELECT_TAB', tab: 'Antrenman' }); }}>Bugün telafi et</button>
            <button className="btn secondary" onClick={() => dispatch({ type: 'SKIP_MISSED', date: missed.date })}>Aynen devam</button>
          </div>
        </Card>
      )}

      <div className="grid g4">
        <Card><div className="muted">Güncel kilo</div><div className="kpi">{fmt(latest?.weight, 1)} kg</div><div className="muted">Başlangıç: {persisted.profile.startWeight ?? '—'} kg</div></Card>
        <Card><div className="muted">Kalori</div><div className="kpi">{fmt(totals.kcal)} / {persisted.targets.kcal}</div><ProgressBar value={totals.kcal} max={persisted.targets.kcal} /></Card>
        <Card><div className="muted">Protein</div><div className="kpi">{fmt(totals.protein)} / {persisted.targets.protein} g</div><ProgressBar value={totals.protein} max={persisted.targets.protein} /></Card>
        <Card><div className="muted">Tahmini yağ oranı</div><div className="kpi">{bf == null ? '—' : `${fmt(bf, 1)}%`}</div><div className="muted">{bf == null ? 'Bel + boyun ölçümü gerekli' : 'Bel-boyun-boy tahmini'}</div></Card>
      </div>

      <Card>
        <h2>Hazırlık</h2>
        <div className="row">
          <div><label>Uyku (saat)</label><input type="number" step="0.5" value={persisted.coach.readiness[today]?.sleep ?? ''} onChange={(e) => dispatch({ type: 'SET_READINESS', date: today, field: 'sleep', value: Number(e.target.value) })} /></div>
          <div><label>Enerji (1-5)</label><input type="number" min={1} max={5} value={persisted.coach.readiness[today]?.energy ?? ''} onChange={(e) => dispatch({ type: 'SET_READINESS', date: today, field: 'energy', value: Number(e.target.value) })} /></div>
          <div><label>Kas ağrısı (1-5)</label><input type="number" min={1} max={5} value={persisted.coach.readiness[today]?.soreness ?? ''} onChange={(e) => dispatch({ type: 'SET_READINESS', date: today, field: 'soreness', value: Number(e.target.value) })} /></div>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>{readiness.score == null ? readiness.advice : `${readiness.score}/100 • ${readiness.label} — ${readiness.advice}`}</div>
      </Card>

      <div className="grid g2">
        <Card>
          <h2>Hızlı işlemler</h2>
          <div className="grid g2">
            <button className="btn primary" onClick={goToWorkout}>{plan ? `${plan} antrenmanını aç` : 'Programları aç'}</button>
            <button className="btn secondary" onClick={() => dispatch({ type: 'SELECT_TAB', tab: 'Beslenme' })}>Öğün ekle</button>
          </div>
        </Card>
        <Card>
          <h2>Bu ayın antrenman takibi</h2>
          <div className="kpi">{monthStats.matched.size}/{monthStats.slots.length}</div>
          <div className="muted">planlı antrenman tamamlandı</div>
        </Card>
      </div>

      <Card>
        <h2>Haftalık rapor</h2>
        <div className="muted small" style={{ marginBottom: 8 }}>{weekly.verdict}</div>
        <div className="grid g3">
          <div><span className="muted">Antrenman</span><div className="kpi">{weekly.workoutsDone}/{weekly.workoutsPlannedThrough || 0}</div><div className="muted small">bugüne kadar</div></div>
          <div><span className="muted">Protein günü</span><div className="kpi">{weekly.proteinDays}/{weekly.loggedDays || 0}</div><div className="muted small">≥ %90 hedef</div></div>
          <div><span className="muted">Ort. kalori</span><div className="kpi">{weekly.avgKcal == null ? '—' : fmt(weekly.avgKcal)}</div><div className="muted small">{weekly.loggedDays} kayıtlı gün</div></div>
          <div><span className="muted">Çalışma seti</span><div className="kpi">{weekly.totalSets}</div><div className="muted small">{fmt(weekly.totalVolume / 1000, 1)} ton hacim</div></div>
          <div><span className="muted">Kardiyo</span><div className="kpi">{weekly.cardioMinutes} dk</div><div className="muted small">bu hafta</div></div>
          <div><span className="muted">Kilo trendi</span><div className="kpi">{weekly.weightTrend.delta == null ? '—' : `${weekly.weightTrend.delta > 0 ? '+' : ''}${fmt(weekly.weightTrend.delta, 2)} kg`}</div><div className="muted small">7g / önceki 7g</div></div>
        </div>
      </Card>

      {calorieCoach.status === 'suggest' ? (
        <Card className="coach-suggest">
          <span className="chip">KALORİ KOÇU</span>
          <h3 style={{ marginTop: 7 }}>{calorieCoach.delta! < 0 ? calorieCoach.delta : '+' + calorieCoach.delta} kcal öneri</h3>
          <p className="muted small">{calorieCoach.text}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn secondary small" onClick={() => dispatch({ type: 'DISMISS_CALORIE_SUGGESTION' })}>Şimdilik hayır</button>
            <button className="btn primary small" onClick={() => dispatch({ type: 'ACCEPT_CALORIE_SUGGESTION', delta: calorieCoach.delta! })}>Uygula</button>
          </div>
        </Card>
      ) : (
        <Card>
          <span className="chip">KALORİ KOÇU</span>
          <div className="muted small" style={{ marginTop: 7 }}>{calorieCoach.text}</div>
        </Card>
      )}

      {muscleVolume.length > 0 && (
        <Card>
          <h2>Haftalık kas grubu hacmi</h2>
          <div className="muted small" style={{ marginBottom: 8 }}>Planlanan vs gerçekleşen set sayısı — bu bant "optimal" iddiası değil.</div>
          <div className="stack" style={{ gap: 8 }}>
            {muscleVolume.map((row) => (
              <div key={row.muscle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{row.label}</span><b>{row.done}/{row.planned} set</b></div>
                <ProgressBar value={row.done} max={row.planned || 1} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2>Günlük alışkanlıklar</h2>
        <label className="check"><input type="checkbox" checked={!!habits.creatine} onChange={(e) => dispatch({ type: 'SET_HABIT', date: today, key: 'creatine', value: e.target.checked })} /> Kreatin alındı</label>
        <label className="check"><input type="checkbox" checked={!!habits.biotin} onChange={(e) => dispatch({ type: 'SET_HABIT', date: today, key: 'biotin', value: e.target.checked })} /> Biotin alındı</label>
        <div className="row">
          <div><label>Su (L)</label><input type="number" step="0.25" value={habits.water || ''} onChange={(e) => dispatch({ type: 'SET_HABIT', date: today, key: 'water', value: e.target.value })} /></div>
          <div><label>Adım</label><input type="number" value={habits.steps || ''} onChange={(e) => dispatch({ type: 'SET_HABIT', date: today, key: 'steps', value: e.target.value })} /></div>
        </div>
      </Card>
    </div>
  );
}
