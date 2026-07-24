# Cloudflare Deployment Guide

**For:** Manual v1 production deployment to Cloudflare (Neon + Workers + Pages).
**Status:** First-time setup; GitHub Actions automation added post-launch.
**Time:** ~30 minutes first-time; ~5 minutes per repeat deploy.

---

## Prerequisites

- Node.js `>=22.12.0`
- Cloudflare account (free tier)
- Neon account with linked project (setup in ../docs/architecture/05-Database/11-Neon-Integration.md)
- GitHub repository push access (for Pages auto-deploy)
- Wrangler installed (`npm install -g wrangler` or via `package.json`)

**Verify:** Run `neon auth`, `wrangler login`, and `git status` before starting.

---

## Phase 1: Neon Production Database Setup

### 1.1 Link Cloudflare account ID

Open https://dash.cloudflare.com/profile/api-tokens and copy your **Account ID** (left sidebar, under "API").

Edit `wrangler.toml`:
- Replace `account_id = "YOUR_ACCOUNT_ID"` with your real ID

Save and verify:
```bash
grep "account_id" wrangler.toml
# Expected: account_id = "YOUR_ACCOUNT_ID" (with real 32-char hex string)
```

### 1.2 Authenticate to Neon

```bash
neon auth
# Opens browser; sign in to Neon account
# Returns: "Authenticated as <email>"
```

Verify authentication:
```bash
neon projects list
# Expected: Shows your Neon project(s)
```

### 1.3 Link existing Neon project

```bash
neon link
# Prompts: "Select a project"
# Select the project with branches: main, preview, dev
```

Verify link:
```bash
neon projects current
# Expected: Prints project name and ID
```

### 1.4 Pull production connection strings

```bash
neon env main
# Outputs: NEON_BRANCH=main, DATABASE_URL=..., DATABASE_URL_UNPOOLED=..., etc.
```

Copy the output and create `.env.production`:

```bash
# Create file from template
cp .env.production.example .env.production

# Edit and paste values from 'neon env main' output
# Verify all 5 vars are populated:
# - NEON_BRANCH
# - DATABASE_URL (pooled)
# - DATABASE_URL_UNPOOLED (direct)
# - NEON_AUTH_BASE_URL
# - NEON_AUTH_JWKS_URL
```

Verify:
```bash
grep -E "^[A-Z_]+=.*" .env.production | wc -l
# Expected: 5 (or more if you added PUBLIC_ vars)
```

### 1.5 Migrate schema to Neon main branch

```bash
# Load production env vars
export $(cat .env.production | xargs)

# Run migrations
npm run db:migrate
# Expected output: "Applying migration 0001...", "Applying migration 0002...", etc.
# Final line: "No more migrations"
```

Verify:
```bash
npm run db:status
# Expected: Shows all migrations applied (✓ checks)
```

### 1.6 Verify schema in Neon dashboard

Open https://console.neon.tech → your project → main branch → SQL Editor.

Query:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Expected: Lists tables (activities, sessions, turns, darts, players, etc.). Reference data seeded (game_types, capture_modes, etc.).

---

## Phase 2: Cloudflare Workers API Deployment

### 2.1 Authenticate to Cloudflare

```bash
wrangler login
# Opens browser; authorize Cloudflare
# Returns: "Logged in as <email>"
```

Verify:
```bash
wrangler whoami
# Expected: Prints your account email
```

### 2.2 Set Worker secrets

Secrets are encrypted and not visible in Cloudflare dashboard or logs.

```bash
# From app/ directory, with .env.production loaded:
export $(cat .env.production | xargs)

# Set each secret (prompted for value)
wrangler secret put DATABASE_URL --env production
# Paste the value from $DATABASE_URL, press Enter

wrangler secret put DATABASE_URL_UNPOOLED --env production
# Paste the value from $DATABASE_URL_UNPOOLED, press Enter

wrangler secret put NEON_AUTH_JWKS_URL --env production
# Paste the value from $NEON_AUTH_JWKS_URL, press Enter

wrangler secret put NEON_AUTH_BASE_URL --env production
# Paste the value from $NEON_AUTH_BASE_URL, press Enter
```

Verify secrets were set:
```bash
wrangler secret list --env production
# Expected: Lists 4 secrets (no values shown; just names)
```

### 2.3 Build Astro project

```bash
npm run build
# Expected output: "✓ done", "dist/ contains built site"
```

Verify build output:
```bash
ls -la dist/ | head -10
# Expected: dist/ contains files (index.html, _astro/, api/)
```

### 2.4 Deploy to Cloudflare Workers

```bash
wrangler deploy --env production
# Uploads to Cloudflare; watch for progress
# Expected output: "Deployed to https://dart-analytics-api.workers.dev"
```

### 2.5 Test Worker API endpoint

```bash
# Test unauthenticated request (should get 401 UNAUTHORIZED)
curl -X GET https://dart-analytics-api.workers.dev/api/sessions/active \
  -H "Content-Type: application/json"

# Expected: {"ok":false,"error":{"code":"UNAUTHORIZED",...}}
```

---

## Phase 3: Cloudflare Pages Frontend Deployment

### 3.1 Connect GitHub repo to Cloudflare Pages

1. Go to https://dash.cloudflare.com/pages
2. Click "Create a project" → "Connect to Git"
3. Authorize GitHub
4. Select repository: `levibroeksma/dart-analytics`
5. Build settings auto-detect:
   - Build command: `npm run build` (or auto-detected `npm run build`)
   - Output directory: `dist/`
   - Root directory: `app/`
6. Click "Save and Deploy"

Pages triggers first build from main branch.

### 3.2 Set environment variables in Pages project

1. Go to Pages project settings → "Environment variables"
2. Add `PUBLIC_NEON_AUTH_BASE_URL`:
   - Value: (same as `NEON_AUTH_BASE_URL` from `.env.production`)
   - Environments: Production (and Preview if using staging later)
3. Save

### 3.3 Verify Pages deployment

Wait for build to complete (usually 2–3 minutes).

Check https://dash.cloudflare.com/pages → dart-analytics-api → Deployments tab.

Expected: Latest deployment shows "✓ Published".

### 3.4 Test frontend

```bash
curl https://dart-analytics-api.pages.dev/
# Expected: HTML response (Astro prerendered home page)
```

---

## Phase 4: End-to-End Validation

### 4.1 Check monitoring dashboards

**Neon dashboard:**
- Open https://console.neon.tech → main branch → Monitoring
- Expected: Query count from migrations visible

**Cloudflare Analytics Engine:**
- Open https://dash.cloudflare.com/analytics/workers
- Expected: Deploy request visible (status 200 or similar)

**Pages Analytics:**
- Open https://dash.cloudflare.com/pages → dart-analytics-api → Analytics
- Expected: Deploy event + build success shown

### 4.2 Record URLs

Save these for future reference:
- **Pages (frontend):** https://dart-analytics-api.pages.dev
- **Workers (API):** https://dart-analytics-api.workers.dev/api
- **Neon dashboard:** https://console.neon.tech/app/projects/YOUR_PROJECT_ID

---

## Phase 5: Next Steps

- **Play first game:** Log in via Neon Auth, start a session, submit gameplay
- **Monitor:** Check Neon query count and Worker logs for errors
- **GitHub Actions (post-launch):** Enable automated deploys on merge to main (separate spec)

---

## Rollback

If deployment breaks:

1. **Pages:** Revert to previous successful deployment in Pages dashboard (Deployments tab)
2. **Workers:** Rollback with `wrangler rollback --env production`
3. **Neon:** Rollback schema with `npm run db:migrate down` (consult migrations for safety)

---

## Troubleshooting

**"wrangler: command not found"**
- Run `npm install -g wrangler` or `npm install` to get local version

**"Account ID mismatch"**
- Verify `wrangler.toml` account_id matches https://dash.cloudflare.com/profile/api-tokens
- Run `wrangler whoami` to confirm logged-in account

**"DATABASE_URL not found"**
- Verify `.env.production` exists and is loaded: `export $(cat .env.production | xargs)`
- Run `printenv DATABASE_URL` to confirm var is set

**"Pages build fails"**
- Check Pages project → Deployments → build logs
- Common: missing `PUBLIC_NEON_AUTH_BASE_URL` env var in Pages settings

**"401 UNAUTHORIZED on API call"**
- Expected without JWT; test with real Neon Auth JWT from browser login
- Check `NEON_AUTH_JWKS_URL` secret is set correctly

---

## References

- Spec: `../../docs/superpowers/specs/2026-07-24-cloudflare-deployment-specs.md`
- Neon setup: `../../docs/architecture/05-Database/11-Neon-Integration.md`
- API contract: `../../docs/architecture/06-API/00-Overview.md`
- Local dev: `./README.md`
