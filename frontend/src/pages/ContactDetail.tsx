/**
 * Contact detail/edit page
 */
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { contactApi, userApi, companyApi } from '../api';
import { Contact, ContactCreate, ContactContactDetailCreate, HistoryEntry, HistoryCreate, RelationshipStatus, User, CompanyListItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Contacts.css';
import { fromServer, fmtDateTime, localNow, toInputLocal, dtDate, dtTime, dtCombine } from '../utils/dates';

const ENTRY_TYPE_LABEL: Record<string, string> = {
  created: 'Contact created',
  edited: 'Contact edited',
  interaction: 'Interaction logged',
  marked_contacted: 'Marked as contacted',
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
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Log interaction form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState<HistoryCreate>({
    status: RelationshipStatus.CONTACTED,
    note: '',
    interaction_at: localNow(),
    next_contact_due_at: '',
  });
  const [logError, setLogError] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  const [nameSuggestions, setNameSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<ContactCreate>({
    first_name: '',
    last_name: '',
    company_id: undefined,
    job_title: '',
    notes: '',
    current_relationship_status: RelationshipStatus.NEW,
    reminders_enabled: true,
    owner_user_id: user?.id,
  });

  type DetailRow = { _idx: number; value: string; label: string };
  type DetailsForm = Record<'email' | 'phone', DetailRow[]>;
  const [detailsForm, setDetailsForm] = useState<DetailsForm>({ email: [], phone: [] });
  const [detailCounter, setDetailCounter] = useState(0);

  const handleNameFieldChange = (field: 'first_name' | 'last_name', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (id !== 'new') return;
    if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current);
    if (value.trim().length < 2) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    nameSearchTimer.current = setTimeout(async () => {
      try {
        const results = await contactApi.list({ search: value.trim(), limit: 5 });
        setNameSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        // silently ignore
      }
    }, 300);
  };

  const addDetailRow = (type: 'email' | 'phone') => {
    const idx = detailCounter;
    setDetailCounter((c: number) => c + 1);
    setDetailsForm((prev: DetailsForm) => ({ ...prev, [type]: [...prev[type], { _idx: idx, value: '', label: '' }] }));
  };
  const removeDetailRow = (type: 'email' | 'phone', idx: number) => {
    setDetailsForm((prev: DetailsForm) => ({ ...prev, [type]: prev[type].filter((r: DetailRow) => r._idx !== idx) }));
  };
  const updateDetailRow = (type: 'email' | 'phone', idx: number, field: 'value' | 'label', val: string) => {
    setDetailsForm((prev: DetailsForm) => ({
      ...prev,
      [type]: prev[type].map((r: DetailRow) => r._idx === idx ? { ...r, [field]: val } : r),
    }));
  };

  useEffect(() => {
    loadUsers();
    loadCompanies();
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

  const loadCompanies = async () => {
    try {
      const data = await companyApi.listSimple();
      setCompanies(data);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
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
        company_id: data.company_id,
        job_title: data.job_title || '',
        notes: data.notes || '',
        current_relationship_status: data.current_relationship_status,
        last_contacted_at: data.last_contacted_at ? toInputLocal(data.last_contacted_at) : undefined,
        next_contact_due_at: data.next_contact_due_at ? toInputLocal(data.next_contact_due_at) : undefined,
        reminders_enabled: data.reminders_enabled,
        owner_user_id: data.owner_user_id,
      });
      let counter = 0;
      const toRows = (type: 'email' | 'phone') =>
        data.contact_details.filter((d) => d.type === type).map((d) => ({ _idx: counter++, value: d.value, label: d.label || '' }));
      setDetailsForm({ email: toRows('email'), phone: toRows('phone') });
      setDetailCounter(counter);
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
      const contact_details: ContactContactDetailCreate[] = [
        ...detailsForm.email.filter((r: DetailRow) => r.value).map((r: DetailRow) => ({ type: 'email' as const, value: r.value, label: r.label || undefined })),
        ...detailsForm.phone.filter((r: DetailRow) => r.value).map((r: DetailRow) => ({ type: 'phone' as const, value: r.value, label: r.label || undefined })),
      ];
      const payload = {
        ...formData,
        next_contact_due_at: formData.next_contact_due_at
          ? new Date(formData.next_contact_due_at).toISOString()
          : undefined,
        last_contacted_at: formData.last_contacted_at
          ? new Date(formData.last_contacted_at).toISOString()
          : undefined,
        contact_details,
      };
      if (id === 'new') {
        await contactApi.create(payload);
        navigate('/contacts');
      } else {
        await contactApi.update(parseInt(id!), payload);
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
        interaction_at: localNow(),
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
            <div className="form-row" style={{ position: 'relative' }}>
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleNameFieldChange('first_name', e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleNameFieldChange('last_name', e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                  required
                />
              </div>
              {isNewContact && showSuggestions && (
                <ul className="name-suggestions" style={{ top: '100%' }}>
                  <li className="name-suggestions-header">Existing contacts — select to open instead of creating a duplicate:</li>
                  {nameSuggestions.map((c) => (
                    <li key={c.id} className="name-suggestions-item" onMouseDown={() => navigate(`/contacts/${c.id}`)}>
                      <span className="name-suggestions-name">{c.first_name} {c.last_name}</span>
                      {c.company_name && <span className="name-suggestions-meta">{c.company_name}</span>}
                      <span className="name-suggestions-action">→ Open</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="owner_user_id">Relationship Owner *</label>
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
                <label htmlFor="company_id">Company</label>
                <select
                  id="company_id"
                  value={formData.company_id ?? ''}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">— No company —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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

            {(['email', 'phone'] as const).map((type) => {
              const rows = detailsForm[type];
              const inputType = type === 'email' ? 'email' : 'tel';
              const placeholder = type === 'email' ? 'e.g. john@example.com' : 'e.g. +386 1 234 5678';
              return (
                <div key={type} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#2c3e50' }}>
                      {type === 'email' ? 'Emails' : 'Phones'}
                    </label>
                    <button type="button" onClick={() => addDetailRow(type)} className="btn-primary-inline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                      + Add {type}
                    </button>
                  </div>
                  {rows.length === 0 && <p style={{ color: '#888', fontSize: '0.875rem', margin: 0 }}>No {type}s added yet.</p>}
                  {rows.map((detail: DetailRow) => (
                    <div key={detail._idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input type={inputType} value={detail.value} placeholder={placeholder}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDetailRow(type, detail._idx, 'value', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: '0 0 140px', marginBottom: 0 }}>
                        <input type="text" value={detail.label} placeholder="Label (optional)"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDetailRow(type, detail._idx, 'label', e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeDetailRow(type, detail._idx)}
                        className="btn-remove" style={{ alignSelf: 'center', marginBottom: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="form-group">
              <label htmlFor="next_contact_due_at_date">Next Follow-up Date</label>
              <div className="datetime-split">
                <input
                  id="next_contact_due_at_date"
                  type="date"
                  value={formData.next_contact_due_at ? dtDate(formData.next_contact_due_at) : ''}
                  onChange={(e) => setFormData({ ...formData, next_contact_due_at: dtCombine(e.target.value, formData.next_contact_due_at ? dtTime(formData.next_contact_due_at) : '09:30') })}
                />
                <input
                  type="time"
                  value={formData.next_contact_due_at ? dtTime(formData.next_contact_due_at) : '09:30'}
                  onChange={(e) => {
                    const date = formData.next_contact_due_at ? dtDate(formData.next_contact_due_at) : '';
                    setFormData({ ...formData, next_contact_due_at: date ? dtCombine(date, e.target.value) : '' });
                  }}
                />
              </div>
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

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.reminders_enabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, reminders_enabled: e.target.checked })}
              />
              Enable reminders for this contact
            </label>
          </form>
        ) : (
          <div className="detail-layout">
            {/* Timeline — left/main column */}
            <div className="detail-main">
              <div className="timeline-section">
                <div className="timeline-section-header">
                  <h2>Activity Timeline</h2>
                  <button
                    className="btn-primary-inline"
                    onClick={() => {
                      setLogFormData({
                        status: contact?.current_relationship_status ?? RelationshipStatus.CONTACTED,
                        note: '',
                        interaction_at: localNow(),
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
                        <div className="datetime-split">
                          <input
                            id="log_date"
                            type="date"
                            value={dtDate(logFormData.interaction_at)}
                            onChange={(e) => setLogFormData({ ...logFormData, interaction_at: dtCombine(e.target.value, dtTime(logFormData.interaction_at)) })}
                            required
                          />
                          <input
                            type="time"
                            value={dtTime(logFormData.interaction_at)}
                            onChange={(e) => setLogFormData({ ...logFormData, interaction_at: dtCombine(dtDate(logFormData.interaction_at), e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="log_followup">Next follow-up date (optional — updates the contact)</label>
                      <div className="datetime-split">
                        <input
                          id="log_followup"
                          type="date"
                          value={dtDate(logFormData.next_contact_due_at ?? '')}
                          onChange={(e) => setLogFormData({ ...logFormData, next_contact_due_at: dtCombine(e.target.value, dtTime(logFormData.next_contact_due_at ?? '')) })}
                        />
                        <input
                          type="time"
                          value={dtTime(logFormData.next_contact_due_at ?? '')}
                          onChange={(e) => {
                            const date = dtDate(logFormData.next_contact_due_at ?? '');
                            setLogFormData({ ...logFormData, next_contact_due_at: date ? dtCombine(date, e.target.value) : '' });
                          }}
                        />
                      </div>
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
                    {history.map((entry) => {
                      const recordedAt = fromServer(entry.created_at);
                      const happenedAt = fromServer(entry.interaction_at);
                      const showHappenedOn =
                        entry.entry_type === 'interaction' &&
                        recordedAt.getTime() - happenedAt.getTime() > 5 * 60 * 1000;

                      return (
                        <div key={entry.id} className={`timeline-item entry-${entry.entry_type}`}>
                          <div className="timeline-header">
                            <span className="timeline-type">{ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}</span>
                            <span className="timeline-separator">·</span>
                            <span className="timeline-date">{fmtDateTime(recordedAt)}</span>
                            <span className="timeline-separator">·</span>
                            <span className="timeline-by">by {entry.changed_by_full_name}</span>
                          </div>

                          <span className="timeline-status">
                            {STATUS_LABELS[entry.status] ?? entry.status}
                          </span>

                          {showHappenedOn && (
                            <p className="timeline-happened-on">
                              Happened on: {fmtDateTime(happenedAt)}
                            </p>
                          )}

                          {entry.note && (
                            <p className="timeline-note">{entry.note}</p>
                          )}

                          {entry.next_contact_due_at && (
                            <p className="timeline-followup">
                              Next follow-up: {fmtDateTime(fromServer(entry.next_contact_due_at))}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Info panel — right/sidebar column */}
            <div className="detail-sidebar">
              <div className="contact-info">
                <h2>Contact Information</h2>
                <div className="info-grid">
                    <div className="info-item">
                      <label>Name</label>
                      <span>{contact?.first_name} {contact?.last_name}</span>
                    </div>
                    <div className="info-item">
                      <label>Company</label>
                      <span>{contact?.company_name || '-'}</span>
                    </div>
                    <div className="info-item">
                      <label>Job Title</label>
                      <span>{contact?.job_title || '-'}</span>
                    </div>
                    <div className="info-item">
                      <label>Relationship Owner</label>
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
                    {(['email', 'phone'] as const).map((type) => {
                      const items = contact?.contact_details.filter((d: { type: string }) => d.type === type) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div className="info-item" key={type}>
                          <label>{type === 'email' ? 'Emails' : 'Phones'}</label>
                          <div className="detail-chips">
                            {items.map((d: { id: number; value: string; label?: string }) => (
                              <span className="detail-chip" key={d.id} title={d.label || undefined}>
                                {d.value}{d.label ? <em> ({d.label})</em> : null}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div className="info-item">
                      <label>Status</label>
                      <span className="status-badge">{STATUS_LABELS[contact?.current_relationship_status ?? ''] ?? contact?.current_relationship_status}</span>
                    </div>
                    <div className="info-item">
                      <label>Next Follow-up</label>
                      <span>
                        {contact?.next_contact_due_at
                          ? fmtDateTime(fromServer(contact.next_contact_due_at))
                          : '-'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Reminders</label>
                      <span>{contact?.reminders_enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                {contact?.notes && (
                  <div className="sidebar-notes">
                    <h2>Notes</h2>
                    <p className="notes-content">{contact.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
