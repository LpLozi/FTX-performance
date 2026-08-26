import React, { useRef, useState } from 'react';
import { useStore } from '../../state/StoreProvider';
import { Card } from '../../components/ui';
import { exportBackup, importBackup } from '../../core/dataLayer';

const TARGET_FIELDS: [string, string][] = [['kcal', 'Kalori'], ['protein', 'Protein (g)'], ['carb', 'Karbonhidrat (g)'], ['fat', 'Yağ (g)'], ['fiber', 'Lif (g)'], ['water', 'Su (L)']];

export function Settings() {
  const { state, dispatch } = useStore();
  const { persisted } = state;
  const [targets, setTargets] = useState<Record<string, string>>(Object.fromEntries(Object.entries(persisted.targets).map(([k, v]) => [k, String(v)])));
  const [food, setFood] = useState({ name: '', brand: '', servingG: '100', kcal: '', protein: '', carb: '', fat: '', fiber: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  function saveTargets() {
    dispatch({ type: 'SET_TARGETS', targets: Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, Number(v) || 0])) as any });
  }
  function addFood() {
    dispatch({
      type: 'ADD_CUSTOM_FOOD',
      food: { name: food.name || 'Özel besin', category: 'Özel', brand: food.brand || 'Özel', unit: 'g', servingG: Number(food.servingG) || 100, kcal: Number(food.kcal) || 0, protein: Number(food.protein) || 0, carb: Number(food.carb) || 0, fat: Number(food.fat) || 0, fiber: Number(food.fiber) || 0 },
    });
    setFood({ name: '', brand: '', servingG: '100', kcal: '', protein: '', carb: '', fat: '', fiber: '' });
  }
  function download() {
    const blob = exportBackup(persisted);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `FTX-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const persistedState = await importBackup(file);
      dispatch({ type: 'IMPORT_STATE', persisted: persistedState });
    } catch { window.alert('Geçersiz yedek dosyası'); }
  }
  function resetAll() {
    if (window.confirm('Tüm kayıtlar silinecek. Emin misin?')) dispatch({ type: 'RESET_STATE' });
  }

  return (
    <div className="stack">
      <Card>
        <h2>Hedefler</h2>
        <div className="grid g2">
          {TARGET_FIELDS.map(([k, label]) => (
            <div key={k}><label>{label}</label><input type="number" value={targets[k]} onChange={(e) => setTargets((t) => ({ ...t, [k]: e.target.value }))} /></div>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={saveTargets}>Hedefleri kaydet</button>
      </Card>
      <Card>
        <h2>Yeni özel besin</h2>
        <div className="grid g2">
          <div><label>Ad</label><input value={food.name} onChange={(e) => setFood((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><label>Porsiyon (g)</label><input type="number" value={food.servingG} onChange={(e) => setFood((f) => ({ ...f, servingG: e.target.value }))} /></div>
          <div><label>Kalori /100g</label><input type="number" value={food.kcal} onChange={(e) => setFood((f) => ({ ...f, kcal: e.target.value }))} /></div>
          <div><label>Protein /100g</label><input type="number" value={food.protein} onChange={(e) => setFood((f) => ({ ...f, protein: e.target.value }))} /></div>
          <div><label>Karbonhidrat /100g</label><input type="number" value={food.carb} onChange={(e) => setFood((f) => ({ ...f, carb: e.target.value }))} /></div>
          <div><label>Yağ /100g</label><input type="number" value={food.fat} onChange={(e) => setFood((f) => ({ ...f, fat: e.target.value }))} /></div>
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={addFood}>Besini ekle</button>
      </Card>
      <Card>
        <h2>Yedekleme</h2>
        <div className="row">
          <button className="btn secondary" onClick={download}>JSON yedeği indir</button>
          <div><label>Yedeği geri yükle</label><input type="file" accept="application/json" ref={fileRef} onChange={upload} /></div>
          <button className="btn danger" onClick={resetAll}>Tüm veriyi sıfırla</button>
        </div>
      </Card>
    </div>
  );
}
