/**
 * Shared helpers for the pipeline ("hot list") feature.
 */
import { DealPeriod, DealStage, Priority, RelationshipStatus, WaitingOn } from '../types';
import { fromServer, fmtDate, fmtDateTime } from './dates';

export const PRIORITY_ORDER: Priority[] = [Priority.HOT, Priority.WARM, Priority.COLD];

export const PRIORITY_META: Record<Priority, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  [Priority.HOT]: { label: 'Hot', emoji: '🔥', color: '#b42318', bg: '#fee4e2', border: '#fda29b' },
  [Priority.WARM]: { label: 'Warm', emoji: '🌤️', color: '#b54708', bg: '#fef0c7', border: '#fec84b' },
  [Priority.COLD]: { label: 'Cold', emoji: '❄️', color: '#175cd3', bg: '#d1e9ff', border: '#84caff' },
};

export const STATUS_LABELS: Record<string, string> = {
  [RelationshipStatus.NEW]: 'New',
  [RelationshipStatus.CONTACTED]: 'Contacted',
  [RelationshipStatus.FOLLOW_UP_NEEDED]: 'Follow-up needed',
  [RelationshipStatus.INTERESTED]: 'Interested',
  [RelationshipStatus.NOT_INTERESTED]: 'Not interested',
  [RelationshipStatus.CUSTOMER]: 'Customer',
  [RelationshipStatus.INACTIVE]: 'Inactive',
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole local calendar days from today to `d` (negative = in the past). */
export function calendarDaysFromToday(d: Date): number {
  return Math.round((startOfDay(d) - startOfDay(new Date())) / DAY_MS);
}

export type FollowUpTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export interface FollowUpInfo {
  label: string;
  tone: FollowUpTone;
  title: string;
}

/** Human label + urgency tone for a next-follow-up timestamp. */
export function followUpInfo(dateStr?: string | null): FollowUpInfo {
  if (!dateStr) return { label: 'Not set', tone: 'none', title: 'No follow-up scheduled' };
  const d = fromServer(dateStr);
  const title = fmtDateTime(d);
  const days = calendarDaysFromToday(d);
  const isPast = d.getTime() <= Date.now();

  if (isPast) {
    if (days === 0) return { label: 'Due today', tone: 'overdue', title };
    return { label: `${-days}d overdue`, tone: 'overdue', title };
  }
  if (days === 0) return { label: 'Today', tone: 'today', title };
  if (days === 1) return { label: 'Tomorrow', tone: 'soon', title };
  if (days <= 7) return { label: `In ${days} days`, tone: 'soon', title };
  return { label: fmtDate(d), tone: 'later', title };
}

/** "3 days ago" style label for the last-contact timestamp. */
export function lastContactInfo(dateStr?: string | null): { label: string; title: string } {
  if (!dateStr) return { label: 'Never', title: 'Never contacted' };
  const d = fromServer(dateStr);
  const days = -calendarDaysFromToday(d);
  const title = fmtDateTime(d);
  if (days <= 0) return { label: 'Today', title };
  if (days === 1) return { label: 'Yesterday', title };
  if (days < 14) return { label: `${days} days ago`, title };
  if (days < 60) return { label: `${Math.round(days / 7)} weeks ago`, title };
  if (days < 365) return { label: `${Math.round(days / 30)} months ago`, title };
  return { label: fmtDate(d), title };
}

export type FollowUpPreset = 'tomorrow' | '3days' | 'week' | '2weeks' | 'month';

export const FOLLOW_UP_PRESETS: { key: FollowUpPreset; label: string; days: number }[] = [
  { key: 'tomorrow', label: 'Tomorrow', days: 1 },
  { key: '3days', label: 'In 3 days', days: 3 },
  { key: 'week', label: 'In a week', days: 7 },
  { key: '2weeks', label: 'In 2 weeks', days: 14 },
  { key: 'month', label: 'In a month', days: 30 },
];

/** ISO timestamp (UTC) for 09:00 local time, `days` from today. */
export function followUpIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** ISO timestamp (UTC) for 09:00 local on a "YYYY-MM-DD" date input value. */
export function followUpIsoFromDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0, 0).toISOString();
}

/** "YYYY-MM-DD" (local) for a server timestamp, for <input type="date">. */
export function toDateInput(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = fromServer(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function detailPath(type: 'company' | 'contact', id: number): string {
  return type === 'company' ? `/companies/${id}` : `/contacts/${id}`;
}

// ── Deal: stage, waiting-on, value ─────────────────────────────────────

export const STAGE_ORDER: DealStage[] = [
  DealStage.LEAD,
  DealStage.DEMO,
  DealStage.TRIAL,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.WON,
  DealStage.LOST,
];

export const STAGE_META: Record<DealStage, { label: string; color: string; bg: string }> = {
  [DealStage.LEAD]: { label: 'Lead', color: '#475467', bg: '#f2f4f7' },
  [DealStage.DEMO]: { label: 'Demo', color: '#3538cd', bg: '#e0eaff' },
  [DealStage.TRIAL]: { label: 'Trial', color: '#6927da', bg: '#ebe9fe' },
  [DealStage.PROPOSAL]: { label: 'Proposal', color: '#b54708', bg: '#fef0c7' },
  [DealStage.NEGOTIATION]: { label: 'Negotiation', color: '#c4320a', bg: '#ffead5' },
  [DealStage.WON]: { label: 'Won', color: '#067647', bg: '#d1fadf' },
  [DealStage.LOST]: { label: 'Lost', color: '#b42318', bg: '#fee4e2' },
};

export const WAITING_META: Record<WaitingOn, { label: string; short: string; color: string; bg: string }> = {
  client: { label: 'Waiting on client', short: 'Client', color: '#475467', bg: '#f2f4f7' },
  us: { label: 'Waiting on us', short: 'Us', color: '#b54708', bg: '#fef0c7' },
};

export const PERIOD_META: Record<DealPeriod, { label: string; suffix: string }> = {
  monthly: { label: 'Monthly', suffix: '/ mo' },
  yearly: { label: 'Yearly', suffix: '/ yr' },
  one_time: { label: 'One-time', suffix: 'one-time' },
};

const eurWhole = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const eurCents = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Croatian money format, e.g. "1.234,50 €" (no decimals for whole amounts). */
export function formatMoney(value: number): string {
  return (Number.isInteger(value) ? eurWhole : eurCents).format(value);
}

/** "170 € / mo", "12.000 € / yr" or "500 € one-time". */
export function formatDeal(value?: number | null, period?: DealPeriod | null): string {
  if (value === null || value === undefined) return '';
  const p = PERIOD_META[period ?? 'monthly'];
  return `${formatMoney(value)} ${p.suffix}`;
}

/**
 * Parse an amount typed the Croatian way: "1.234,50", "170", "170,5", "1234.5".
 * Returns null for empty / invalid / negative input.
 */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[€\s]/g, '');
  if (!t) return null;
  let normalised: string;
  if (t.includes(',')) normalised = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normalised = t.replace(/\./g, '');
  else normalised = t;
  const v = Number(normalised);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}

/** Amount for a text input, with a decimal comma. */
export function amountToInput(value?: number | null): string {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

/** Local "YYYY-MM-DDTHH:mm" for 09:00, `days` from today (the value shape of DateTimeInput). */
export function followUpLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}
