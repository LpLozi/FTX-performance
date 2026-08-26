import React, { useEffect, useState } from 'react';

export interface KeypadTarget { exerciseIndex: number; setIndex: number; field: 'weight' | 'reps' | 'rir'; }

interface Props {
  active: KeypadTarget | null;
  initialValue: string;
  onPreview: (v: string) => void;
  onNext: (v: string) => void;
  onClose: (v: string) => void;
  isLastField: boolean;
}

/**
 * Numeric keypad optimized for iPhone: digits live entirely inside this
 * component. Pressing a number no longer re-renders the workout card or the
 * global store. The parent only gets a lightweight imperative preview and a
 * commit value when Next/Seti tamamla/close is pressed.
 */
export function SetEntryKeypad({ active, initialValue, onPreview, onNext, onClose, isLastField }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [active?.exerciseIndex, active?.setIndex, active?.field, initialValue]);

  if (!active) return null;

  const press = (k: string) => {
    let v = value;
    if (k === '⌫') v = v.slice(0, -1);
    else if (k === ',') {
      if (!v.includes('.')) v += (v ? '' : '0') + '.';
    } else v += k;
    setValue(v);
    onPreview(v);
  };

  const immediate = (fn: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="strong-pad open">
      <div className="strong-pad-inner">
        <div className="strong-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => (
            <button key={k} type="button" onPointerDown={immediate(() => press(k))}>{k}</button>
          ))}
        </div>
        <div className="strong-side">
          <button type="button" className="strong-close" onPointerDown={immediate(() => onClose(value))}>⌄</button>
          <button type="button" className="strong-next" onPointerDown={immediate(() => onNext(value))}>{isLastField ? 'Seti tamamla' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

export function useSetEntryKeypad() {
  const [active, setActive] = useState<KeypadTarget | null>(null);
  return { active, setActive };
}
