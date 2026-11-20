/**
 * Small presentational building blocks shared by all pages.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Popover } from './Popover';
import { STATUS_LABELS, initials } from '../utils/pipeline';

// ── Avatar / person ───────────────────────────────────────────────────

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; title?: string }> = ({ name, size = 'md', title }) => (
  <span className={`avatar${size === 'md' ? '' : ` avatar-${size}`}`} title={title ?? name}>{initials(name)}</span>
);

export const Person: React.FC<{ name: string; title?: string; firstNameOnly?: boolean }> = ({ name, title, firstNameOnly }) => (
  <span className="person" title={title ?? name}>
    <Avatar name={name} size="sm" />
    <span className="person-name">{firstNameOnly ? name.split(' ')[0] : name}</span>
  </span>
);

// ── Relationship status badge ─────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  new: '',
  contacted: 'badge-info',
  'follow-up-needed': 'badge-warn',
  interested: 'badge-purple',
  'not-interested': 'badge-danger',
  customer: 'badge-ok',
  inactive: '',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`badge badge-dot ${STATUS_TONE[status] ?? ''}`}>{STATUS_LABELS[status] ?? status}</span>
);

// ── Search box ────────────────────────────────────────────────────────

export const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  label?: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ value, onChange, placeholder = 'Search…', inputRef, label = 'Search' }) => (
  <div className="search">
    <span className="search-icon"><SearchIcon /></span>
    <input ref={inputRef} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    {value && (
      <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">×</button>
    )}
  </div>
);

// ── Empty / loading states ────────────────────────────────────────────

interface EmptyProps {
  icon?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyProps> = ({ icon, title, children, action, compact }) => (
  <div className={`empty${compact ? ' empty-compact' : ''}`}>
    {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
    <h2>{title}</h2>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const PageLoading: React.FC = () => (
  <div className="page-loading" role="status" aria-label="Loading">
    <span className="spinner" />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="card skeleton-rows" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i}><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
    ))}
  </div>
);

export const Alert: React.FC<{ tone?: 'error' | 'success' | 'warn' | 'info'; children: React.ReactNode; onClose?: () => void }> = ({ tone = 'error', children, onClose }) => (
  <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span>{children}</span>
    {onClose && <button type="button" onClick={onClose} aria-label="Dismiss">×</button>}
  </div>
);

// ── Row actions menu (kebab) ──────────────────────────────────────────

export interface MenuAction {
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export const RowMenu: React.FC<{ actions: MenuAction[]; label?: string }> = ({ actions, label = 'More actions' }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label={label}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="menu" align="right">
          {visible.map((a, i) =>
            a.to ? (
              <Link key={i} to={a.to} role="menuitem" className={`menu-item${a.danger ? ' menu-item-danger' : ''}`} onClick={() => setAnchor(null)}>
                {a.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={`menu-item${a.danger ? ' menu-item-danger' : ''}`}
                onClick={() => {
                  setAnchor(null);
                  a.onClick?.();
                }}
              >
                {a.label}
              </button>
            )
          )}
        </Popover>
      )}
    </>
  );
};
