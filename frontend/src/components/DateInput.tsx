/**
 * Date input that always shows dd.mm.yyyy (Croatian format), independent of the
 * browser locale. Type the date (dots are inserted for you) or pick it from the
 * calendar. Value is "YYYY-MM-DD" or ''.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from './Calendar';
import { Popover } from './Popover';
import { hrToIso, isoToHr, maskHrDate } from '../utils/dates';
import './Pickers.css';

interface DateInputProps {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
}

export const CalendarIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, id, className = '', disabled, required, ...aria }) => {
  const [text, setText] = useState(isoToHr(value));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Follow external value changes (e.g. picked in the calendar, form reset)
  useEffect(() => {
    setText((prev) => (hrToIso(prev) === value ? prev : isoToHr(value)));
  }, [value]);

  const invalid = text.length === 10 && hrToIso(text) === null;

  const handleText = (raw: string) => {
    // Let the user delete freely: only re-mask when characters were added
    const masked = raw.length < text.length ? raw.replace(/[^\d.]/g, '') : maskHrDate(raw);
    setText(masked);
    if (masked === '') {
      if (value !== '') onChange('');
      return;
    }
    const iso = hrToIso(masked);
    if (iso && masked.length === 10 && iso !== value) onChange(iso);
  };

  const handleBlur = () => {
    const iso = hrToIso(text);
    if (iso) {
      setText(isoToHr(iso));
      if (iso !== value) onChange(iso);
    } else {
      setText(isoToHr(value)); // revert unfinished / invalid input
    }
  };

  return (
    <div className={`pk-field ${invalid ? 'pk-invalid' : ''}`} ref={wrapRef}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd.mm.gggg"
        maxLength={10}
        className={className}
        value={text}
        disabled={disabled}
        required={required}
        onChange={(e) => handleText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !disabled) {
            e.preventDefault();
            setAnchor(wrapRef.current);
          }
        }}
        {...aria}
      />
      <button
        type="button"
        className="pk-icon-btn"
        disabled={disabled}
        aria-label="Otvori kalendar"
        title="Otvori kalendar"
        onClick={() => setAnchor(anchor ? null : wrapRef.current)}
      >
        <CalendarIcon />
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pk-popover">
          <Calendar
            value={value}
            onSelect={(iso) => {
              setAnchor(null);
              setText(isoToHr(iso));
              onChange(iso);
            }}
            onClear={
              required
                ? undefined
                : () => {
                    setAnchor(null);
                    setText('');
                    onChange('');
                  }
            }
          />
        </Popover>
      )}
    </div>
  );
};
