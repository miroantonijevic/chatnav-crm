/**
 * Shared date utilities.
 *
 * The backend stores naive UTC datetimes and Pydantic serialises them
 * without a 'Z' suffix. fromServer() ensures they are always parsed as UTC.
 */

/** Parse a server datetime string as UTC. */
export function fromServer(dateStr: string): Date {
  return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
}

/** DD.MM.YYYY, HH:mm */
export function fmtDateTime(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y}, ${hh}:${mm}`;
}

/** Current local time as "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
export function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/**
 * Converts a server datetime string to "YYYY-MM-DDTHH:mm" in local time,
 * suitable as the value of a datetime-local input.
 */
export function toInputLocal(dateStr: string): string {
  const d = fromServer(dateStr);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** Extract "YYYY-MM-DD" from a datetime string. Returns '' if empty. */
export function dtDate(v: string): string {
  return v ? v.slice(0, 10) : '';
}

/** Extract "HH:mm" from a datetime string. Returns '09:30' if empty (default time). */
export function dtTime(v: string): string {
  return v ? v.slice(11, 16) : '09:30';
}

/** Combine date + time into "YYYY-MM-DDTHH:mm". Returns '' if no date. */
export function dtCombine(date: string, time: string): string {
  return date ? `${date}T${time || '09:30'}` : '';
}

/** DD.MM.YYYY */
export function fmtDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

// ── Croatian date handling (dd.mm.yyyy) ─────────────────────────────────

export const HR_MONTHS = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
];
export const HR_WEEKDAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

/** "YYYY-MM-DD" → "dd.mm.yyyy" ('' for empty/invalid input). */
export function isoToHr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** True when y/m/d (m is 1-12) is a real calendar date. */
export function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** "dd.mm.yyyy" (also "d.m.yyyy", "dd/mm/yyyy", 2-digit year) → "YYYY-MM-DD", or null if invalid. */
export function hrToIso(text: string): string | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\.?$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (!isRealDate(y, mo, d)) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Auto-format typed input as dd.mm.yyyy. Digits fill day, month and year in turn
 * (dots are inserted for you); typing a separator after a single digit pads it
 * with a zero, so "1.3.2027" becomes "01.03.2027".
 */
export function maskHrDate(raw: string): string {
  const max = [2, 2, 4];
  const groups: string[] = [''];
  for (const ch of raw) {
    const g = groups.length - 1;
    if (/\d/.test(ch)) {
      if (groups[g].length >= max[g]) {
        if (g === 2) continue; // year is full
        groups.push('');
      }
      groups[groups.length - 1] += ch;
    } else if (/[./\- ]/.test(ch) && groups[g] && g < 2) {
      if (groups[g].length === 1) groups[g] = `0${groups[g]}`;
      groups.push('');
    }
  }
  return groups.join('.');
}

/** Auto-format typed digits as HH:mm (24-hour). */
export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** "HH:mm" or loose input ("9", "930", "9:30") → "HH:mm", or null if not a valid 24h time. */
export function normalizeTime(text: string): string | null {
  const t = text.trim();
  let h: number;
  let mi: number;
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (colon) {
    h = Number(colon[1]);
    mi = Number(colon[2]);
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    mi = 0;
  } else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, t.length - 2));
    mi = Number(t.slice(-2));
  } else {
    return null;
  }
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
