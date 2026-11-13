/**
 * Resting rotations a piece may take, in degrees. A fixed set rather than any
 * number because the CSP (#25) has `style-src 'self'`, which blocks inline
 * `style` attributes: each value maps to a rule in ArtFrame's stylesheet.
 * Add a value there and here together.
 */
export const ROTATIONS = [-8, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 6, 8] as const;
export type Rotation = (typeof ROTATIONS)[number];

/** Behaviour props shared by every decorative piece (see ArtFrame.astro). */
export interface ArtBehaviour {
  /** Resting rotation in degrees, from `ROTATIONS`. */
  rotate?: Rotation;
  /** Gentle 8px vertical drift over 6s (motion permitting). */
  float?: boolean;
  /** Hover tilt −2° / scale 1.02 over 0.8s (motion permitting). */
  tilt?: boolean;
  /** Hide below 960px. Defaults to true. */
  hideOnSmall?: boolean;
  /**
   * Extra classes, e.g. Tailwind utilities for placement or colour. There is
   * deliberately no `style` prop: inline styles are blocked by the CSP (#25).
   */
  class?: string;
}

/** Allowed ChaosTicket widths in px; each maps to a `.ticket[data-w]` rule in ChaosTicket.astro. Add to both together. */
export const TICKET_WIDTHS = [200, 220, 240, 250, 260, 280, 300, 320] as const;
export type TicketWidth = (typeof TICKET_WIDTHS)[number];
