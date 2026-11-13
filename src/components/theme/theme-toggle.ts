import { DARK_QUERY, LIGHT_QUERY, STORAGE_KEY, THEME_COLOR, type Theme } from './theme';

const root = document.documentElement;
const osQuery = matchMedia(DARK_QUERY);
const FADE_MS = 500;
let fadeTimer: number | undefined;

const osTheme = (): Theme => (osQuery.matches ? 'dark' : 'light');

function readSaved(): Theme | null {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function writeSaved(theme: Theme | null): void {
  try {
    if (theme) localStorage.setItem(STORAGE_KEY, theme);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the change still applies to this page.
  }
}

export const currentTheme = (): Theme => (root.dataset.theme === 'dark' ? 'dark' : 'light');

/** One `theme-color` tag for a saved preference, otherwise the two media-query tags. */
function syncThemeColor(saved: Theme | null): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const add = (content: string, media?: string) => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    if (media) meta.media = media;
    meta.content = content;
    document.head.append(meta);
  };
  if (saved) add(THEME_COLOR[saved]);
  else {
    add(THEME_COLOR.light, LIGHT_QUERY);
    add(THEME_COLOR.dark, DARK_QUERY);
  }
}

function updateToggles(): void {
  const label = currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  document
    .querySelectorAll('theme-toggle button')
    .forEach((b) => b.setAttribute('aria-label', label));
}

/** Applies a theme. The cross-fade CSS only animates when motion is allowed. */
function apply(theme: Theme, saved: Theme | null): void {
  if (theme !== currentTheme()) {
    root.classList.add('theme-fading');
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => root.classList.remove('theme-fading'), FADE_MS);
    root.dataset.theme = theme;
  }
  syncThemeColor(saved);
  updateToggles();
}

/** Flips Light/Dark. Landing on the OS's theme deletes the preference (back to following the OS). */
export function toggleTheme(): void {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  const saved = next === osTheme() ? null : next;
  writeSaved(saved);
  apply(next, saved);
}

// Nothing saved: follow live OS changes.
osQuery.addEventListener('change', () => {
  if (!readSaved()) apply(osTheme(), null);
});

// Another tab saved or cleared a preference (key is null when storage is cleared).
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  const saved = readSaved();
  apply(saved ?? osTheme(), saved);
});

class ThemeToggle extends HTMLElement {
  connectedCallback(): void {
    this.querySelector('button')?.addEventListener('click', toggleTheme);
    updateToggles();
  }
}

if (!customElements.get('theme-toggle')) customElements.define('theme-toggle', ThemeToggle);
