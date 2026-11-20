/**
 * Company detail / edit page
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { companyApi, contactApi, pipelineApi, userApi } from '../api';
import {
  Company,
  CompanyContactDetailCreate,
  CompanyCreate,
  CompanyHistoryEntry,
  Contact,
  RelationshipStatus,
  User,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm, useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { fmtDateTime, fromServer, toInputLocal } from '../utils/dates';
import { listUrl, splitValues } from '../utils/lists';
import { STAGE_META, STATUS_LABELS, WAITING_META, detailPath, formatDeal } from '../utils/pipeline';
import { HotBadge, HotToggle } from '../components/HotToggle';
import { PipelineFields } from '../components/PipelineFields';
import { DateTimeInput } from '../components/DateTimeInput';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { LogInteractionModal } from '../components/LogInteractionModal';
import { DetailRow, DetailsEditor } from '../components/DetailsEditor';
import { FormSection } from '../components/FormSection';
import { FollowUpBadge, InfoRow } from '../components/EntityBits';
import { Alert, Avatar, PageLoading, Person, RowMenu, StatusBadge } from '../components/ui';
import '../styles/detail.css';

const DETAIL_KINDS = [
  { type: 'email', title: 'Emails', singular: 'email', placeholder: 'e.g. info@company.com', inputType: 'email' as const },
  { type: 'phone', title: 'Phones', singular: 'phone', placeholder: 'e.g. +385 1 234 5678', inputType: 'tel' as const },
  { type: 'website', title: 'Websites', singular: 'website', placeholder: 'e.g. https://example.com', inputType: 'url' as const },
  { type: 'address', title: 'Addresses', singular: 'address', placeholder: 'e.g. Ilica 1, Zagreb', inputType: 'text' as const },
];

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  const backTo = listUrl('companies');
  const openedForEdit = useRef(searchParams.get('edit') === 'true'); // came from a list row's Edit action

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<CompanyHistoryEntry[]>([]);
  const [people, setPeople] = useState<Contact[]>([]);
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const [formData, setFormData] = useState<CompanyCreate>({
    name: '',
    industry: '',
    notes: '',
    current_relationship_status: RelationshipStatus.NEW,
    reminders_enabled: true,
    is_hot: false,
    next_action: '',
    deal_value: null,
    deal_value_period: null,
    deal_stage: null,
    waiting_on: null,
    owner_user_id: user?.id,
    contact_details: [],
  });
  const [rows, setRows] = useState<DetailRow[]>([]);

  // Duplicate detection (create mode only)
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePageTitle(isNew ? 'New company' : company?.name || 'Company');

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, name: value }));
    if (!isNew) return;
    if (nameTimer.current) clearTimeout(nameTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    nameTimer.current = setTimeout(async () => {
      try {
        const results = await companyApi.list({ search: value.trim(), limit: 5 });
        setSuggestions(results.items);
        setShowSuggestions(results.items.length > 0);
      } catch {
        // ignore search errors
      }
    }, 300);
  };

  const loadCompany = useCallback(async () => {
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
        next_contact_due_at: data.next_contact_due_at ? toInputLocal(data.next_contact_due_at) : undefined,
        is_hot: data.is_hot,
        next_action: data.next_action || '',
        deal_value: data.deal_value ?? null,
        deal_value_period: data.deal_value_period ?? null,
        deal_stage: data.deal_stage ?? null,
        waiting_on: data.waiting_on ?? null,
        owner_user_id: data.owner_user_id,
        contact_details: [],
      });
      setRows(data.contact_details.map((d, i) => ({ _idx: i, type: d.type, value: d.value, label: d.label || '' })));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      setHistory(await companyApi.getHistory(parseInt(id)));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, [id]);

  const loadPeople = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      const res = await contactApi.list({ company_id: parseInt(id), limit: 8, sort_by: 'name' });
      setPeople(res.items);
      setPeopleTotal(res.total);
    } catch (err) {
      console.error('Failed to load contacts of company:', err);
    }
  }, [id]);

  useEffect(() => {
    userApi.list().then(setUsers).catch((err) => console.error('Failed to load users:', err));
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      setLoading(true);
      loadCompany();
      loadHistory();
      loadPeople();
      setEditing(searchParams.get('edit') === 'true');
    } else {
      setEditing(true);
      setLoading(false);
    }
  }, [id, searchParams, loadCompany, loadHistory, loadPeople]);

  const handleHotChange = async (is_hot: boolean) => {
    if (!company) return;
    try {
      await pipelineApi.update('company', company.id, { is_hot });
      await Promise.all([loadCompany(), loadHistory()]);
      toast(is_hot ? 'Marked as hot lead' : 'Removed from hot leads');
    } catch (err: any) {
      toast(err.message || 'Failed to update', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const contact_details: CompanyContactDetailCreate[] = rows
        .filter((r) => r.value.trim())
        .map((r) => ({ type: r.type as CompanyContactDetailCreate['type'], value: r.value.trim(), label: r.label || undefined }));
      const payload = {
        ...formData,
        next_contact_due_at: formData.next_contact_due_at ? new Date(formData.next_contact_due_at).toISOString() : null,
        contact_details,
      };
      if (isNew) {
        const created = await companyApi.create(payload);
        toast('Company created');
        navigate(`/companies/${created.id}`);
      } else {
        await companyApi.update(parseInt(id!), payload);
        toast('Changes saved');
        if (openedForEdit.current) {
          navigate(backTo); // back to the same list page the user came from
        } else {
          await Promise.all([loadCompany(), loadHistory()]); // refresh first so the view never flashes stale data
          setEditing(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save company');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete company?',
      message: <>{company?.name} will be removed from your lists. Its history is kept.</>,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await companyApi.delete(parseInt(id!));
      toast('Company deleted');
      navigate(backTo);
    } catch (err: any) {
      toast(err.message || 'Failed to delete company', 'error');
    }
  };

  const cancelEdit = () => {
    if (isNew || openedForEdit.current) navigate(backTo);
    else {
      setEditing(false);
      loadCompany();
    }
  };

  const canDelete = user?.role === 'admin' || (company && user?.id === company.owner_user_id);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading />
      </MainLayout>
    );
  }

  if (!isNew && !company) {
    return (
      <MainLayout>
        <div className="page page-narrow">
          <Link to={backTo} className="back-link">← Companies</Link>
          <Alert tone="error">{error || 'Company not found'}</Alert>
        </div>
      </MainLayout>
    );
  }

  // ── edit / create form ─────────────────────────────────────────────
  if (editing) {
    return (
      <MainLayout>
        <div className="page page-narrow">
          <Link to={isNew || openedForEdit.current ? backTo : `/companies/${id}`} className="back-link">← {isNew || openedForEdit.current ? 'Companies' : company?.name}</Link>
          <div className="page-header">
            <h1 className="page-title">{isNew ? 'New company' : 'Edit company'}</h1>
          </div>

          {error && <div style={{ marginBottom: '1rem' }}><Alert tone="error" onClose={() => setError('')}>{error}</Alert></div>}

          <form id="company-form" onSubmit={handleSubmit} className="stack edit-form">
            <FormSection title="Basic information">
              <div className="form-grid">
                <div className="field span-2" style={{ position: 'relative' }}>
                  <label htmlFor="name">Name <span className="req">*</span></label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    required
                    autoFocus={isNew}
                  />
                  {isNew && showSuggestions && (
                    <ul className="suggest">
                      <li className="suggest-head">Already in your CRM – open instead of creating a duplicate:</li>
                      {suggestions.map((c) => (
                        <li key={c.id} className="suggest-item" onMouseDown={() => navigate(`/companies/${c.id}`)}>
                          <span className="suggest-name">{c.name}</span>
                          {c.industry && <span className="suggest-meta">{c.industry}</span>}
                          <span className="suggest-action">Open →</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="industry">Industry</label>
                  <input id="industry" type="text" value={formData.industry || ''} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="status">Relationship status</label>
                  <select id="status" value={formData.current_relationship_status} onChange={(e) => setFormData({ ...formData, current_relationship_status: e.target.value as RelationshipStatus })}>
                    {Object.values(RelationshipStatus).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>

                <div className="field span-2">
                  <label htmlFor="owner_user_id">Relationship owner <span className="req">*</span></label>
                  <select id="owner_user_id" value={formData.owner_user_id || ''} onChange={(e) => setFormData({ ...formData, owner_user_id: parseInt(e.target.value) })} required>
                    <option value="">Select an owner…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Contact details" description="E-mail, phone, website and address of the company.">
              <DetailsEditor kinds={DETAIL_KINDS} rows={rows} onChange={setRows} />
            </FormSection>

            <FormSection title="Hot lead & deal" description="Mark this company as a hot lead to show it in the Hot leads list, and track the deal.">
              <PipelineFields values={formData} onChange={(patch) => setFormData({ ...formData, ...patch })} />
              <div className="field">
                <label htmlFor="next_contact_due_at">Next follow-up</label>
                <DateTimeInput
                  id="next_contact_due_at"
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
                <input type="checkbox" checked={formData.reminders_enabled ?? true} onChange={(e) => setFormData({ ...formData, reminders_enabled: e.target.checked })} />
                Send me e-mail reminders when a follow-up is due
              </label>
            </FormSection>
          </form>

          <div className="savebar">
            <div className="savebar-inner">
              <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="submit" form="company-form" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : isNew ? 'Create company' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── read-only view ─────────────────────────────────────────────────
  const c = company!;
  const values = (type: string) => c.contact_details.filter((d) => d.type === type);
  const stage = c.deal_stage ? STAGE_META[c.deal_stage] : null;
  const waiting = c.waiting_on ? WAITING_META[c.waiting_on] : null;

  return (
    <MainLayout>
      <div className="page">
        <Link to={backTo} className="back-link">← Companies</Link>

        <div className="detail-head">
          <div className="detail-id">
            <Avatar name={c.name} size="xl" />
            <div>
              <div className="detail-title">
                <h1>{c.name}</h1>
              </div>
              <div className="detail-sub">{c.industry || <span className="faint">No industry</span>}</div>
              <div className="detail-badges">
                <StatusBadge status={c.current_relationship_status} />
                {c.is_hot && <HotBadge size="sm" />}
                {stage && <span className="pl-stage" style={{ color: stage.color, background: stage.bg }}>{stage.label}</span>}
                {waiting && <span className="pl-waiting" style={{ color: waiting.color, background: waiting.bg }}>{waiting.label}</span>}
              </div>
            </div>
          </div>
          <div className="page-actions">
            <HotToggle variant="button" value={!!c.is_hot} onChange={handleHotChange} />
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setLogOpen(true)}>+ Log interaction</button>
            <button type="button" className="btn btn-lg" onClick={() => setEditing(true)}>Edit</button>
            <RowMenu actions={[{ label: 'Delete company', danger: true, onClick: handleDelete, hidden: !canDelete }]} />
          </div>
        </div>

        {error && <div style={{ marginBottom: '1rem' }}><Alert tone="error" onClose={() => setError('')}>{error}</Alert></div>}

        <div className="detail-grid">
          <div className="stack">
            <section className="card">
              <div className="card-head"><h2>Activity</h2><span className="muted">{history.length} {history.length === 1 ? 'entry' : 'entries'}</span></div>
              <div className="card-body"><HistoryTimeline entries={history} /></div>
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <div className="card-head"><h3>Deal</h3></div>
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
              <div className="card-head">
                <h3>People {peopleTotal > 0 && <span className="muted">({peopleTotal})</span>}</h3>
                <Link to={`/contacts/new?company_id=${c.id}`} className="btn btn-sm">+ Add</Link>
              </div>
              {people.length === 0 ? (
                <p className="card-body muted">No contacts at this company yet.</p>
              ) : (
                <ul className="people-list">
                  {people.map((p) => (
                    <li key={p.id}>
                      <Link to={detailPath('contact', p.id)} className="people-item">
                        <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                        <span className="people-name">
                          {p.first_name} {p.last_name}
                          {p.job_title && <span className="cell-sub">{p.job_title}</span>}
                        </span>
                        {p.is_hot && <HotBadge size="sm" />}
                      </Link>
                    </li>
                  ))}
                  {peopleTotal > people.length && (
                    <li><Link to={`/contacts?search=${encodeURIComponent(c.name)}`} className="people-more">View all {peopleTotal} →</Link></li>
                  )}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h3>Details</h3></div>
              <dl className="info-list">
                <InfoRow label="Owner"><Person name={c.owner_full_name} title={c.owner_email} /></InfoRow>
                <InfoRow label="Created by"><Person name={c.created_by_full_name} title={c.created_by_email} /></InfoRow>
                {DETAIL_KINDS.map((kind) => {
                  const items = values(kind.type).flatMap((d) =>
                    (kind.type === 'email' || kind.type === 'phone' ? splitValues([d.value]) : [d.value]).map((v) => ({ ...d, value: v, id: `${d.id}-${v}` }))
                  );
                  if (items.length === 0) return null;
                  return (
                    <InfoRow key={kind.type} label={kind.title}>
                      <div className="chip-list">
                        {items.map((d) => {
                          const href = kind.type === 'email' ? `mailto:${d.value}` : kind.type === 'phone' ? `tel:${d.value}` : kind.type === 'website' ? (d.value.startsWith('http') ? d.value : `https://${d.value}`) : undefined;
                          return href ? (
                            <a key={d.id} href={href} className="detail-chip" target={kind.type === 'website' ? '_blank' : undefined} rel="noreferrer" title={d.label || undefined}>
                              {d.value}{d.label ? <em> ({d.label})</em> : null}
                            </a>
                          ) : (
                            <span key={d.id} className="detail-chip" title={d.label || undefined}>{d.value}{d.label ? <em> ({d.label})</em> : null}</span>
                          );
                        })}
                      </div>
                    </InfoRow>
                  );
                })}
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
          type="company"
          id={c.id}
          name={c.name}
          currentStatus={c.current_relationship_status}
          onClose={() => setLogOpen(false)}
          onSaved={async () => {
            setLogOpen(false);
            toast('Interaction logged');
            await Promise.all([loadCompany(), loadHistory()]);
          }}
        />
      )}
    </MainLayout>
  );
};
