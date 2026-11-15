/**
 * 24-hour time input (HH:mm), independent of the browser locale. Type the time or
 * pick it from the hour / minute lists. Value is "HH:mm" or ''.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Popover } from './Popover';
import { maskTime, normalizeTime } from '../utils/dates';
import './Pickers.css';

interface TimeInputProps {
  value: string;
  onChange: (time: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const ClockIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, id, className = '', disabled, ...aria }) => {
  const [text, setText] = useState(value);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText((prev) => (normalizeTime(prev) === value ? prev : value));
  }, [value]);

  // Scroll the selected hour into view when the list opens
  useEffect(() => {
    if (anchor) hourRef.current?.querySelector('.selected')?.scrollIntoView({ block: 'center' });
  }, [anchor]);

  const [h, m] = (value || '').split(':');

  const handleText = (raw: string) => {
    const masked = raw.length < text.length ? raw.replace(/[^\d:]/g, '') : maskTime(raw);
    setText(masked);
    if (masked.length === 5) {
      const t = normalizeTime(masked);
      if (t && t !== value) onChange(t);
    }
  };

  const handleBlur = () => {
    const t = normalizeTime(text);
    if (t) {
      setText(t);
      if (t !== value) onChange(t);
    } else {
      setText(value);
    }
  };

  const pick = (hour: string, minute: string) => {
    const t = `${hour}:${minute}`;
    setText(t);
    onChange(t);
  };

  return (
    <div className={`pk-field pk-time ${text.length === 5 && !normalizeTime(text) ? 'pk-invalid' : ''}`} ref={wrapRef}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:mm"
        maxLength={5}
        className={className}
        value={text}
        disabled={disabled}
        onChange={(e) => handleText(e.target.value)}
        onBlur={handleBlur}
        {...aria}
      />
      <button
        type="button"
        className="pk-icon-btn"
        disabled={disabled}
        aria-label="Odaberi vrijeme"
        title="Odaberi vrijeme"
        onClick={() => setAnchor(anchor ? null : wrapRef.current)}
      >
        <ClockIcon />
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pk-popover pk-time-pop">
          <div className="pk-time-cols">
            <div className="pk-time-col" ref={hourRef} role="listbox" aria-label="Sati">
              {HOURS.map((hh) => (
                <button key={hh} type="button" className={hh === h ? 'selected' : ''} onClick={() => pick(hh, m || '00')}>
                  {hh}
                </button>
              ))}
            </div>
            <div className="pk-time-col" role="listbox" aria-label="Minute">
              {MINUTES.map((mm) => (
                <button key={mm} type="button" className={mm === m ? 'selected' : ''} onClick={() => pick(h || '09', mm)}>
                  {mm}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
};
