/**
 * Geometry of the SVG art pieces, shared by the Astro components (which paint
 * it with the theme tokens in their scoped styles) and the OG cards (#39),
 * which paint it with the Light tokens: Satori can't render Astro components,
 * so the cards draw these same shapes as SVG strings. Change a shape here and
 * both follow.
 *
 * Each `body` is static markup with paint classes only (no colours), so it can
 * go through `set:html` unchanged. The classes a body uses are listed in its
 * component's `<style>` and in `src/lib/og/art.ts`; keep the two in step.
 */

export interface Shape {
  viewBox: string;
  /** viewBox width and height, for sizing by one dimension. */
  width: number;
  height: number;
  body: string;
}

/** Height for a rendered width, keeping the shape's aspect ratio. */
export const heightFor = (shape: Shape, width: number) =>
  Math.round((width * shape.height) / shape.width);

/** The homepage hero's cubist still life (StillLife.astro). */
export const STILL_LIFE: Shape = {
  viewBox: '0 0 400 420',
  width: 400,
  height: 420,
  body: `
    <!-- planes -->
    <polygon class="plane-a" opacity="0.5" points="38,64 252,26 292,262 18,300" />
    <polygon class="plane-b" opacity="0.42" points="168,118 384,146 362,394 146,366" />
    <polygon class="plane-a" opacity="0.32" points="0,318 176,288 214,420 0,420" />
    <polygon class="accent-fill" opacity="0.22" points="300,34 364,22 344,116 312,100" />
    <line class="ink-line" opacity="0.35" x1="232" y1="14" x2="218" y2="300" stroke-width="1.2" />
    <!-- table edge -->
    <polyline class="ink-line" points="0,304 214,268 400,240" stroke-width="2" />

    <!-- fork, fractured into three offset pieces -->
    <g transform="translate(298 70) rotate(12) scale(1.2)">
      <path class="surface ink" d="M-15,0 V40 Q-15,60 0,63 Q15,60 15,40 V0" />
      <line class="ink-line" x1="-5" y1="0" x2="-5" y2="38" />
      <line class="ink-line" x1="5" y1="0" x2="5" y2="38" />
      <g transform="translate(9 5)">
        <polygon class="plane-b-solid ink" points="-3.5,63 3.5,63 4.5,124 -4.5,124" />
      </g>
      <g transform="translate(-7 12) rotate(-5)">
        <path class="surface ink" d="M-5,128 H5 L9,206 Q0,216 -9,206 Z" />
      </g>
    </g>

    <!-- cup: side view body + handle -->
    <path class="ink-line" d="M194,192 C232,190 234,250 186,254" stroke-width="2.4" />
    <path class="ink-line" d="M192,206 C214,206 216,238 188,240" stroke-width="1.6" />
    <polygon class="surface ink" points="94,172 198,172 184,286 108,286" />
    <polygon class="plane-a-solid" opacity="0.7" points="146,172 198,172 184,286 146,286" />
    <polygon class="ink-none ink" points="94,172 198,172 184,286 108,286" />
    <line class="ink-line" x1="102" y1="296" x2="190" y2="290" stroke-width="2.4" />
    <!-- cup: the same rim seen from above, shifted off the body's axis -->
    <ellipse class="surface ink" cx="136" cy="160" rx="54" ry="40" />
    <ellipse class="plane-b-solid" cx="136" cy="160" rx="42" ry="30" />
    <path class="ink-line" opacity="0.55" d="M106,150 Q130,140 158,148" stroke-width="1.4" />

    <!-- half-lemon: the dome from the side, the cut face from the front -->
    <path class="accent-fill ink" d="M52,372 A58,44 0 0 1 168,372 Z" />
    <path class="ink-line" opacity="0.5" d="M120,336 Q148,344 156,366" stroke-width="1.4" />
    <circle class="accent-fill ink" cx="76" cy="352" r="42" />
    <circle class="flesh" cx="76" cy="352" r="33" />
    <g class="segments">
      <line x1="76" y1="352" x2="76" y2="319" />
      <line x1="76" y1="352" x2="104.6" y2="335.5" />
      <line x1="76" y1="352" x2="104.6" y2="368.5" />
      <line x1="76" y1="352" x2="76" y2="385" />
      <line x1="76" y1="352" x2="47.4" y2="368.5" />
      <line x1="76" y1="352" x2="47.4" y2="335.5" />
    </g>
    <circle class="ink-none ink" cx="76" cy="352" r="33" stroke-width="1.4" />
    <circle class="accent-fill" cx="76" cy="352" r="4" />
    <!-- knife: blade and handle off-axis -->
    <g transform="translate(156 390) rotate(-9)">
      <path class="surface ink" d="M0,0 H142 C162,0 178,6 184,11 C162,17 42,19 0,19 Z" />
      <line class="ink-line" opacity="0.5" x1="10" y1="6" x2="128" y2="6" stroke-width="1.2" />
      <g transform="translate(-6 10) rotate(4)">
        <rect class="ink-fill" x="-110" y="0" width="104" height="15" rx="6" />
        <circle class="surface" cx="-86" cy="7.5" r="2" />
        <circle class="surface" cx="-34" cy="7.5" r="2" />
      </g>
    </g>
  `,
};

/** The split bottle (SplitBottle.astro): homepage, /about, the /about OG card. */
export const SPLIT_BOTTLE: Shape = {
  viewBox: '0 0 96 116',
  width: 96,
  height: 116,
  body: `
    <!-- left half, set back -->
    <polygon class="b ink" opacity="0.5" points="20,14 36,14 36,42 52,58 52,112 20,112" />
    <!-- right half, pushed up and across -->
    <polygon class="a ink" opacity="0.65" points="38,6 52,6 52,34 70,52 70,106 38,106" />
    <!-- cork, seen from the side and the top -->
    <rect class="surface ink" x="39" y="1" width="12" height="7" rx="1.5" />
    <ellipse class="surface ink" cx="30" cy="13" rx="7" ry="3" />
    <!-- label bridging both halves, slightly askew -->
    <polygon class="surface ink" points="14,66 62,60 66,82 18,88" />
    <line class="accent" x1="23" y1="74.5" x2="56" y2="70.5" />
    <line class="faint" x1="25" y1="80" x2="46" y2="77.5" />
    <!-- shared outlines so the halves read as one bottle -->
    <polyline class="line" points="36,14 36,42 52,58 52,112" />
  `,
};

/** Faint faceted planes for a panel corner (LabPlanes.astro), drawn for the bottom-right. */
export const LAB_PLANES: Shape = {
  viewBox: '0 0 260 200',
  width: 260,
  height: 200,
  body: `
    <polygon class="a" opacity="0.24" points="260,36 158,92 198,200 260,200" />
    <polygon class="b" opacity="0.18" points="112,200 188,108 260,146 260,200" />
    <polygon class="a" opacity="0.14" points="196,200 226,128 260,118 260,200" />
    <polygon class="accent" opacity="0.13" points="206,0 260,0 260,72 228,60" />
    <polyline class="line" points="158,92 188,108 226,128" />
    <line class="line" x1="188" y1="108" x2="168" y2="200" />
  `,
};

/**
 * The fork-toque mark (ForkToque.astro): stroked in the current colour, the
 * middle tine in accent (`stroke-accent`, a Tailwind utility on the site).
 */
export const FORK_TOQUE: Shape = {
  viewBox: '0 0 64 64',
  width: 64,
  height: 64,
  body: `
    <line x1="20" y1="28" x2="20" y2="12" />
    <line x1="26" y1="28" x2="26" y2="8" />
    <line x1="32" y1="28" x2="32" y2="5" class="stroke-accent" />
    <line x1="38" y1="28" x2="38" y2="8" />
    <line x1="44" y1="28" x2="44" y2="12" />
    <rect x="17" y="28" width="30" height="7" />
    <polyline points="27,35 30,40 30,58 34,58 34,40 37,35" />
  `,
};

/**
 * The ablation dot graphic's states (AblationGraphic.astro):
 *   on      → accent fill
 *   removed → dashed accent circle (the part this row ablates)
 *   gone    → rule outline (never in this configuration)
 */
export type Dot = 'on' | 'removed' | 'gone';
export interface AblationRow {
  label: string;
  dots: Dot[];
}

/** The default ablation rows: the /research glance panel, the Lab panel and the /research OG card. */
export const ABLATION_ROWS: AblationRow[] = [
  { label: 'full brigade', dots: ['on', 'on', 'on', 'on'] },
  { label: '− critic', dots: ['on', 'on', 'on', 'removed'] },
  { label: '− orchestrator', dots: ['removed', 'on', 'on', 'on'] },
  { label: 'single cook', dots: ['on', 'gone', 'gone', 'gone'] },
];
