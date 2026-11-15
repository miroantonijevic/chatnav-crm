/**
 * Reminders page (admin only)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { reminderApi } from '../api';
import { ReminderStats } from '../types';
import { useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Alert, PageLoading } from '../components/ui';
import '../styles/reminders.css';

interface CheckResult {
  message?: string;
  sent?: number;
  simulated?: number;
  failed?: number;
  skipped?: number;
  errors?: string[];
}

export const RemindersPage: React.FC = () => {
  usePageTitle('Reminders');
  const toast = useToast();
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(await reminderApi.getStats());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load reminder stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const data = (await reminderApi.triggerCheck()) as CheckResult;
      setResult(data);
      toast(data.message || 'Reminder check finished');
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed to run the reminder check', 'error');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <PageLoading />
      </MainLayout>
    );
  }

  const lastErrors = stats?.last_run_errors ?? [];
  const dueTotal = (stats?.due_now ?? 0) + (stats?.companies_due_now ?? 0);
  const upcomingTotal = (stats?.upcoming_7_days ?? 0) + (stats?.companies_upcoming_7_days ?? 0);

  return (
    <MainLayout>
      <div className="page page-narrow">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reminders</h1>
            <p className="page-sub">E-mail notifications when a contact or company follow-up becomes due.</p>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={runCheck} disabled={checking}>
              {checking ? <><span className="spinner" /> Checking…</> : 'Run check now'}
            </button>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {stats && !stats.reminders_enabled && (
          <div style={{ marginBottom: '1rem' }}>
            <Alert tone="warn">Reminders are switched off (<code>REMINDERS_ENABLED=false</code>), so no e-mails are sent automatically.</Alert>
          </div>
        )}

        <div className="reminder-stats">
          <div className="card card-pad rstat">
            <span className="rstat-label">Status</span>
            <span className={`badge badge-dot ${stats?.reminders_enabled ? 'badge-ok' : ''}`}>{stats?.reminders_enabled ? 'Enabled' : 'Disabled'}</span>
            <span className="rstat-sub">Checks every {stats?.check_interval_minutes ?? 0} minutes</span>
          </div>
          <div className="card card-pad rstat">
            <span className="rstat-label">Due now</span>
            <span className={`rstat-value${dueTotal > 0 ? ' danger' : ''}`}>{dueTotal}</span>
            <span className="rstat-sub">{stats?.due_now ?? 0} contacts · {stats?.companies_due_now ?? 0} companies</span>
          </div>
          <div className="card card-pad rstat">
            <span className="rstat-label">Next 7 days</span>
            <span className="rstat-value">{upcomingTotal}</span>
            <span className="rstat-sub">{stats?.upcoming_7_days ?? 0} contacts · {stats?.companies_upcoming_7_days ?? 0} companies</span>
          </div>
        </div>

        <section className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-head"><h2>Last check</h2></div>
          <div className="card-body">
            {!stats?.last_run_at ? (
              <p className="muted">No check has run since the server started. Use “Run check now” to try one.</p>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: '0.9rem' }}>Ran at {stats.last_run_at}</p>
                <div className="run-grid">
                  <div><strong>{stats.last_run_sent ?? 0}</strong><span>sent</span></div>
                  <div><strong>{stats.last_run_simulated ?? 0}</strong><span>simulated (SMTP not configured)</span></div>
                  <div className={(stats.last_run_failed ?? 0) > 0 ? 'bad' : ''}><strong>{stats.last_run_failed ?? 0}</strong><span>failed</span></div>
                </div>
              </>
            )}
            {lastErrors.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <Alert tone="error">
                  <strong>E-mail errors</strong>
                  <ul className="error-list">{lastErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </Alert>
              </div>
            )}
            {result && (
              <div style={{ marginTop: '1rem' }}>
                <Alert tone={(result.failed ?? 0) > 0 ? 'warn' : 'success'}>
                  {result.message} — sent {result.sent ?? 0}
                  {result.simulated ? `, simulated ${result.simulated}` : ''}
                  {result.failed ? `, failed ${result.failed}` : ''}
                  {result.skipped ? `, already notified ${result.skipped}` : ''}.
                </Alert>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>How reminders work</h2></div>
          <ul className="how-list">
            <li>The server checks for due follow-ups on a schedule (see the interval above).</li>
            <li>When a follow-up date is reached, the owner gets one e-mail with the next action, stage and deal value.</li>
            <li>Each follow-up date is reminded only once, so changing the date triggers a new reminder.</li>
            <li>Reminders can be turned off for a single contact or company in its edit form.</li>
            <li>Hot items get a <b>[HOT]</b> prefix in the e-mail subject.</li>
          </ul>
        </section>
      </div>
    </MainLayout>
  );
};
