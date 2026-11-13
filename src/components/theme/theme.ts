/** The two site themes. Never "prep"/"service": see GLOSSARY.md. */
export type Theme = 'light' | 'dark';

/** localStorage key holding a saved preference (`light` | `dark`). Absent = follow the OS. */
export const STORAGE_KEY = 'theme';

/** `theme-color` values: each theme's `bg` token (keep in sync with src/styles/global.css). */
export const THEME_COLOR: Record<Theme, string> = {
  light: '#F7F6F3',
  dark: '#0C0C0B',
};

export const LIGHT_QUERY = '(prefers-color-scheme: light)';
export const DARK_QUERY = '(prefers-color-scheme: dark)';
