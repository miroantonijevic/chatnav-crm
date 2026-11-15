/**
 * Change password page
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api';
import { AuthShell, PasswordInput } from '../components/AuthShell';
import { Alert } from '../components/ui';
import { usePageTitle } from '../hooks/usePageTitle';

export const ChangePasswordPage: React.FC = () => {
  usePageTitle('Change password');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser, user } = useAuth();
  const navigate = useNavigate();

  const mismatch = confirmPassword !== '' && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Change password" subtitle="Choose a new password of at least 6 characters.">
      {user?.must_change_password && <Alert tone="warn">You must change your password before continuing.</Alert>}
      <form onSubmit={handleSubmit}>
        {error && <Alert tone="error">{error}</Alert>}

        <div className="field">
          <label htmlFor="currentPassword">Current password</label>
          <PasswordInput id="currentPassword" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" required autoFocus />
        </div>

        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <PasswordInput id="newPassword" value={newPassword} onChange={setNewPassword} autoComplete="new-password" required minLength={6} />
        </div>

        <div className={`field${mismatch ? ' invalid' : ''}`}>
          <label htmlFor="confirmPassword">Confirm new password</label>
          <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required minLength={6} />
          {mismatch && <span className="hint hint-warn">Passwords do not match</span>}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? <><span className="spinner" /> Saving…</> : 'Change password'}
        </button>
      </form>
      {!user?.must_change_password && (
        <p className="auth-foot"><Link to="/dashboard">← Back to dashboard</Link></p>
      )}
    </AuthShell>
  );
};
