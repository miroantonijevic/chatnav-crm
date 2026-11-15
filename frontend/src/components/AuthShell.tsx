/**
 * Shared shell for the login / change-password screens, plus a password input
 * with a show/hide toggle.
 */
import React, { useState } from 'react';
import './AuthShell.css';

export const AuthShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="auth">
    <aside className="auth-brand" aria-hidden="true">
      <div className="auth-brand-inner">
        <span className="brand-mark auth-mark">C</span>
        <h2>Keep every relationship moving.</h2>
        <p>Track contacts and companies, never miss a follow-up, and see your hottest deals at a glance.</p>
        <ul>
          <li>🔥 Hot leads you can act on</li>
          <li>⏰ Follow-up reminders by email</li>
          <li>📈 Team activity at a glance</li>
        </ul>
      </div>
    </aside>

    <main className="auth-panel">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-mark">C</span>
          <span>CRM</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
      </div>
    </main>
  </div>
);

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ id, value, onChange, ...rest }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      <button
        type="button"
        className="input-addon auth-eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
};
