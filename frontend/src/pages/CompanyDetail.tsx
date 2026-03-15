/**
 * Company detail/edit page
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { companyApi, userApi } from '../api';
import {
  Company,
  CompanyCreate,
  CompanyUpdate,
  CompanyHistoryEntry,
  CompanyHistoryCreate,
  CompanyContactDetailCreate,
  RelationshipStatus,
  User,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Contacts.css';
import { fromServer, fmtDateTime, localNow, toInputLocal } from '../utils/dates';

const ENTRY_TYPE_LABEL: Record<string, string> = {
  created: 'Company created',
  edited: 'Company edited',
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


export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<CompanyHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Contact details editing state (separate from main formData)
  type DetailRow = { _idx: number; type: CompanyContactDetailCreate['type']; value: string; label: string };
  const [detailsForm, setDetailsForm] = useState<DetailRow[]>([]);
  const [detailCounter, setDetailCounter] = useState(0);

  // Log interaction form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState<CompanyHistoryCreate>({
    status: RelationshipStatus.CONTACTED,
    note: '',
    interaction_at: localNow(),
    next_contact_due_at: '',
  });
  const [logError, setLogError] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  const [formData, setFormData] = useState<CompanyCreate>({
    name: '',
    industry: '',
    notes: '',
    current_relationship_status: RelationshipStatus.NEW,
    reminders_enabled: true,
    owner_user_id: user?.id,
    contact_details: [],
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      loadCompany();
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

  const loadCompany = async () => {
    if (!id || id === 'new') return;
    try {
      const data = await companyApi.get(parseInt(id));
      setCompany(data);
      setFormData({
        name: data.name,
        industry: data.industry || '',
        notes: data.notes || '',
        current_relationship_status: data.current_relationship_status,
        reminders_enabled: data.reminders_enabled,
        next_contact_due_at: data.next_contact_due_at,
        owner_user_id: data.owner_user_id,
        contact_details: [],
      });
      let counter = 0;
      setDetailsForm(
        data.contact_details.map((d) => ({ _idx: counter++, type: d.type as CompanyContactDetailCreate['type'], value: d.value, label: d.label || '' }))
      );
      setDetailCounter(counter);
      setLogFormData((prev: CompanyHistoryCreate) => ({ ...prev, status: data.current_relationship_status }));
    } catch (err: any) {
      setError(err.message || 'Failed to load company');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!id || id === 'new') return;
    try {
      const data = await companyApi.getHistory(parseInt(id));
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const contact_details: CompanyContactDetailCreate[] = detailsForm
        .filter((r: DetailRow) => r.value)
        .map((r: DetailRow) => ({ type: r.type, value: r.value, label: r.label || undefined }));
      const payload = { ...formData, contact_details };
      if (id === 'new') {
        await companyApi.create(payload);
        navigate('/companies');
      } else {
        const updatePayload: CompanyUpdate = { ...payload };
        await companyApi.update(parseInt(id!), updatePayload);
        setEditing(false);
        await loadCompany();
        await loadHistory();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save company');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this company?')) return;
    try {
      await companyApi.delete(parseInt(id!));
      navigate('/companies');
    } catch (err: any) {
      setError(err.message || 'Failed to delete company');
    }
  };

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    setLogSaving(true);
    try {
      await companyApi.addHistory(parseInt(id!), {
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
      await loadCompany();
      await loadHistory();
    } catch (err: any) {
      setLogError(err.message || 'Failed to log interaction');
    } finally {
      setLogSaving(false);
    }
  };

  const addDetailRow = (type: CompanyContactDetailCreate['type']) => {
    const idx = detailCounter;
    setDetailCounter((c: number) => c + 1);
    setDetailsForm((prev: DetailRow[]) => [...prev, { _idx: idx, type, value: '', label: '' }]);
  };

  const removeDetailRow = (idx: number) => {
    setDetailsForm((prev: DetailRow[]) => prev.filter((r: DetailRow) => r._idx !== idx));
  };

  const updateDetailRow = (idx: number, field: 'value' | 'label', val: string) => {
    setDetailsForm((prev: DetailRow[]) => prev.map((r: DetailRow) => r._idx === idx ? { ...r, [field]: val } : r));
  };

  const canDelete = user?.role === 'admin' || (company && user?.id === company.owner_user_id);
  const isNew = id === 'new';

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading company...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="contact-detail">
        <div className="page-header">
          <h1>{isNew ? 'New Company' : editing ? 'Edit Company' : 'Company Details'}</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {editing ? (
              <>
                <button type="submit" form="company-form" className="btn-primary-inline">
                  {isNew ? 'Create Company' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => (isNew ? navigate('/companies') : setEditing(false))}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                {!isNew && canDelete && (
                  <button type="button" onClick={handleDelete} className="btn-danger">
                    Delete
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/companies" className="btn-secondary">Back to Companies</Link>
                <button onClick={() => setEditing(true)} className="btn-primary-inline">Edit</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {editing ? (
          <form id="company-form" onSubmit={handleSubmit} className="contact-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="owner_user_id">Relationship Owner *</label>
                <select
                  id="owner_user_id"
                  value={formData.owner_user_id || ''}
                  onChange={(e) => setFormData({ ...formData, owner_user_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select relationship owner...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <input
                  id="industry"
                  type="text"
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
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

            <div className="form-group">
              <label htmlFor="next_contact_due_at">Next Follow-up Date</label>
              <input
                id="next_contact_due_at"
                type="datetime-local"
                value={
                  formData.next_contact_due_at
                    ? toInputLocal(formData.next_contact_due_at)
                    : ''
                }
                onChange={(e) => setFormData({ ...formData, next_contact_due_at: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={5}
              />
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.reminders_enabled ?? true}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, reminders_enabled: e.target.checked })}
              />
              Enable reminders for this company
            </label>

            {(['email', 'phone', 'website', 'address'] as const).map((type) => {
              const rows = detailsForm.filter((r: DetailRow) => r.type === type);
              const inputType = type === 'email' ? 'email' : type === 'website' ? 'url' : 'text';
              const label = type.charAt(0).toUpperCase() + type.slice(1) + 's';
              const placeholder = type === 'email' ? 'e.g. info@company.com'
                : type === 'phone' ? 'e.g. +386 1 234 5678'
                : type === 'website' ? 'e.g. https://example.com'
                : 'e.g. 123 Main St, Ljubljana';
              return (
                <div key={type} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#2c3e50' }}>{label}</label>
                    <button type="button" onClick={() => addDetailRow(type)} className="btn-primary-inline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                      + Add {type}
                    </button>
                  </div>
                  {rows.length === 0 && <p style={{ color: '#888', fontSize: '0.875rem', margin: 0 }}>No {type}s added yet.</p>}
                  {rows.map((detail: DetailRow) => (
                    <div key={detail._idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input type={inputType} value={detail.value} placeholder={placeholder}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDetailRow(detail._idx, 'value', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: '0 0 160px', marginBottom: 0 }}>
                        <input type="text" value={detail.label} placeholder="Label (optional)"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDetailRow(detail._idx, 'label', e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeDetailRow(detail._idx)}
                        className="btn-remove" style={{ alignSelf: 'center', marginBottom: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              );
            })}
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
                        status: company?.current_relationship_status ?? RelationshipStatus.CONTACTED,
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
                      <label htmlFor="log_followup">Next follow-up date (optional — updates the company)</label>
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
                <h2>Company Information</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <span>{company?.name}</span>
                  </div>
                  <div className="info-item">
                    <label>Industry</label>
                    <span>{company?.industry || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Relationship Owner</label>
                    <span className="owner-info" title={company?.owner_email}>
                      {company?.owner_full_name}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Created By</label>
                    <span className="owner-info" title={company?.created_by_email}>
                      {company?.created_by_full_name}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Status</label>
                    <span className="status-badge">
                      {STATUS_LABELS[company?.current_relationship_status ?? ''] ?? company?.current_relationship_status}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Next Follow-up</label>
                    <span>
                      {company?.next_contact_due_at
                        ? fmtDateTime(fromServer(company.next_contact_due_at))
                        : '-'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Reminders</label>
                    <span>{company?.reminders_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>

                  {(['email', 'phone', 'website', 'address'] as const).map((type) => {
                    const items = company?.contact_details.filter((d) => d.type === type) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div className="info-item" key={type}>
                        <label>{type.charAt(0).toUpperCase() + type.slice(1)}s</label>
                        <div className="detail-chips">
                          {items.map((d) => (
                            <span className="detail-chip" key={d.id} title={d.label || undefined}>
                              {d.value}{d.label ? <em> ({d.label})</em> : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {company?.notes && (
                  <div className="sidebar-notes">
                    <h2>Notes</h2>
                    <p className="notes-content">{company.notes}</p>
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
