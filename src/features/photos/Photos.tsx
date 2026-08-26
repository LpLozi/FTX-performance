import React, { useEffect, useRef, useState } from 'react';
import { useStore, dateKey } from '../../state/StoreProvider';
import { Card } from '../../components/ui';
import { putPhotoBytes, getPhotoBytes, deletePhotoBytes } from './photoStore';
import type { PhotoMeta } from '../../core/types';

const POSES = ['Ön rahat', 'Ön poz', 'Sağ yan', 'Sol yan', 'Arka', 'Biceps', 'Tam boy'];

function PhotoThumb({ meta, onRemove }: { meta: { id: string; date: string; pose: string }; onRemove: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    getPhotoBytes(meta.id).then((blob) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob);
      revoke = u;
      setUrl(u);
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [meta.id]);
  return (
    <Card className="photo-card">
      {url ? <img src={url} alt={meta.pose} /> : <div className="photo-placeholder">…</div>}
      <strong>{meta.pose}</strong><div className="muted">{meta.date}</div>
      <button className="btn danger small" onClick={() => onRemove(meta.id)}>Sil</button>
    </Card>
  );
}

function usePhotoUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    setUrl(null);
    if (!id) return;
    getPhotoBytes(id).then((blob) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob);
      revoke = u;
      setUrl(u);
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [id]);
  return url;
}

/** Same-pose before/after comparison with a wipe slider (PH1) — two dates
 * chosen from photos that share a pose, overlapped with a draggable clip
 * boundary. ui.photoCompare is pure view state (which two ids are selected);
 * bytes are re-fetched from IndexedDB like any other photo, nothing new is
 * persisted to PersistedState. */
function PhotoCompare({ photos }: { photos: PhotoMeta[] }) {
  const { state, dispatch } = useStore();
  const compare = state.ui.photoCompare;
  const [wipe, setWipe] = useState(50);
  const poses = [...new Set(photos.map((p) => p.pose))];
  const activePose = compare?.pose || poses[0] || '';
  const posePhotos = photos.filter((p) => p.pose === activePose).sort((a, b) => a.date.localeCompare(b.date));

  const urlA = usePhotoUrl(compare?.a ?? null);
  const urlB = usePhotoUrl(compare?.b ?? null);

  function setPose(pose: string) {
    dispatch({ type: 'SET_PHOTO_COMPARE', pose, a: null, b: null });
  }
  function setSide(side: 'a' | 'b', id: string) {
    dispatch({ type: 'SET_PHOTO_COMPARE', pose: activePose, a: side === 'a' ? id : compare?.a ?? null, b: side === 'b' ? id : compare?.b ?? null });
  }

  if (posePhotos.length < 2) {
    return <div className="muted small">Karşılaştırma için aynı pozda en az 2 fotoğraf gerekli.</div>;
  }

  return (
    <div>
      <div className="row">
        <div>
          <label>Poz</label>
          <select value={activePose} onChange={(e) => setPose(e.target.value)}>{poses.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div>
          <label>Önce (A)</label>
          <select value={compare?.a ?? ''} onChange={(e) => setSide('a', e.target.value)}>
            <option value="">Seç</option>
            {posePhotos.map((p) => <option key={p.id} value={p.id}>{p.date}</option>)}
          </select>
        </div>
        <div>
          <label>Sonra (B)</label>
          <select value={compare?.b ?? ''} onChange={(e) => setSide('b', e.target.value)}>
            <option value="">Seç</option>
            {posePhotos.map((p) => <option key={p.id} value={p.id}>{p.date}</option>)}
          </select>
        </div>
      </div>
      {urlA && urlB && (
        <div className="photo-compare-wrap">
          <img src={urlA} alt="Önce" />
          <div className="photo-compare-after" style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}>
            <img src={urlB} alt="Sonra" />
          </div>
          <div className="photo-compare-handle" style={{ left: `${wipe}%` }} />
          <input className="photo-compare-slider" type="range" min={0} max={100} value={wipe} onChange={(e) => setWipe(Number(e.target.value))} />
          <span className="photo-compare-label left">A</span>
          <span className="photo-compare-label right">B</span>
        </div>
      )}
    </div>
  );
}

export function Photos() {
  const { state, dispatch } = useStore();
  const [date, setDate] = useState(dateKey());
  const [pose, setPose] = useState(POSES[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPhoto() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await putPhotoBytes(id, file);
    dispatch({ type: 'ADD_PHOTO_META', meta: { id, date, pose } });
    if (fileRef.current) fileRef.current.value = '';
  }
  async function removePhoto(id: string) {
    await deletePhotoBytes(id);
    dispatch({ type: 'REMOVE_PHOTO_META', id });
  }

  const sorted = [...state.persisted.photoIndex].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="stack">
      <Card>
        <h2>Form fotoğrafı ekle</h2>
        <div className="row">
          <div><label>Tarih</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label>Poz</label><select value={pose} onChange={(e) => setPose(e.target.value)}>{POSES.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label>Fotoğraf</label><input type="file" accept="image/*" ref={fileRef} /></div>
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={addPhoto}>Ekle</button>
        <div className="muted small" style={{ marginTop: 8 }}>Fotoğraflar yalnızca bu cihazda (tarayıcı depolamasında) saklanır.</div>
      </Card>
      <div className="grid photo-grid">
        {sorted.length ? sorted.map((m) => <PhotoThumb key={m.id} meta={m} onRemove={removePhoto} />) : <div className="muted">Henüz fotoğraf yok.</div>}
      </div>
      {sorted.length >= 2 && (
        <Card>
          <h2>Önce/sonra karşılaştırma</h2>
          <PhotoCompare photos={sorted} />
        </Card>
      )}
    </div>
  );
}
