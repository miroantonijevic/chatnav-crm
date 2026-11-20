/**
 * Small display helpers for contacts / companies used on lists and detail pages.
 */
import React from 'react';
import { followUpInfo } from '../utils/pipeline';
import { splitValues } from '../utils/lists';

/** Coloured follow-up chip (Overdue / Today / In 3 days / date). */
export const FollowUpBadge: React.FC<{ value?: string | null; emptyLabel?: string }> = ({ value, emptyLabel = '—' }) => {
  if (!value) return <span className="faint">{emptyLabel}</span>;
  const info = followUpInfo(value);
  return (
    <span className={`pl-followup pl-tone-${info.tone}`} title={info.title} style={{ cursor: 'default' }}>
      {info.label}
    </span>
  );
};

/** First e-mail and phone as links, with a "+N" badge when there are more. */
export const ContactLinks: React.FC<{ emails: string[]; phones: string[] }> = ({ emails: rawEmails, phones: rawPhones }) => {
  const emails = splitValues(rawEmails);
  const phones = splitValues(rawPhones);
  if (emails.length === 0 && phones.length === 0) return <span className="faint">—</span>;
  const extra = emails.length + phones.length - (emails[0] ? 1 : 0) - (phones[0] ? 1 : 0);
  const all = [...emails, ...phones].join('\n');
  return (
    <div className="contact-links">
      {emails[0] && <a href={`mailto:${emails[0]}`} title={emails[0]}>✉ {emails[0]}</a>}
      {phones[0] && <a href={`tel:${phones[0]}`} title={phones[0]}>☎ {phones[0]}</a>}
      {extra > 0 && <span className="badge" title={all}>+{extra} more</span>}
    </div>
  );
};

/** Label / value row for the detail sidebars. */
export const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="info-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);
