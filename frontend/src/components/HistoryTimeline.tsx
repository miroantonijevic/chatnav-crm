/**
 * Activity timeline shared by the contact and company detail pages.
 */
import React from 'react';
import { StatusBadge } from './ui';
import { fromServer, fmtDateTime } from '../utils/dates';

export interface TimelineEntry {
  id: number;
  entry_type: string;
  status: string;
  note?: string | null;
  interaction_at: string;
  next_contact_due_at?: string | null;
  created_at: string;
  changed_by_full_name: string;
}

const TYPE_META: Record<string, { label: string; icon: string; tone: string }> = {
  created: { label: 'Created', icon: '✦', tone: 'ok' },
  edited: { label: 'Edited', icon: '✎', tone: 'muted' },
  interaction: { label: 'Interaction', icon: '💬', tone: 'brand' },
  marked_contacted: { label: 'Marked as contacted', icon: '✓', tone: 'info' },
};

export const HistoryTimeline: React.FC<{ entries: TimelineEntry[] }> = ({ entries }) => {
  if (entries.length === 0) {
    return <p className="timeline-empty">No activity yet. Log an interaction to start the history.</p>;
  }

  return (
    <ol className="timeline">
      {entries.map((entry) => {
        const meta = TYPE_META[entry.entry_type] ?? { label: entry.entry_type, icon: '•', tone: 'muted' };
        const recordedAt = fromServer(entry.created_at);
        const happenedAt = fromServer(entry.interaction_at);
        const showHappenedOn = entry.entry_type === 'interaction' && recordedAt.getTime() - happenedAt.getTime() > 5 * 60 * 1000;

        return (
          <li key={entry.id} className={`timeline-item tone-${meta.tone}`}>
            <span className="timeline-dot" aria-hidden="true">{meta.icon}</span>
            <div className="timeline-body">
              <div className="timeline-head">
                <strong>{meta.label}</strong>
                <StatusBadge status={entry.status} />
                <span className="timeline-meta">
                  {fmtDateTime(recordedAt)} · {entry.changed_by_full_name}
                </span>
              </div>
              {showHappenedOn && <p className="timeline-extra">Happened on {fmtDateTime(happenedAt)}</p>}
              {entry.note && <p className="timeline-note">{entry.note}</p>}
              {entry.next_contact_due_at && (
                <p className="timeline-extra timeline-followup">⏰ Next follow-up {fmtDateTime(fromServer(entry.next_contact_due_at))}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
