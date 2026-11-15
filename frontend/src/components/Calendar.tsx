/**
 * Inline month calendar with Croatian month / weekday names, weeks starting on Monday.
 * Values are "YYYY-MM-DD" strings (no time zones involved).
 */
import React, { useState } from 'react';
import { HR_MONTHS, HR_WEEKDAYS, isRealDate, todayIso } from '../utils/dates';
import './Pickers.css';

interface CalendarProps {
  value: string; // "YYYY-MM-DD" or ''
  onSelect: (iso: string) => void;
  onClear?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export const Calendar: React.FC<CalendarProps> = ({ value, onSelect, onClear }) => {
  const today = todayIso();
  const seed = /^\d{4}-\d{2}-\d{2}/.test(value) ? value : today;
  const [year, setYear] = useState(Number(seed.slice(0, 4)));
  const [month, setMonth] = useState(Number(seed.slice(5, 7))); // 1-12

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  // Monday-first offset of the 1st of the month
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="pk-cal">
      <div className="pk-cal-head">
        <button type="button" onClick={() => shift(-12)} aria-label="Prethodna godina" title="Prethodna godina">«</button>
        <button type="button" onClick={() => shift(-1)} aria-label="Prethodni mjesec" title="Prethodni mjesec">‹</button>
        <span className="pk-cal-title">{HR_MONTHS[month - 1]} {year}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Sljedeći mjesec" title="Sljedeći mjesec">›</button>
        <button type="button" onClick={() => shift(12)} aria-label="Sljedeća godina" title="Sljedeća godina">»</button>
      </div>

      <div className="pk-cal-grid pk-cal-weekdays">
        {HR_WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>

      <div className="pk-cal-grid">
        {cells.map((d, i) => {
          if (d === null || !isRealDate(year, month, d)) return <span key={`e${i}`} />;
          const iso = toIso(year, month, d);
          const col = (i % 7);
          return (
            <button
              key={iso}
              type="button"
              className={[
                'pk-cal-day',
                iso === value ? 'selected' : '',
                iso === today ? 'today' : '',
                col >= 5 ? 'weekend' : '',
              ].join(' ')}
              onClick={() => onSelect(iso)}
              aria-label={`${d}. ${HR_MONTHS[month - 1]} ${year}`}
              aria-pressed={iso === value}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="pk-cal-foot">
        <button type="button" onClick={() => onSelect(today)}>Danas</button>
        {onClear && value && <button type="button" onClick={onClear} className="pk-cal-clear">Obriši</button>}
      </div>
    </div>
  );
};
