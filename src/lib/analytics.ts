/**
 * The one hook point for custom analytics events from client code (#15).
 * Link and button clicks use `data-umami-event*` attributes instead; this is
 * for events no element can carry, like `search-open` (#38).
 *
 * Nothing is loaded here. Until the Umami script lands (#41) `window.umami`
 * is undefined and `track()` does nothing; once it's there, events go
 * straight to it. It never throws: analytics must not break the page.
 */

export type EventData = Record<string, string | number | boolean>;

type Umami = { track(event: string, data?: EventData): unknown };

export function track(event: string, data?: EventData): void {
  try {
    (globalThis as { umami?: Umami }).umami?.track(event, data);
  } catch {
    // Blocked or broken tracker: ignore.
  }
}
