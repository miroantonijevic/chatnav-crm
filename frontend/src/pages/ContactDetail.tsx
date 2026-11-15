/**
 * Contact detail / edit page
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { companyApi, contactApi, pipelineApi, userApi } from '../api';
import {
  CompanyListItem,
  Contact,
  ContactContactDetailCreate,
  ContactCreate,
  HistoryEntry,
  Priority,
  RelationshipStatus,
  User,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm, useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { toInputLocal } from '../utils/dates';
import { STAGE_META, STATUS_LABELS, WAITING_META, formatDeal } from '../utils/pipeline';
import { PriorityPicker } from '../components/PriorityBadge';
import { PipelineFields } from '../components/PipelineFields';
import { DateTimeInput } from '../components/DateTimeInput';
import { FavoriteStar } from '../components/FavoriteStar';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { LogInteractionModal } from '../components/LogInteractionModal';
import { DetailRow, DetailsEditor } from '../components/DetailsEditor';
import { FormSection } from '../components/FormSection';
import { FollowUpBadge, InfoRow } from '../components/EntityBits';
import { Alert, Avatar, PageLoading, Person, RowMenu, StatusBadge } from '../components/ui';
import { fmtDateTime, fromServer } from '../utils/dates';
import '../styles/detail.css';

const DETAIL_KINDS = [
  { type: 'email', title: 'Emails', singular: 'email', placeholder: 'e.g. john@example.com', inputType: 'email' as const },
  { type: 'phone', title: 'Phones', singular: 'phone', placeholder: 'e.g. +385 91 234 5678', inputType: 'tel' as const },
];

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';

  const [contact, setContact] = useState<Contact | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const [formData, setFormData] = useState<ContactCreate>({
    first_name: '',
    last_name: '',
    company_id: undefined,
    job_title: '',
    notes: '',
    current_relationship_status: RelationshipStatus.NEW,
    reminders_enabled: true,
    priority: null,
    next_action: '',
    deal_value: null,
    deal_value_period: null,
    deal_stage: null,
    waiting_on: null,
    owner_user_id: user?.id,
  });
  const [rows, setRows] = useState<DetailRow[]>([]);

  // Duplicate detection (create mode only)
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : '';
  usePageTitle(isNew ? 'New contact' : fullName || 'Contact');

  const handleNameChange = (field: 'first_name' | 'last_name', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (!isNew) return;
    if (nameTimer.current) clearTimeout(nameTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    nameTimer.current = setTimeout(async () => {
      try {
        const results = await contactApi.list({ search: value.trim(), limit: 5 });
        setSuggestions(results.items);
        setShowSuggestions(results.items.length > 0);
      } catch {
        // ignore search errors
      }
    }, 300);
  };

  const loadContact = useCallback(async () => {
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
        priority: data.priority ?? null,
        next_action: data.next_action || '',
        deal_value: data.deal_value ?? null,
        deal_value_period: data.deal_value_period ?? null,
        deal_stage: data.deal_stage ?? null,
        waiting_on: data.waiting_on ?? null,
        owner_user_id: data.owner_user_id,
      });
      setRows(
        data.contact_details
          .filter((d) => d.type === 'email' || d.type === 'phone')
          .map((d, i) => ({ _idx: i, type: d.type, value: d.value, label: d.label || '' }))
      );
      pipelineApi.get('contact', data.id).then((item) => setFavorite(item.is_favorite)).catch(() => undefined);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      setHistory(await contactApi.getHistory(parseInt(id)));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, [id]);

  useEffect(() => {
    userApi.list().then(setUsers).catch((err) => console.error('Failed to load users:', err));
    companyApi.listSimple().then(setCompanies).catch((err) => console.error('Failed to load companies:', err));
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      setLoading(true);
      loadContact();
      loadHistory();
      setEditing(searchParams.get('edit') === 'true');
    } else {
      const preset = parseInt(searchParams.get('company_id') || '', 10);
      if (preset) setFormData((prev) => ({ ...prev, company_id: preset }));
      setEditing(true);
      setLoading(false);
    }
  }, [id, searchParams, loadContact, loadHistory]);

  const toggleFavorite = async (next: boolean) => {
    if (!contact) return;
    setFavorite(next);
    try {
      await pipelineApi.setFavorite('contact', contact.id, next);
      toast(next ? 'Added to favorites' : 'Removed from favorites');
    } catch (err: any) {
      setFavorite(!next);
      toast(err.message || 'Failed to update favorites', 'error');
    }
  };

  const handlePriorityChange = async (priority: Priority | null) => {
    if (!contact) return;
    try {
      await pipelineApi.update('contact', contact.id, { priority });
      await Promise.all([loadContact(), loadHistory()]);
    } catch (err: any) {
      toast(err.message || 'Failed to update priority', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const contact_details: ContactContactDetailCreate[] = rows
        .filter((r) => r.value.trim())
        .map((r) => ({ type: r.type as 'email' | 'phone', value: r.value.trim(), label: r.label || undefined }));
      const payload = {
        ...formData,
        next_contact_due_at: formData.next_contact_due_at ? new Date(formData.next_contact_due_at).toISOString() : null,
        last_contacted_at: formData.last_contacted_at ? new Date(formData.last_contacted_at).toISOString() : undefined,
        contact_details,
      };
      if (isNew) {
        const created = await contactApi.create(payload);
        toast('Contact created');
        navigate(`/contacts/${created.id}`);
      } else {
        await contactApi.update(parseInt(id!), payload);
        await Promise.all([loadContact(), loadHistory()]); // refresh first so the view never flashes stale data
        setEditing(false);
        toast('Changes saved');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save contact');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete contact?',
      message: <>{fullName} will be removed from your lists. Their history is kept.</>,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await contactApi.delete(parseInt(id!));
      toast('Contact deleted');
      navigate('/contacts');
    } catch (err: any) {
      toast(err.message || 'Failed to delete contact', 'error');
    }
  };

  const cancelEdit = () => {
    if (isNew) navigate('/contacts');
    else {
      setEditing(false);
      loadContact(); // discard unsaved changes
    }
  };

  const canDelete = user?.role === 'admin' || (contact && user?.id === contact.owner_user_id);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading />
      </MainLayout>
    );
  }

  if (!isNew && !contact) {
    return (
      <MainLayout>
        <div className="page page-narrow">
          <Link to="/contacts" className="back-link">← Contacts</Link>
          <Alert tone="error">{error || 'Contact not found'}</Alert>
        </div>
      </MainLayout>
    );
  }

  // ── edit / create form ─────────────────────────────────────────────
  if (editing) {
    return (
      <MainLayout>
        <div className="page page-narrow">
          <Link to={isNew ? '/contacts' : `/contacts/${id}`} className="back-link">← {isNew ? 'Contacts' : fullName}</Link>
          <div className="page-header">
            <h1 className="page-title">{isNew ? 'New contact' : 'Edit contact'}</h1>
          </div>

          {error && <div style={{ marginBottom: '1rem' }}><Alert tone="error" onClose={() => setError('')}>{error}</Alert></div>}

          <form id="contact-form" onSubmit={handleSubmit} className="stack edit-form">
            <FormSection title="Basic information">
              <div className="form-grid name-grid">
                <div className="field">
                  <label htmlFor="first_name">First name <span className="req">*</span></label>
                  <input
                    id="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleNameChange('first_name', e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    required
                    autoFocus={isNew}
                  />
                </div>
                <div className="field">
                  <label htmlFor="last_name">Last name <span className="req">*</span></label>
                  <input
                    id="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleNameChange('last_name', e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    required
                  />
                </div>
                {isNew && showSuggestions && (
                  <ul className="suggest">
                    <li className="suggest-head">Already in your CRM – open instead of creating a duplicate:</li>
                    {suggestions.map((c) => (
                      <li key={c.id} className="suggest-item" onMouseDown={() => navigate(`/contacts/${c.id}`)}>
                        <span className="suggest-name">{c.first_name} {c.last_name}</span>
                        {c.company_name && <span className="suggest-meta">{c.company_name}</span>}
                        <span className="suggest-action">Open →</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="field">
                  <label htmlFor="job_title">Job title</label>
                  <input id="job_title" type="text" value={formData.job_title || ''} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="company_id">Company</label>
                  <select id="company_id" value={formData.company_id ?? ''} onChange={(e) => setFormData({ ...formData, company_id: e.target.value ? parseInt(e.target.value) : undefined })}>
                    <option value="">— No company —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="owner_user_id">Relationship owner <span className="req">*</span></label>
                  <select id="owner_user_id" value={formData.owner_user_id || ''} onChange={(e) => setFormData({ ...formData, owner_user_id: parseInt(e.target.value) })} required>
                    <option value="">Select an owner…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="status">Relationship status</label>
                  <select id="status" value={formData.current_relationship_status} onChange={(e) => setFormData({ ...formData, current_relationship_status: e.target.value as RelationshipStatus })}>
                    {Object.values(RelationshipStatus).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Contact details" description="E-mail addresses and phone numbers.">
              <DetailsEditor kinds={DETAIL_KINDS} rows={rows} onChange={setRows} />
            </FormSection>

            <FormSection title="Pipeline & deal" description="Rank this contact to show it in the Pipeline, and track the deal.">
              <PipelineFields values={formData} onChange={(patch) => setFormData({ ...formData, ...patch })} />
              <div className="field">
                <label htmlFor="next_contact_due_at_date">Next follow-up</label>
                <DateTimeInput
                  id="next_contact_due_at_date"
                  value={formData.next_contact_due_at ?? ''}
                  onChange={(v) => setFormData({ ...formData, next_contact_due_at: v || undefined })}
                />
              </div>
            </FormSection>

            <FormSection title="Notes & reminders">
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={5} />
              </div>
              <label className="check">
                <input type="checkbox" checked={formData.reminders_enabled} onChange={(e) => setFormData({ ...formData, reminders_enabled: e.target.checked })} />
                Send me e-mail reminders when a follow-up is due
              </label>
            </FormSection>
          </form>

          <div className="savebar">
            <div className="savebar-inner">
              <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="submit" form="contact-form" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : isNew ? 'Create contact' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── read-only view ─────────────────────────────────────────────────
  const c = contact!;
  const emails = [...(c.email ? [c.email] : []), ...c.contact_details.filter((d) => d.type === 'email').map((d) => d.value)].filter((v, i, a) => a.indexOf(v) === i);
  const phones = [...(c.phone ? [c.phone] : []), ...c.contact_details.filter((d) => d.type === 'phone').map((d) => d.value)].filter((v, i, a) => a.indexOf(v) === i);
  const stage = c.deal_stage ? STAGE_META[c.deal_stage] : null;
  const waiting = c.waiting_on ? WAITING_META[c.waiting_on] : null;

  return (
    <MainLayout>
      <div className="page">
        <Link to="/contacts" className="back-link">← Contacts</Link>

        <div className="detail-head">
          <div className="detail-id">
            <Avatar name={fullName} size="xl" />
            <div>
              <div className="detail-title">
                <h1>{fullName}</h1>
                <FavoriteStar value={favorite} onToggle={toggleFavorite} />
              </div>
              <div className="detail-sub">
                {c.job_title}
                {c.job_title && c.company_name ? ' · ' : ''}
                {c.company_id && c.company_name && <Link to={`/companies/${c.company_id}`}>{c.company_name}</Link>}
                {!c.job_title && !c.company_name && <span className="faint">No job title or company</span>}
              </div>
              <div className="detail-badges">
                <StatusBadge status={c.current_relationship_status} />
                <PriorityPicker value={c.priority} onChange={handlePriorityChange} size="sm" />
                {stage && <span className="pl-stage" style={{ color: stage.color, background: stage.bg }}>{stage.label}</span>}
                {waiting && <span className="pl-waiting" style={{ color: waiting.color, background: waiting.bg }}>{waiting.label}</span>}
              </div>
            </div>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setLogOpen(true)}>+ Log interaction</button>
            <button type="button" className="btn btn-lg" onClick={() => setEditing(true)}>Edit</button>
            <RowMenu actions={[{ label: 'Delete contact', danger: true, onClick: handleDelete, hidden: !canDelete }]} />
          </div>
        </div>

        {error && <div style={{ marginBottom: '1rem' }}><Alert tone="error" onClose={() => setError('')}>{error}</Alert></div>}

        <div className="detail-grid">
          <section className="card">
            <div className="card-head"><h2>Activity</h2><span className="muted">{history.length} {history.length === 1 ? 'entry' : 'entries'}</span></div>
            <div className="card-body"><HistoryTimeline entries={history} /></div>
          </section>

          <aside className="stack">
            <section className="card">
              <div className="card-head"><h3>Pipeline</h3></div>
              <dl className="info-list">
                <InfoRow label="Next action">{c.next_action || <span className="faint">Not set</span>}</InfoRow>
                <InfoRow label="Follow-up">
                  <FollowUpBadge value={c.next_contact_due_at} emptyLabel="Not scheduled" />
                  {c.next_contact_due_at && <div className="info-sub">{fmtDateTime(fromServer(c.next_contact_due_at))}</div>}
                </InfoRow>
                <InfoRow label="Deal value">{c.deal_value !== null && c.deal_value !== undefined ? <strong>{formatDeal(c.deal_value, c.deal_value_period)}</strong> : <span className="faint">Not set</span>}</InfoRow>
                <InfoRow label="Last contact">{c.last_contacted_at ? fmtDateTime(fromServer(c.last_contacted_at)) : <span className="faint">Never</span>}</InfoRow>
              </dl>
            </section>

            <section className="card">
              <div className="card-head"><h3>Details</h3></div>
              <dl className="info-list">
                <InfoRow label="Owner"><Person name={c.owner_full_name} title={c.owner_email} /></InfoRow>
                <InfoRow label="Created by"><Person name={c.created_by_full_name} title={c.created_by_email} /></InfoRow>
                <InfoRow label="E-mail">
                  {emails.length ? <div className="chip-list">{emails.map((e) => <a key={e} href={`mailto:${e}`} className="detail-chip">{e}</a>)}</div> : <span className="faint">None</span>}
                </InfoRow>
                <InfoRow label="Phone">
                  {phones.length ? <div className="chip-list">{phones.map((p) => <a key={p} href={`tel:${p}`} className="detail-chip">{p}</a>)}</div> : <span className="faint">None</span>}
                </InfoRow>
                <InfoRow label="Reminders">{c.reminders_enabled ? <span className="badge badge-ok">Enabled</span> : <span className="badge">Off</span>}</InfoRow>
              </dl>
            </section>

            {c.notes && (
              <section className="card">
                <div className="card-head"><h3>Notes</h3></div>
                <div className="card-body notes-text">{c.notes}</div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {logOpen && (
        <LogInteractionModal
          type="contact"
          id={c.id}
          name={fullName}
          currentStatus={c.current_relationship_status}
          onClose={() => setLogOpen(false)}
          onSaved={async () => {
            setLogOpen(false);
            toast('Interaction logged');
            await Promise.all([loadContact(), loadHistory()]);
          }}
        />
      )}
    </MainLayout>
  );
};
