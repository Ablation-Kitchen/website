# Island footprint against the 100 KB JS budget

Research for [#4](https://github.com/Ablation-Kitchen/website/issues/4), part of map [#1](https://github.com/Ablation-Kitchen/website/issues/1). Measured 2026-11-12.

## Question

Which island approach keeps the homepage under **100 KB of JavaScript** while building the ticket rail and trace replay (one interactive unit) plus a lazily loaded ⌘K palette: Svelte 5, Preact, React, or plain web components / vanilla TS? Also covered: how big Pagefind is and whether it can load only on ⌘K, whether `astro-icon` works inside islands, and how each option behaves with View Transitions.

## Answer

- **Rail + replay:** build it as a **vanilla TS custom element** (`<rail-replay>`) inside an `.astro` component. Astro renders all the markup on the server. A bundled `<script>` adds the click handling, and the data ships as an inline JSON `<script>`. This costs about **0.6 KB raw / 0.3 KB br**, and it needs no framework runtime and no `astro-island` loader.
  - If the team wants a component model, **Preact** is the fallback at about **9 KB br**.
  - **Svelte 5** costs about 15 KB br and is acceptable.
  - **React 19** costs about **221 KB raw / 60 KB br**. Measured raw, that alone breaks the budget.
- **⌘K palette:** write a small listener of our own (about 0.5 KB) that opens a `<dialog>` and calls `import("/pagefind/pagefind.js")` the first time it opens. Render the results in our own markup.
  - None of Pagefind loads before ⌘K. After it opens, the cost is about 12 KB br of JS plus about 11 KB br for the worker, then a roughly 60 KB WASM file and the index chunks.
  - Pagefind's own Component UI (about 33 KB br JS + 6 KB br CSS) also works, but only if it is injected on first ⌘K. Don't put it on the page eagerly.
- **Icons:** `astro-icon` is an `.astro` component, so it **cannot be imported inside a framework island**. It does work when passed as children or a slot, because it renders on the server. With the vanilla approach this problem disappears: all markup is `.astro`, so `<Icon name="ph:…">` works anywhere. Icons that must change on the client go in as inline SVG, or are pre-rendered and toggled with CSS.
- **View Transitions:** `<ClientRouter />` costs **16.3 KB raw / 4.9 KB br**.
  - With it, `transition:persist` keeps any island's state, whatever the framework.
  - A vanilla custom element keeps its state if it is persisted. If it is not, it re-initialises from the server HTML on each page.
  - Bundled module scripts run only once, so `customElements.define` and the ⌘K listener survive navigation.
  - Without ClientRouter (MPA, optionally CSS `@view-transition`), every page starts fresh and costs 0 KB.
- **Homepage total with the recommendation:** about **17.5 KB raw / about 6 KB br** of eager JS, ClientRouter included. Pagefind loads only after ⌘K.

## Measurements

Scratch project (not committed) on Node 24.7. The installed versions were the latest on npm on 2026-11-12:

- `astro@7.4.11`
- `@astrojs/svelte@9.1.5` + `svelte@5.57.3`
- `@astrojs/preact@6.1.5` + `preact@11.2.0`
- `@astrojs/react@7.1.8` + `react@19.3.1`
- `pagefind@1.6.0`
- `astro-icon@1.2.0` + `@iconify-json/ph`

Every page held the same rail + replay: three projects, `aria-pressed` buttons, and a list of steps that rise in. Each framework page used `client:load`.

A script walked each built page's eager JS: inline scripts, `<script src>`, the `astro-island` `component-url`/`renderer-url`, and their static import graph. Dynamic imports were not followed. Compressed sizes are per file (gzip -9 and brotli, as served).

| Page | Eager JS raw | gzip | brotli | What makes it up |
|---|---:|---:|---:|---|
| Vanilla custom element | **0.6 KB** | 0.4 | 0.3 | inline bundled script only (no island loader) |
| Preact island | **21.7 KB** | 9.6 | 8.6 | preact 10.5 raw, hooks 2.4, renderer client 3.0, component 0.9, astro-island loader ~5 (inline) |
| Svelte 5 island | **41.9 KB** | 16.7 | 15.1 | svelte client runtime 35.0 raw, renderer 1.0, component 1.0, loader ~5 |
| React 19 island | **221.4 KB** | 69.6 | 60.2 | react-dom client 207.8 raw, react 7.7, component 0.9, loader ~5 |
| `<ClientRouter />` alone | 16.3 KB | 5.5 | 4.9 | Astro's router script |
| ⌘K listener (pre-open) | 0.5 KB | 0.3 | 0.3 | inline; `import()` of pagefind.js not followed |

The Svelte and Preact runtimes are a fixed cost per page that every island of that framework shares. The extra cost of each additional component is under 1 KB.

**Pagefind 1.6.0 output** (bytes, measured on a 7-page index):

| File | raw | gzip | brotli | When loaded |
|---|---:|---:|---:|---|
| `pagefind.js` (JS API) | 47,228 | 13,289 | 12,080 | on `import()` (first ⌘K) |
| `pagefind-worker.js` | 42,928 | 12,344 | 11,186 | spawned by pagefind.js on init (`new Worker(...)`, falls back to main thread) |
| `wasm.en.pagefind` | 59,738 (already gzipped) | — | — | on init / first search |
| index + fragments | ~4 KB + ~4 KB/page | — | — | per search / per result |
| `pagefind-component-ui.js` + `.css` | 184,026 + 42,081 | 40,452 + 6,950 | 33,381 + 5,951 | only if we use Component UI |
| `pagefind-ui.js` + `.css` (Default UI, legacy) | 126,634 + 14,482 | 30,785 + 2,603 | 25,224 + 2,215 | not recommended |
| `pagefind-modular-ui.js` | 14,634 | 4,265 | 3,739 | legacy modular UI |

## Sources

- Astro, framework components: "You cannot import `.astro` components in a UI framework component (e.g. `.jsx` or `.svelte`)". Astro output can be passed in as children. Mixing React and Preact needs `include` configuration. <https://docs.astro.build/en/guides/framework-components/>
- Astro, View Transitions:
  - `transition:persist` keeps an island "with its current state", and `transition:persist-props` stops it re-rendering with new props.
  - Bundled module scripts "are only ever executed once". Inline scripts may re-run, and `data-astro-rerun` forces a re-run.
  - `astro:page-load` fires after each navigation.
  - <https://docs.astro.build/en/guides/view-transitions/>
- Pagefind JS API:
  - The docs give `await import("/pagefind/pagefind.js")` as the way to load it.
  - `init()` is optional and happens on the first search.
  - Indexes don't load until a search runs, and `preload()` can be called while the user types.
  - `bundlePath` must be set before `init()`.
  - <https://pagefind.app/docs/api/>
- Pagefind Component UI:
  - The Default UI "is legacy and no longer recommended".
  - The `<pagefind-modal>` trigger binds Cmd/Ctrl+K itself, and the bundle starts loading when the input gets focus.
  - `preload` defaults to `false`, and `no-worker` forces the main thread, so a worker is the default.
  - <https://pagefind.app/llms-component-ui.txt>
- astro-icon README: "Astro Icon can be used with other frameworks utilizing the slot element". Iconify sets are supported out of the box via `@iconify-json/<set>`. <https://github.com/natemoo-re/astro-icon>, <https://astroicon.dev>
- Measured in the scratch build: `<Icon name="ph:moon" />` passed as children into a Svelte island rendered as server-side `<svg data-icon="ph:moon">` inside the `<astro-island>`.

## Side findings

- **Astro 7.4 requires Node >= 22.23.4.** It refuses to run on 22.19, which CI and local setups must account for.
- **Raw or compressed?** The spec's "100 KB of JavaScript" doesn't say which. React passes only if it means compressed, and even then it would use about 60% of the budget. Every other option passes either way.
- **Rail buttons with icons that change on the client** (e.g. a pressed-state glyph) can't use `astro-icon` at runtime. Pre-render both SVGs on the server and toggle them with CSS on `[aria-pressed]`.
