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
