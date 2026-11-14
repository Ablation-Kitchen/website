/**
 * The one Trusted Types policy the site may create (#21, #25). The ⌘K palette
 * (#38) uses it to turn Pagefind's `<mark>` excerpts into allowlisted DOM. Any
 * other policy name, and any raw string assigned to an HTML/script sink, is
 * blocked by the CSP (src/lib/security-headers.ts).
 *
 * Its own module so the palette's client bundle imports just this name, not
 * the whole header set.
 */
export const TRUSTED_TYPES_POLICY = 'search-excerpt';
