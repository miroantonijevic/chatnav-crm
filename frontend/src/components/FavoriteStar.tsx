/**
 * Star toggle for the current user's personal favourites.
 */
import React from 'react';
import './Pipeline.css';

interface Props {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const FavoriteStar: React.FC<Props> = ({ value, onToggle, disabled, size = 'md' }) => (
  <button
    type="button"
    className={`pl-star pl-star-${size}${value ? ' on' : ''}`}
    disabled={disabled}
    aria-pressed={value}
    aria-label={value ? 'Ukloni iz favorita' : 'Dodaj u favorite'}
    title={value ? 'Remove from favorites' : 'Add to favorites'}
    onClick={() => onToggle(!value)}
  >
    {value ? '★' : '☆'}
  </button>
);
