/**
 * Inline-editable table cells for the pipeline: next action, follow-up date,
 * deal stage / waiting-on and deal value.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Popover } from './Popover';
import { Calendar } from './Calendar';
import { DealPeriod, DealStage, PipelineUpdate, WaitingOn } from '../types';
import {
  FOLLOW_UP_PRESETS,
  PERIOD_META,
  STAGE_META,
  STAGE_ORDER,
  WAITING_META,
  amountToInput,
  followUpInfo,
  followUpIso,
  followUpIsoFromDate,
  formatDeal,
  parseAmount,
  toDateInput,
} from '../utils/pipeline';
import './Pipeline.css';

// ── Next action ───────────────────────────────────────────────────────

interface NextActionCellProps {
  value?: string | null;
  onSave: (value: string | null) => void;
}

export const NextActionCell: React.FC<NextActionCellProps> = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(value ?? '');
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? '')) onSave(next || null);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="pl-inline-input"
        value={draft}
        maxLength={500}
        placeholder="What needs to happen next?"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button type="button" className={`pl-next-action${value ? '' : ' pl-placeholder'}`} onClick={start} title="Click to edit">
      {value || 'Add next action…'}
      <span className="pl-edit-hint" aria-hidden="true">✎</span>
    </button>
  );
};

// ── Follow-up date ────────────────────────────────────────────────────

interface FollowUpCellProps {
  value?: string | null;
  onSave: (iso: string | null) => void;
}

export const FollowUpCell: React.FC<FollowUpCellProps> = ({ value, onSave }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const info = followUpInfo(value);

  const set = (iso: string | null) => {
    setAnchor(null);
    onSave(iso);
  };

  return (
    <>
      <button
        type="button"
        className={`pl-followup pl-tone-${info.tone}`}
        title={value ? `${info.title} – click to change` : 'Schedule a follow-up'}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        {info.tone === 'none' ? '+ Schedule' : info.label}
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pl-fu-pop">
          <div className="pl-fu-title">Next follow-up</div>
          <div className="pl-fu-presets">
            {FOLLOW_UP_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => set(followUpIso(p.days))}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="pl-fu-cal">
            <Calendar
              value={toDateInput(value)}
              onSelect={(iso) => set(followUpIsoFromDate(iso))}
              onClear={value ? () => set(null) : undefined}
            />
          </div>
        </Popover>
      )}
    </>
  );
};

// ── Deal stage + waiting on ───────────────────────────────────────────

interface DealCellProps {
  stage?: DealStage | null;
  waitingOn?: WaitingOn | null;
  onSave: (patch: PipelineUpdate) => void;
}

export const DealCell: React.FC<DealCellProps> = ({ stage, waitingOn, onSave }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const sm = stage ? STAGE_META[stage] : null;
  const wm = waitingOn ? WAITING_META[waitingOn] : null;

  return (
    <>
      <button
        type="button"
        className="pl-deal"
        title="Change stage"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        {sm ? (
          <span className="pl-stage" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
        ) : (
          <span className="pl-stage-add">+ Stage</span>
        )}
        {wm && (
          <span className={`pl-waiting pl-waiting-${waitingOn}`} style={{ color: wm.color, background: wm.bg }}>
            {wm.label}
          </span>
        )}
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pl-deal-pop">
          <div className="pl-fu-title">Stage</div>
          {STAGE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`pl-menu-item${s === stage ? ' active' : ''}`}
              onClick={() => s !== stage && onSave({ deal_stage: s })}
            >
              <span className="pl-stage" style={{ color: STAGE_META[s].color, background: STAGE_META[s].bg }}>
                {STAGE_META[s].label}
              </span>
              {s === stage && <span className="pl-menu-check">✓</span>}
            </button>
          ))}
          {stage && (
            <button type="button" className="pl-menu-item pl-menu-remove" onClick={() => onSave({ deal_stage: null })}>
              Clear stage
            </button>
          )}

          <div className="pl-fu-title pl-deal-sep">Whose turn is it?</div>
          <div className="pl-seg">
            <button type="button" className={!waitingOn ? 'active' : ''} onClick={() => waitingOn && onSave({ waiting_on: null })}>
              Nobody
            </button>
            {(['client', 'us'] as WaitingOn[]).map((w) => (
              <button
                key={w}
                type="button"
                className={waitingOn === w ? 'active' : ''}
                onClick={() => waitingOn !== w && onSave({ waiting_on: w })}
              >
                {WAITING_META[w].short}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
};

// ── Deal value ────────────────────────────────────────────────────────

interface ValueCellProps {
  value?: number | null;
  period?: DealPeriod | null;
  onSave: (patch: PipelineUpdate) => void;
}

export const ValueCell: React.FC<ValueCellProps> = ({ value, period, onSave }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [text, setText] = useState('');
  const [per, setPer] = useState<DealPeriod>('monthly');
  const [error, setError] = useState('');

  const open = (el: HTMLElement) => {
    setText(amountToInput(value));
    setPer(period ?? 'monthly');
    setError('');
    setAnchor(el);
  };

  const save = () => {
    const amount = parseAmount(text);
    if (text.trim() && amount === null) {
      setError('Enter a valid amount, e.g. 170 or 1.234,50');
      return;
    }
    setAnchor(null);
    if (amount === null) {
      if (value !== null && value !== undefined) onSave({ deal_value: null });
    } else if (amount !== value || per !== (period ?? 'monthly')) {
      onSave({ deal_value: amount, deal_value_period: per });
    }
  };

  const hasValue = value !== null && value !== undefined;

  return (
    <>
      <button
        type="button"
        className={`pl-value${hasValue ? '' : ' pl-placeholder'}`}
        title="Edit deal value"
        onClick={(e) => (anchor ? setAnchor(null) : open(e.currentTarget))}
      >
        {hasValue ? formatDeal(value, period) : '+ Value'}
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="pl-value-pop">
          <div className="pl-fu-title">Deal value</div>
          <div className="pl-value-row">
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              className="pl-value-input"
              placeholder="0,00"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              aria-label="Iznos u eurima"
            />
            <span className="pl-value-cur">€</span>
          </div>
          <div className="pl-seg">
            {(['monthly', 'yearly', 'one_time'] as DealPeriod[]).map((p) => (
              <button key={p} type="button" className={per === p ? 'active' : ''} onClick={() => setPer(p)}>
                {PERIOD_META[p].label}
              </button>
            ))}
          </div>
          {error && <div className="pl-value-error">{error}</div>}
          <div className="pl-value-actions">
            {hasValue && (
              <button type="button" className="pl-fu-clear" onClick={() => { setAnchor(null); onSave({ deal_value: null }); }}>
                Clear
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        </Popover>
      )}
    </>
  );
};
