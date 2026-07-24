# CI Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production app deploys CI-only: shared quality gates on every PR (including `npm test`), re-run those gates on `main`, then deploy the Astro Cloudflare Worker after GitHub Environment `production` approval.

**Architecture:** Extract today’s `checks.yml` jobs into a reusable `quality.yml` (`workflow_call`). `checks.yml` calls it on PRs only. `deploy.yml` on `main` calls the same reusable workflow, then a `deploy` job (`environment: production`) runs `npm ci` → `npm run build` → `npx wrangler deploy` using `app/wrangler.jsonc`. Retire local `deploy.sh` / stale `wrangler.toml` / prereq script; document operator secrets + Environment setup in `app/README.md`.

**Tech Stack:** GitHub Actions (reusable workflows), Node 22, npm, Vitest, Wrangler 4, `@astrojs/cloudflare`, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-07-24-ci-production-deploy-design.md`

**Branch:** Stay on `feat/deployment-config-and-setup` (no worktrees — root `CLAUDE.md`).

## Global Constraints

- No Neon migrate in CI (v1).
- No local `npm run deploy` script.
- Canonical Wrangler config is `app/wrangler.jsonc` only — delete `app/wrangler.toml`.
- Do not run `validate:app` / `db:migrate` / `db:introspect` in Actions (needs live Neon).
- Deploy does **not** pass `--env production` (single default Worker in `wrangler.jsonc`).
- Worker runtime secrets stay in Cloudflare; CI only needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- Minimal diffs; do not rewrite historical `docs/superpowers/specs/2026-07-24-cloudflare-deployment-specs.md` beyond leaving it as first-setup history.
- After workflow YAML changes, verify with the local commands in each task (Actions cannot be fully exercised offline).
- Context Maintenance: `DECISIONS.md` entry **D135**; `app/README.md` update; run the seven `scripts/check-*.sh` scripts before claiming done. Superpowers plans/specs are out of Context Map registration scope.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `.github/workflows/quality.yml` | **Create** — reusable `structure` + `app` jobs (includes `npm test`) |
| `.github/workflows/checks.yml` | **Replace** — PR-only caller of `quality.yml` |
| `.github/workflows/deploy.yml` | **Create** — `main` push: quality → Environment-approved Wrangler deploy |
| `app/scripts/deploy.sh` | **Delete** |
| `app/scripts/validate-deployment-prerequisites.sh` | **Delete** (obsolete; tied to `wrangler.toml` / local deploy) |
| `app/wrangler.toml` | **Delete** |
| `app/README.md` | Production section → CI + Environment + secrets checklist |
| `DECISIONS.md` | D135 one-liner |

---

### Task 1: Prove current gaps

**Files:**
- Read: `.github/workflows/checks.yml`
- Read: `app/package.json`
- Read: `app/wrangler.jsonc`

- [ ] **Step 1: Confirm `npm test` is missing from CI**

```bash
grep -n 'npm test\|vitest' .github/workflows/checks.yml || echo "NO_TEST_IN_CI"
grep -n '"test"' app/package.json
# expect package.json has "test": "vitest run"; CI has no npm test
```

- [ ] **Step 2: Confirm local quality commands work (baseline)**

```bash
cd app
npm ci
npm run format:check
npx astro check
npx fallow
npm test
```

Expected: all exit 0 (if any fail, stop and fix before changing workflows — do not weaken gates).

- [ ] **Step 3: Confirm obsolete local deploy artifacts exist**

```bash
test -f app/scripts/deploy.sh && echo "deploy.sh present"
test -f app/scripts/validate-deployment-prerequisites.sh && echo "prereq present"
test -f app/wrangler.toml && echo "wrangler.toml present"
test -f app/wrangler.jsonc && echo "wrangler.jsonc present"
grep -n 'DEPLOYMENT.md\|deploy.sh' app/README.md
```

- [ ] **Step 4: Commit nothing** (discovery only)

---

### Task 2: Create reusable `quality.yml`

**Files:**
- Create: `.github/workflows/quality.yml`

- [ ] **Step 1: Write `.github/workflows/quality.yml`**

Create the file with exactly this content:

```yaml
name: quality

on:
  workflow_call:

jobs:
  structure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh
      - name: File-location gate
        run: bash scripts/check-file-locations.sh
      - name: AGENT.md mirror gate
        run: bash scripts/check-agent-mirrors.sh
      - name: Astro class-composition gate
        run: bash scripts/check-astro-class-composition.sh
      - name: Astro conventions gate
        run: bash scripts/check-astro-conventions.sh
      - name: Doc-links gate
        run: bash scripts/check-doc-links.sh
      - name: Context-budget gate
        run: bash scripts/check-context-budget.sh

  app:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Format gate
        run: npm run format:check
      - name: Type gate
        run: npx astro check
      - name: Stale-usage gate
        run: npx fallow
      - name: Unit tests
        run: npm test
      - name: Check for deprecated neonConfig.fetchConnectionCache
        working-directory: ${{ github.workspace }}
        run: |
          if grep -r "fetchConnectionCache" app/src --include="*.ts" --include="*.js"; then
            echo "Error: fetchConnectionCache is deprecated and must not be used"
            exit 1
          fi
```

- [ ] **Step 2: Verify file shape**

```bash
grep -n 'workflow_call\|npm test\|Unit tests' .github/workflows/quality.yml
# expect workflow_call once; Unit tests + npm test present
test ! -f .github/workflows/quality.yml.bak
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/quality.yml
git commit -m "$(cat <<'EOF'
ci: add reusable quality workflow with npm test

Shared structure + app gates for PRs and pre-deploy; closes the missing Vitest gate.
EOF
)"
```

---

### Task 3: Rewire `checks.yml` as PR-only caller

**Files:**
- Modify: `.github/workflows/checks.yml` (replace entire file)

- [ ] **Step 1: Replace `.github/workflows/checks.yml`**

Overwrite with exactly:

```yaml
name: checks

on:
  pull_request:
    branches: [main]

jobs:
  quality:
    uses: ./.github/workflows/quality.yml
```

Rationale: drop `push` to `main` so quality is not double-run; `deploy.yml` owns `main`.

- [ ] **Step 2: Verify**

```bash
grep -n 'push:\|pull_request:\|uses:' .github/workflows/checks.yml
# expect pull_request only; uses quality.yml; no inline npm steps left
wc -l .github/workflows/checks.yml
# expect a short file (~10 lines)
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/checks.yml
git commit -m "$(cat <<'EOF'
ci: call reusable quality workflow on pull requests

Keeps a single gate definition; main pushes are handled by deploy.yml.
EOF
)"
```

---

### Task 4: Add `deploy.yml` (quality → Environment → Wrangler)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

Create with exactly:

```yaml
name: deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  quality:
    uses: ./.github/workflows/quality.yml

  deploy:
    needs: quality
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy Worker
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Verify shape (no migrate, no `--env`, Environment set)**

```bash
grep -n 'environment:\|wrangler deploy\|db:migrate\|--env\|npm run build' .github/workflows/deploy.yml
# expect: environment: production; wrangler deploy without --env; npm run build; NO db:migrate
```

- [ ] **Step 3: Dry-run build locally (deploy auth not required)**

```bash
cd app
npm run build
# expect dist/ exists and exit 0
test -d dist && echo "dist ok"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: add main deploy workflow with production Environment gate

Re-runs shared quality, then builds and wrangler-deploys after approval.
EOF
)"
```

---

### Task 5: Retire local deploy artifacts

**Files:**
- Delete: `app/scripts/deploy.sh`
- Delete: `app/scripts/validate-deployment-prerequisites.sh`
- Delete: `app/wrangler.toml`

- [ ] **Step 1: Confirm nothing else imports these paths**

```bash
rg -n 'deploy\.sh|validate-deployment-prerequisites|wrangler\.toml' --glob '!docs/superpowers/**' --glob '!graphify-out/**' || echo "no live refs"
```

Expected: only historical/superpowers hits if any; live `app/` / `.github/` / canonical docs should not require the deleted files. If a live ref remains outside superpowers, fix that ref in this task before deleting.

- [ ] **Step 2: Delete the three files**

```bash
git rm app/scripts/deploy.sh app/scripts/validate-deployment-prerequisites.sh app/wrangler.toml
```

- [ ] **Step 3: Confirm canonical config remains**

```bash
test -f app/wrangler.jsonc && echo "canonical wrangler.jsonc ok"
test ! -f app/wrangler.toml && echo "toml gone"
test ! -f app/scripts/deploy.sh && echo "deploy.sh gone"
```

- [ ] **Step 4: Commit**

```bash
git add -u app/scripts/deploy.sh app/scripts/validate-deployment-prerequisites.sh app/wrangler.toml
git commit -m "$(cat <<'EOF'
chore: remove obsolete local deploy scripts and wrangler.toml

CI + wrangler.jsonc are the sole production deploy path.
EOF
)"
```

---

### Task 6: README + decision ledger

**Files:**
- Modify: `app/README.md` (Production Deployment section)
- Modify: `DECISIONS.md` (add D135; bump `updated` date in HTML comment to `2026-07-24`)

- [ ] **Step 1: Replace the Production Deployment section in `app/README.md`**

Find the section starting at `## Production Deployment` through the paragraph ending with `one-click merges.` and replace with:

```markdown
## Production Deployment

Production deploys are **CI-only** (GitHub Actions). There is no local `npm run deploy`.

**Happy path**

1. Open a PR to `main` — workflow `checks` runs the shared `quality` suite (structure scripts, format, `astro check`, fallow, `npm test`).
2. Merge when green.
3. Push to `main` runs workflow `deploy`: the same `quality` suite again, then job `deploy` waits on GitHub Environment **`production`** approval.
4. After Approve: `npm run build` + `npx wrangler deploy` (Worker + assets via `wrangler.jsonc`).

**One-time operator setup**

| Item | Where |
| ---- | ----- |
| Cloudflare API token (Workers deploy) | Create in Cloudflare dashboard |
| `CLOUDFLARE_API_TOKEN` | GitHub secret (repo or Environment `production`) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub secret (same) |
| Environment `production` | GitHub → Settings → Environments → required reviewers |
| Branch protection on `main` | Require status checks `quality / structure` and `quality / app` |

Worker runtime secrets (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, auth JWKS, etc.) stay in Cloudflare (`wrangler secret` / dashboard). Neon schema migrate is **not** part of deploy — run locally against prod when needed.

First-time Neon + Worker secret bootstrap notes (historical): `docs/superpowers/specs/2026-07-24-cloudflare-deployment-specs.md`.
```

- [ ] **Step 2: Add D135 to `DECISIONS.md`**

In the most appropriate process/platform table (same style as nearby late D-numbers; if a “Tooling / CI” or general continued-session table exists near D133/D134, append there), add:

```markdown
| D135 | 2026-07-24 | Production app deploy is CI-only: reusable `quality.yml` (structure + format/`astro check`/fallow/`npm test`) on PRs and again on `main`, then `deploy.yml` builds and `wrangler deploy`s after GitHub Environment `production` approval; local `deploy.sh` / stale `wrangler.toml` retired; Neon migrate stays out of deploy | Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts |
```

Also set the file header comment `updated:` to `2026-07-24`.

- [ ] **Step 3: Verify README has no dead links**

```bash
grep -n 'DEPLOYMENT.md\|deploy.sh\|npm run deploy' app/README.md || echo "clean"
test ! -f app/DEPLOYMENT.md
```

- [ ] **Step 4: Run context checkers**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/README.md DECISIONS.md
git commit -m "$(cat <<'EOF'
docs: document CI production deploy and record D135

README matches Actions + Environment approval; ledger captures CI-only deploy.
EOF
)"
```

---

### Task 7: Final verification + operator handoff note

**Files:** none (verify only)

- [ ] **Step 1: Workflow inventory**

```bash
ls -1 .github/workflows/
# expect: checks.yml deploy.yml quality.yml (and any pre-existing unrelated workflows)

grep -RIn 'npm test' .github/workflows/quality.yml
grep -RIn 'environment: production' .github/workflows/deploy.yml
grep -RIn 'wrangler.toml\|deploy.sh' app --glob '!**/node_modules/**' || echo "app clean"
```

- [ ] **Step 2: Re-run app gates once**

```bash
cd app
npm run format:check
npx astro check
npx fallow
npm test
```

Expected: all green.

- [ ] **Step 3: Print operator checklist (do not automate)**

Confirm with the user (chat) that they will, before first green `main` deploy:

1. Create GitHub Environment `production` with required reviewer(s).
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as Environment (preferred) or repo secrets.
3. Enable branch protection requiring `quality / structure` and `quality / app`.
4. Merge this branch via PR (so `checks` runs), then Approve the `production` Environment on the `deploy` workflow.

- [ ] **Step 4: No further commit unless Step 1–2 found fixes**

If fixes were needed, commit them with a clear message; otherwise stop.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| Reusable quality workflow | Task 2 |
| PR calls quality | Task 3 |
| `main` quality then deploy + Environment | Task 4 |
| Add `npm test` | Task 2 |
| Secrets documented | Task 6 |
| Delete `deploy.sh` / `wrangler.toml` | Task 5 (+ prereq script) |
| README Production rewrite | Task 6 |
| Operator Environment / branch protection | Task 6 + Task 7 |
| No Neon migrate in v1 | Tasks 2–4 (absent by design) |
| No local `npm run deploy` | Tasks 5–6 |
| Canonical `wrangler.jsonc` | Task 5 |

## Placeholder / consistency check

- No TBD/TODO left in tasks.
- Wrangler invoke is always `npx wrangler deploy` (no `--env`).
- Status check names documented as `quality / structure` and `quality / app` (caller job id `quality` + reusable job ids).
- D135 number is next after D134.
