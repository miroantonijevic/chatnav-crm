/**
 * Pipeline / deal form fields (priority, next action, stage, waiting on, value),
 * shared by the contact and company edit forms.
 */
import React, { useEffect, useState } from 'react';
import { DealFields, DealPeriod, DealStage, Priority, WaitingOn } from '../types';
import { PERIOD_META, PRIORITY_META, PRIORITY_ORDER, STAGE_META, STAGE_ORDER, WAITING_META, amountToInput, parseAmount } from '../utils/pipeline';

interface Props {
  values: DealFields;
  onChange: (patch: DealFields) => void;
}

export const PipelineFields: React.FC<Props> = ({ values, onChange }) => {
  const [amountText, setAmountText] = useState(amountToInput(values.deal_value));

  // Follow external changes (e.g. the form is re-populated after loading)
  useEffect(() => {
    setAmountText((prev) => (parseAmount(prev) === (values.deal_value ?? null) ? prev : amountToInput(values.deal_value)));
  }, [values.deal_value]);

  const amountInvalid = amountText.trim() !== '' && parseAmount(amountText) === null;

  return (
    <div className="pipeline-fields">
      <div className="form-grid form-grid-3">
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={values.priority ?? ''} onChange={(e) => onChange({ priority: (e.target.value || null) as Priority | null })}>
            <option value="">Not in pipeline</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].emoji} {PRIORITY_META[p].label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="deal_stage">Deal stage</label>
          <select id="deal_stage" value={values.deal_stage ?? ''} onChange={(e) => onChange({ deal_stage: (e.target.value || null) as DealStage | null })}>
            <option value="">—</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{STAGE_META[s].label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="waiting_on">Whose turn is it?</label>
          <select id="waiting_on" value={values.waiting_on ?? ''} onChange={(e) => onChange({ waiting_on: (e.target.value || null) as WaitingOn | null })}>
            <option value="">Nobody</option>
            <option value="client">{WAITING_META.client.label}</option>
            <option value="us">{WAITING_META.us.label}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="next_action">Next action</label>
        <input
          id="next_action"
          type="text"
          maxLength={500}
          value={values.next_action ?? ''}
          onChange={(e) => onChange({ next_action: e.target.value })}
          placeholder="What needs to happen next?"
        />
      </div>

      <div className="form-grid">
        <div className={`field${amountInvalid ? ' invalid' : ''}`}>
          <label htmlFor="deal_value">Deal value (€)</label>
          <input
            id="deal_value"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              const n = parseAmount(e.target.value);
              if (e.target.value.trim() === '') onChange({ deal_value: null });
              else if (n !== null) onChange({ deal_value: n });
            }}
          />
          {amountInvalid && <span className="hint hint-warn">Enter an amount like 170 or 1.234,50</span>}
        </div>

        <div className="field">
          <label htmlFor="deal_value_period">Billing</label>
          <select id="deal_value_period" value={values.deal_value_period ?? 'monthly'} onChange={(e) => onChange({ deal_value_period: e.target.value as DealPeriod })}>
            {(['monthly', 'yearly', 'one_time'] as DealPeriod[]).map((p) => (
              <option key={p} value={p}>{PERIOD_META[p].label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
