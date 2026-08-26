import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}
export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="pill">{children}</span>;
}
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="progress"><div style={{ width: `${pct}%` }} /></div>;
}
export function fmt(n: number | null | undefined, digits = 0): string {
  return Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: digits });
}
