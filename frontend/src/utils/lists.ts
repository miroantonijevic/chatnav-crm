/**
 * Helpers shared by list and detail pages.
 */

/**
 * Splits values that hold several entries in one field ("+385 98 111 ; +385 91 222")
 * into separate, trimmed, de-duplicated entries.
 */
export function splitValues(values: string[]): string[] {
  const all = values.flatMap((v) => v.split(/[;\n]+/)).map((v) => v.trim()).filter(Boolean);
  return all.filter((v, i) => all.indexOf(v) === i);
}

const key = (kind: 'contacts' | 'companies') => `listUrl:${kind}`;

/** Remember the list URL (search, filters, sort, page) so detail pages can return to it. */
export function rememberListUrl(kind: 'contacts' | 'companies', url: string) {
  try {
    sessionStorage.setItem(key(kind), url);
  } catch {
    // storage unavailable - fall back to the plain list
  }
}

/** The last list URL of this kind, or the plain list when there is none. */
export function listUrl(kind: 'contacts' | 'companies'): string {
  try {
    return sessionStorage.getItem(key(kind)) || `/${kind}`;
  } catch {
    return `/${kind}`;
  }
}
