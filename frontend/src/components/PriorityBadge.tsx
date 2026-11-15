/**
 * Priority pill (static) and PriorityPicker (click to change, with "remove").
 */
import React, { useState } from 'react';
import { Priority } from '../types';
import { PRIORITY_META, PRIORITY_ORDER } from '../utils/pipeline';
import { Popover } from './Popover';
import './Pipeline.css';

interface BadgeProps {
  value?: Priority | null;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<BadgeProps> = ({ value, size = 'md' }) => {
  if (!value) return null;
  const m = PRIORITY_META[value];
  return (
    <span
      className={`pl-priority pl-priority-${size}`}
      style={{ color: m.color, background: m.bg, borderColor: m.border }}
    >
      <span aria-hidden="true">{m.emoji}</span> {m.label}
    </span>
  );
};

interface PickerProps {
  value?: Priority | null;
  onChange: (value: Priority | null) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/** A priority pill that opens a small menu to pick Hot / Warm / Cold or remove it. */
export const PriorityPicker: React.FC<PickerProps> = ({ value, onChange, disabled, size = 'md' }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const pick = (v: Priority | null) => {
    setAnchor(null);
    if (v !== (value ?? null)) onChange(v);
  };

  return (
    <>
      <button
        type="button"
        className={`pl-priority-trigger${value ? '' : ' pl-priority-empty'}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        title={value ? 'Change priority' : 'Add to pipeline'}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        {value ? <PriorityBadge value={value} size={size} /> : <span className="pl-priority-add">+ Set priority</span>}
        <span className="pl-caret" aria-hidden="true">▾</span>
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pl-menu">
          {PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              className={`pl-menu-item${p === value ? ' active' : ''}`}
              onClick={() => pick(p)}
            >
              <PriorityBadge value={p} size="sm" />
              {p === value && <span className="pl-menu-check">✓</span>}
            </button>
          ))}
          {value && (
            <button type="button" role="menuitem" className="pl-menu-item pl-menu-remove" onClick={() => pick(null)}>
              Remove from pipeline
            </button>
          )}
        </Popover>
      )}
    </>
  );
};
