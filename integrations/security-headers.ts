/**
 * Post-build step for #25: hashes every inline script in the built HTML and
 * writes the security headers, with those hashes in the CSP, into
 * `dist/_headers` for every path.
 *
 * Why not Astro's `security.csp`: on a static build without an adapter it only
 * emits a `<meta http-equiv>` CSP, and a meta CSP cannot carry
 * `frame-ancestors`. Its `_headers` route (`routeToHeaders`) is only handed to
 * adapters that declare `staticHeaders`, and this site has no adapter.
 */
import { createHash } from 'node:crypto';
import { appendFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { headersRule, securityHeaders } from '../src/lib/security-headers.ts';

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
// Data blocks are never executed, so the CSP doesn't apply to them.
const DATA_TYPE = /\btype\s*=\s*["']?application\/(ld\+)?json\b/i;
const HAS_SRC = /\bsrc\s*=/i;

/** `sha256-<base64>` for each executable inline script in an HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const [, attrs = '', body = ''] of html.matchAll(SCRIPT)) {
    if (HAS_SRC.test(attrs) || DATA_TYPE.test(attrs)) continue;
    hashes.push(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  return hashes;
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => join(e.parentPath, e.name));
}

export default function securityHeadersIntegration(): AstroIntegration {
  return {
    name: 'ablation-kitchen:security-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const headersFile = join(out, '_headers');
        const existing = await readFile(headersFile, 'utf8').catch(() => '');
        if (/content-security-policy/i.test(existing)) {
          throw new Error(
            'public/_headers sets a Content-Security-Policy. Remove it: the build writes the CSP (src/lib/security-headers.ts).',
          );
        }

        const hashes = new Set<string>();
        const files = await htmlFiles(out);
        for (const file of files) {
          for (const h of inlineScriptHashes(await readFile(file, 'utf8'))) hashes.add(h);
        }

        const rule = headersRule('/*', securityHeaders([...hashes]));
        const banner =
          '\n# Generated at build by integrations/security-headers.ts from src/lib/security-headers.ts.\n';
        await appendFile(headersFile, `${existing.endsWith('\n') ? '' : '\n'}${banner}${rule}`);
        logger.info(
          `wrote security headers to _headers: ${hashes.size} inline-script hash(es) from ${files.length} page(s)`,
        );
      },
    },
  };
}
