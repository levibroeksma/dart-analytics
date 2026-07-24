# CI Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production app deploys CI-only: shared quality gates on every PR (including `npm test`), re-run those gates on `main`, then deploy the Astro Cloudflare Worker after GitHub Environment `production` approval. Stop Prettier CI failures by combining husky/lint-staged pre-commit formatting with mandatory agent/pre-PR format gates (CI stays `format:check` fail-only).

**Architecture:** Extract today’s `checks.yml` jobs into a reusable `quality.yml` (`workflow_call`). `checks.yml` calls it on PRs only. `deploy.yml` on `main` calls the same reusable workflow, then a `deploy` job (`environment: production`) runs `npm ci` → `npm run build` → `npx wrangler deploy` using `app/wrangler.jsonc`. Retire local `deploy.sh` / stale `wrangler.toml` / prereq script; document operator secrets + Environment setup in `app/README.md`. Wire `husky` + `lint-staged` from `app/package.json` into repo-root `.husky/pre-commit`; sharpen `app/CLAUDE.md`/`AGENT.md` and the finishing-a-branch skill so agents always format before PR.

**Tech Stack:** GitHub Actions (reusable workflows), Node 22, npm, Vitest, Wrangler 4, `@astrojs/cloudflare`, Cloudflare Workers, husky, lint-staged, Prettier.

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
- Context Maintenance: `DECISIONS.md` entry **D135** (CI deploy) + **D136** (format pre-commit + agent gate); `app/README.md` update; `app/CLAUDE.md` ↔ `app/AGENT.md` byte-identical; run the seven `scripts/check-*.sh` scripts before claiming done. Superpowers plans/specs are out of Context Map registration scope.
- Hooks live at repo-root `.husky/` even though npm lives under `app/` (only package.json). Do not add a root `package.json` solely for husky.

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
| `app/package.json` | Add `husky`, `lint-staged`, `prepare` script, `lint-staged` config |
| `.husky/pre-commit` | Run `cd app && npx lint-staged` |
| `app/CLAUDE.md` + `app/AGENT.md` | Mandatory format before any PR create/update |
| `.claude/skills/finishing-a-development-branch/SKILL.md` | Format gate before Create PR option |
| `app/README.md` | Production section → CI + Environment + secrets; Quick Start notes hooks |
| `DECISIONS.md` | D135 (CI deploy) + D136 (format enforcement) |

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

### Task 6: Husky + lint-staged + agent format gates

**Files:**
- Modify: `app/package.json`
- Create: `.husky/pre-commit`
- Modify: `app/CLAUDE.md` + `app/AGENT.md` (must stay byte-identical)
- Modify: `.claude/skills/finishing-a-development-branch/SKILL.md`

- [ ] **Step 1: Install husky and lint-staged in `app/`**

```bash
cd app
npm install -D husky lint-staged
```

Expected: both appear under `devDependencies` in `app/package.json` and `package-lock.json` updates.

- [ ] **Step 2: Add `prepare`, `lint-staged` config to `app/package.json`**

In `app/package.json` `scripts`, add:

```json
"prepare": "cd .. && husky"
```

At the top level of `app/package.json` (sibling of `scripts`), add:

```json
"lint-staged": {
  "*": "prettier --write --ignore-unknown"
}
```

Notes:
- `prepare` runs from `app/` after `npm install`, so `cd .. && husky` installs hooks into repo-root `.husky/`.
- lint-staged runs with cwd `app/` (see pre-commit), so Prettier picks up `app/.prettierrc.mjs` / `.prettierignore`.

- [ ] **Step 3: Create `.husky/pre-commit`**

```bash
cd ..
npx --prefix app husky init
```

If `husky init` created a sample hook, replace `.husky/pre-commit` contents with exactly:

```sh
#!/usr/bin/env sh
cd app && npx lint-staged
```

Ensure the file is executable (`chmod +x .husky/pre-commit` on Unix; on Windows Git still runs it via sh).

- [ ] **Step 4: Prove the hook formats staged files**

Create a throwaway dirty file, stage it, run the hook, then clean up:

```bash
cd app
printf 'const x=1\n' > /tmp/prettier-hook-probe.ts
# On Windows PowerShell use: Set-Content -NoNewline is fine; prefer a path under app/
printf 'const x=1\n' > scripts/_prettier_hook_probe.ts
git add scripts/_prettier_hook_probe.ts
npx lint-staged
# expect Prettier rewrote the file (spaces after = or semicolon style per config)
git restore --staged scripts/_prettier_hook_probe.ts
rm -f scripts/_prettier_hook_probe.ts
```

Expected: `lint-staged` exits 0 and rewrites the probe before cleanup.

- [ ] **Step 5: Sharpen Formatting section in `app/CLAUDE.md`**

Replace the entire `## Formatting` section with:

```markdown
## Formatting

- Prettier + `prettier-plugin-astro` (`singleAttributePerLine: true`).
- `npm run format` (write) · `npm run format:check` (CI Format gate — not part of `validate:app`).
- Format on save via `app/.vscode/settings.json`.
- **pre-commit:** husky + lint-staged run Prettier `--write` on staged files (`cd app && npx lint-staged`). Hooks install via `npm install` (`prepare` → repo-root `.husky/`).
- **Before every PR create or update (mandatory):** run `cd app && npm run format`, commit any formatting diffs, and confirm `npm run format:check` is clean. Applies to all app work — not only multi-task plan completion. Skipping this fails the CI Format gate. (2026-07-24)
```

Copy the same bytes into `app/AGENT.md` (mirrors must stay identical — verify with `bash scripts/check-agent-mirrors.sh`).

- [ ] **Step 6: Add format gate to finishing-a-development-branch skill**

In `.claude/skills/finishing-a-development-branch/SKILL.md`, immediately before the **Option 2: Push and Create PR** subsection (or at the start of that option’s steps), insert the following prose + commands (not nested fences — plain markdown):

**Format gate (mandatory before Push and Create PR):**

Run from `app/`:

1. `npm run format`
2. `npm run format:check`

If `format` produced diffs, commit them before pushing. Do not open or update a PR while `format:check` is red.
- [ ] **Step 7: Verify agent mirrors**

```bash
bash scripts/check-agent-mirrors.sh
# expect exit 0
```

- [ ] **Step 8: Commit**

```bash
git add app/package.json app/package-lock.json .husky/pre-commit app/CLAUDE.md app/AGENT.md .claude/skills/finishing-a-development-branch/SKILL.md
git commit -m "$(cat <<'EOF'
chore: enforce Prettier via husky and pre-PR agent gates

Stop format:check PR failures with local hooks plus mandatory format before PR.
EOF
)"
```

---

### Task 7: README + decision ledger

**Files:**
- Modify: `app/README.md` (Production Deployment section + Quick Start hook note)
- Modify: `DECISIONS.md` (add D135 + D136; bump `updated` date in HTML comment to `2026-07-24`)

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

**Formatting**

- Local: husky pre-commit runs Prettier on staged files after `npm install` in `app/`.
- Before PR: `npm run format` then `npm run format:check` (agents: mandatory).
- CI: `format:check` only — does not auto-write.

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

- [ ] **Step 2: Add a Quick Start note after `npm install`**

Immediately after the Quick Start step that runs `npm install`, add:

```markdown
Hooks: `npm install` runs `prepare`, which installs repo-root husky hooks (Prettier on commit).
```

- [ ] **Step 3: Add D135 and D136 to `DECISIONS.md`**

Append near D133/D134:

```markdown
| D135 | 2026-07-24 | Production app deploy is CI-only: reusable `quality.yml` (structure + format/`astro check`/fallow/`npm test`) on PRs and again on `main`, then `deploy.yml` builds and `wrangler deploy`s after GitHub Environment `production` approval; local `deploy.sh` / stale `wrangler.toml` retired; Neon migrate stays out of deploy | Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts |
| D136 | 2026-07-24 | Prettier enforced locally via husky + lint-staged pre-commit (`app/` prepare → repo-root `.husky/`) and mandatory agent/pre-PR `npm run format` + clean `format:check`; CI remains fail-only `format:check` with no Actions auto-format | PRs were failing solely on format drift; catch at commit and before PR instead of only in CI |
```

Also set the file header comment `updated:` to `2026-07-24`.

- [ ] **Step 4: Verify README has no dead links**

```bash
grep -n 'DEPLOYMENT.md\|deploy.sh\|npm run deploy' app/README.md || echo "clean"
test ! -f app/DEPLOYMENT.md
```

- [ ] **Step 5: Run context checkers**

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

- [ ] **Step 6: Commit**

```bash
git add app/README.md DECISIONS.md
git commit -m "$(cat <<'EOF'
docs: document CI deploy, format hooks, and D135/D136

README matches Actions + Environment approval + Prettier gates.
EOF
)"
```

---

### Task 8: Final verification + operator handoff note

**Files:** none (verify only)

- [ ] **Step 1: Workflow + hook inventory**

```bash
ls -1 .github/workflows/
# expect: checks.yml deploy.yml quality.yml (and any pre-existing unrelated workflows)

test -f .husky/pre-commit && grep -n 'lint-staged' .husky/pre-commit
grep -n 'prepare\|lint-staged\|husky' app/package.json

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
| Secrets documented | Task 7 |
| Delete `deploy.sh` / `wrangler.toml` | Task 5 (+ prereq script) |
| README Production rewrite | Task 7 |
| Operator Environment / branch protection | Task 7 + Task 8 |
| No Neon migrate in v1 | Tasks 2–4 (absent by design) |
| No local `npm run deploy` | Tasks 5–7 |
| Canonical `wrangler.jsonc` | Task 5 |
| husky + lint-staged pre-commit | Task 6 |
| Agent / finishing-a-branch format gate | Task 6 |
| CI format fail-only (no auto-write) | Tasks 2 + 6–7 |

## Placeholder / consistency check

- No TBD/TODO left in tasks.
- Wrangler invoke is always `npx wrangler deploy` (no `--env`).
- Status check names documented as `quality / structure` and `quality / app` (caller job id `quality` + reusable job ids).
- D135 = CI deploy; D136 = format enforcement.

