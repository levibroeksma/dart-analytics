# Cloudflare Deployment Spec — Dart Analytics v1

**Date:** 2026-07-24  
**Status:** Design approved  
**Scope:** Manual production deployment to Cloudflare (Neon + Workers + Pages) on free tier, with expansion path to GitHub Actions automation.

---

## Overview

Deploy the Dart Analytics app to Cloudflare production. This spec covers:
- Neon production database setup
- Cloudflare Workers API deployment
- Cloudflare Pages static site deployment
- Free tier optimization & quotas
- Monitoring & observability tooling
- GitHub Actions automation path (follow-up)

**Design principle:** Learn by doing. Manual step-by-step deployment first; GitHub Actions + staging branches added post-launch.

**Timeline:** This spec enables v1 manual deployment. GitHub Actions + Preview branch automation follows after first engine is tested live.

**User profile:** Single player initially (5+ games/day). Long-term continuous improvement.

---

## 1. Neon Production Setup

### Goals
- Production database on Neon's free tier
- Service-role connection for Workers
- Schema + reference data only (no dev fixtures)

### Project Topology

Neon project has three branches:
| Branch | Role | Compute | Notes |
| --- | --- | --- | --- |
| `main` | Production | Scale-to-zero | Always on (free tier); upgrade to always-on paid compute when onboarding users |
| `preview` | Staging (future) | Scale-to-zero | For PR deploys; added post-launch |
| `dev` | Local dev | Scale-to-zero | Shared dev environment; created as child of `main` |

**Region:** `aws-eu-central-1` (Frankfurt).

### Connection Strings

Neon `neonctl link` produces two connection strings per branch:

| Variable | Use | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Migrations, introspection | Pooled connection (hostname contains `-pooler`); consumed by dbmate and Drizzle |
| `DATABASE_URL_UNPOOLED` | Worker runtime (`getDb()`) | Direct connection (hostname without `-pooler`); required for serverless runtime |

**Never create separate `DATABASE_URL_POOLED` alias** — `neonctl link` is the sole source.

### Setup Steps

1. **Authenticate & verify project:**
   ```bash
   neon auth
   neon projects list
   ```

2. **Link existing Neon project to this repo:**
   ```bash
   neon link
   ```
   (If this is a new Neon account, create a new project via https://console.neon.tech first.)

3. **Pull production connection strings:**
   ```bash
   neon env main
   # Outputs NEON_BRANCH, DATABASE_URL, DATABASE_URL_UNPOOLED, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL
   ```

4. **Migrate schema to main:**
   ```bash
   # From app/ directory, with DATABASE_URL set to main's pooled connection
   npm run db:migrate
   ```

5. **Seed production reference data only:**
   - Reference data (game types, capture modes, etc.) is auto-seeded during migration via SQL seed in `0002`.
   - Dev fixtures and test templates are **not** seeded to production.

6. **Verify:**
   ```bash
   npm run db:status
   ```

### Free Tier Limits & Headroom

- **Storage:** 3GB free. Gameplay facts (turns, darts) are small; even 1000 games stores <100MB. Headroom: excellent.
- **Compute:** Shared, scale-to-zero (suspend after 5min inactivity). No compute charges on free tier.
- **Queries:** Unlimited per month. No quota.

**Monitoring:** Neon dashboard shows query count and active connections. Check monthly to track growth.

### Expansion Path

When onboarding users:
- Upgrade to paid compute ($9–15/mo for always-on or auto-scaling)
- Add Row-Level Security (RLS) for multi-player isolation (deferred from v1)
- Create separate staging branches for preview deploys

---

## 2. Cloudflare Workers API Deployment

### Goals
- Deploy existing Astro API layer to Cloudflare Workers
- Store secrets securely
- Enable manual + future GitHub Actions deploys

### Wrangler Configuration

Create `app/wrangler.toml`:

```toml
name = "dart-analytics-api"
type = "service"
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
main = "dist/worker.js"
compatibility_date = "2024-11-28"

[env.production]
routes = [
  { pattern = "example.workers.dev/api/*", zone_name = "workers.dev" }
]
vars = { ENVIRONMENT = "production" }

[[env.production.vars]]
NEON_AUTH_BASE_URL = "https://auth.neon.tech"

[env.preview]
routes = [
  { pattern = "preview.example.workers.dev/api/*", zone_name = "workers.dev" }
]
vars = { ENVIRONMENT = "preview" }
```

**Account ID:** Available at https://dash.cloudflare.com/profile/api-tokens.

### Secrets Management

Store in Cloudflare Workers environment via CLI:

```bash
wrangler secret put DATABASE_URL_UNPOOLED --env production
wrangler secret put DATABASE_URL --env production
wrangler secret put NEON_AUTH_JWKS_URL --env production
wrangler secret put NEON_AUTH_BASE_URL --env production
```

(Paste Neon values from `neon env main` output; these are never committed.)

**Why secrets, not vars?** Secrets are encrypted and not visible in logs or dashboards. Database credentials must be secrets.

### Build & Deploy

From `app/` directory:

```bash
npm run build
wrangler deploy --env production
```

**Output:** Deployed to `example.workers.dev/api/*` (free `.workers.dev` subdomain). Custom domain optional (add later).

### Deployment Flow

1. Build Astro → `dist/`
2. Wrangler bundles & uploads to Cloudflare
3. Workers service runs API endpoints
4. Routes `/api/*` → Worker handlers → Neon via `DATABASE_URL_UNPOOLED`

### Free Tier Limits & Headroom

- **Requests:** 100k/day (1M/month). At 5 games/day × 3 calls/game = 450/month. Headroom: 2200× comfortable.
- **CPU:** 50ms/request default (sufficient for Neon queries + JSON serialization).
- **Bundled assets:** Included with free tier.

**Monitoring:** Cloudflare Analytics Engine (built-in) logs every Worker request (latency, status, errors).

### Expansion Path

- **Custom domain:** Add via Cloudflare registrar or external DNS ($20+/year if using new domain).
- **Paid Workers:** Upgrade to Bundled ($20/mo) for higher quotas when user base grows.

---

## 3. Frontend & Pages Deployment

### Goals
- Deploy Astro static site to Cloudflare Pages
- Auto-deploy on push to main
- Route `/api/*` requests to Workers API

### Pages Configuration

1. **Connect GitHub repo:**
   - Go to https://dash.cloudflare.com/pages
   - Click "Create a project" → "Connect to Git"
   - Authorize GitHub, select `levibroeksma/dart-analytics`
   - Build settings auto-detect Astro

2. **Build & deploy settings:**
   - Build command: `npm run build`
   - Build output directory: `dist/`
   - Root directory: `app/`
   - Deploy branch: `main` (auto-deploy on push)

3. **Environment variables:**
   - Set `PUBLIC_NEON_AUTH_BASE_URL` in Pages project settings
   - Value: same as `NEON_AUTH_BASE_URL` from Neon (browser-visible auth endpoint)

4. **Route configuration:**
   - Static assets (HTML, CSS, JS) served by Pages
   - `/api/*` requests forward to Workers API
   - Cloudflare automatically routes based on path pattern

### Request Flow

```
Browser
  ↓
Cloudflare Pages (static assets)
  ├→ /api/* → Cloudflare Workers API
  │           ↓
  │        Neon via DATABASE_URL_UNPOOLED
  │
  └→ /*.html, /css/*, /js/* → Pages CDN (cached)
```

### Free Tier Limits & Headroom

- **Deployments:** Unlimited
- **Requests:** Shared with Workers (1M/month total)
- **Build time:** 500 builds/month free
- **Sites:** Unlimited

**No separate quota for Pages**—all requests (Pages + Workers) share the 1M/month Cloudflare quota.

### Deployment Workflow

1. Push to main
2. Pages detects change, triggers build
3. `npm run build` runs in Cloudflare environment
4. `dist/` deployed to CDN
5. Live in ~2 minutes

**No manual Pages step required.** GitHub push triggers everything.

### Expansion Path

- **Custom domain:** Add via Cloudflare registrar
- **Preview branches:** Add GitHub Actions to deploy PRs to Preview branch (post-launch)

---

## 4. Free Tier Optimization & Limits

### Quotas Summary

| Resource | Free Limit | Usage | Headroom |
| --- | --- | --- | --- |
| Workers requests | 1M/month | ~450/month | 2200× |
| Pages requests | Shared with Workers | ~450/month | 2200× |
| Neon queries | Unlimited | ~1.5k/month | ∞ |
| Neon storage | 3GB | ~100MB (estimate) | 30× |
| KV operations | 100k/day | <100/day | 1000× |

### Performance Tuning

**Worker latency:**
- Typical: 50–200ms (Neon query + JSON serialization)
- Optimization: Already batching writes; no per-turn calls
- Monitor: Cloudflare Analytics Engine

**Database pool:**
- Neon pooler handles connection reuse automatically
- For Workers: use `DATABASE_URL_UNPOOLED` (direct, serverless-optimized)
- No manual tuning needed for single-user load

**Pages caching:**
- Static assets (CSS, JS, HTML) cached at edge by default
- Cache headers auto-set for `dist/` files
- Browser caching: 30 days default

### Cost Projection

| Scenario | Workers Cost | Neon Cost | Total |
| --- | --- | --- | --- |
| v1 launch (free tier) | $0 | $0 | **$0** |
| After 100 users (est. 5k games/day) | $20/mo (Bundled) | $9/mo (compute) | **$29/mo** |
| After 1000 users (est. 50k games/day) | $50/mo (Enterprise) | $25/mo (auto-scale) | **$75/mo** |

**Strategy:** Start free tier; upgrade only when usage demands it.

---

## 5. Monitoring & Observability

### Goals
- Track performance metrics
- Catch errors and incidents
- Measure UX (completion rate, latency)
- Inform next engine optimizations

### Included (Free Tier)

**Neon Dashboard:**
- Query count per month
- Active connections
- Compute uptime (scale-to-zero events)
- Database size

**Cloudflare Analytics Engine:**
- Worker request logs (latency, status, errors)
- Query in Grafana or custom dashboards
- Free tier: all data retained

**Cloudflare Pages:**
- Build status (success/fail)
- Deploy logs
- Request count

**Error Logging (add during implementation):**
- Option 1: Sentry free tier (5k events/month)
- Option 2: Axiom free tier (unlimited ingestion, 7-day retention)
- Option 3: Workers KV + simple error dashboard

### Key Metrics

**API Health:**
- Request latency (p50, p95, p99)
- Error rate (5xx, 4xx by error code)
- Response time by endpoint

**Database Health:**
- Query count (trend vs. capacity)
- Connection pool saturation
- Query latency (p95)

**Application Health:**
- Session completion rate (games played ÷ completed)
- Error types (validation, database, auth)
- Deployment frequency & success rate

**User Experience:**
- Pages load time (first contentful paint)
- Worker response time (API latency)

### Observability Setup (Initial)

1. **Neon:** Check dashboard monthly to track query volume and storage growth.
2. **Cloudflare:** Enable Analytics Engine; export to Grafana or simple CSV dashboard.
3. **Error logging:** Use Axiom free tier (simple signup, no credit card required).
4. **Incident response:** Errors logged to Axiom; you check weekly or on deploy.

### Escalation Plan

- **Post-launch (1 month):** Add Grafana dashboards for real-time monitoring.
- **After 10 users:** Add Sentry for error tracking + release management.
- **After 100 users:** Upgrade to PagerDuty for on-call alerting (if needed).

---

## 6. GitHub Actions Automation (Follow-Up)

### Timeline
Added **after v1 engine is tested live in production** (post-launch, ~1–2 weeks).

### Two Options

**Option A: CLI-based (simple)**
```bash
npm run deploy  # Local script: npm run build && wrangler deploy
```
- No GitHub Actions setup
- Still manual, but one-command
- Works for 1+ weekly deploy cadence
- Good for solo development

**Option B: GitHub Actions (full automation)**
- Merge to main → Actions builds & deploys
- PR → Auto-deploy to Preview branch for testing
- Requires Cloudflare API tokens in GitHub secrets
- Full staging environment (Preview Neon branch)
- Zero manual steps post-merge

### Spec Coverage

**This spec covers:** Manual `wrangler deploy` only (Sections 1–5).

**Next spec will cover:** GitHub Actions config + Preview branch promotion (post-launch).

---

## 7. Deployment Checklist

### Pre-Launch

- [ ] Neon main branch created & linked
- [ ] Schema migrated to main
- [ ] Reference data seeded
- [ ] wrangler.toml created with secrets
- [ ] Workers deployed & tested
- [ ] Pages connected to GitHub
- [ ] PUBLIC_NEON_AUTH_BASE_URL set in Pages
- [ ] Both endpoints accessible (public URLs recorded)
- [ ] Monitoring dashboards created (Neon + Cloudflare)

### Post-Launch

- [ ] Play first game in production
- [ ] Verify session created in Neon
- [ ] Check Worker logs for errors
- [ ] Confirm metrics in Cloudflare Analytics
- [ ] Note any latency surprises (set p95 baseline)
- [ ] Run weekly monitoring checks

---

## 8. Known Deferred Items

- **Preview/staging branches:** Added in GitHub Actions spec (post-launch)
- **Custom domains:** Optional; free subdomain works for v1
- **Row-Level Security (RLS):** Deferred post-v1; only needed for multi-player
- **Alerting:** Not required for single-player; check dashboards weekly
- **Performance optimization:** Post-launch; measure real usage first

---

## 9. Related Documents

- `../../../docs/architecture/05-Database/11-Neon-Integration.md` — Neon topology & tooling
- `../../../docs/architecture/06-API/00-Overview.md` — API contract (frozen v1)
- `../../../docs/architecture/06-API/01-Implementation-Strategy.md` — REST vs Astro Actions, Cloudflare constraints
- `../../../app/CLAUDE.md` — App implementation rules
- `../../../app/README.md` — Local dev setup
