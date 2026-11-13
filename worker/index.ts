// Placeholder Worker. Static assets are served without invoking it; it only
// runs for `/_a/*` (`run_worker_first` in wrangler.jsonc). The Umami proxy
// replaces this in #41. Until then every request it sees gets a 404.
export default {
  fetch(): Response {
    return new Response('Not found\n', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
