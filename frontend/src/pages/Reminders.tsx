/**
 * Reminders page (admin only)
 */
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { reminderApi } from '../api';
import { ReminderStats } from '../types';
import './Reminders.css';

export const RemindersPage: React.FC = () => {
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await reminderApi.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reminder stats');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCheck = async () => {
    setChecking(true);
    setMessage('');
    setError('');

    try {
      const result = await reminderApi.triggerCheck();
      setMessage(JSON.stringify(result, null, 2));
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger reminder check');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading reminders...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="reminders-page">
        <h1>Reminders & Settings</h1>

        {error && <div className="error-message">{error}</div>}
        {message && (
          <div className="success-message">
            <pre>{message}</pre>
          </div>
        )}

        <div className="stats-section">
          <h2>Current Status</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Reminders Enabled</h3>
              <div className="stat-value">
                {stats?.reminders_enabled ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="stat-card">
              <h3>Check Interval</h3>
              <div className="stat-value">{stats?.check_interval_minutes || 0}</div>
              <p>Minutes</p>
            </div>

            <div className="stat-card">
              <h3>Due Now</h3>
              <div className="stat-value">{stats?.due_now || 0}</div>
              <p>Contacts</p>
            </div>

            <div className="stat-card">
              <h3>Upcoming (7 days)</h3>
              <div className="stat-value">{stats?.upcoming_7_days || 0}</div>
              <p>Contacts</p>
            </div>
          </div>
        </div>

        <div className="actions-section">
          <h2>Manual Actions</h2>
          <p>
            Trigger a manual reminder check. This will send email notifications for all due
            contacts that haven't been notified yet.
          </p>
          <button
            onClick={handleTriggerCheck}
            disabled={checking}
            className="btn-primary-inline"
          >
            {checking ? 'Checking...' : 'Trigger Reminder Check'}
          </button>
        </div>

        <div className="info-section">
          <h2>How Reminders Work</h2>
          <ul>
            <li>The system automatically checks for due contacts at the configured interval.</li>
            <li>
              When a contact's "Next Follow-up Date" is reached or passed, a reminder is sent.
            </li>
            <li>Reminders are sent to the contact owner and all admin users.</li>
            <li>Each contact is only reminded once per due date to prevent spam.</li>
            <li>You can disable reminders per contact or globally in settings.</li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
};
