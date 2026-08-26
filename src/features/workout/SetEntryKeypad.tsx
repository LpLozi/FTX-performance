import React, { useState } from 'react';

interface KeypadTarget { exerciseIndex: number; setIndex: number; field: 'weight' | 'reps' | 'rir'; }

interface Props {
  active: KeypadTarget | null;
  value: string;
  onOpen: (t: KeypadTarget) => void;
  onChange: (v: string) => void;
  onNext: () => void;
  onClose: () => void;
  isLastField: boolean;
}

/** Renders the on-screen numeric keypad. The actual KG/Reps/RIR <input>
 * elements are `readOnly` with `inputMode="none"` (set by SetRow) so the
 * native iOS keyboard never opens — this component is the ONLY thing that
 * writes to those fields. */
export function SetEntryKeypad({ active, value, onChange, onNext, onClose, isLastField }: Props) {
  if (!active) return null;
  const press = (k: string) => {
    let v = value;
    if (k === '⌫') v = v.slice(0, -1);
    else if (k === ',') { if (!v.includes('.')) v += (v ? '' : '0') + '.'; }
    else v += k;
    onChange(v);
  };
  return (
    <div className="strong-pad open">
      <div className="strong-pad-inner">
        <div className="strong-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => (
            <button key={k} type="button" onClick={() => press(k)}>{k}</button>
          ))}
        </div>
        <div className="strong-side">
          <button type="button" className="strong-close" onClick={onClose}>⌄</button>
          <button type="button" className="strong-next" onClick={onNext}>{isLastField ? 'Seti tamamla' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

export function useSetEntryKeypad() {
  const [active, setActive] = useState<KeypadTarget | null>(null);
  const [value, setValue] = useState('');
  return { active, value, setActive, setValue };
}
