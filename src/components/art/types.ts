/** Behaviour props shared by every decorative piece (see ArtFrame.astro). */
export interface ArtBehaviour {
  /** Resting rotation in degrees. */
  rotate?: number;
  /** Gentle 8px vertical drift over 6s (motion permitting). */
  float?: boolean;
  /** Hover tilt −2° / scale 1.02 over 0.8s (motion permitting). */
  tilt?: boolean;
  /** Hide below 960px. Defaults to true. */
  hideOnSmall?: boolean;
  class?: string;
  style?: string;
}
