import React, { useMemo, useState } from 'react';
import { useStore, dateKey } from '../../state/StoreProvider';
import { Card, fmt } from '../../components/ui';
import { nutrientTotals } from '../../core/selectors';
import { weeklyCalorieSummary, rescueMealPlans } from '../../core/coachSelectors';
import type { MealName } from '../../core/types';

const MEALS: MealName[] = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün', 'Antrenman Öncesi', 'Antrenman Sonrası'];

export function Nutrition() {
  const { state, dispatch } = useStore();
  const { persisted, ui } = state;
  const today = dateKey();
  const dayMeals = persisted.meals[today] || {};
  const allToday = MEALS.flatMap((m) => dayMeals[m] || []);
  const totals = nutrientTotals(allToday, persisted.foods);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);

  const categories = useMemo(() => [...new Set(persisted.foods.map((f) => f.category))].sort(), [persisted.foods]);
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return persisted.foods.filter((f) => (!category || f.category === category) && (!q || `${f.name} ${f.brand} ${f.category}`.toLocaleLowerCase('tr-TR').includes(q))).slice(0, 60);
  }, [persisted.foods, query, category]);

  const favorites = useMemo(() => [...persisted.foods].sort((a, b) => (persisted.foodUsage[b.name] || 0) - (persisted.foodUsage[a.name] || 0)).slice(0, 6), [persisted.foods, persisted.foodUsage]);
  const weeklyKcal = useMemo(() => weeklyCalorieSummary(persisted, today), [persisted.meals, persisted.foods, persisted.targets, today]);
  const rescue = useMemo(() => rescueMealPlans(persisted, today), [persisted.foods, persisted.foodUsage, persisted.targets, persisted.meals, today]);

  function addFood(foodId: string) {
    const food = persisted.foods.find((f) => f.id === foodId);
    if (!food) return;
    const isCount = food.unit !== 'g';
    const raw = window.prompt(`${food.name} — miktar (${isCount ? food.unit : 'gram'}):`, isCount ? '1' : '100');
    if (raw == null) return;
    const qty = Number(String(raw).replace(',', '.'));
    if (!qty || qty < 0) return;
    dispatch({ type: 'ADD_MEAL_ITEM', date: today, meal: ui.selectedMeal, foodId, qty, unit: isCount ? food.unit : 'g' });
  }

  function saveFavorite() {
    const name = window.prompt('Favori öğünün adı:', ui.selectedMeal);
    if (!name) return;
    dispatch({ type: 'SAVE_FAVORITE_MEAL', name, date: today, meal: ui.selectedMeal });
  }

  function applyRescuePlan(plan: { items: { foodId: string; qty: number; unit: string }[] }) {
    // Reuses the existing ADD_MEAL_ITEM action once per item — no new/duplicate
    // handler is introduced for "add a rescue plan", it's the same single
    // source-of-truth action every other food-add path already uses.
    plan.items.forEach((it) => dispatch({ type: 'ADD_MEAL_ITEM', date: today, meal: ui.selectedMeal, foodId: it.foodId, qty: it.qty, unit: it.unit }));
  }

  return (
    <div className="stack">
      <div className="grid g3">
        <Card><div className="muted">Kalori</div><div className="kpi">{fmt(totals.kcal)} / {persisted.targets.kcal}</div></Card>
        <Card><div className="muted">Protein</div><div className="kpi">{fmt(totals.protein)} / {persisted.targets.protein} g</div></Card>
        <Card><div className="muted">Makrolar</div><div>K: {fmt(totals.carb)} g · Y: {fmt(totals.fat)} g · Lif: {fmt(totals.fiber)} g</div></Card>
      </div>

      <Card>
        <h2>Haftalık kalori</h2>
        <div className="grid g3">
          <div><span className="muted small">Hedef (7g)</span><div className="kpi">{fmt(weeklyKcal.target)}</div></div>
          <div><span className="muted small">Gerçekleşen</span><div className="kpi">{fmt(weeklyKcal.total)}</div></div>
          <div><span className="muted small">Günlük ort.</span><div className="kpi">{fmt(weeklyKcal.avg)}</div></div>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>Fark: {weeklyKcal.diff >= 0 ? '+' : ''}{fmt(weeklyKcal.diff)} kcal</div>
      </Card>

      {(rescue.needProtein > 5 || rescue.budgetKcal > 100) && rescue.plans.length > 0 && (
        <Card>
          <h2>Günü kurtar</h2>
          <div className="muted small" style={{ marginBottom: 8 }}>Kalan bütçe: ~{fmt(rescue.budgetKcal)} kcal, ~{fmt(rescue.needProtein)} g protein</div>
          <div className="list">
            {rescue.plans.map((p, i) => (
              <div key={i} className="item">
                <div>
                  <strong>{p.items.map((it) => persisted.foods.find((f) => f.id === it.foodId)?.name).filter(Boolean).join(' + ')}</strong>
                  <div className="muted small">{fmt(p.kcal)} kcal · {fmt(p.protein, 1)} g protein</div>
                </div>
                <button className="btn primary small" onClick={() => applyRescuePlan(p)}>Öğüne ekle</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2>Favori öğünler</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn secondary" onClick={saveFavorite}>Mevcut öğünü favori kaydet</button>
        </div>
        <div className="list">
          {persisted.favoriteMeals.length ? persisted.favoriteMeals.map((fav) => (
            <div key={fav.id} className="item">
              <div><b>{fav.name}</b><div className="muted small">{fav.items.length} besin</div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn primary small" onClick={() => dispatch({ type: 'APPLY_FAVORITE_MEAL', id: fav.id, date: today, meal: ui.selectedMeal })}>Ekle</button>
                <button className="btn danger small" onClick={() => dispatch({ type: 'REMOVE_FAVORITE_MEAL', id: fav.id })}>Sil</button>
              </div>
            </div>
          )) : <div className="muted small">Henüz favori öğün yok.</div>}
        </div>
      </Card>

      <Card>
        <h2>Hızlı besin ekle</h2>
        <div className="meal-tabs">{MEALS.map((m) => <button key={m} className={ui.selectedMeal === m ? 'active' : ''} onClick={() => dispatch({ type: 'SELECT_MEAL', meal: m })}>{m}</button>)}</div>
        <div className="quick-favs">
          {favorites.map((f) => <button key={f.id} className="btn secondary small" onClick={() => addFood(f.id)}>+ {f.name}</button>)}
        </div>
        <button className="btn secondary" onClick={() => setOpen((o) => !o)}>{open ? 'Aramayı kapat' : '🔎 Besin ara'}</button>
        {open && (
          <div style={{ marginTop: 10 }}>
            <div className="row">
              <input placeholder="Besin ara: tavuk, yulaf, whey..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="food-results">
              {results.map((f) => (
                <button key={f.id} className="food-pick" onClick={() => addFood(f.id)}>
                  <span><strong>{f.name}</strong><br /><span className="muted">{fmt(f.kcal)} kcal · P {fmt(f.protein, 1)} · K {fmt(f.carb, 1)} · Y {fmt(f.fat, 1)} /100g</span></span>
                  <span className="category-chip">{f.category}</span>
                </button>
              ))}
              {!results.length && <div className="muted">Eşleşen besin yok.</div>}
            </div>
          </div>
        )}
      </Card>

      <div className="grid g2">
        {MEALS.map((m) => {
          const items = dayMeals[m] || [];
          const t = nutrientTotals(items, persisted.foods);
          return (
            <Card key={m} className={ui.selectedMeal === m ? 'meal-active' : ''}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><h3>{m}</h3><div className="muted">{fmt(t.kcal)} kcal · P {fmt(t.protein)} · K {fmt(t.carb)} · Y {fmt(t.fat)}</div></div>
                <button className="btn secondary" onClick={() => dispatch({ type: 'SELECT_MEAL', meal: m })}>Buraya ekle</button>
              </div>
              <div className="list">
                {items.length ? items.map((item, idx) => {
                  const f = persisted.foods.find((x) => x.id === item.foodId);
                  return (
                    <div key={idx} className="item">
                      <div><strong>{f?.name || 'Besin'}</strong><span className="muted"> {item.qty} {item.unit === 'g' ? 'g' : item.unit}</span></div>
                      <button className="btn danger small" onClick={() => dispatch({ type: 'REMOVE_MEAL_ITEM', date: today, meal: m, index: idx })}>Sil</button>
                    </div>
                  );
                }) : <div className="muted">Kayıt yok.</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
