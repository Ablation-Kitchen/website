# Deploy

GitHub Actions builds, checks and deploys (`.github/workflows/ci.yml`). Workers Builds stays off.

- **Pull requests:** `wrangler versions upload --preview-alias pr-<n>` gives a preview at `https://pr-<n>-ablation-kitchen.<subdomain>.workers.dev`. The URL is in the job summary.
- **`main`:** `wrangler deploy`, after every blocking check passes: Astro check, ESLint, Prettier, Build, CSP check, Accessibility, Lighthouse CI and Internal links.
- Without the Cloudflare secrets (fork PRs, or before setup) both deploy jobs skip their steps and pass.
- **Preview noindex:** `public/_headers` sends `X-Robots-Tag: noindex` on every `*.*.workers.dev` host (previews and the Worker's own workers.dev URL). `ablation.kitchen` doesn't match the rule, so production stays indexable.
- **Security headers (#25):** defined in `src/lib/security-headers.ts`. At build, `integrations/security-headers.ts` hashes every inline script in `dist/**/*.html` and appends a `/*` rule with the CSP and the other headers to `dist/_headers`. Never paste a hash or a CSP into `public/_headers`: the build fails if it finds one. The Worker sets the same headers on `/_a/*`, because `_headers` doesn't apply to Worker responses.
- **CSP check:** `pnpm build && pnpm test:csp` serves `dist/` with `wrangler dev` (so `_headers` applies) and loads every built page in Chromium. Any CSP or Trusted Types violation, console error or blocked request fails it.

## Quality gates (#28)

Run `pnpm build` first. Each gate runs as its own CI job after Build.

| Gate                                                         | Local command                     | CI job                       | Blocks merge |
| ------------------------------------------------------------ | --------------------------------- | ---------------------------- | ------------ |
| axe, in Light and Dark, each with and without reduced motion | `pnpm test:a11y`                  | Accessibility                | yes          |
| Lighthouse, mobile, 3 runs (median)                          | `pnpm test:lhci`                  | Lighthouse CI                | yes          |
| Internal links and `#anchors` in `dist/`, offline            | `pnpm test:links`                 | Internal links               | yes          |
| GLOSSARY.md vocabulary on `src/content/**`                   | `pnpm lint:prose`                 | Vale (warn only)             | no           |
| External links, weekly                                       | `scripts/check-links.sh external` | External links (`links.yml`) | no           |

- **Audited pages:** `e2e/pages.ts` is the one list. Lighthouse CI (`lighthouserc.js`) and the axe suite (`e2e/a11y.e2e.ts`) both read it. A ticket that ships a page template adds one entry there in the same PR: `name`, `path`, the built `file` under `dist/`, and `status` if it isn't 200. A listed page whose file is missing fails both gates, unless it has `pending: '#<issue>'`. Then it's skipped with a warning until the file is built. `/`, `/about` and the 404 are listed. #32, #31 and #34 add `/work`, one case study and `/research`. Pages build as files (`build.format: 'file'`, so `about.html`), which is what lets `/about` answer 200 with no redirect; both gates reject redirects.
- **Lighthouse thresholds:** Accessibility, Best Practices and SEO = 100, Performance ≥ 95, JavaScript ≤ 100 KB transferred (`wrangler dev` gzips), LCP ≤ 2.0 s, CLS ≤ 0.02, TBT ≤ 150 ms. On the 404 page, three audits fail by design: `http-status-code`, `is-crawlable` (it's noindex) and `errors-in-console` (Chrome logs the document's own 404). So there the SEO and Best Practices categories are swapped for every other audit in them at 100, plus at most that one console error. Reports are in `.lighthouseci/`, and the CI job uploads them as the `lighthouse-reports` artifact.
- **No redirects:** both gates fail if a listed path redirects. LHCI matches assertions on the final URL, so a redirect would otherwise skip every assertion for that page. `scripts/lhci-check-urls.ts` checks this after `lhci autorun`.
- **Internal links:** `scripts/check-links.sh internal` resolves root-relative links under `dist/`, and maps the site's own `https://ablation.kitchen/…` URLs (canonical, sitemap, feeds, `/menu.txt`) onto `dist/`. A directory link resolves to its `index.html`. `lychee.toml` excludes paths that the nav or feeds already link to but a later ticket builds. Each line names its ticket, and that ticket deletes its line.
- **External links:** `.github/workflows/links.yml` runs on Mondays and on demand (Actions → External links → Run workflow). Broken links go into one open issue titled "Broken external links". The run creates it, updates its body each week, and closes it once everything passes. LinkedIn is excluded, because it answers every bot with status 999.
- **Vale:** `scripts/vale-rules.ts` turns every `_Avoid_:` word in `GLOSSARY.md` into a Vale rule (generated into `.vale/styles/Glossary/`, not committed). Distinctive words are warnings, which CI shows as PR annotations. Everyday words the glossary lists only to name a concept (`who`, `number`, `line`) are suggestions, shown only locally. Install Vale and lychee locally with `brew install vale lychee`.

## Manual steps (Dalmo only)

These need account access. Nothing in the repo does them.

### 1. Cloudflare API token

Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom token:

| Scope   | Permission       | Access |
| ------- | ---------------- | ------ |
| Account | Workers Scripts  | Edit   |
| Account | Account Settings | Read   |

Account Resources: include only the account that owns `ablation.kitchen`. No zone permissions are needed, because the Custom Domain is attached by hand (step 3). If a deploy fails with an authentication error, recreate the token from the "Edit Cloudflare Workers" template, scoped to the same account.

### 2. Repository secrets

GitHub → Settings → Secrets and variables → Actions → New repository secret:

- `CLOUDFLARE_API_TOKEN`: the token from step 1.
- `CLOUDFLARE_ACCOUNT_ID`: from the dashboard (Workers & Pages overview, right-hand column).

### 3. First deploy and the apex Custom Domain

1. Merge to `main` once the secrets exist, so `wrangler deploy` creates the `ablation-kitchen` Worker. PR previews fail until the Worker exists.
2. Workers & Pages → `ablation-kitchen` → Settings → Domains & Routes → Add → Custom Domain → `ablation.kitchen`. Cloudflare creates the DNS record and certificate. If an `A`/`AAAA`/`CNAME` record for the apex already exists, delete it first.
3. Check that Settings → Domains & Routes shows **Preview URLs: enabled** (`wrangler.jsonc` sets `preview_urls: true`).

### 4. `www` → apex redirect

1. DNS → Add record: `AAAA`, name `www`, content `100::`, **Proxied**. This is a dummy target so the request reaches Cloudflare.
2. Rules → Redirect Rules → Create rule (or the "Redirect from WWW to root" template):
   - When: hostname equals `www.ablation.kitchen`
   - Then: Dynamic redirect, expression `concat("https://ablation.kitchen", http.request.uri.path)`, status **301**, preserve query string.

### 5. Protect `main`

GitHub → Settings → General → Pull Requests: allow **squash merging** only (untick merge commits and rebase merging).

Settings → Rules → Rulesets → New branch ruleset, target `main`, enforcement Active:

- Restrict deletions
- Require linear history
- Require a pull request before merging (0 approvals is fine for a single maintainer)
- Require status checks to pass, up to date with the base: `Astro check`, `ESLint`, `Prettier`, `Build`, `CSP check`, `Accessibility`, `Lighthouse CI`, `Internal links`. Not `Vale (warn only)`, which never blocks.
- Block force pushes
- No bypass list, or only for emergencies

The check names come from the job `name:` fields in `ci.yml`. They appear in the picker after CI has run once.

### 6. Zone hardening (#25)

Cloudflare dashboard → the `ablation.kitchen` zone:

1. **Email Obfuscation off:** Email Address Obfuscation → Off (under Scrape Shield; newer dashboards list it in Security → Settings). It injects an inline script the CSP blocks (#7).
2. **Also off**, for the same reason: Rocket Loader (Speed → Optimization) and any Zaraz or Web Analytics auto-injection. Anything Cloudflare inserts into the HTML at the edge has no build hash.
3. **DNSSEC:** DNS → Settings → DNSSEC → Enable. Copy the DS record into the registrar. If the registrar is Cloudflare Registrar this happens by itself. Wait until the dashboard says **Active**.
4. **CAA:** DNS → Records → Add, type `CAA`, name `@`, for each CA below, tag "Only allow specific hostnames" (`issue`) and again "Only allow wildcards" (`issuewild`):
   - `letsencrypt.org`
   - `pki.goog; cansignhttpexchanges=yes`
   - `ssl.com`
   - `sectigo.com`

   Then one `iodef` record ("Send violation reports to URL"): `mailto:dalmo@ablation.kitchen`. Cloudflare also adds the CAA records Universal SSL needs once any CAA record exists. They don't show in the dashboard; `dig` shows them. The list is Cloudflare's [Universal SSL CAs](https://developers.cloudflare.com/ssl/reference/certificate-authorities/#caa-records), which can change: check it if a certificate renewal fails.

5. **HSTS preload:** after the first production deploy with the headers, submit `ablation.kitchen` at <https://hstspreload.org>. Preloading is hard to undo: every subdomain must serve HTTPS for good.
6. **Grade:** run <https://securityheaders.com/?q=ablation.kitchen&followRedirects=on>. The target is **A+**. Then tick the first box in #25.
7. **security.txt:** `public/.well-known/security.txt` has an `Expires` date. A test in `tests/security-headers.test.ts` starts failing 30 days before it. Renew by moving it about a year out.

## Done-when checks

```sh
curl -sI https://ablation.kitchen/ | head -1                 # 200
curl -sI https://ablation.kitchen/does-not-exist | head -1   # 404
curl -sI https://www.ablation.kitchen/x | grep -iE '^(HTTP|location)'  # 301 → https://ablation.kitchen/x
curl -sI https://pr-<n>-ablation-kitchen.<subdomain>.workers.dev/ | grep -i x-robots-tag  # noindex
curl -sI https://ablation.kitchen/ | grep -ic x-robots-tag   # 0
curl -sI https://ablation.kitchen/ | grep -iE '^(content-security-policy|strict-transport-security|cross-origin-embedder-policy):'  # all three
curl -s https://ablation.kitchen/.well-known/security.txt | head -2   # Contact + Expires
dig +short ablation.kitchen CAA          # the CAs above (plus Cloudflare's own)
dig +short ablation.kitchen DS           # non-empty once DNSSEC is active
```
