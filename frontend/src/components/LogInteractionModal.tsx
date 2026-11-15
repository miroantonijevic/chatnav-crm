/**
 * "Log interaction" dialog for contacts and companies: what happened, when,
 * the resulting status and the next follow-up.
 */
import React, { useEffect, useRef, useState } from 'react';
import { companyApi, contactApi } from '../api';
import { EntityType, RelationshipStatus } from '../types';
import { Modal } from './Modal';
import { Alert } from './ui';
import { DateTimeInput } from './DateTimeInput';
import { FOLLOW_UP_PRESETS, STATUS_LABELS, followUpLocal } from '../utils/pipeline';
import { localNow } from '../utils/dates';

interface Props {
  type: EntityType;
  id: number;
  name: string;
  currentStatus: RelationshipStatus;
  onClose: () => void;
  onSaved: () => void;
}

export const LogInteractionModal: React.FC<Props> = ({ type, id, name, currentStatus, onClose, onSaved }) => {
  const [status, setStatus] = useState<RelationshipStatus>(currentStatus);
  const [when, setWhen] = useState(localNow());
  const [followUp, setFollowUp] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => noteRef.current?.focus(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) {
      setError('Please choose when the interaction happened.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      status,
      note: note.trim() || undefined,
      interaction_at: new Date(when).toISOString(),
      next_contact_due_at: followUp ? new Date(followUp).toISOString() : undefined,
    };
    try {
      if (type === 'company') await companyApi.addHistory(id, payload);
      else await contactApi.addHistory(id, payload);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to log interaction');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Log interaction · ${name}`} onClose={onClose} locked={saving} size="wide">
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="field">
            <label htmlFor="log_note">What happened?</label>
            <textarea
              id="log_note"
              ref={noteRef}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Had a call, sent the proposal, met at the conference…"
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="log_status">Status after interaction</label>
              <select id="log_status" value={status} onChange={(e) => setStatus(e.target.value as RelationshipStatus)}>
                {Object.values(RelationshipStatus).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="log_date">When</label>
              <DateTimeInput id="log_date" value={when} onChange={setWhen} required />
            </div>
          </div>

          <div className="field">
            <label htmlFor="log_followup">Next follow-up <span className="hint">(optional – updates the {type})</span></label>
            <DateTimeInput id="log_followup" value={followUp} onChange={setFollowUp} />
            <div className="chip-row">
              {FOLLOW_UP_PRESETS.map((p) => (
                <button key={p.key} type="button" className="chip" onClick={() => setFollowUp(followUpLocal(p.days))}>
                  {p.label}
                </button>
              ))}
              {followUp && <button type="button" className="chip" onClick={() => setFollowUp('')}>Clear</button>}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save interaction'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
