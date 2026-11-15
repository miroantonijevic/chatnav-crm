/**
 * Dashboard
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { companyApi, contactApi, dashboardApi, reminderApi } from '../api';
import { ActivityStats, Company, Contact, EntityStats, ReminderStats, RelationshipStatus } from '../types';
import { HotListWidget } from '../components/HotListWidget';
import { ContactedModal } from '../components/PipelineDialogs';
import { FollowUpBadge } from '../components/EntityBits';
import { Avatar, EmptyState, PageLoading, Person, StatusBadge } from '../components/ui';
import { STATUS_LABELS, detailPath } from '../utils/pipeline';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import '../styles/dashboard.css';

const ACTIVITY_RANGES = [7, 14, 30, 60, 90];

/** "YYYY-MM-DD" bucket as "DD.MM." */
const formatBucket = (value: string): string => {
  const [, month, day] = value.split('-');
  return `${day}.${month}.`;
};

const STATUS_COLORS: Record<string, string> = {
  new: '#98a2b3',
  contacted: '#2e90fa',
  'follow-up-needed': '#f79009',
  interested: '#7a5af8',
  'not-interested': '#f04438',
  customer: '#12b76a',
  inactive: '#d0d5dd',
};

interface AttentionItem {
  type: 'contact' | 'company';
  id: number;
  name: string;
  sub: string;
  status: RelationshipStatus;
  due: string;
  owner: string;
  next_action?: string | null;
}

function toAttention(contacts: Contact[], companies: Company[]): AttentionItem[] {
  const items: AttentionItem[] = [
    ...contacts.map((c) => ({
      type: 'contact' as const,
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      sub: c.company_name || c.job_title || 'Contact',
      status: c.current_relationship_status,
      due: c.next_contact_due_at ?? '',
      owner: c.owner_full_name,
      next_action: c.next_action,
    })),
    ...companies.map((c) => ({
      type: 'company' as const,
      id: c.id,
      name: c.name,
      sub: c.industry || 'Company',
      status: c.current_relationship_status,
      due: c.next_contact_due_at ?? '',
      owner: c.owner_full_name,
      next_action: c.next_action,
    })),
  ];
  return items.filter((i) => i.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 10);
}

const StatusBreakdown: React.FC<{ title: string; stats: EntityStats; to: string }> = ({ title, stats, to }) => {
  const total = Object.values(stats.by_status).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <strong>{title}</strong>
        <Link to={to}>{stats.total} total →</Link>
      </div>
      <div className="breakdown-bar" role="img" aria-label={`${title} by status`}>
        {Object.values(RelationshipStatus).map((s) => {
          const n = stats.by_status[s] ?? 0;
          return n > 0 ? <span key={s} style={{ width: `${(n / total) * 100}%`, background: STATUS_COLORS[s] }} title={`${STATUS_LABELS[s]}: ${n}`} /> : null;
        })}
      </div>
      <ul className="breakdown-legend">
        {Object.values(RelationshipStatus).map((s) => (
          <li key={s}><i style={{ background: STATUS_COLORS[s] }} />{STATUS_LABELS[s]} <b>{stats.by_status[s] ?? 0}</b></li>
        ))}
      </ul>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const toast = useToast();

  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [reminders, setReminders] = useState<ReminderStats | null>(null);
  const [contactStats, setContactStats] = useState<EntityStats | null>(null);
  const [companyStats, setCompanyStats] = useState<EntityStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [days, setDays] = useState(30);
  const [activityLoading, setActivityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logItem, setLogItem] = useState<AttentionItem | null>(null);
  useScrollRestoration('scroll:dashboard', !loading);

  const loadData = useCallback(async () => {
    try {
      const [dueContacts, dueCompanies, stats, cStats, coStats] = await Promise.all([
        contactApi.list({ due_only: true, limit: 10, sort_by: 'next_contact_due_at' }),
        companyApi.list({ due_only: true, limit: 10, sort_by: 'next_contact_due_at' }),
        reminderApi.getStats(),
        contactApi.getStats(),
        companyApi.getStats(),
      ]);
      setAttention(toAttention(dueContacts.items, dueCompanies.items));
      setReminders(stats);
      setContactStats(cStats);
      setCompanyStats(coStats);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    dashboardApi
      .getActivity(days)
      .then((data) => !cancelled && setActivity(data))
      .catch((err) => console.error('Failed to load activity stats:', err))
      .finally(() => !cancelled && setActivityLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const dueNow = (reminders?.due_now ?? 0) + (reminders?.companies_due_now ?? 0);
  const upcoming = (reminders?.upcoming_7_days ?? 0) + (reminders?.companies_upcoming_7_days ?? 0);
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const today = useMemo(
    () => new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );

  if (loading) {
    return (
      <MainLayout>
        <PageLoading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Welcome back{firstName ? `, ${firstName}` : ''} 👋</h1>
            <p className="page-sub">{today}</p>
          </div>
          <div className="page-actions">
            <Link to="/contacts/new" className="btn">+ Contact</Link>
            <Link to="/companies/new" className="btn">+ Company</Link>
            <Link to="/pipeline" className="btn btn-primary">Open pipeline</Link>
          </div>
        </div>

        <div className="kpi-grid">
          <Link to="/pipeline?due=overdue" className={`kpi${dueNow > 0 ? ' kpi-alert' : ''}`}>
            <span className="kpi-icon">⏰</span>
            <span className="kpi-value">{dueNow}</span>
            <span className="kpi-label">Follow-ups due</span>
          </Link>
          <Link to="/pipeline?due=week" className="kpi">
            <span className="kpi-icon">📅</span>
            <span className="kpi-value">{upcoming}</span>
            <span className="kpi-label">Coming up in 7 days</span>
          </Link>
          <Link to="/contacts" className="kpi">
            <span className="kpi-icon">👤</span>
            <span className="kpi-value">{contactStats?.total ?? 0}</span>
            <span className="kpi-label">Contacts</span>
          </Link>
          <Link to="/companies" className="kpi">
            <span className="kpi-icon">🏢</span>
            <span className="kpi-value">{companyStats?.total ?? 0}</span>
            <span className="kpi-label">Companies</span>
          </Link>
        </div>

        <HotListWidget />

        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <p className="card-sub">Follow-ups that are due or overdue</p>
            </div>
            {attention.length > 0 && <Link to="/pipeline?due=overdue" className="btn btn-sm">View in pipeline</Link>}
          </div>
          {attention.length === 0 ? (
            <div className="card-body">
              <EmptyState compact icon="🎉" title="You are all caught up">No overdue or due follow-ups right now. Great job!</EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Status</th><th>Follow-up</th><th>Next action</th><th>Owner</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {attention.map((i) => (
                    <tr key={`${i.type}-${i.id}`}>
                      <td>
                        <div className="name-cell">
                          <span className={`pl-type pl-type-${i.type}`}>{i.type === 'company' ? 'Company' : 'Contact'}</span>
                          <Link to={detailPath(i.type, i.id)} className="row-link">{i.name}</Link>
                        </div>
                        <div className="cell-sub">{i.sub}</div>
                      </td>
                      <td><StatusBadge status={i.status} /></td>
                      <td><FollowUpBadge value={i.due} /></td>
                      <td className="cell-clamp">{i.next_action || <span className="faint">—</span>}</td>
                      <td><Person name={i.owner} firstNameOnly /></td>
                      <td className="right"><button type="button" className="btn btn-sm" onClick={() => setLogItem(i)}>✓ Contacted</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {contactStats && companyStats && (
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-head"><h2>Relationships by status</h2></div>
            <div className="card-body breakdown-grid">
              <StatusBreakdown title="Contacts" stats={contactStats} to="/contacts" />
              <StatusBreakdown title="Companies" stats={companyStats} to="/companies" />
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Team activity</h2>
              <p className="card-sub">Entries created, edited and logged over the last {days} days</p>
            </div>
            <div className="segment" role="group" aria-label="Time range">
              {ACTIVITY_RANGES.map((d) => (
                <button key={d} type="button" className={d === days ? 'active' : ''} onClick={() => setDays(d)}>{d}d</button>
              ))}
            </div>
          </div>
          <div className={`card-body${activityLoading ? ' is-refreshing' : ''}`}>
            {activity && (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={activity.by_day} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
                    <XAxis dataKey="date" tickFormatter={formatBucket} interval={Math.max(0, Math.floor(activity.by_day.length / 8) - 1)} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(v) => formatBucket(String(v))} formatter={(v) => [v, 'Activities']} cursor={{ fill: '#f1f3ff' }} />
                    <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {activity.by_user.length > 0 && (
                  <div className="activity-users">
                    {activity.by_user.map((u) => (
                      <div className="activity-user" key={u.user_id}>
                        <div className="activity-user-head">
                          <Avatar name={u.user_name} size="sm" />
                          <strong>{u.user_name}</strong>
                          <span className="badge badge-brand">{u.total}</span>
                        </div>
                        <div className="activity-user-counts">
                          <span><b>{u.created}</b> created</span>
                          <span><b>{u.edited}</b> edited</span>
                          <span><b>{u.interactions}</b> interactions</span>
                        </div>
                        <ResponsiveContainer width="100%" height={56}>
                          <BarChart data={u.by_day}>
                            <XAxis dataKey="date" hide />
                            <YAxis hide allowDecimals={false} />
                            <Tooltip labelFormatter={(v) => formatBucket(String(v))} formatter={(v) => [v, 'Activities']} />
                            <Bar dataKey="count" fill="#9b8afb" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {logItem && (
        <ContactedModal
          item={{ entity_type: logItem.type, id: logItem.id, name: logItem.name, status: logItem.status, next_action: logItem.next_action }}
          onClose={() => setLogItem(null)}
          onSaved={() => {
            toast(`Logged contact with ${logItem.name}`);
            setLogItem(null);
            loadData();
          }}
        />
      )}
    </MainLayout>
  );
};
