/**
 * The ⌘K "Call an order" palette (#38): its data and the pure rules behind it,
 * kept free of the DOM so the unit tests can cover them. The element itself is
 * src/components/palette/call-order.ts.
 */

/** Where Pagefind's index is served (written by integrations/pagefind.ts). */
export const PAGEFIND_URL = '/pagefind/pagefind.js';

/** Search shows Pagefind's top results only (spec: "top ~8"). */
export const SEARCH_LIMIT = 8;

export type ActionId = 'theme' | 'email' | 'cv';

/** A static row: a page to go to, or an action. Search rows come from Pagefind. */
export type PaletteItem =
  | { kind: 'goto'; label: string; href: string; hint?: string }
  | { kind: 'action'; label: string; action: ActionId; hint?: string };

/** What the server renders into the palette's data block. */
export interface PaletteData {
  goto: PaletteItem[];
  actions: PaletteItem[];
  email: string;
  cv: { href: string; downloadName: string };
}

export const STATUS = {
  warmingUp: 'warming up…',
  searchFailed: 'Search didn’t load. Go to and Actions still work.',
} as const;

/** The no-match line (spec: Interactions → ⌘K). */
export function noMatch(query: string): string {
  return `86’d: nothing on the menu for ‘${query.trim()}’`;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Every word of the query appears in the label (or hint), in any order, ignoring case and accents. */
export function matches(item: PaletteItem, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const text = fold(`${item.label} ${item.hint ?? ''}`);
  return words.every((w) => text.includes(w));
}

export function filterItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  return items.filter((item) => matches(item, query));
}

/** Minimal key event shape, so the rule is testable without a DOM. */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Which shortcut a keydown is, if any. ⌘K / Ctrl+K works anywhere (it toggles
 * the palette); `/` only opens it when the reader isn't typing somewhere.
 */
export function shortcut(e: KeyLike, typing: boolean): 'toggle' | 'open' | null {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
    return 'toggle';
  }
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) return 'open';
  return null;
}

/** Tag names that take typed text. `contenteditable` is checked by the caller. */
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Whether focus is somewhere the reader types: a text field, a select or contenteditable. */
export function isTyping(el: { tagName: string; isContentEditable?: boolean } | null): boolean {
  return !!el && (TYPING_TAGS.has(el.tagName) || el.isContentEditable === true);
}

/**
 * Pagefind's excerpts are page text with each match wrapped in `<mark>`. This
 * is the Trusted Types policy's `createHTML`: everything but a bare `<mark>` /
 * `</mark>` has its angle brackets escaped, so the parsed result can only be
 * text and `<mark>` elements (the palette then copies just those two node
 * types, as a second fence).
 */
export function excerptHtml(excerpt: string): string {
  return excerpt
    .split(/(<\/?mark>)/)
    .map((part) =>
      part === '<mark>' || part === '</mark>'
        ? part
        : part.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    )
    .join('');
}

/** Platforms that say ⌘ rather than Ctrl. */
export function isApple(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}
