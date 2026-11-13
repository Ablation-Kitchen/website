// PROTOTYPE (#19), throwaway, never merge.
// Question: what do the OG images look like per template, and can they be built
// at build time with Satori + resvg (no browser)?
// Three variants (A ticket · B masthead split · C the pass) x every launch template,
// rendered to out/<variant>-<page>.png at 1200x630. `npm run render`.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const font = (pkg, file) => readFileSync(new URL(`./node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url));
const FONTS = [
  { name: 'Serif', data: font('instrument-serif', 'instrument-serif-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Serif', data: font('instrument-serif', 'instrument-serif-latin-400-italic.woff'), weight: 400, style: 'italic' },
  { name: 'Sans', data: font('inter-tight', 'inter-tight-latin-300-normal.woff'), weight: 300, style: 'normal' },
  { name: 'Sans', data: font('inter-tight', 'inter-tight-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Mono', data: font('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff'), weight: 400, style: 'normal' },
];

// Light tokens, basil palette (#1). OG images are one fixed theme: crawlers don't know the viewer's.
const T = {
  bg: '#F7F6F3', surface: '#FFFFFF', ink: '#111111', soft: '#3B3B38', meta: '#6A6A66', rule: '#E4E2DC',
  accent: '#69908C', accentText: '#4A6562', planeA: '#C9A66B', planeB: '#5B7C99',
  tBg: '#0E0E0D', tInk: '#E9E6DF', tRole: '#85A6A3', tMeta: '#8F9196', tRule: '#262624',
};

// ---------- tiny vnode helper ----------
const h = (type, style = {}, ...children) => ({ type, props: { style, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });
const row = (style, ...c) => h('div', { display: 'flex', ...style }, ...c);
const col = (style, ...c) => h('div', { display: 'flex', flexDirection: 'column', ...style }, ...c);
const txt = (style, s) => h('div', { display: 'flex', ...style }, s);
const svg = (markup, w, hgt, style = {}) => ({ type: 'img', props: { src: `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`, width: w, height: hgt, style } });
const mono = { fontFamily: 'Mono', fontWeight: 400 };
const serif = { fontFamily: 'Serif', fontWeight: 400 };

// ---------- art (same shapes as the launch-page prototypes; colours inlined) ----------
const LOGO = (c, tine) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="square"><line x1="20" y1="28" x2="20" y2="12"/><line x1="26" y1="28" x2="26" y2="8"/><line x1="32" y1="28" x2="32" y2="5" stroke="${tine}"/><line x1="38" y1="28" x2="38" y2="8"/><line x1="44" y1="28" x2="44" y2="12"/><rect x="17" y="28" width="30" height="7"/><polyline points="27,35 30,40 30,58 34,58 34,40 37,35"/></svg>`, 40, 40);
const ARROW = (c, s = 22) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14,6 20,12 14,18"/></svg>`, s, s);
const PLANES = (w, hgt, surface = T.surface) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 200" preserveAspectRatio="none">
  <polygon points="260,40 160,90 200,200 260,200" fill="${T.planeA}" opacity=".26"/>
  <polygon points="120,200 190,110 260,150 260,200" fill="${T.planeB}" opacity=".2" stroke="${T.ink}" stroke-width=".8" stroke-opacity=".25"/>
  <polygon points="210,0 260,0 260,70 230,60" fill="${T.accent}" opacity=".18"/></svg>`, w, hgt);
const BOTTLE = (w) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 116">
  <polygon points="20,12 36,12 36,42 52,58 52,112 20,112" fill="${T.planeB}" fill-opacity=".45" stroke="${T.ink}" stroke-width="1.2"/>
  <polygon points="38,4 52,4 52,34 70,52 70,106 38,106" fill="${T.planeA}" fill-opacity=".6" stroke="${T.ink}" stroke-width="1.2"/>
  <polygon points="14,66 62,60 66,82 18,88" fill="${T.surface}" stroke="${T.ink}" stroke-width="1.2"/>
  <line x1="24" y1="74" x2="56" y2="70" stroke="${T.accent}" stroke-width="2"/></svg>`, w, Math.round((w * 116) / 96));
const EGG = (s, c = T.ink) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M208,152a80,80,0,0,1-160,0C48,88,96,24,128,24S208,88,208,152Z"/><polyline points="84,112 104,132 124,108 144,132 168,112" stroke="${T.accent}"/></svg>`, s, s);
// "Still life" stand-in: planes + bottle + egg composed, for the home card.
const STILL = (w) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <polygon points="10,60 210,20 250,250 40,280" fill="${T.planeA}" opacity=".28"/>
  <polygon points="120,90 290,120 270,290 90,260" fill="${T.planeB}" opacity=".22" stroke="${T.ink}" stroke-width="1" stroke-opacity=".3"/>
  <polygon points="150,40 196,40 196,110 230,140 230,270 150,270" fill="${T.surface}" stroke="${T.ink}" stroke-width="1.6"/>
  <polygon points="170,30 210,30 210,100 246,132 246,256 170,256" fill="${T.planeA}" fill-opacity=".55" stroke="${T.ink}" stroke-width="1.6"/>
  <line x1="160" y1="190" x2="236" y2="180" stroke="${T.accent}" stroke-width="3"/>
  <ellipse cx="96" cy="222" rx="44" ry="52" fill="${T.surface}" stroke="${T.ink}" stroke-width="1.6"/>
  <polyline points="64,214 78,226 92,208 106,226 124,212" fill="none" stroke="${T.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`, w, w);
// Ablation dot graphic (research). on = accent, off = hollow, gone = rule.
const ABL = [['full brigade', 'oooo'], ['− critic', 'ooox'], ['− orchestrator', 'xooo'], ['single cook', 'o---']];
const ablate = (dark = false, size = 18) => col({ gap: 16 }, ...ABL.map(([l, d]) => row({ alignItems: 'center', justifyContent: 'space-between', gap: 28 },
  txt({ ...mono, fontSize: 18, color: dark ? T.tMeta : T.meta, width: 180 }, l),
  row({ gap: 10 }, ...[...d].map((k) => h('div', { width: size, height: size, borderRadius: 999,
    background: k === 'o' ? T.accent : 'transparent',
    border: k === 'x' ? `2px dashed ${T.accent}` : k === '-' ? `2px solid ${dark ? T.tRule : T.rule}` : `2px solid ${T.accent}` }))))));

// ---------- launch content (#6: courses i–iv only; #7 identity) ----------
const S = (t) => `[${t}]`; // a slot waiting on #8 numbers
const COURSES = [
  { n: 'i.', t: 'One agent platform for the whole company', k: 'iCounter · 2025–now', m: [['teams on the platform', S('N')], ['agent runs / wk', S('N')]] },
  { n: 'ii.', t: 'Hybrid search and automated reporting', k: 'Fortinet · 2023–2025', m: [['analyst hours saved', S('N')], ['retrieval quality', S('+X%')]] },
  { n: 'iii.', t: 'Founding a software company', k: '313X · founder · 2019–2022', m: [['investigations supported', S('N')], ['team', S('N')]] },
  { n: 'iv.', t: 'Optimizing tugboats in busy ports', k: 'Cyberlabs · 2016–2019', m: [['cost cut', S('−X%')], ['ports', S('N')]] },
];
// Every page shares one shape so the endpoint can build it from frontmatter.
const PAGES = [
  { id: 'home', path: '/', eyebrow: 'Dalmo Veras · Lead AI Engineer', title: 'AI systems, tasted before they leave the pass.', meta: 'agents · evals · retrieval', art: 'still' },
  { id: 'work', path: '/work', eyebrow: 'Signature dishes · case studies', title: 'The tasting menu', meta: `${COURSES.length} courses · i.–${COURSES.at(-1).n}`, art: 'menu' },
  ...COURSES.map((c, i) => ({ id: `case-${i + 1}`, path: `/work/${['agent-platform', 'hybrid-search', '313x', 'tugboats'][i]}`, eyebrow: `Signature dishes · course ${c.n}`, title: c.t, meta: c.k, course: c.n, metrics: c.m, art: 'check' })),
  { id: 'research', path: '/research', eyebrow: 'The Lab · research', title: 'Take one ingredient out. Taste the difference.', meta: 'PhD candidate · Warwick · topology-aware ML', art: 'ablate' },
  { id: 'about', path: '/about', eyebrow: 'About · Kitchen rules', title: 'Dalmo Veras', meta: 'Lead AI Engineer, iCounter · PhD candidate, Warwick', art: 'bottle' },
  { id: 'default', path: '(404, anything without its own)', eyebrow: 'ablation.kitchen', title: 'Dalmo Veras', meta: 'AI engineering, cooked to order', art: 'egg' },
];

const W = 1200, H = 630;
const wordmark = (ink, dot) => row({ alignItems: 'center', gap: 14 }, LOGO(ink, T.accent), row({ ...mono, fontSize: 24, color: ink }, 'ablation', txt({ color: dot }, '.'), 'kitchen'));
const titleSize = (s, big = 76) => (s.length > 40 ? big - 10 : s.length > 26 ? big : big + 16);
const leader = (l, v, color = T.soft, vColor = T.ink, size = 20) => row({ alignItems: 'center', gap: 10, ...mono, fontSize: size, color },
  txt({ flexShrink: 0 }, l), h('div', { flexGrow: 1, height: 2, borderTop: `2px dotted ${T.rule}`, marginTop: 8 }), txt({ color: vColor, flexShrink: 0 }, v));

// ---------- A · The ticket: the page is a tilted kitchen ticket on the cubist field ----------
function A(p) {
  const lines = p.metrics ? p.metrics.map(([l, v]) => leader(l, v))
    : p.art === 'menu' ? COURSES.map((c) => leader(c.n, c.k.split(' · ')[0]))
    : [];
  return row({ width: W, height: H, background: T.bg, position: 'relative', alignItems: 'center', justifyContent: 'center' },
    h('div', { position: 'absolute', right: 0, top: 0, display: 'flex' }, PLANES(720, 630)),
    h('div', { position: 'absolute', left: 56, top: 40, display: 'flex' }, wordmark(T.ink, T.accentText)),
    col({ width: 900, marginTop: 60, padding: '40px 48px 36px', background: T.surface, border: `1px solid ${T.rule}`, borderRadius: 10, transform: 'rotate(-1deg)', boxShadow: '0 24px 48px rgba(0,0,0,.14)' },
      row({ justifyContent: 'space-between', ...mono, fontSize: 20, color: T.meta }, txt({}, p.course ? `course ${p.course}` : p.eyebrow.split(' · ')[0].toLowerCase()), txt({}, p.path.startsWith('/') ? `ablation.kitchen${p.path === '/' ? '' : p.path}` : 'ablation.kitchen')),
      h('div', { borderTop: `2px dashed ${T.rule}`, margin: '20px 0 24px' }),
      txt({ ...serif, fontSize: titleSize(p.title, 68), lineHeight: 1.02, letterSpacing: '-0.02em', color: T.ink, lineClamp: 2 }, p.title),
      txt({ ...mono, fontSize: 20, color: T.meta, marginTop: 18 }, p.meta),
      h('div', { borderTop: `2px dashed ${T.rule}`, margin: '24px 0 18px' }),
      lines.length ? col({ gap: 10 }, ...lines) : null,
      row({ alignItems: 'center', gap: 8, marginTop: 18, ...mono, fontSize: 20, color: T.accentText }, 'yes, chef', ARROW(T.accentText, 20))));
}

// ---------- B · Masthead split: big serif title left, the page's own art in a glance panel right ----------
function B(p) {
  const panel = {
    still: () => STILL(330),
    menu: () => col({ gap: 14, width: '100%' }, txt({ ...mono, fontSize: 18, color: T.meta, marginBottom: 6 }, 'tasting menu'), ...COURSES.map((c) => row({ alignItems: 'baseline', gap: 16 }, txt({ ...serif, fontStyle: 'italic', fontSize: 30, color: T.meta, width: 56 }, c.n), txt({ ...mono, fontSize: 18, color: T.soft }, c.k.split(' · ')[0])))),
    check: () => col({ gap: 26, width: '100%' }, txt({ ...mono, fontSize: 18, color: T.meta }, 'at a glance · service'), ...p.metrics.map(([l, v]) => col({}, txt({ ...serif, fontSize: 64, lineHeight: 1, color: T.ink }, v), txt({ ...mono, fontSize: 17, color: T.meta, marginTop: 6 }, l)))),
    ablate: () => ablate(false, 22),
    bottle: () => BOTTLE(220),
    egg: () => EGG(240),
  }[p.art]();
  return row({ width: W, height: H, background: T.bg },
    col({ flexGrow: 1, padding: '56px 56px 52px 64px', justifyContent: 'space-between' },
      wordmark(T.ink, T.accentText),
      col({}, txt({ ...mono, fontSize: 20, color: T.meta, marginBottom: 20 }, p.eyebrow),
        txt({ ...serif, fontSize: titleSize(p.title, 78), lineHeight: 1, letterSpacing: '-0.025em', color: T.ink, lineClamp: 3 }, p.title)),
      row({ alignItems: 'center', gap: 16, ...mono, fontSize: 20, color: T.meta, borderTop: `1px solid ${T.rule}`, paddingTop: 22 }, txt({}, p.meta))),
    col({ width: 420, height: '100%', background: T.surface, borderLeft: `1px solid ${T.rule}`, padding: 48, alignItems: 'center', justifyContent: 'center', position: 'relative' },
      h('div', { position: 'absolute', right: 0, bottom: 0, display: 'flex' }, PLANES(260, 200)),
      panel));
}

// ---------- C · The pass: always-dark trace-panel band; the page arrives as a trace ----------
function C(p) {
  const steps = [
    ['00:00', 'Ticket', p.course ? `course ${p.course}` : p.eyebrow.split(' · ').at(-1).toLowerCase()],
    ['00:04', 'Sous chef', p.meta],
    p.metrics ? ['00:11', 'The pass', p.metrics.map(([l, v]) => `${v} ${l}`).join(' · ')] : ['00:11', 'The pass', 'plated'],
  ];
  return row({ width: W, height: H, background: T.tBg, position: 'relative', overflow: 'hidden' }, col({ flexGrow: 1, padding: '52px 64px 48px', justifyContent: 'space-between' },
    h('div', { position: 'absolute', right: 0, top: 0, display: 'flex', opacity: 0.55 }, PLANES(520, 400)),
    row({ justifyContent: 'space-between', alignItems: 'center' }, wordmark(T.tInk, T.tRole), row({ alignItems: 'center', gap: 10, ...mono, fontSize: 18, color: T.tMeta }, h('div', { width: 10, height: 10, borderRadius: 999, background: T.accent }), 'on the pass')),
    col({ gap: 26 },
      txt({ ...serif, fontSize: titleSize(p.title, 80), lineHeight: 1, letterSpacing: '-0.025em', color: T.tInk, lineClamp: 2, maxWidth: 1000 }, p.title),
      col({ gap: 8, borderTop: `1px solid ${T.tRule}`, paddingTop: 22 }, ...steps.map(([t, r, s]) => row({ gap: 22, ...mono, fontSize: 19 },
        txt({ color: T.tMeta, width: 64 }, t), txt({ color: T.tRole, width: 130 }, r), txt({ color: T.tInk, lineClamp: 1, maxWidth: 820 }, s)))))));
}

const VARIANTS = { A: ['The ticket', A], B: ['Masthead split', B], C: ['The pass (dark)', C] };
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const manifest = { variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, [n]]) => [k, n])), pages: PAGES.map(({ id, path, title }) => ({ id, path, title })), files: {} };
const t0 = performance.now();
for (const [k, [, fn]] of Object.entries(VARIANTS).filter(([k]) => !process.env.ONLY || k === process.env.ONLY)) {
  for (const p of PAGES) {
    const s = performance.now();
    const svgOut = await satori(fn(p), { width: W, height: H, fonts: FONTS });
    if (process.env.DUMP) writeFileSync(new URL(`./out/${k}-${p.id}.svg`, import.meta.url), svgOut);
    if (process.env.DUMP) console.error(k, p.id);
    const png = new Resvg(svgOut, { fitTo: { mode: 'width', value: W } }).render().asPng();
    writeFileSync(new URL(`./out/${k}-${p.id}.png`, import.meta.url), png);
    manifest.files[`${k}-${p.id}`] = { kb: +(png.length / 1024).toFixed(1), ms: Math.round(performance.now() - s) };
  }
}
manifest.totalMs = Math.round(performance.now() - t0);
writeFileSync(new URL('./out/manifest.js', import.meta.url), `window.MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
console.log(`rendered ${Object.keys(manifest.files).length} images in ${manifest.totalMs} ms`);
for (const [f, { kb, ms }] of Object.entries(manifest.files)) console.log(`${f.padEnd(16)} ${String(kb).padStart(6)} KB ${String(ms).padStart(5)} ms`);
