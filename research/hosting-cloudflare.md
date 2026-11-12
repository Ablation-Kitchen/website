# Hosting on Cloudflare: Pages or Workers static assets?

Research for issue #2. Sources checked 2026-11-12; each source's "last updated" date is given where the page shows one.

## Answer

**Use Cloudflare Workers with static assets, without the Astro adapter, deployed by Workers Builds from GitHub.**

- Cloudflare's Pages docs now open with "Start new projects with Workers": Workers "supports most Pages use cases and offers a broader feature set." ([Pages overview](https://developers.cloudflare.com/pages/))
- Astro's Cloudflare guide also says "Cloudflare recommends using Cloudflare Workers for new projects" and treats Pages as the legacy path. ([Astro: Deploy to Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/))
- Every requirement in the ticket is met on Workers. Pages is better in only two areas: branch-deploy controls, and 404s that work without config. The 404 gap takes one line of config, and the site doesn't need the extra branch-deploy controls.

## Requirement by requirement

### Git-linked builds and preview URLs

- **Workers Builds** connects to a GitHub or GitLab repo. A push to the production branch builds and deploys. A push to any other branch creates or updates a **Preview**, whose URL serves that branch's latest build. On GitHub, Cloudflare posts the Preview URL as a PR comment and reports build status as a check run. ([Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), updated Oct 28 2026; [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), updated Oct 1 2026)
- Previews are per branch. The docs don't describe a separate URL for each PR, but one PR maps to one branch, so in practice each PR gets its own preview.
- Each uploaded version can also get a **Version URL**, `<prefix>-<worker>.<subdomain>.workers.dev`, and `wrangler versions upload --preview-alias <name>` gives it a readable alias. Version URLs run only on `workers.dev` and are public unless Cloudflare Access protects them. ([Preview URLs](https://developers.cloudflare.com/workers/configuration/previews/), updated Sep 22 2026)
- In the Pages-to-Workers comparison, Workers gets 🟡 for "branch deploy controls": it has preview builds but fewer settings. ([Migrate from Pages](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/), updated Oct 12 2026)
- Build settings for an Astro site: build command `npx astro build`, deploy command `npx wrangler deploy`. ([Astro guide](https://docs.astro.build/en/guides/deploy/cloudflare/))

### Custom apex domain and the `www` → apex redirect

- Attach `ablation.kitchen` as a Worker **Custom Domain**, either in the dashboard or with a Wrangler route `{ "pattern": "ablation.kitchen", "custom_domain": true }`. Cloudflare creates the DNS record and an Advanced Certificate itself. The hostname must not already have a CNAME record. ([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), updated Sep 29 2026)
- Custom Domains match the hostname exactly, so `www` needs its own handling. For `www` → apex:
  1. Add a proxied `www` record that points to a dummy address (`A 192.0.2.0` or `AAAA 100::`).
  2. Add a zone **Redirect Rule** using Cloudflare's "Redirect from www to root" guide.
- `_redirects` cannot do this, because it doesn't support redirects between domains. Cloudflare's docs point to Bulk Redirects or Redirect Rules instead. ([Redirects](https://developers.cloudflare.com/workers/static-assets/redirects/), updated Aug 25 2026)
- This setup is the same on Pages.

### Serverless function for a rate-limited contact form that sends email

- One Worker script can sit in front of the assets and handle only the form endpoint. For example, set `"run_worker_first": ["/api/*"]` and every other path is still served as a plain static asset. ([Static assets](https://developers.cloudflare.com/workers/static-assets/), updated Oct 12 2026)
- Requests that reach the Worker count against the Free plan's 100,000 requests/day and 10 ms of CPU per request. Above the daily limit, requests that match `run_worker_first` get a 429. ([Limits](https://developers.cloudflare.com/workers/platform/limits/), updated Oct 29 2026; [Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), updated Nov 3 2026)
- **Rate limiting:** the Workers Rate Limiting binding is configured as `ratelimits` with `simple.limit` and `simple.period`, where the period is 10 or 60 seconds. It needs Wrangler 4.36 or later.
  - The limit is approximate, counted separately in each Cloudflare location, and eventually consistent.
  - A strict global limit needs a Durable Object.
  - For a contact form the approximate limit is enough. Pairing it with Turnstile is worth considering; the binding docs don't mention Turnstile. ([Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), updated Nov 12 2026)
- **Sending email:** a Worker sends mail with a `send_email` binding and `env.EMAIL.send({...})`. This is Cloudflare **Email Service, Email Sending**, which is in **beta**.
  - The sender domain must be verified and onboarded.
  - Sending to **verified destination addresses in your own account is free on Workers Free**.
  - **Sending to arbitrary recipients requires Workers Paid.**
  - **Email Routing** is the inbound side: it forwards incoming mail or hands it to Workers, and it is free.
  - ([Email Service](https://developers.cloudflare.com/email-service/), updated Oct 15 2026; [Send emails from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/), updated Oct 30 2026)
- **What this means for the form:** it can email the site owner's own verified inbox for free. Don't send an auto-reply "receipt" to the visitor: that is arbitrary-recipient sending, which needs Paid, and it would also let the form be abused to spam addresses. Show the receipt on the page instead.

### Custom 404

- Set `"assets": { "not_found_handling": "404-page" }`. Unmatched paths then return a 404 status with the nearest `404.html`, which Astro builds from `src/pages/404.astro`.
- Without this setting and without a Worker script, unmatched paths return a bare 404. Pages finds `404.html` without being told.
- ([Static assets](https://developers.cloudflare.com/workers/static-assets/); [Astro guide](https://docs.astro.build/en/guides/deploy/cloudflare/); [Migrate from Pages](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/))

### Headers and redirects config

- Workers static assets read the same `_headers` and `_redirects` files as Pages. Put them in Astro's `public/` so the build copies them to `dist/`.
- `_headers`: up to 100 rules, and each line is at most 2,000 characters. The rules apply **only to asset responses**. Responses generated by the Worker script, such as the form endpoint, must set their own headers in code. ([Headers](https://developers.cloudflare.com/workers/static-assets/headers/), updated Sep 22 2026)
- `_redirects`: up to 2,000 static rules plus 100 dynamic rules, each at most 1,000 characters.
  - Status codes 301, 302, 303, 307 and 308 are supported; 302 is the default.
  - Status 200 proxies, but only to relative paths on the same site.
  - Redirects between domains are not supported.
  - Redirects are applied before headers.
  - ([Redirects](https://developers.cloudflare.com/workers/static-assets/redirects/))

### Free-tier limits

| | Workers (Free) | Pages (Free) |
|---|---|---|
| Static asset requests | Free and unlimited | Free and unlimited |
| Function/Worker invocations | 100k/day, 10 ms CPU each | Pages Functions are billed as Workers |
| Files per deploy | 20,000 (100,000 on Paid) | 20,000 |
| Max file size | 25 MiB | 25 MiB |
| Worker bundle | 64 MiB uncompressed | n/a |
| Builds | 3,000 build-minutes/month, 1 concurrent, 20 min timeout, 2 vCPU / 8 GB | 500 builds/month, 1 concurrent, 20 min timeout |
| Custom domains | Multiple | 100 per project |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (Oct 29 2026), [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) (Nov 3 2026), [Workers Builds limits & pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) (Oct 28 2026), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) (Sep 5 2026).

A personal portfolio site uses a small fraction of every one of these limits.

### Astro adapter (`@astrojs/cloudflare`) for a fully static site

- The adapter is **not needed**. Astro's guide says to install it only "if your site uses on-demand rendering."
- For a static build, `wrangler.jsonc` needs only `name`, `compatibility_date` and `assets.directory: "./dist"`, plus `not_found_handling`.
- To add the contact endpoint, add `main` pointing at a small hand-written Worker, an `ASSETS` binding and `run_worker_first`. The rest of the site stays a static Astro build. Server-rendered Astro routes would be the only reason to add the adapter.
- Deploy locally with `npx astro build && npx wrangler deploy`; preview locally with `npx wrangler dev`. ([Astro: Deploy to Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/))

## Sketch config (illustrative, not verified by a deploy)

```jsonc
// wrangler.jsonc
{
  "name": "ablation-kitchen",
  "compatibility_date": "2026-11-01",
  "main": "./worker/index.ts",          // only once the contact endpoint exists
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page",
    "run_worker_first": ["/api/*"]
  },
  "routes": [{ "pattern": "ablation.kitchen", "custom_domain": true }],
  "ratelimits": [{ "name": "CONTACT_LIMITER", "namespace_id": "1001", "simple": { "limit": 5, "period": 60 } }],
  "send_email": [{ "name": "EMAIL" }]   // restrict to the owner's verified address
}
```

The `www` redirect lives in the zone's Redirect Rules, not in this file.

## Open questions surfaced

- **Email Sending is in beta.** Is it acceptable to depend on a beta service, or should the form fall back to a third-party email API? Should the visitor's "Order up!" receipt be shown on the page only? Sending it by email needs Workers Paid.
- **Spam protection:** is Turnstile on the form wanted alongside the approximate rate limit?
- **Should previews be private?** Version and Preview URLs on `workers.dev` are public by default. Protecting them with Cloudflare Access is optional.
- **Who owns the security headers:** `_headers` in `public/` covers assets only, so CSP and HSTS for the Worker endpoint must be set in code.
