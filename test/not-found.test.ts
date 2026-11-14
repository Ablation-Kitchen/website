import { describe, expect, it } from 'vitest';
import { TICKET_PATH_FALLBACK, TICKET_PATH_MAX, ticketPath } from '../src/lib/not-found';

describe('ticketPath', () => {
  it('prints a short path as it is', () => {
    expect(ticketPath('/menu')).toBe('/menu');
  });
  it('decodes percent-escapes', () => {
    expect(ticketPath('/caf%C3%A9')).toBe('/café');
  });
  it('keeps a malformed escape as it came', () => {
    expect(ticketPath('/bad%E0%A4%A')).toBe('/bad%E0%A4%A');
  });
  it('falls back for an empty or root path', () => {
    expect(ticketPath('')).toBe(TICKET_PATH_FALLBACK);
    expect(ticketPath('/')).toBe(TICKET_PATH_FALLBACK);
  });
  it('cuts a long path to the ticket width with an ellipsis', () => {
    const out = ticketPath('/work/a-very-long-course-slug-that-overflows');
    expect([...out]).toHaveLength(TICKET_PATH_MAX);
    expect(out).toBe('/work/a-very-long-cou…');
  });
  it('counts characters, not UTF-16 units', () => {
    expect(ticketPath(`/${'🥚'.repeat(30)}`, 5)).toBe('/🥚🥚🥚…');
  });
});
