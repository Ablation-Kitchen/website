/**
 * <call-order>: the ⌘K "Call an order" palette (#38). CallOrder.astro renders
 * the trigger, an empty `<dialog>` and a JSON data block; this adds behaviour:
 *
 * - opens on the trigger, ⌘K / Ctrl+K (toggles) and `/` when not typing, and
 *   fires `search-open` with `via` = keys | button;
 * - the input is an ARIA combobox: ↑/↓ move the active option
 *   (`aria-activedescendant`), Enter picks it, Esc closes the dialog and focus
 *   goes back to the trigger;
 * - Pagefind is imported on the first open, never before, so a page that
 *   never opens the palette loads no Pagefind bytes. Search shows "warming
 *   up…" until it's ready;
 * - every row is built with DOM APIs. The one HTML string, Pagefind's
 *   `<mark>` excerpt, goes through the site's one Trusted Types policy
 *   (`excerptHtml`) and is then copied node by node: text and `<mark>` only.
 */
import { track } from '../../lib/analytics';
import {
  excerptHtml,
  filterItems,
  isApple,
  isTyping,
  noMatch,
  PAGEFIND_URL,
  SEARCH_LIMIT,
  shortcut,
  STATUS,
  type PaletteData,
  type PaletteItem,
} from '../../lib/palette';
import { TRUSTED_TYPES_POLICY } from '../../lib/trusted-types';
import { toggleTheme } from '../theme/theme-toggle';

/** The slice of Pagefind's JS API the palette uses. */
interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
}
interface Pagefind {
  options(options: { noWorker?: boolean }): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(
    term: string,
    options?: object,
    debounceMs?: number,
  ): Promise<{ results: { data(): Promise<PagefindResultData> }[] } | null>;
}

interface SearchHit {
  title: string;
  url: string;
  excerpt: string;
}

/** One rendered option and what picking it does. */
interface Row {
  /** Stable across re-renders, so the active option survives results arriving. */
  key: string;
  el: HTMLElement;
  pick: () => void;
}

// TypeScript's DOM lib has no Trusted Types yet.
type TrustedTypes = {
  createPolicy(
    name: string,
    rules: { createHTML: (s: string) => string },
  ): { createHTML(s: string): string };
};

let excerptPolicy: { createHTML(s: string): string } | undefined;

/** Pagefind's excerpt as DOM: text nodes and `<mark>` elements, nothing else. */
function excerptNodes(excerpt: string): DocumentFragment {
  const tt = (window as unknown as { trustedTypes?: TrustedTypes }).trustedTypes;
  if (tt && !excerptPolicy) {
    excerptPolicy = tt.createPolicy(TRUSTED_TYPES_POLICY, { createHTML: excerptHtml });
  }
  const template = document.createElement('template');
  // Without Trusted Types support there's no enforcement either; the string is the same.
  template.innerHTML = excerptPolicy ? excerptPolicy.createHTML(excerpt) : excerptHtml(excerpt);
  const out = document.createDocumentFragment();
  for (const node of template.content.childNodes) {
    if (node.nodeName === 'MARK') {
      const mark = document.createElement('mark');
      mark.textContent = node.textContent;
      out.append(mark);
    } else {
      out.append(document.createTextNode(node.textContent ?? ''));
    }
  }
  return out;
}

class CallOrder extends HTMLElement {
  #data: PaletteData | undefined;
  #trigger: HTMLButtonElement | null = null;
  #dialog: HTMLDialogElement | null = null;
  #input: HTMLInputElement | null = null;
  #status: HTMLElement | null = null;
  #list: HTMLElement | null = null;

  #search: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  #pagefind: Pagefind | undefined;
  /** Results for the current query; `null` while they're on their way. */
  #hits: SearchHit[] | null = null;
  /** Bumped on every query change, so a late answer for an old query is dropped. */
  #searchId = 0;
  #rows: Row[] = [];
  #active = -1;
  #note = '';

  connectedCallback(): void {
    const data = this.querySelector('script[data-palette]');
    this.#trigger = this.querySelector('button[data-trigger]');
    this.#dialog = this.querySelector('dialog');
    this.#input = this.querySelector('input[data-input]');
    this.#status = this.querySelector('[data-status]');
    this.#list = this.querySelector('[data-list]');
    if (!data?.textContent || !this.#trigger || !this.#dialog || !this.#input) return;
    this.#data = JSON.parse(data.textContent) as PaletteData;

    const platform =
      (navigator as { userAgentData?: { platform: string } }).userAgentData?.platform ??
      navigator.platform;
    const kbd = this.querySelector('[data-kbd]');
    if (kbd && !isApple(platform)) kbd.textContent = 'Ctrl K';

    this.#trigger.addEventListener('click', () => this.open('button'));
    this.#input.addEventListener('input', () => this.#onQuery());
    this.#input.addEventListener('keydown', (e) => this.#onKey(e));
    this.#dialog.addEventListener('close', () => this.#trigger?.focus());
    // A click on the dialog box itself (not its content) is a click on the backdrop.
    this.#dialog.addEventListener('click', (e) => {
      if (e.target === this.#dialog) this.close();
    });
    document.addEventListener('keydown', (e) => {
      const which = shortcut(e, isTyping(document.activeElement as HTMLElement | null));
      if (!which) return;
      if (which === 'toggle' && this.#dialog?.open) {
        e.preventDefault();
        this.close();
      } else if (!this.#dialog?.open) {
        e.preventDefault();
        this.open('keys');
      }
    });
  }

  open(via: 'keys' | 'button'): void {
    const dialog = this.#dialog;
    if (!dialog || dialog.open || !this.#input) return;
    track('search-open', { via });
    this.#input.value = '';
    this.#note = '';
    this.#onQuery();
    dialog.showModal();
    this.#input.focus();
    void this.#loadPagefind();
  }

  close(): void {
    this.#dialog?.close();
  }

  get #query(): string {
    return this.#input?.value.trim() ?? '';
  }

  async #loadPagefind(): Promise<void> {
    if (this.#search !== 'idle') return;
    this.#search = 'loading';
    this.#render();
    try {
      const pagefind = (await import(/* @vite-ignore */ PAGEFIND_URL)) as Pagefind;
      // No Web Worker: `new Worker(url)` is a Trusted Types sink (and the build drops the file).
      await pagefind.options({ noWorker: true });
      await pagefind.init();
      this.#pagefind = pagefind;
      this.#search = 'ready';
    } catch {
      this.#search = 'failed';
    }
    if (this.#query) void this.#runSearch();
    else this.#render();
  }

  #onQuery(): void {
    this.#searchId++;
    this.#hits = null;
    this.#note = '';
    this.#active = -1; // a new query starts at its first option
    this.#render();
    if (this.#query && this.#search === 'ready') void this.#runSearch();
  }

  async #runSearch(): Promise<void> {
    const id = this.#searchId;
    const query = this.#query;
    if (!this.#pagefind || !query) return;
    try {
      const found = await this.#pagefind.debouncedSearch(query, {}, 120);
      if (!found || id !== this.#searchId) return; // superseded
      const data = await Promise.all(found.results.slice(0, SEARCH_LIMIT).map((r) => r.data()));
      if (id !== this.#searchId) return;
      this.#hits = data.map((d) => ({
        title: d.meta.title ?? d.url,
        url: d.url,
        excerpt: d.excerpt,
      }));
    } catch {
      if (id !== this.#searchId) return;
      this.#hits = [];
    }
    this.#render();
  }

  #onKey(e: KeyboardEvent): void {
    const n = this.#rows.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.#setActive((this.#active + step + n) % n, true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.#rows[this.#active]?.pick();
    }
  }

  #setActive(i: number, scroll: boolean): void {
    this.#rows.forEach((row, j) => row.el.setAttribute('aria-selected', String(i === j)));
    this.#active = i;
    const row = this.#rows[i];
    if (row) {
      this.#input?.setAttribute('aria-activedescendant', row.el.id);
      if (scroll) row.el.scrollIntoView({ block: 'nearest' });
    } else {
      this.#input?.removeAttribute('aria-activedescendant');
    }
  }

  #pick(item: PaletteItem): void {
    const data = this.#data;
    if (!data) return;
    if (item.kind === 'goto') return this.#go(item.href);
    if (item.action === 'theme') {
      this.close();
      toggleTheme();
    } else if (item.action === 'cv') {
      this.close();
      track('cv-download', { location: 'palette' });
      const a = document.createElement('a');
      a.href = data.cv.href;
      a.download = data.cv.downloadName;
      a.click();
    } else {
      navigator.clipboard.writeText(data.email).then(
        () => this.#say(`Copied ${data.email}`),
        () => this.#say(`Copy didn’t work. The email is ${data.email}`),
      );
    }
  }

  #say(note: string): void {
    this.#note = note;
    this.#render();
  }

  #go(href: string): void {
    this.close();
    location.assign(href);
  }

  /** Rebuilds the listbox and the status line from the current state. */
  #render(): void {
    const data = this.#data;
    const list = this.#list;
    if (!data || !list || !this.#input || !this.#status) return;
    const query = this.#query;

    type Spec = Omit<Row, 'el'> & { build: (el: HTMLElement) => void };
    const groups: { label: string; rows: Spec[] }[] = [];
    const itemRow = (item: PaletteItem): Spec => ({
      key: item.kind === 'goto' ? `goto:${item.href}` : `action:${item.action}`,
      build: (el: HTMLElement) => {
        el.append(span('label', item.label));
        if (item.hint) el.append(span('hint', item.hint));
      },
      pick: () => this.#pick(item),
    });

    const goto = filterItems(data.goto, query);
    if (goto.length) groups.push({ label: 'Go to', rows: goto.map(itemRow) });
    const hits = query ? (this.#hits ?? []) : [];
    if (hits.length) {
      groups.push({
        label: 'Search',
        rows: hits.map((hit) => ({
          key: `search:${hit.url}`,
          build: (el: HTMLElement) => {
            el.append(span('label', hit.title));
            const excerpt = span('excerpt', '');
            excerpt.append(excerptNodes(hit.excerpt));
            el.append(excerpt);
          },
          pick: () => this.#go(hit.url),
        })),
      });
    }
    const actions = filterItems(data.actions, query);
    if (actions.length) groups.push({ label: 'Actions', rows: actions.map(itemRow) });

    const rows: Row[] = [];
    const nodes = groups.map((group, g) => {
      const el = document.createElement('div');
      el.setAttribute('role', 'group');
      const label = document.createElement('div');
      label.id = `call-order-group-${g}`;
      label.className = 'group-label';
      label.setAttribute('role', 'presentation');
      label.textContent = group.label;
      el.setAttribute('aria-labelledby', label.id);
      el.append(label);
      for (const row of group.rows) {
        const option = document.createElement('div');
        option.id = `call-order-option-${rows.length}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        row.build(option);
        const i = rows.length;
        option.addEventListener('click', () => row.pick());
        option.addEventListener('mousemove', () => {
          if (this.#active !== i) this.#setActive(i, false);
        });
        rows.push({ key: row.key, el: option, pick: row.pick });
        el.append(option);
      }
      return el;
    });
    const activeKey = this.#rows[this.#active]?.key;
    list.replaceChildren(...nodes);
    this.#rows = rows;
    list.hidden = rows.length === 0;
    this.#input.setAttribute('aria-expanded', String(rows.length > 0));
    const kept = rows.findIndex((r) => r.key === activeKey);
    this.#setActive(kept >= 0 ? kept : rows.length ? 0 : -1, false);

    let status = this.#note;
    if (!status && query) {
      if (this.#search === 'loading' || this.#search === 'idle') status = STATUS.warmingUp;
      else if (this.#search === 'failed')
        status = rows.length ? STATUS.searchFailed : noMatch(query);
      else if (this.#hits !== null && rows.length === 0) status = noMatch(query);
    }
    if (this.#status.textContent !== status) this.#status.textContent = status;
  }
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

if (!customElements.get('call-order')) customElements.define('call-order', CallOrder);
