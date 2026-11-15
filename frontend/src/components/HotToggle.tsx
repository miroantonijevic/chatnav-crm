/**
 * Hot lead flag: a static badge, and a toggle button (on = hot lead, off = not).
 */
import React from 'react';
import './Pipeline.css';

export const HotBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <span className={`hot-badge hot-badge-${size}`}>
    <span aria-hidden="true">🔥</span> Hot lead
  </span>
);

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** "icon" = just the flame (tables), "button" = labelled button (detail pages) */
  variant?: 'icon' | 'button';
}

export const HotToggle: React.FC<ToggleProps> = ({ value, onChange, disabled, variant = 'icon' }) => {
  const title = value ? 'Hot lead – click to remove' : 'Not a hot lead – click to mark as hot';
  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`hot-btn${value ? ' on' : ''}`}
        disabled={disabled}
        aria-pressed={value}
        title={title}
        onClick={() => onChange(!value)}
      >
        <span aria-hidden="true">🔥</span> {value ? 'Hot lead' : 'Mark as hot lead'}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`hot-flame${value ? ' on' : ''}`}
      disabled={disabled}
      aria-pressed={value}
      aria-label={title}
      title={title}
      onClick={() => onChange(!value)}
    >
      🔥
    </button>
  );
};
