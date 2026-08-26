import React, { useState } from 'react';
import { useStore, dateKey } from '../../state/StoreProvider';
import { Card, fmt } from '../../components/ui';
import { estimateBodyFat } from '../../core/selectors';
import { weightRollingAverage } from '../../core/coachSelectors';
import { LineChart, LineChartLegend } from '../../components/LineChart';

const FIELDS: [string, string, string][] = [
  ['date', 'Tarih', 'date'], ['weight', 'Kilo (kg)', 'number'], ['waist', 'Bel (cm)', 'number'],
  ['neck', 'Boyun (cm)', 'number'], ['chest', 'Göğüs (cm)', 'number'], ['armR', 'Sağ kol (cm)', 'number'],
  ['armL', 'Sol kol (cm)', 'number'], ['thighR', 'Sağ bacak (cm)', 'number'], ['thighL', 'Sol bacak (cm)', 'number'],
  ['note', 'Not', 'text'],
];

export function Measurements() {
  const { state, dispatch } = useStore();
  const { persisted } = state;
  const [draft, setDraft] = useState<Record<string, string>>({ date: dateKey() });
  const rows = [...persisted.measurements].sort((a, b) => b.date.localeCompare(a.date));
  const chronological = [...persisted.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const weightSeries = chronological.map((m) => m.weight);
  const weightAvgSeries = weightRollingAverage(chronological);
  const waistSeries = chronological.map((m) => m.waist);
  const bfSeries = chronological.map((m) => estimateBodyFat({ waist: m.waist, neck: m.neck, heightCm: persisted.profile.heightCm }));

  function save() {
    dispatch({
      type: 'ADD_MEASUREMENT',
      measurement: {
        date: draft.date || dateKey(),
        weight: draft.weight ? Number(draft.weight) : null,
        waist: draft.waist ? Number(draft.waist) : null,
        navel: null,
        neck: draft.neck ? Number(draft.neck) : null,
        chest: draft.chest ? Number(draft.chest) : null,
        armR: draft.armR ? Number(draft.armR) : null,
        armL: draft.armL ? Number(draft.armL) : null,
        thighR: draft.thighR ? Number(draft.thighR) : null,
        thighL: draft.thighL ? Number(draft.thighL) : null,
        note: draft.note || '',
      },
    });
    setDraft({ date: dateKey() });
  }

  return (
    <div className="stack">
      <Card>
        <h2>Yeni ölçüm</h2>
        <div className="grid g4">
          {FIELDS.map(([key, label, type]) => (
            <div key={key}><label>{label}</label><input type={type} value={draft[key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /></div>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={save}>Kaydet</button>
      </Card>
      <Card>
        <h2>Trend</h2>
        <LineChart
          series={[
            { values: weightSeries, color: '#94a3b8', label: 'Kilo (kg)' },
            { values: weightAvgSeries, color: '#2563eb', label: 'Kilo — 7g ortalama' },
            { values: waistSeries, color: '#0ea5a4', label: 'Bel (cm)' },
            { values: bfSeries, color: '#d97706', label: 'Tahmini yağ %' },
          ]}
          height={180}
        />
        <LineChartLegend series={[{ values: [], color: '#94a3b8', label: 'Kilo (kg)' }, { values: [], color: '#2563eb', label: 'Kilo — 7g ortalama' }, { values: [], color: '#0ea5a4', label: 'Bel (cm)' }, { values: [], color: '#d97706', label: 'Tahmini yağ %' }]} />
      </Card>
      <Card>
        <h2>Geçmiş</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="set-table">
            <thead><tr>{['Tarih', 'Kilo', 'Bel', 'Boyun', 'Yağ %', 'Not'].map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const bf = estimateBodyFat({ waist: r.waist, neck: r.neck, heightCm: persisted.profile.heightCm });
                return (
                  <tr key={r.id}>
                    <td>{r.date}</td><td>{r.weight ?? '-'}</td><td>{r.waist ?? '-'}</td><td>{r.neck ?? '-'}</td>
                    <td>{bf == null ? '—' : fmt(bf, 1)}</td><td>{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
