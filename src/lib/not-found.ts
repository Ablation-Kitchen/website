/**
 * The requested path as the 404 page's "ticket 404" prints it (#36).
 * Percent-escapes are decoded where valid, and anything longer than the
 * 220px ticket holds on one line is cut with an ellipsis.
 */

/** Characters that fit after "1× " on the 220px ticket in 11.5px mono. */
export const TICKET_PATH_MAX = 22;

/** Shown when there is no path to print (and before the script runs). */
export const TICKET_PATH_FALLBACK = '/that-page';

export function ticketPath(pathname: string, max: number = TICKET_PATH_MAX): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // Malformed escape: print it as it came.
  }
  if (!path || path === '/') return TICKET_PATH_FALLBACK;
  const chars = [...path];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : path;
}
