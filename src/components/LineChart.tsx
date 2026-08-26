import React from 'react';

interface Series { values: (number | null)[]; color: string; label?: string; }
interface Props { series: Series[]; labels?: string[]; height?: number; emptyText?: string; }

/** No canvas, no chart library dependency (none is in package.json) — a
 * small inline SVG polyline chart. Handles multiple series, null gaps. */
export function LineChart({ series, labels, height = 160, emptyText = 'Grafik için en az 2 kayıt gerekli.' }: Props) {
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (n < 2) return <div className="muted small" style={{ padding: '20px 4px' }}>{emptyText}</div>;

  const W = 100; // percentage-based viewBox, scales with container width
  const H = height;
  const padL = 8, padR = 2, padT = 6, padB = 14;
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  let min = Math.min(...allValues), max = Math.max(...allValues);
  const pad = Math.max(0.5, (max - min) * 0.12);
  min -= pad; max += pad;
  const x = (i: number) => padL + ((W - padL - padR) * i) / (n - 1);
  const y = (v: number) => padT + ((H - padT - padB) * (max - v)) / (max - min || 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" className="line-chart">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + ((H - padT - padB) * i) / 3} y2={padT + ((H - padT - padB) * i) / 3} stroke="#e7ebf1" strokeWidth={0.3} />
      ))}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter((p): p is string => p != null);
        return <polyline key={si} points={points.join(' ')} fill="none" stroke={s.color} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
      })}
      {series.map((s, si) => s.values.map((v, i) => v == null ? null : (
        <circle key={`${si}-${i}`} cx={x(i)} cy={y(v)} r={0.9} fill={s.color} />
      )))}
    </svg>
  );
}

export function LineChartLegend({ series }: { series: Series[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
      {series.filter((s) => s.label).map((s, i) => (
        <span key={i} className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: 'inline-block' }} />{s.label}
        </span>
      ))}
    </div>
  );
}
