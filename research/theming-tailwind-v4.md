# Theming mechanics with Tailwind v4 tokens

Research for [#5](https://github.com/Ablation-Kitchen/website/issues/5) (map: #1). Sources checked 2026-11-12. This is a throwaway findings note; it is not merged.

## Answer in one paragraph

Declare the eight colour tokens once in a **non-`inline` `@theme`** block (`--color-bg`, `--color-surface`, ...) so Tailwind generates `bg-bg`, `text-ink`, `border-rule`, etc., and every utility compiles to `var(--color-*)`. Re-declare the same variables under `[data-theme="dark"]` (plus a `prefers-color-scheme` fallback for no-JS). Override Tailwind's `dark` variant with `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` for the rare one-off. A tiny `<script is:inline>` in `<head>` sets `data-theme` from `localStorage` or `matchMedia` before first paint, and re-applies it on `astro:after-swap`. The 0.5s cross-fade only runs while a short-lived `theme-fading` class is on `<html>`. The toggle adds that class just before it flips the theme, and the CSS sits inside `@media (prefers-reduced-motion: no-preference)`. First paint, View Transition swaps and reduced-motion users therefore never animate.

## Findings

### 1. Tokens to utilities: `@theme` (not `@theme inline`)

- Theme variables "instruct Tailwind to create new utility classes". The `--color-*` namespace produces colour utilities such as `bg-*` and `text-*`. Source: [Tailwind: Theme variables](https://tailwindcss.com/docs/theme).
- "All of your theme variables are turned into regular CSS variables when you compile your CSS". By default "only used CSS variables will be generated"; `@theme static` emits all of them. Source: [Tailwind: Theme variables](https://tailwindcss.com/docs/theme).
- With `@theme inline`, "the utility class will use the theme variable *value* instead of referencing the actual theme variable". Source: [Tailwind: Theme variables](https://tailwindcss.com/docs/theme).
  - **Consequence:** use plain `@theme` with literal light values. Utilities then reference `var(--color-bg)`, so overriding `--color-bg` under `[data-theme=dark]` re-themes everything with no `dark:` classes. Use `@theme inline` only if you keep a second layer of raw variables (`--bg`) and map `--color-bg: var(--bg)`. That layer adds nothing here.
- Tailwind's own guidance: use `@theme` when a token should map to a utility, and `:root` for plain variables that shouldn't. Source: [Tailwind: Theme variables](https://tailwindcss.com/docs/theme).

### 2. The `dark` variant on a `data-theme` attribute

- Verbatim from the docs: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`. Source: [Tailwind: Dark mode](https://tailwindcss.com/docs/dark-mode).
- `@custom-variant` is the general directive (for example `theme-midnight`). Source: [Tailwind: Functions and directives](https://tailwindcss.com/docs/functions-and-directives).
- The tokens swap on their own, so `dark:` is only an escape hatch, for example for an image or SVG that needs a different asset per theme.

### 3. Default from `prefers-color-scheme`, persisted choice, no flash

- Tailwind's recommended script reads `localStorage.theme` and falls back to `matchMedia("(prefers-color-scheme: dark)")`. The docs say it is "best to add inline in `head` to avoid FOUC". Source: [Tailwind: Dark mode](https://tailwindcss.com/docs/dark-mode).
- In Astro, a `<script>` with any attribute other than `src` is not processed or bundled. `is:inline` renders it as written, so it runs synchronously where it sits in `<head>`. Source: [Astro: Scripts and event handling](https://docs.astro.build/en/guides/client-side-scripts/).
- Set `color-scheme` per theme so the canvas, scrollbars and form controls match. Add `<meta name="color-scheme" content="light dark">` in `<head>` before any CSS, which helps "prevent unwanted screen flashes during the page load". Source: [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme).
- Storage: one key, `theme` = `"light"` | `"dark"`, written only when the visitor clicks. An absent key means "follow the OS". Wrap storage access in try/catch, because private modes can throw.

### 4. Surviving Astro View Transitions (`<ClientRouter />`)

- `astro:after-swap` fires right after the new page replaces the old one. It is "the latest point in the lifecycle where it is still safe" to set a theme. The docs' own example re-applies dark mode there. Source: [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/).
- Alternative: in `astro:before-swap`, write to `event.newDocument.documentElement.dataset.theme`. Source: [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/).
- Bundled module scripts "are only ever executed once". Inline scripts can run again during a visit, and `data-astro-rerun` forces a re-run. Source: [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/).
  - **Consequence:** make the head script idempotent. Guard the listener with a window flag so repeat runs don't stack duplicate `astro:after-swap` handlers. Put the toggle's click handler in a normal bundled `<script>`, bound on `astro:page-load`, because the button is replaced on every swap.
- Under `prefers-reduced-motion`, ClientRouter "disables all view transition animations, including fallback animation". Source: [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/).

### 5. The 0.5s cross-fade, gated

- `prefers-reduced-motion: reduce` means the user asked for reduced motion. `no-preference` evaluates as false. Source: [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). Tailwind's `motion-safe` variant maps to `@media (prefers-reduced-motion: no-preference)`. Source: [Tailwind: Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states).
- Design choice (not a docs claim): don't put a permanent `transition` on colours. Doing so would fade on first paint, whenever the head script corrects the theme, and on every `after-swap`. Instead, the toggle:
  1. adds `theme-fading` to `<html>`
  2. flips `data-theme` and writes storage
  3. removes the class after 500ms (a `setTimeout` is more robust than `transitionend`, which may not fire).
- The fade CSS lives inside `@media (prefers-reduced-motion: no-preference)`, so reduced-motion users get an instant swap.

## Sketch

```css
/* global.css */
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

@theme {
  --color-bg: #F7F6F3;  --color-surface: #FFFFFF;  --color-ink: #111111;
  --color-soft: #3B3B38; --color-meta: #6A6A66;    --color-rule: #E4E2DC;
  --color-accent: #E4572E; --color-accent-text: #B83D1A;
  --ease-kitchen: cubic-bezier(.2,.7,.2,1);
}

:root { color-scheme: light; }

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #0C0C0B;  --color-surface: #141413;  --color-ink: #EDEBE6;
  --color-soft: #C7C4BC; --color-meta: #9A9A95;    --color-rule: #262624;
  --color-accent: #FF6A3D; --color-accent-text: #FF7A52;
}

/* no-JS fallback: follow the OS when the script never set data-theme */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { color-scheme: dark; /* same dark values as above */ }
}

@media (prefers-reduced-motion: no-preference) {
  html.theme-fading, html.theme-fading * {
    transition: background-color .5s var(--ease-kitchen), color .5s var(--ease-kitchen),
                border-color .5s var(--ease-kitchen), fill .5s var(--ease-kitchen),
                stroke .5s var(--ease-kitchen) !important;
  }
}
```

```html
<!-- in <head>, before the stylesheet link -->
<meta name="color-scheme" content="light dark" />
<script is:inline>
  (() => {
    const get = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
    const apply = () => {
      const t = get() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = t;
    };
    apply();
    if (!window.__themeBound) {
      window.__themeBound = true;
      document.addEventListener("astro:after-swap", apply);
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!get()) apply(); });
    }
  })();
</script>
```

The toggle (bundled script, bound on `astro:page-load`): add `theme-fading`, set the opposite `data-theme`, `localStorage.setItem("theme", next)`, `setTimeout(() => remove "theme-fading", 500)`. Update the icon (sun = light, moon = dark, showing the *current* theme) and the `aria-label`.

## Bonus: WCAG contrast of the text tokens

Relative luminance per WCAG 2.x, computed locally.

| Pair | Light on bg | Light on surface | Dark on bg | Dark on surface |
|---|---|---|---|---|
| ink | 17.47 | 18.88 | 16.43 | 15.47 |
| soft | 10.40 | 11.24 | 11.23 | 10.58 |
| meta | 5.03 | 5.43 | 6.92 | 6.52 |
| accentText | 5.22 | 5.64 | 7.60 | 7.16 |
| accent (not a text token) | **3.41** | **3.68** | 6.88 | 6.48 |

All of soft, meta and accentText pass 4.5:1 (AA, normal text) in both themes. Light-theme `accent` is under 4.5:1. That is fine for non-text UI and large text (3:1), but `accent` must never be used for body-size text in light mode. That rule is why `accentText` exists.

## Open questions surfaced

- The toggle has two states, so after the first click there is no way back to "follow the OS". Is that acceptable, or should something (for example a long-press or a footer link) clear the stored key?
- Should `<meta name="theme-color">` follow the active theme (mobile browser chrome)? If yes, the head script also has to update it.
- Should the theme toggle use `document.startViewTransition()` for a snapshot cross-fade instead of per-property transitions? It is simpler to make exact, but it interacts with ClientRouter's own transitions. Prototype it only if the class-gated fade looks uneven.
