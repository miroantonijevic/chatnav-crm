/**
 * Contact detail/edit page
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { contactApi, userApi } from '../api';
import { Contact, ContactCreate, HistoryEntry, HistoryCreate, RelationshipStatus, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Contacts.css';

const ENTRY_TYPE_LABEL: Record<string, string> = {
  created: 'Contact created',
  edited: 'Contact edited',
  interaction: 'Interaction logged',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'follow-up-needed': 'Follow-up needed',
  interested: 'Interested',
  'not-interested': 'Not interested',
  customer: 'Customer',
  inactive: 'Inactive',
};

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [contact, setContact] = useState<Contact | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Log interaction form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState<HistoryCreate>({
    status: RelationshipStatus.CONTACTED,
    note: '',
    interaction_at: new Date().toISOString().slice(0, 16),
    next_contact_due_at: '',
  });
  const [logError, setLogError] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  const [formData, setFormData] = useState<ContactCreate>({
    first_name: '',
    last_name: '',
    company: '',
    job_title: '',
    email: '',
    phone: '',
    notes: '',
    current_relationship_status: RelationshipStatus.NEW,
    reminders_enabled: true,
    owner_user_id: user?.id,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      loadContact();
      loadHistory();
      if (searchParams.get('edit') === 'true') {
        setEditing(true);
      }
    } else {
      setEditing(true);
      setLoading(false);
    }
  }, [id, searchParams]);

  const loadUsers = async () => {
    try {
      const data = await userApi.list();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    }
  };

  const loadContact = async () => {
    if (!id || id === 'new') return;
    try {
      const data = await contactApi.get(parseInt(id));
      setContact(data);
      setFormData({
        first_name: data.first_name,
        last_name: data.last_name,
        company: data.company || '',
        job_title: data.job_title || '',
        email: data.email || '',
        phone: data.phone || '',
        notes: data.notes || '',
        current_relationship_status: data.current_relationship_status,
        last_contacted_at: data.last_contacted_at,
        next_contact_due_at: data.next_contact_due_at,
        reminders_enabled: data.reminders_enabled,
        owner_user_id: data.owner_user_id,
      });
      // Pre-fill log form status from current contact status
      setLogFormData((prev: HistoryCreate) => ({ ...prev, status: data.current_relationship_status }));
    } catch (err: any) {
      setError(err.message || 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!id || id === 'new') return;
    try {
      const data = await contactApi.getHistory(parseInt(id));
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (id === 'new') {
        await contactApi.create(formData);
        navigate('/contacts');
      } else {
        await contactApi.update(parseInt(id!), formData);
        setEditing(false);
        await loadContact();
        await loadHistory();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save contact');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await contactApi.delete(parseInt(id!));
      navigate('/contacts');
    } catch (err: any) {
      setError(err.message || 'Failed to delete contact');
    }
  };

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    setLogSaving(true);
    try {
      await contactApi.addHistory(parseInt(id!), {
        ...logFormData,
        interaction_at: new Date(logFormData.interaction_at).toISOString(),
        next_contact_due_at: logFormData.next_contact_due_at
          ? new Date(logFormData.next_contact_due_at).toISOString()
          : undefined,
      });
      setShowLogForm(false);
      setLogFormData({
        status: RelationshipStatus.CONTACTED,
        note: '',
        interaction_at: new Date().toISOString().slice(0, 16),
        next_contact_due_at: '',
      });
      // Reload both contact (status/date may have changed) and history
      await loadContact();
      await loadHistory();
    } catch (err: any) {
      setLogError(err.message || 'Failed to log interaction');
    } finally {
      setLogSaving(false);
    }
  };

  const canDelete = user?.role === 'admin' || (contact && user?.id === contact.owner_user_id);
  const isNewContact = id === 'new';

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading contact...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="contact-detail">
        <div className="page-header">
          <h1>{isNewContact ? 'New Contact' : editing ? 'Edit Contact' : 'Contact Details'}</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {editing ? (
              <>
                <button type="submit" form="contact-form" className="btn-primary-inline">
                  {isNewContact ? 'Create Contact' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => (isNewContact ? navigate('/contacts') : setEditing(false))}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                {!isNewContact && canDelete && (
                  <button type="button" onClick={handleDelete} className="btn-danger">
                    Delete
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/contacts" className="btn-secondary">Back to Contacts</Link>
                <button onClick={() => setEditing(true)} className="btn-primary-inline">Edit</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {editing ? (
          <form id="contact-form" onSubmit={handleSubmit} className="contact-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="owner_user_id">Contact Owner *</label>
                <select
                  id="owner_user_id"
                  value={formData.owner_user_id || ''}
                  onChange={(e) => setFormData({ ...formData, owner_user_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select an owner...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="status">Relationship Status</label>
                <select
                  id="status"
                  value={formData.current_relationship_status}
                  onChange={(e) =>
                    setFormData({ ...formData, current_relationship_status: e.target.value as RelationshipStatus })
                  }
                >
                  {Object.values(RelationshipStatus).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="job_title">Job Title</label>
                <input
                  id="job_title"
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="next_contact_due_at">Next Follow-up Date</label>
              <input
                id="next_contact_due_at"
                type="datetime-local"
                value={
                  formData.next_contact_due_at
                    ? new Date(formData.next_contact_due_at).toISOString().slice(0, 16)
                    : ''
                }
                onChange={(e) => setFormData({ ...formData, next_contact_due_at: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={5}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.reminders_enabled}
                  onChange={(e) => setFormData({ ...formData, reminders_enabled: e.target.checked })}
                />
                Enable reminders for this contact
              </label>
            </div>
          </form>
        ) : (
          <>
            {/* Contact info card */}
            <div className="contact-info">
              <div className="info-section">
                <h2>Contact Information</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <span>{contact?.first_name} {contact?.last_name}</span>
                  </div>
                  <div className="info-item">
                    <label>Company</label>
                    <span>{contact?.company || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Job Title</label>
                    <span>{contact?.job_title || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Contact Owner</label>
                    <span className="owner-info" title={contact?.owner_email}>
                      {contact?.owner_full_name}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Created By</label>
                    <span className="owner-info" title={contact?.created_by_email}>
                      {contact?.created_by_full_name}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <span>{contact?.email || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Phone</label>
                    <span>{contact?.phone || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Status</label>
                    <span className="status-badge">{STATUS_LABELS[contact?.current_relationship_status ?? ''] ?? contact?.current_relationship_status}</span>
                  </div>
                  <div className="info-item">
                    <label>Next Follow-up</label>
                    <span>
                      {contact?.next_contact_due_at
                        ? new Date(contact.next_contact_due_at).toLocaleString()
                        : '-'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Reminders</label>
                    <span>{contact?.reminders_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              {contact?.notes && (
                <div className="info-section">
                  <h2>Notes</h2>
                  <p className="notes-content">{contact.notes}</p>
                </div>
              )}
            </div>

            {/* Timeline section */}
            <div className="timeline-section">
              <div className="timeline-section-header">
                <h2>Activity Timeline</h2>
                <button
                  className="btn-primary-inline"
                  onClick={() => {
                    setLogFormData({
                      status: contact?.current_relationship_status ?? RelationshipStatus.CONTACTED,
                      note: '',
                      interaction_at: new Date().toISOString().slice(0, 16),
                      next_contact_due_at: '',
                    });
                    setLogError('');
                    setShowLogForm((v: boolean) => !v);
                  }}
                >
                  {showLogForm ? 'Cancel' : '+ Log Interaction'}
                </button>
              </div>

              {showLogForm && (
                <form className="log-interaction-form" onSubmit={handleLogInteraction}>
                  {logError && <div className="error-message">{logError}</div>}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="log_status">Status after interaction</label>
                      <select
                        id="log_status"
                        value={logFormData.status}
                        onChange={(e) =>
                          setLogFormData({ ...logFormData, status: e.target.value as RelationshipStatus })
                        }
                      >
                        {Object.values(RelationshipStatus).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="log_date">Interaction date</label>
                      <input
                        id="log_date"
                        type="datetime-local"
                        value={logFormData.interaction_at}
                        onChange={(e) => setLogFormData({ ...logFormData, interaction_at: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="log_followup">Next follow-up date (optional — updates the contact)</label>
                    <input
                      id="log_followup"
                      type="datetime-local"
                      value={logFormData.next_contact_due_at ?? ''}
                      onChange={(e) => setLogFormData({ ...logFormData, next_contact_due_at: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="log_note">Note</label>
                    <textarea
                      id="log_note"
                      value={logFormData.note ?? ''}
                      onChange={(e) => setLogFormData({ ...logFormData, note: e.target.value })}
                      placeholder="What happened? e.g. Had a call, sent proposal, met at conference..."
                      rows={3}
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary-inline" disabled={logSaving}>
                      {logSaving ? 'Saving...' : 'Save Interaction'}
                    </button>
                  </div>
                </form>
              )}

              {history.length === 0 ? (
                <p className="empty-message">No activity yet.</p>
              ) : (
                <div className="timeline">
                  {history.map((entry) => (
                    <div key={entry.id} className={`timeline-item entry-${entry.entry_type}`}>
                      <div className="timeline-header">
                        <span className="timeline-type">{ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}</span>
                        <span className="timeline-separator">·</span>
                        <span className="timeline-date">
                          {new Date(entry.interaction_at).toLocaleString()}
                        </span>
                        <span className="timeline-separator">·</span>
                        <span className="timeline-by">by {entry.changed_by_full_name}</span>
                      </div>

                      <span className="timeline-status">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>

                      {entry.note && (
                        <p className="timeline-note">{entry.note}</p>
                      )}

                      {entry.next_contact_due_at && (
                        <p className="timeline-followup">
                          Next follow-up: {new Date(entry.next_contact_due_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};
