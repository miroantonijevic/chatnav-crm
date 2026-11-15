/**
 * Editor for the e-mail / phone / website / address rows of a contact or company.
 */
import React from 'react';

export interface DetailRow {
  _idx: number;
  type: string;
  value: string;
  label: string;
}

export interface DetailKind {
  type: string;
  title: string;
  singular: string;
  placeholder: string;
  inputType: 'email' | 'tel' | 'url' | 'text';
}

interface Props {
  kinds: DetailKind[];
  rows: DetailRow[];
  onChange: (rows: DetailRow[]) => void;
}

export const DetailsEditor: React.FC<Props> = ({ kinds, rows, onChange }) => {
  const add = (type: string) => {
    const idx = rows.reduce((m, r) => Math.max(m, r._idx), -1) + 1;
    onChange([...rows, { _idx: idx, type, value: '', label: '' }]);
  };
  const remove = (idx: number) => onChange(rows.filter((r) => r._idx !== idx));
  const update = (idx: number, field: 'value' | 'label', val: string) =>
    onChange(rows.map((r) => (r._idx === idx ? { ...r, [field]: val } : r)));

  return (
    <div className="details-editor">
      {kinds.map((kind) => {
        const kindRows = rows.filter((r) => r.type === kind.type);
        return (
          <div key={kind.type} className="details-group">
            <div className="details-group-head">
              <span className="field-label">{kind.title}</span>
              <button type="button" className="btn btn-sm" onClick={() => add(kind.type)}>+ Add {kind.singular}</button>
            </div>
            {kindRows.length === 0 && <p className="details-empty">No {kind.title.toLowerCase()} added yet.</p>}
            {kindRows.map((row) => (
              <div key={row._idx} className="details-row">
                <input
                  type={kind.inputType}
                  className="input"
                  value={row.value}
                  placeholder={kind.placeholder}
                  aria-label={kind.singular}
                  onChange={(e) => update(row._idx, 'value', e.target.value)}
                />
                <input
                  type="text"
                  className="input details-label"
                  value={row.label}
                  placeholder="Label (optional)"
                  aria-label={`${kind.singular} label`}
                  onChange={(e) => update(row._idx, 'label', e.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(row._idx)} aria-label={`Remove ${kind.singular}`} title="Remove">×</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
