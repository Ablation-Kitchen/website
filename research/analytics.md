# Analytics: Plausible vs Umami vs Cloudflare Web Analytics

Research for issue #3. Sources checked 2026-11-12. Script sizes were measured
with `curl` on that date, and the gzip figures use `gzip -9`, so the bytes on
the wire may differ slightly.

## Recommendation

Use **Umami Cloud (Hobby, free)**. Track CV downloads and outbound clicks to
GitHub and LinkedIn with `data-umami-event` attributes. **Plausible Starter
($9/mo)** is the paid fallback if we want longer retention, EU-only hosting or
built-in outbound and download tracking. **Don't use Cloudflare Web Analytics**:
it has no custom events and its beacon is the heaviest of the three. Also make
sure Cloudflare's automatic beacon injection stays off, so we don't double-count.

## Comparison

| | Plausible Cloud | Umami Cloud | Cloudflare Web Analytics |
|---|---|---|---|
| Cost at personal-site traffic | Starter **$9/mo**, 1 site, starts at 10k monthly pageviews; yearly billing gives 2 months free; 30-day trial [1] | **Hobby $0**: 100K events/mo, 1 site, **6-month retention**; Pro $20/mo gives 1M events and 2-year retention [2] | **Free** [3][4] |
| Cookieless, no consent banner | No cookies and no persistent IDs. A daily hash of salt, domain, IP and UA, with the salt deleted every 24h. "You do not need cookie banners for analytics." Data stays in the EU. [5] | "Umami's web tracker does not use cookies." The FAQ says whether a notice is needed depends on your other services and setup [6] | "Does not use any client-side state, such as cookies or localStorage"; "don't fingerprint individuals" [4] |
| Custom events (CV download, outbound clicks) | Yes, on all plans. Outbound links, file downloads and form submissions are **automatic toggles** in site settings, with no snippet change [1][7]. Custom events count toward the pageview quota [8] | Yes. Use `data-umami-event="name"` plus `data-umami-event-*` properties, or `umami.track()`. Outbound tracking isn't built in, so you tag the links yourself [9][10] | **No**: "Not yet, but we may add support for this in the future." [11] |
| Per-page views (case studies) | Yes (Top Pages) | Yes | Yes, but sampled: query-time sampling ranges from 0.0001% to 100%, and unsampled data is kept for only 7 days, then aggregated to about 10% [11] |
| Script weight (measured) | `script.js`: 2.8 KB raw / **1.3 KB gz**. Variant with outbound, downloads and tagged events: 4.8 KB / 2.1 KB gz | `cloud.umami.is/script.js`: 9.2 KB raw / **4.1 KB gz** | `beacon.min.js`: 31.9 KB raw / **10.3 KB gz** |
| Lighthouse effect | Negligible when loaded `defer` | Negligible when loaded `defer` | Small, but the largest of the three. It's a third-party origin |
| Data ownership and export | CSV export (dashboard and full-site export). Stats API only on Business ($19/mo). Raw event export only on Enterprise. You can still export after the subscription ends [12][1] | Data export is included on Hobby. API from Pro up. Open source and free to self-host [2] | GraphQL API [11]. 6 months of history [11]. Hosted by Cloudflare only |

Storage check (grepping the downloaded scripts on 2026-11-12): none of the
three scripts uses `document.cookie`. Plausible reads
`localStorage.plausible_ignore` and Umami reads `umami.disabled`. Both are only
opt-out flags for the site owner, and neither writes an identifier. The
Cloudflare beacon reads no storage at all, and its `beacon.min.js` response
sends no `Set-Cookie` header.

## Notes and caveats

- **Umami Hobby limits.** 6-month retention, no API, one site and community
  support only [2]. That is enough to tell whether the case studies get read,
  but not for year-over-year trends. Pro costs $20/mo, which is more than
  Plausible Starter.
- **Self-hosting Umami** needs a Node.js 20.19+ server (22 LTS recommended)
  and **PostgreSQL** ≥ 12.14 [13]. It does not run natively on Cloudflare
  Pages, Workers or D1, so it would need an external Postgres (for example a
  hosted one) plus a Node host. That ops cost isn't worth it at our traffic.
- **Plausible's quota** counts pageviews *plus* custom events. Being over the
  limit for one month is fine. After two consecutive months over, they ask you
  to upgrade, and dashboards lock if you don't [8].
- **Cloudflare auto-injection.** On a proxied zone, the automatic setup
  injects the beacon into every page [11]. If we choose Umami or Plausible,
  confirm Web Analytics is off for the zone or Pages project.
- **Ad blockers** block all three on their default hosts. Umami's
  `data-host-url` [10] and a same-origin proxy (Cloudflare Worker or Pages
  rewrite) can reduce this. That would be a separate decision.
- All three can load the script with `defer`, so none blocks rendering. The
  Lighthouse 95+ target is safe with any of them. Plausible is lightest and
  Cloudflare is heaviest.

## Sources

1. Plausible pricing: https://plausible.io/#pricing (accessed 2026-11-12)
2. Umami pricing: https://umami.is/pricing (accessed 2026-11-12)
3. Cloudflare Web Analytics docs, About: https://developers.cloudflare.com/web-analytics/about/
4. Cloudflare Web Analytics product page: https://www.cloudflare.com/web-analytics/
5. Plausible data policy (last updated Nov 2026): https://plausible.io/data-policy
6. Umami FAQ: https://docs.umami.is/docs/faq
7. Plausible script extensions, default tracking (last updated Nov 1, 2026): https://plausible.io/docs/script-extensions
8. Plausible pricing and plans (last updated Oct 29, 2026): https://plausible.io/docs/subscription-plans
9. Umami track events: https://docs.umami.is/docs/track-events
10. Umami tracker configuration: https://docs.umami.is/docs/tracker-configuration
11. Cloudflare Web Analytics FAQ: https://developers.cloudflare.com/web-analytics/faq/
12. Plausible export stats (last updated Nov 5, 2026): https://plausible.io/docs/export-stats
13. Umami install: https://docs.umami.is/docs/install
