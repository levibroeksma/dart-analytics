# Design — CI Production Deploy (GitHub Actions)

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-24.
> Scope: GitHub Actions quality gates + Cloudflare Worker deploy via Environment approval.
> Relates to: `2026-07-24-cloudflare-deployment-specs.md` (manual Neon/Worker first-setup). This design **replaces** that doc’s “manual repeat deploy / local `deploy.sh` / post-launch Actions” path with CI-as-the-only deploy path for the app.

---

## 1. Background & Motivation

Production already runs on Cloudflare (`@astrojs/cloudflare` + `app/wrangler.jsonc`). Repeat deploys should not depend on a local script or memory of Wrangler flags. Unformatted or broken code must not reach production.

Existing gaps:

- `.github/workflows/checks.yml` runs structure + format/`astro check`/fallow but **not** `npm test`.
- `app/scripts/deploy.sh` assumes an old Workers/Pages split, `--env production`, and a missing prereq script; conflicts with the live Astro Worker model.
- `app/wrangler.toml` is stale relative to canonical `wrangler.jsonc`.
- README still points at removed/phantom `DEPLOYMENT.md` and local deploy.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Deploy surface | **CI only** — no `npm run deploy` / local deploy script |
| Trigger | Push/merge to `main` → quality → **GitHub Environment `production` approval** → deploy |
| PR protection | Same quality suite must pass on PRs |
| Pre-deploy | Re-run the **same** quality suite before approval/deploy (no weaker gate) |
| Neon migrate | **Out of v1** (optional later; not part of deploy) |
| Approach | Reusable quality workflow + thin deploy workflow (avoid gate drift) |
| Prettier before PR | **Both:** git `pre-commit` (husky + lint-staged → Prettier write on staged files) **and** stronger agent/pre-PR rules. CI stays fail-only (`format:check`) — no Actions auto-format/commit |

---

## 3. Scope

**In:**

- Reusable workflow defining `structure` + `app` quality jobs.
- PR workflow calling that reusable quality suite.
- Deploy workflow on `main`: call quality → `deploy` job with `environment: production` → `npm run build` → `npx wrangler deploy`.
- Add `npm test` to the `app` quality job.
- Repo secrets documentation: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Retire `app/scripts/deploy.sh`; retire or clearly obsolete `app/wrangler.toml`.
- Update `app/README.md` Production section for CI + Environment approval.
- Short operator note: create GitHub Environment `production` with required reviewers; enable branch protection requiring quality checks.
- Prettier enforcement before code leaves the machine / before PR:
  - `husky` + `lint-staged` pre-commit hook (repo root `.husky/`, driven from `app/package.json`) runs Prettier `--write` on staged files under the Prettier project.
  - Agent rules: `app/CLAUDE.md` + `app/AGENT.md` (byte-identical), plus `finishing-a-development-branch` skill — mandatory `npm run format` + clean `format:check` before creating/updating a PR (not only after multi-task plans).
  - CI remains `format:check` fail-only (no auto-commit from Actions).

**Out (v1):**

- Neon migrate in CI or interactive migrate prompts.
- Staging/preview Workers or PR preview deploys.
- Re-uploading Worker secrets from CI each deploy (secrets stay in Cloudflare).
- Full `validate:app` in CI (needs live Neon for migrate/introspect).
- Converting `wrangler.jsonc` → only format (already canonical).
- CI jobs that run `prettier --write` or open format-fix PRs.

---

## 4. Pipeline shape

```
PR opened/updated against main
  └─ quality.yml (reusable): structure + app

push to main
  └─ deploy.yml
       ├─ quality (same reusable)
       └─ deploy (needs: quality)
            environment: production   # manual Approve
            npm ci → npm run build → npx wrangler deploy
```

Canonical Worker config: `app/wrangler.jsonc` (`main` = `@astrojs/cloudflare/entrypoints/server`, `assets.directory` = `./dist`).

---

## 5. Quality gates (shared)

### Job `structure` (repo root)

Unchanged scripts: `check-context-map`, `check-file-locations`, `check-agent-mirrors`, `check-astro-class-composition`, `check-astro-conventions`, `check-doc-links`, `check-context-budget`.

### Job `app` (`working-directory: app`)

1. `npm ci`
2. `npm run format:check`
3. `npx astro check` (same as current `checks.yml`; do not pull in Neon-backed `validate:app`)
4. `npx fallow`
5. `npm test` (**new**)
6. Existing `fetchConnectionCache` grep guard

Both jobs must succeed for the reusable workflow to be green. Deploy may not proceed if either fails.

---

## 6. Deploy job

- Runs only after quality succeeds on `main`.
- Uses GitHub Environment **`production`** so deploy pauses for required reviewer approval.
- Steps in `app/`: `npm ci` → `npm run build` → `npx wrangler deploy`.
- Auth via `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (repo or environment secrets).
- Does not pass `--env production` unless `wrangler.jsonc` gains named envs later (today: single default Worker).

### Failure behavior

- Quality red → no deploy job (or deploy skipped via `needs`).
- Approval rejected / timed out → no Cloudflare change.
- `wrangler deploy` failure → job fails; previous Worker version remains until a successful deploy.

---

## 7. Repo / Cloudflare secrets split

| Secret | Where | Purpose |
| ------ | ----- | ------- |
| `CLOUDFLARE_API_TOKEN` | GitHub (repo or `production` env) | Wrangler CI auth |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub | Account scoping |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, auth JWKS, etc. | Cloudflare Worker secrets | Runtime only — set once via dashboard/`wrangler secret`; not redeployed from Actions in v1 |

---

## 8. Cleanup & docs

| Item | Action |
| ---- | ------ |
| `app/scripts/deploy.sh` | Delete |
| `app/wrangler.toml` | Delete (canonical is `wrangler.jsonc`) or, if any leftover value is still needed, migrate into `wrangler.jsonc` first then delete |
| `app/README.md` | Replace Production section: CI path, Environment approval, secrets checklist; remove `DEPLOYMENT.md` / local deploy claims |
| Branch protection | Document: require `structure` + `app` (or the reusable workflow’s check names) on PRs to `main` |
| `2026-07-24-cloudflare-deployment-specs.md` | Leave as historical first-setup notes; this design owns ongoing app deploy |

---

## 9. Operator setup (one-time, outside code)

1. Cloudflare API token with Workers deploy permission for this account.
2. GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. GitHub Environment `production` with required reviewers (solo: yourself).
4. Branch protection on `main`: require the quality checks before merge.

---

## 10. Format gate (local + agent)

| Layer | Behavior |
| ----- | -------- |
| pre-commit | husky → `cd app && npx lint-staged` → Prettier write on staged matches; commit includes formatted content |
| Agent / finishing-a-branch | Before `gh pr create` / push for review: `cd app && npm run format`, commit diffs if any, `npm run format:check` must exit 0 |
| CI (`quality` app job) | `npm run format:check` only — red if dirty; never auto-writes |

Install path: `app` is the only npm package; `prepare` script installs hooks at repo-root `.husky/` so clone + `npm install` in `app/` wires hooks. Document in `app/README.md` Quick Start.

## 11. Success criteria

- PR with failing tests or format cannot merge (with protection enabled).
- Merge to `main` re-runs the same gates, then waits for Environment approval, then deploys one Worker (app + assets).
- No local deploy script is required or documented as the happy path.
- Neon migrate is not coupled to deploy in v1.
- Unformatted staged files are rewritten at commit time; agents cannot open a PR without a clean `format:check`.
