/**
 * Date + time input in Croatian format (dd.mm.gggg  HH:mm).
 * Value is a local "YYYY-MM-DDTHH:mm" string, or '' when empty - the same shape
 * <input type="datetime-local"> used, so it is a drop-in replacement.
 */
import React, { useEffect, useState } from 'react';
import { DateInput } from './DateInput';
import { TimeInput } from './TimeInput';
import './Pickers.css';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  defaultTime?: string;
  'aria-label'?: string;
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  id,
  className,
  disabled,
  required,
  defaultTime = '09:30',
  ...aria
}) => {
  const date = value ? value.slice(0, 10) : '';
  const [time, setTime] = useState(value ? value.slice(11, 16) : defaultTime);

  useEffect(() => {
    if (value) setTime(value.slice(11, 16));
  }, [value]);

  return (
    <div className="pk-datetime">
      <DateInput
        id={id}
        className={className}
        value={date}
        disabled={disabled}
        required={required}
        onChange={(d) => onChange(d ? `${d}T${time || defaultTime}` : '')}
        {...aria}
      />
      <TimeInput
        className={className}
        value={time}
        disabled={disabled}
        aria-label="Vrijeme"
        onChange={(t) => {
          setTime(t);
          if (date) onChange(`${date}T${t}`);
        }}
      />
    </div>
  );
};
