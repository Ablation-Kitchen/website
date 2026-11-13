/**
 * The site's security headers (#21, #25), in one place. The build step in
 * `integrations/security-headers.ts` writes them into `dist/_headers` for every
 * static page, and the Worker sets the same set on what it serves (`/_a/*`).
 *
 * Nothing here is a hash: `buildCsp` takes the build's inline-script hashes,
 * which are computed from the built HTML, never pasted in by hand.
 */

/**
 * The one Trusted Types policy the site may create. The ⌘K palette uses it to
 * turn Pagefind's `<mark>` excerpts into allowlisted DOM. Any other policy name,
 * and any raw string assigned to an HTML/script sink, is blocked.
 */
export const TRUSTED_TYPES_POLICY = 'search-excerpt';

/** Builds the CSP. `scriptHashes` are `sha256-<base64>` values, without quotes. */
export function buildCsp(scriptHashes: readonly string[]): string {
  const hashes = [...new Set(scriptHashes)].sort().map((h) => `'${h}'`);
  const directives: [string, ...string[]][] = [
    ['default-src', "'none'"],
    // 'wasm-unsafe-eval' is only there for Pagefind.
    ['script-src', "'self'", "'wasm-unsafe-eval'", ...hashes],
    ['style-src', "'self'"],
    ['img-src', "'self'"],
    ['font-src', "'self'"],
    ['connect-src', "'self'"],
    ['manifest-src', "'self'"],
    ['frame-ancestors', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'none'"],
    ['upgrade-insecure-requests'],
    ['require-trusted-types-for', "'script'"],
    ['trusted-types', TRUSTED_TYPES_POLICY],
  ];
  return directives.map((d) => d.join(' ')).join('; ');
}

/**
 * Every feature off except `clipboard-write` for the page itself (copy buttons).
 * Only features Chromium recognises: an unknown name logs a console error.
 */
const PERMISSIONS_OFF = [
  'accelerometer',
  'attribution-reporting',
  'autoplay',
  'bluetooth',
  'browsing-topics',
  'camera',
  'clipboard-read',
  'compute-pressure',
  'cross-origin-isolated',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'gamepad',
  'geolocation',
  'gyroscope',
  'hid',
  'identity-credentials-get',
  'idle-detection',
  'local-fonts',
  'magnetometer',
  'microphone',
  'midi',
  'otp-credentials',
  'payment',
  'picture-in-picture',
  'publickey-credentials-create',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'storage-access',
  'usb',
  'web-share',
  'window-management',
  'xr-spatial-tracking',
] as const;

export const PERMISSIONS_POLICY = [
  ...PERMISSIONS_OFF.map((f) => `${f}=()`),
  'clipboard-write=(self)',
].join(', ');

/** Everything except the CSP, which depends on the build. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Permissions-Policy': PERMISSIONS_POLICY,
};

/** The full set for a response, CSP first. */
export function securityHeaders(scriptHashes: readonly string[]): Record<string, string> {
  return { 'Content-Security-Policy': buildCsp(scriptHashes), ...SECURITY_HEADERS };
}

/** Cloudflare's `_headers` caps each line at 2,000 characters. */
export const HEADERS_LINE_LIMIT = 2000;

/** One `_headers` rule block: the pattern, then indented `Name: value` lines. */
export function headersRule(pattern: string, headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  for (const line of lines) {
    if (line.length > HEADERS_LINE_LIMIT) {
      throw new Error(
        `_headers line is ${line.length} characters (limit ${HEADERS_LINE_LIMIT}): ${line.slice(0, 60)}…`,
      );
    }
  }
  return [pattern, ...lines].join('\n') + '\n';
}
