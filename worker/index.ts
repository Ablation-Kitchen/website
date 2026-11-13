// Placeholder Worker. Static assets are served without invoking it; it only
// runs for `/_a/*` (`run_worker_first` in wrangler.jsonc). The Umami proxy
// replaces this in #41. Until then every request it sees gets a 404.
//
// `_headers` doesn't apply to Worker responses, so the Worker sets the same
// security headers itself (#21). It serves no HTML, so its CSP has no hashes.
import { securityHeaders } from '../src/lib/security-headers.ts';

export default {
  fetch(): Response {
    return new Response('Not found\n', {
      status: 404,
      headers: {
        ...securityHeaders([]),
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
