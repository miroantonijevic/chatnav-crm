/**
 * Dashboard page
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { fromServer, fmtDateTime, localNow, dtDate, dtTime, dtCombine } from '../utils/dates';
import { contactApi, reminderApi } from '../api';
import { Contact, ReminderStats, RelationshipStatus } from '../types';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import './Dashboard.css';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'follow-up-needed': 'Follow-up Needed',
  interested: 'Interested',
  'not-interested': 'Not Interested',
  customer: 'Customer',
  inactive: 'Inactive',
};

export const DashboardPage: React.FC = () => {
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  useScrollRestoration('scroll:dashboard', !loading);
  const [logModal, setLogModal] = useState<{
    id: number;
    name: string;
    currentStatus?: RelationshipStatus;
  } | null>(null);
  const [logForm, setLogForm] = useState({
    status: RelationshipStatus.CONTACTED as string,
    interaction_at: localNow(),
    next_contact_due_at: '',
    note: '',
  });
  const [logSubmitting, setLogSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dueContactsData, stats] = await Promise.all([
        contactApi.list({ due_only: true, limit: 10 }),
        reminderApi.getStats(),
      ]);
      setDueContacts(dueContactsData.items);
      setReminderStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openLogModal = (id: number, name: string, currentStatus?: RelationshipStatus) => {
    setLogModal({ id, name, currentStatus });
    setLogForm({
      status: currentStatus ?? RelationshipStatus.CONTACTED,
      interaction_at: localNow(),
      next_contact_due_at: '',
      note: '',
    });
  };

  const closeLogModal = () => {
    if (logSubmitting) return;
    setLogModal(null);
  };

  const handleLogSubmit = async () => {
    if (!logModal) return;
    setLogSubmitting(true);
    try {
      const interaction_at = dtCombine(
        dtDate(logForm.interaction_at),
        dtTime(logForm.interaction_at),
      );
      const next_contact_due_at = logForm.next_contact_due_at
        ? dtCombine(dtDate(logForm.next_contact_due_at), dtTime(logForm.next_contact_due_at))
        : null;
      const payload = {
        status: logForm.status,
        interaction_at,
        next_contact_due_at,
        note: logForm.note || undefined,
      };
      await contactApi.markContacted(logModal.id, payload);
      setLogModal(null);
      await loadData();
    } catch (error) {
      console.error('Failed to log interaction:', error);
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleMarkContactContacted = (id: number, name: string, currentStatus?: RelationshipStatus) =>
    openLogModal(id, name, currentStatus);

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading dashboard...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="dashboard">
        <h1>Dashboard</h1>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Contacts Due Now</h3>
            <div className="stat-value">{reminderStats?.due_now || 0}</div>
            <p>Contacts needing follow-up</p>
          </div>

          <div className="stat-card">
            <h3>Contacts Upcoming (7 days)</h3>
            <div className="stat-value">{reminderStats?.upcoming_7_days || 0}</div>
            <p>Contacts with upcoming follow-ups</p>
          </div>
        </div>

        {/* Contacts needing attention */}
        <div className="section">
          <div className="section-header">
            <h2>Contacts Needing Attention</h2>
            <Link to="/contacts?due_only=true" className="btn-link">View All</Link>
          </div>

          {dueContacts.length === 0 ? (
            <p className="empty-message">No overdue or due contact follow-ups at this time. Great job!</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Relationship Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.first_name} {contact.last_name}</td>
                      <td>{contact.company_name || '-'}</td>
                      <td>
                        <span className="owner-badge" title={contact.owner_email}>
                          {contact.owner_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="owner-badge" title={contact.created_by_email}>
                          {contact.created_by_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">{contact.current_relationship_status}</span>
                      </td>
                      <td>
                        {contact.next_contact_due_at
                          ? fmtDateTime(fromServer(contact.next_contact_due_at))
                          : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/contacts/${contact.id}`} className="btn-view-small">View</Link>
                          <button
                            className="btn-log-small"
                            onClick={() => handleMarkContactContacted(contact.id, `${contact.first_name} ${contact.last_name}`, contact.current_relationship_status)}
                          >
                            Mark as contacted
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Log interaction modal */}
      {logModal && (
        <div className="modal-overlay" onClick={closeLogModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Mark as Contacted</h3>
            <p className="modal-subtitle">{logModal.name}</p>

            <div className="form-group">
              <label className="modal-label">Status</label>
              <select
                className="modal-select"
                value={logForm.status}
                onChange={(e) => setLogForm(f => ({ ...f, status: e.target.value }))}
                disabled={logSubmitting}
              >
                {Object.values(RelationshipStatus).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="modal-label">Interaction Date</label>
              <div className="datetime-split">
                <input
                  type="date"
                  className="modal-input"
                  value={dtDate(logForm.interaction_at)}
                  onChange={(e) => setLogForm(f => ({ ...f, interaction_at: dtCombine(e.target.value, dtTime(f.interaction_at)) }))}
                  disabled={logSubmitting}
                  required
                />
                <input
                  type="time"
                  className="modal-input"
                  value={dtTime(logForm.interaction_at)}
                  onChange={(e) => setLogForm(f => ({ ...f, interaction_at: dtCombine(dtDate(f.interaction_at), e.target.value) }))}
                  disabled={logSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="modal-label">
                Next Follow-up Date <span className="modal-optional">(optional — leave blank to clear)</span>
              </label>
              <div className="datetime-split">
                <input
                  type="date"
                  className="modal-input"
                  value={dtDate(logForm.next_contact_due_at)}
                  onChange={(e) => setLogForm(f => ({ ...f, next_contact_due_at: dtCombine(e.target.value, dtTime(f.next_contact_due_at)) }))}
                  disabled={logSubmitting}
                />
                <input
                  type="time"
                  className="modal-input"
                  value={dtTime(logForm.next_contact_due_at)}
                  onChange={(e) => setLogForm(f => ({ ...f, next_contact_due_at: dtCombine(dtDate(f.next_contact_due_at), e.target.value) }))}
                  disabled={logSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="modal-label">
                Note <span className="modal-optional">(optional)</span>
              </label>
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder="What was discussed?"
                value={logForm.note}
                onChange={(e) => setLogForm(f => ({ ...f, note: e.target.value }))}
                disabled={logSubmitting}
              />
            </div>

            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={closeLogModal} disabled={logSubmitting}>
                Cancel
              </button>
              <button className="modal-btn-submit" onClick={handleLogSubmit} disabled={logSubmitting}>
                {logSubmitting ? 'Saving...' : 'Mark as Contacted'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
