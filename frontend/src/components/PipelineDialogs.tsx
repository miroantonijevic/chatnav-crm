/**
 * Modal dialogs for the pipeline: "log contact" and "add to pipeline".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { companyApi, contactApi, pipelineApi } from '../api';
import { EntityType, PipelineItem, Priority, RelationshipStatus } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { DateInput } from './DateInput';
import { Modal } from './Modal';
import { Alert, SearchIcon } from './ui';
import {
  FOLLOW_UP_PRESETS,
  PRIORITY_ORDER,
  STATUS_LABELS,
  followUpIso,
  followUpIsoFromDate,
} from '../utils/pipeline';

// ── log contact ───────────────────────────────────────────────────────

interface ContactedModalProps {
  item: Pick<PipelineItem, 'entity_type' | 'id' | 'name' | 'status' | 'next_action'>;
  onClose: () => void;
  onSaved: () => void;
}

type DueChoice = { kind: 'none' } | { kind: 'preset'; days: number } | { kind: 'date'; value: string };

export const ContactedModal: React.FC<ContactedModalProps> = ({ item, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string>(item.status);
  const [due, setDue] = useState<DueChoice>({ kind: 'preset', days: 7 });
  const [nextAction, setNextAction] = useState(item.next_action ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => noteRef.current?.focus(), []);

  const dueIso = (): string | null =>
    due.kind === 'none' ? null : due.kind === 'preset' ? followUpIso(due.days) : followUpIsoFromDate(due.value);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Parameters<typeof contactApi.markContacted>[1] = {
        note: note.trim() || undefined,
        status,
        next_contact_due_at: dueIso(),
      };
      // Only touch the next action when the user changed it
      if (nextAction.trim() !== (item.next_action ?? '')) payload.next_action = nextAction.trim() || null;
      if (item.entity_type === 'company') await companyApi.markContacted(item.id, payload);
      else await contactApi.markContacted(item.id, payload);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Log contact · ${item.name}`} onClose={onClose} locked={saving}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="field">
            <label htmlFor="mc_note">What happened? <span className="hint">(optional)</span></label>
            <textarea
              id="mc_note"
              ref={noteRef}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called, they will test the demo this week"
            />
          </div>

          <div className="field">
            <label htmlFor="mc_status">Status</label>
            <select id="mc_status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.values(RelationshipStatus).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field-label">Next follow-up</span>
            <div className="chip-row">
              {FOLLOW_UP_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`chip${due.kind === 'preset' && due.days === p.days ? ' active' : ''}`}
                  onClick={() => setDue({ kind: 'preset', days: p.days })}
                >
                  {p.label}
                </button>
              ))}
              <button type="button" className={`chip${due.kind === 'none' ? ' active' : ''}`} onClick={() => setDue({ kind: 'none' })}>
                No follow-up
              </button>
              <div className={`pl-chip-date${due.kind === 'date' ? ' active' : ''}`}>
                <DateInput
                  aria-label="Custom follow-up date"
                  value={due.kind === 'date' ? due.value : ''}
                  onChange={(v) => v && setDue({ kind: 'date', value: v })}
                />
              </div>
            </div>
            {due.kind === 'none' && <span className="hint hint-warn">The current follow-up date will be cleared.</span>}
          </div>

          <div className="field">
            <label htmlFor="mc_next">Next action</label>
            <input
              id="mc_next"
              type="text"
              maxLength={500}
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="What needs to happen next?"
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ── add to pipeline ───────────────────────────────────────────────────

interface Candidate {
  type: EntityType;
  id: number;
  name: string;
  sub: string;
  priority: Priority | null;
}

interface AddModalProps {
  onClose: () => void;
  /** Called on close if anything was added/changed, so the list can refresh. */
  onChanged: () => void;
}

export const AddToPipelineModal: React.FC<AddModalProps> = ({ onClose, onChanged }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const changed = useRef(false);
  const reqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      try {
        const [companies, contacts] = await Promise.all([
          companyApi.list({ search: term, limit: 8 }),
          contactApi.list({ search: term, limit: 8 }),
        ]);
        if (id !== reqRef.current) return;
        const rows: Candidate[] = [
          ...companies.items.map((c) => ({
            type: 'company' as const,
            id: c.id,
            name: c.name,
            sub: c.industry || 'Company',
            priority: c.priority ?? null,
          })),
          ...contacts.items.map((c) => ({
            type: 'contact' as const,
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            sub: [c.job_title, c.company_name].filter(Boolean).join(' · ') || 'Contact',
            priority: c.priority ?? null,
          })),
        ];
        setResults(rows);
        setError('');
      } catch (err: any) {
        if (id === reqRef.current) setError(err.message || 'Search failed');
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const setPriority = async (row: Candidate, priority: Priority | null) => {
    const key = `${row.type}-${row.id}`;
    setBusyKey(key);
    setError('');
    try {
      await pipelineApi.update(row.type, row.id, { priority });
      changed.current = true;
      setResults((prev) => prev.map((r) => (r.type === row.type && r.id === row.id ? { ...r, priority } : r)));
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setBusyKey(null);
    }
  };

  const close = () => {
    if (changed.current) onChanged();
    onClose();
  };

  return (
    <Modal title="Add to pipeline" onClose={close} size="wide">
      <div className="modal-body">
        <div className="search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search companies and contacts…"
            aria-label="Search companies and contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="pl-add-results">
          {!search.trim() && (
            <p className="pl-add-hint">
              Search for a company or contact, then rank it <strong>Hot</strong>, <strong>Warm</strong> or <strong>Cold</strong> to
              add it to the pipeline.
            </p>
          )}
          {search.trim() && !loading && results.length === 0 && !error && (
            <p className="pl-add-hint">
              Nothing found. <Link to="/companies/new">Create a company</Link> or <Link to="/contacts/new">create a contact</Link>.
            </p>
          )}
          {search.trim() && loading && results.length === 0 && <p className="pl-add-hint">Searching…</p>}

          {results.map((r) => {
            const key = `${r.type}-${r.id}`;
            return (
              <div className="pl-add-row" key={key}>
                <div className="pl-add-info">
                  <span className={`pl-type pl-type-${r.type}`}>{r.type === 'company' ? 'Company' : 'Contact'}</span>
                  <div>
                    <div className="pl-add-name">{r.name}</div>
                    <div className="pl-add-sub">{r.sub}</div>
                  </div>
                </div>
                <div className="pl-add-actions">
                  {PRIORITY_ORDER.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={busyKey === key}
                      className={`pl-add-pick${r.priority === p ? ' active' : ''}`}
                      onClick={() => setPriority(r, p)}
                      aria-pressed={r.priority === p}
                    >
                      <PriorityBadge value={p} size="sm" />
                    </button>
                  ))}
                  {r.priority && (
                    <button type="button" className="pl-add-remove" disabled={busyKey === key} onClick={() => setPriority(r, null)} title="Remove from pipeline">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="modal-foot">
        <button type="button" className="btn btn-primary" onClick={close}>Done</button>
      </div>
    </Modal>
  );
};
