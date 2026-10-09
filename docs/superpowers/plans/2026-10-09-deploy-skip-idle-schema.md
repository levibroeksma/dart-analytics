# Deploy Skips Idle Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `deploy.yml` cuts a Neon rehearsal branch and runs the production migration runner only when production has something to apply; app-only merges go `quality → pending → deploy`.

**Architecture:** One new job `pending` (after `quality`, `environment: production`) asks production via `dbmate status --exit-code` and diffs `database/migrations`, `database/seeds`, `app/scripts/seed.ts` from the last successful `deploy` run's `headSha`; it outputs `apply`. `rehearse` and `migrate` gain `if: success() && apply == 'true'`; `deploy` gains an explicit `if` that admits "nothing pending" or "migrate succeeded" and nothing else. Docs, File Inventory and decision D434 follow.

**Tech Stack:** GitHub Actions (`push` event, job outputs, reusable workflow), dbmate 2.33 via `npx`, `gh run list` with the runner token, bash. Local checks use `yaml` from `app/node_modules` and `bash -n`.

**Spec:** `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md`

## Global Constraints

- Code change is `.github/workflows/deploy.yml` only. No `app/package.json` script is added (an edit there re-triggers `db-rehearsal`, `integration`, `schema`).
- `on.push.paths`, `concurrency: deploy-production`, `cancel-in-progress: false`, `db-rehearsal.yml`, `migrate`'s step list and `deploy`'s steps stay as they are.
- Every detector failure (no prior successful run, zero `before`, `forced`, unfetchable base, diff error) yields `apply=true`. A connection error fails `pending` closed: `npm run --silent db:status:ci` runs first and fails the job; only then does `--exit-code` give the verdict.
- `rehearse`/`migrate`: `if: success() && needs.pending.outputs.apply == 'true'` — `success()` written out.
- `deploy`: `needs: [pending, migrate]`, `if: !cancelled() && needs.pending.result == 'success' && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success')`.
- **This session is local only: never run `gh`, `git push`, `git fetch` or anything that reaches GitHub.** The owner is signed into another account for another project. `gh run list` appears only inside the workflow text, where the runner's token executes it.
- Decision id: `bash scripts/next-decision-id.sh` prints `D434` on 2026-10-09 against the stale local `origin/main`. Re-run it when the remote is reachable, before any PR; `bash scripts/renumber-decision.sh D434 <new>` if it moved.
- Decisions are append-only (`decisions/context-system.md`, CI domain). `docs/superpowers/**` gets status notes only.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never `--no-verify`.
- Branch: `ci/deploy-skip-idle-schema` (already created from the Handoff 1 head; rebase onto `origin/main` before any PR, once git is free).

## Review Focus

Behaviour of a GitHub Actions job graph cannot be executed locally. The checks below pin what can be pinned: YAML shape, expression text, and the detector's bash under stubbed inputs. Each line has its check in Task 1.

1. **`rehearse` fails → `deploy` must not run.** A `migrate` skipped by a failed `rehearse` is `result == 'skipped'`, not `'success'`, and `apply` is `'true'`, so `deploy`'s `if` is false. Pinned by the expression assertion in Task 1 Step 3 (the `if` must name `needs.migrate.result == 'success'` and `needs.pending.outputs.apply == 'false'`, nothing looser).
2. **Earlier `migrate` failed in seeding; app-only merge now → seeds must land.** The diff base is the last *successful* run, so the seed files are in range. Pinned by the stubbed dry-run in Task 1 Step 5 (base three commits back, a seed file changed in between → `schema=1`).
3. **Production unreachable → no Neon branch, no deploy.** `db:status:ci` fails the step before `--exit-code` runs. Pinned by the step-order assertion in Task 1 Step 3 and the dry-run with a dead `DATABASE_URL` in Step 5.
4. **First push / forced push → apply.** Pinned by the dry-run with `BEFORE` all zeros and with `FORCED=true` in Step 5.
5. **`gh run list` returns nothing (no successful run yet) and `before` is unfetchable → apply.** Pinned by the dry-run with a stub `gh` printing nothing and a bogus `BEFORE` in Step 5.

---

### Task 1: `pending` job and the gated job graph in `deploy.yml`

**Files:**
- Modify: `.github/workflows/deploy.yml` (whole `jobs:` block)
- Verify: scratch scripts under the session scratchpad (not committed)

**Interfaces:**
- Consumes: `secrets.DATABASE_URL` (production environment), `github.token` (`actions: read`), `./.github/workflows/db-rehearsal.yml` (`workflow_call`).
- Produces: job `pending` with output `apply` (`'true'` | `'false'`); step ids `status` (output `migrations` = `0`|`1`), `diff` (output `schema` = `0`|`1`), `decide` (output `apply`). Step env names `BEFORE`, `FORCED`, `MIGRATIONS`, `SCHEMA` — Task 4's docs name the job and the reason line text `pending migrations` / `schema files changed` / `nothing to apply`.

- [ ] **Step 1: Write the shape assertion (fails on the current file)**

Save as `$SCRATCH/assert-deploy-graph.mjs` (replace `$SCRATCH` with the session scratchpad path):

```js
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/levi.broeksma/Dev/dart-analytics/app/package.json');
const YAML = require('yaml');

const doc = YAML.parse(fs.readFileSync('/Users/levi.broeksma/Dev/dart-analytics/.github/workflows/deploy.yml', 'utf8'));
const jobs = doc.jobs;
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: got ${JSON.stringify(a)}`); };

eq(Object.keys(jobs), ['quality', 'pending', 'rehearse', 'migrate', 'deploy'], 'job order');

// pending
eq(jobs.pending.needs, 'quality', 'pending.needs');
eq(jobs.pending.environment, 'production', 'pending.environment');
eq(jobs.pending.permissions, { contents: 'read', actions: 'read' }, 'pending.permissions');
eq(jobs.pending.outputs, { apply: '${{ steps.decide.outputs.apply }}' }, 'pending.outputs');
eq(jobs.pending.env, { DATABASE_URL: '${{ secrets.DATABASE_URL }}', GH_TOKEN: '${{ github.token }}' }, 'pending.env');
const names = jobs.pending.steps.map((s) => s.name ?? s.uses);
eq(names, [
  'actions/checkout@v4',
  'actions/setup-node@v4',
  'Install',
  'Require the production connection string',
  'Pending migrations',
  'Schema files changed since the last successful deploy',
  'Decide',
], 'pending step order');
const status = jobs.pending.steps.find((s) => s.id === 'status');
if (!status) fail('no step id=status');
else {
  const i1 = status.run.indexOf('db:status:ci');
  const i2 = status.run.indexOf('status --exit-code');
  if (!(i1 > -1 && i2 > i1)) fail('status: db:status:ci must run before --exit-code');
}
const diff = jobs.pending.steps.find((s) => s.id === 'diff');
if (!diff) fail('no step id=diff');
else {
  eq(diff.env, { BEFORE: '${{ github.event.before }}', FORCED: '${{ github.event.forced }}' }, 'diff.env');
  for (const p of ['../database/migrations', '../database/seeds', 'scripts/seed.ts', 'gh run list', '--status success', 'headSha']) {
    if (!diff.run.includes(p)) fail(`diff.run lacks ${p}`);
  }
}
const decide = jobs.pending.steps.find((s) => s.id === 'decide');
if (!decide) fail('no step id=decide');
else eq(decide.env, { MIGRATIONS: '${{ steps.status.outputs.migrations }}', SCHEMA: '${{ steps.diff.outputs.schema }}' }, 'decide.env');

// gated jobs
eq(jobs.rehearse.needs, 'pending', 'rehearse.needs');
eq(jobs.rehearse.if, "success() && needs.pending.outputs.apply == 'true'", 'rehearse.if');
eq(jobs.rehearse.uses, './.github/workflows/db-rehearsal.yml', 'rehearse.uses');
eq(jobs.migrate.needs, ['pending', 'rehearse'], 'migrate.needs');
eq(jobs.migrate.if, "success() && needs.pending.outputs.apply == 'true'", 'migrate.if');
eq(jobs.deploy.needs, ['pending', 'migrate'], 'deploy.needs');
eq(
  jobs.deploy.if.replace(/\s+/g, ' ').trim(),
  "${{ !cancelled() && needs.pending.result == 'success' && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success') }}",
  'deploy.if',
);

// unchanged surfaces
eq(doc.on.push.paths, ['app/**', 'database/**', '.github/workflows/deploy.yml', '.github/workflows/quality.yml', '.github/workflows/db-rehearsal.yml'], 'paths');
eq(doc.concurrency, { group: 'deploy-production', 'cancel-in-progress': false }, 'concurrency');
eq(jobs.migrate.steps.map((s) => s.name ?? s.uses).slice(-5), [
  'Pending migrations',
  'Apply migrations (first pass, may stop early)',
  'Apply seeds',
  'Apply migrations (authoritative pass)',
  'Confirm nothing is left pending',
], 'migrate steps unchanged');

if (process.exitCode) process.exit(1);
console.log('OK: deploy.yml job graph matches the spec');
```

- [ ] **Step 2: Run it; expect failure on the current file**

```bash
node "$SCRATCH/assert-deploy-graph.mjs"
```

Expected: `FAIL: job order: got ["quality","rehearse","migrate","deploy"]` and more; exit 1.

- [ ] **Step 3: Replace the `jobs:` block of `.github/workflows/deploy.yml`**

Keep lines 1–14 (`name`, `on`, `concurrency`) untouched. Replace everything from `jobs:` to the end with:

```yaml
jobs:
  quality:
    uses: ./.github/workflows/quality.yml

  # Asks production whether there is anything to apply before a Neon branch is
  # cut or the migration runner starts (D434). Two signals, either one applies:
  # dbmate's own pending flag, and a diff of migrations, seeds and the seed
  # runner since the last deploy run that succeeded -- dbmate cannot see seeds,
  # and a deploy that failed in seeding must not be forgotten by the next
  # app-only merge (#293). Every failure of the detector falls toward applying;
  # an unreachable production fails this job and nothing deploys.
  pending:
    needs: quality
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      actions: read
    outputs:
      apply: ${{ steps.decide.outputs.apply }}
    defaults:
      run:
        working-directory: app
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Require the production connection string
        run: |
          if [ -z "$DATABASE_URL" ]; then
            echo "::error::DATABASE_URL is not set on the production environment. Add it as a secret (see docs/architecture/05-Database/11-Neon-Integration.md)."
            exit 1
          fi
      # The first call is the plain status: it fails the job on any connection
      # or auth error, so a blip never cuts a Neon branch. The second call runs
      # only after the first proved the connection; `--exit-code` is dbmate's
      # documented "1 if pending" contract, so nothing parses output.
      - name: Pending migrations
        id: status
        run: |
          {
            echo "### Pending on production"
            echo '```'
            npm run --silent db:status:ci
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"
          if npx dbmate --no-dump-schema --migrations-dir ../database/migrations status --exit-code >/dev/null; then
            echo "migrations=0" >> "$GITHUB_OUTPUT"
          else
            echo "migrations=1" >> "$GITHUB_OUTPUT"
          fi
      # Base = headSha of the last successful deploy run on main (the current
      # run is in progress, so it is never its own base). Falls back to the
      # push base, then to applying.
      - name: Schema files changed since the last successful deploy
        id: diff
        env:
          BEFORE: ${{ github.event.before }}
          FORCED: ${{ github.event.forced }}
        run: |
          set -u
          base=$(gh run list --workflow deploy.yml --branch main --status success --limit 1 --json headSha --jq '.[0].headSha' 2>/dev/null || true)
          if [ -z "$base" ]; then
            base="$BEFORE"
            echo "::notice::no successful deploy run found; diffing from the push base $base"
          fi
          if [ "$base" = "0000000000000000000000000000000000000000" ] || [ "$FORCED" = "true" ]; then
            echo "schema=1" >> "$GITHUB_OUTPUT"; exit 0
          fi
          if git fetch --depth=1 origin "$base" \
             && changed=$(git diff --name-only "$base" "$GITHUB_SHA" -- ../database/migrations ../database/seeds scripts/seed.ts); then
            if [ -n "$changed" ]; then
              printf 'Schema files changed since %s:\n%s\n' "$base" "$changed"
              echo "schema=1" >> "$GITHUB_OUTPUT"
            else
              echo "schema=0" >> "$GITHUB_OUTPUT"
            fi
          else
            echo "::warning::could not diff $base..$GITHUB_SHA; applying"
            echo "schema=1" >> "$GITHUB_OUTPUT"
          fi
      - name: Decide
        id: decide
        env:
          MIGRATIONS: ${{ steps.status.outputs.migrations }}
          SCHEMA: ${{ steps.diff.outputs.schema }}
        run: |
          if [ "$MIGRATIONS" = "1" ]; then
            reason="pending migrations"
          elif [ "$SCHEMA" = "1" ]; then
            reason="schema files changed"
          else
            reason="nothing to apply"
          fi
          if [ "$reason" = "nothing to apply" ]; then
            echo "apply=false" >> "$GITHUB_OUTPUT"
          else
            echo "apply=true" >> "$GITHUB_OUTPUT"
          fi
          echo "**Schema gate:** $reason" >> "$GITHUB_STEP_SUMMARY"
          echo "$reason"

  # The schema change is rehearsed on a throwaway Neon branch cut from
  # production before anything touches production itself (#354). A failure
  # here blocks both the apply and the Worker deploy. Skipped when `pending`
  # found nothing to apply (D434). `success()` is written out: a failed
  # `quality` or `pending` must never reach a Neon branch.
  rehearse:
    needs: pending
    if: success() && needs.pending.outputs.apply == 'true'
    uses: ./.github/workflows/db-rehearsal.yml
    secrets: inherit

  # Applies the pending chain to production BEFORE the Worker ships, so the
  # Worker never runs ahead of its schema (#293). Every seed is
  # `ON CONFLICT DO NOTHING` and the runner applies them in two passes by
  # design, so re-running them is a no-op once they are in. Runs only when
  # `pending` found something (D434).
  migrate:
    needs: [pending, rehearse]
    if: success() && needs.pending.outputs.apply == 'true'
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: app
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Require the production connection string
        run: |
          if [ -z "$DATABASE_URL" ]; then
            echo "::error::DATABASE_URL is not set on the production environment. Add it as a secret (see docs/architecture/05-Database/11-Neon-Integration.md)."
            exit 1
          fi
      - name: Pending migrations
        run: |
          {
            echo "### Applying to production"
            echo '```'
            npm run --silent db:status:ci
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"
      # Migrate -> seed -> migrate, as app/DEPLOYMENT.md §1.3 tells a human to
      # (#378): a migration like 0020 cannot apply until a seed has run. The
      # first pass may stop early; the second is authoritative and fails the job.
      - name: Apply migrations (first pass, may stop early)
        run: npm run db:migrate:ci || echo "::warning::first migrate pass stopped; seeding, then retrying"
      - name: Apply seeds
        run: npm run db:seed:ci
      - name: Apply migrations (authoritative pass)
        run: npm run db:migrate:ci
      - name: Confirm nothing is left pending
        run: npm run db:status:ci

  # Two ways in, named explicitly: nothing was pending, or `migrate` succeeded.
  # A `migrate` skipped because `rehearse` failed is neither, so it cannot
  # pass as "skipped, so fine" (D434).
  deploy:
    needs: [pending, migrate]
    if: >-
      ${{ !cancelled()
          && needs.pending.result == 'success'
          && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success') }}
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
        env:
          PUBLIC_NEON_AUTH_BASE_URL: ${{ vars.PUBLIC_NEON_AUTH_BASE_URL }}
      - name: Deploy Worker
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 4: Run the shape assertion; expect pass**

```bash
node "$SCRATCH/assert-deploy-graph.mjs"
```

Expected: `OK: deploy.yml job graph matches the spec`.

- [ ] **Step 5: Dry-run the detector's bash with stubbed inputs**

Extract the three `run:` scripts and run them with `gh`, `git fetch` and `GITHUB_*` stubbed. Save as `$SCRATCH/dryrun-pending.sh`:

```bash
#!/usr/bin/env bash
# Runs the `status`, `diff` and `decide` step scripts from deploy.yml against
# this repo with gh/git-fetch stubbed. Never contacts GitHub. Steps run under
# `bash -eo pipefail`, as GitHub's default shell does.
set -euo pipefail
REPO=/Users/levi.broeksma/Dev/dart-analytics
SCRATCH="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO/app"

node -e '
  const fs=require("fs"), Y=require("yaml");
  const d=Y.parse(fs.readFileSync("../.github/workflows/deploy.yml","utf8"));
  for (const id of ["status","diff","decide"]) {
    const s=d.jobs.pending.steps.find(x=>x.id===id);
    fs.writeFileSync(process.argv[1]+"/step-"+id+".sh", s.run);
  }' "$SCRATCH"

for id in status diff decide; do bash -n "$SCRATCH/step-$id.sh"; done
echo "OK: step scripts parse"

# gh stub: prints $GH_BASE (may be empty). git stub: fetch is a no-op success.
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf '%s' "${GH_BASE:-}"
EOF
cat > "$SCRATCH/bin/git" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "fetch" ]; then exit "${GIT_FETCH_EXIT:-0}"; fi
exec /usr/bin/git "$@"
EOF
chmod +x "$SCRATCH/bin/gh" "$SCRATCH/bin/git"
export PATH="$SCRATCH/bin:$PATH"

run_diff() { # name BEFORE FORCED GH_BASE GIT_FETCH_EXIT expected
  local out; out=$(mktemp)
  GITHUB_OUTPUT="$out" GITHUB_SHA="$(git rev-parse HEAD)" BEFORE="$2" FORCED="$3" GH_BASE="$4" GIT_FETCH_EXIT="$5" \
    bash -eo pipefail "$SCRATCH/step-diff.sh" >/dev/null 2>&1 || { echo "FAIL $1: step exited non-zero"; exit 1; }
  if ! grep -qx "schema=$6" "$out"; then echo "FAIL $1: expected schema=$6, got: $(cat "$out")"; exit 1; fi
  echo "OK $1 -> schema=$6"
}

HEAD=$(git rev-parse HEAD)
# A commit that touched a seed or migration, found from history.
SCHEMA_TOUCH=$(git log --format=%H -1 -- ../database/seeds ../database/migrations)
CLEAN_PARENT=$(git rev-parse "$SCHEMA_TOUCH^")

run_diff "zero before"              0000000000000000000000000000000000000000 false ""             0 1
run_diff "forced push"              "$HEAD"                                   true  ""             0 1
run_diff "no prior success, before=HEAD" "$HEAD"                              false ""             0 0
run_diff "base before a seed change" "$HEAD"                                  false "$CLEAN_PARENT" 0 1
run_diff "base = HEAD, nothing changed" "$HEAD"                               false "$HEAD"        0 0
run_diff "unfetchable base"         deadbeefdeadbeefdeadbeefdeadbeefdeadbeef false ""             1 1

run_decide() { # name MIGRATIONS SCHEMA expected
  local out; out=$(mktemp); local sum; sum=$(mktemp)
  GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY="$sum" MIGRATIONS="$2" SCHEMA="$3" bash -eo pipefail "$SCRATCH/step-decide.sh" >/dev/null
  grep -qx "apply=$4" "$out" || { echo "FAIL $1: expected apply=$4, got: $(cat "$out")"; exit 1; }
  echo "OK $1 -> apply=$4 ($(cat "$sum"))"
}
run_decide "migrations pending"  1 0 true
run_decide "seeds changed"       0 1 true
run_decide "both"                1 1 true
run_decide "nothing"             0 0 false

# Status step with a dead DATABASE_URL must exit non-zero before --exit-code runs.
out=$(mktemp); sum=$(mktemp)
if DATABASE_URL='postgres://nobody:nothing@127.0.0.1:1/none?sslmode=disable' GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY="$sum" \
   bash -eo pipefail "$SCRATCH/step-status.sh" >/dev/null 2>&1; then
  echo "FAIL status: dead DATABASE_URL did not fail the step"; exit 1
fi
if [ -s "$out" ]; then echo "FAIL status: wrote an output on connection error: $(cat "$out")"; exit 1; fi
echo "OK status: connection error fails closed, no verdict written"
```

Run:

```bash
bash "$SCRATCH/dryrun-pending.sh"
```

Expected: every line `OK …`; exit 0. The `base before a seed change` case uses the parent of the most recent commit that touched a seed or migration, so the diff from it must list that file → `schema=1`.

- [ ] **Step 6: Run the status step against a local Postgres (optional, if Docker is running)**

```bash
docker run -d --rm --name itest-pg -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=integration -p 5433:5432 postgres:16
sleep 5
cd /Users/levi.broeksma/Dev/dart-analytics/app
export DATABASE_URL='postgres://postgres:ci@localhost:5433/integration?sslmode=disable'
out=$(mktemp); GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY=/dev/null bash -eo pipefail "$SCRATCH/step-status.sh"; cat "$out"   # migrations=1 (empty db)
npm run db:migrate:ci || true; npm run db:seed:ci; npm run db:migrate:ci
out=$(mktemp); GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY=/dev/null bash -eo pipefail "$SCRATCH/step-status.sh"; cat "$out"   # migrations=0
docker stop itest-pg
```

Expected: `migrations=1` on the empty database, `migrations=0` after the chain applied. Port 5433 because 5432 is held by another container on this machine.

- [ ] **Step 7: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
git add .github/workflows/deploy.yml
git commit -m "ci(deploy): rehearse and migrate only when production has something to apply

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Decision D434

**Files:**
- Modify: `decisions/context-system.md` (append after D433, the last block)

**Interfaces:**
- Consumes: the job/step names from Task 1 (`pending`, `status`, `diff`, `decide`; reason lines `pending migrations` / `schema files changed` / `nothing to apply`).
- Produces: `D434`, cited by Task 1's comments and Task 3's docs.

- [ ] **Step 1: Confirm the id**

```bash
bash scripts/next-decision-id.sh
```

Expected: `D434`. (Derived against the stale local `origin/main`; re-run before the PR.)

- [ ] **Step 2: Append the block**

Append to the end of `decisions/context-system.md`, after D433's `Supersedes: none` line and one blank line:

```markdown
### D434 — `deploy.yml` rehearses and migrates only when production has something to apply
Status: Accepted · Date: 2026-10-09
Decision: `deploy.yml` gains a `pending` job between `quality` and `rehearse` (`environment: production`, `permissions: contents: read, actions: read`). It runs `db:status:ci` (fails closed on any connection error), then `npx dbmate … status --exit-code` for the verdict, then diffs `database/migrations/**`, `database/seeds/**` and `app/scripts/seed.ts` from the `headSha` of the last successful `deploy` run on `main` (`gh run list`, runner token), falling back to `github.event.before`. `apply=true` when dbmate reports pending, the diff is non-empty, `before` is all zeros, the push was forced, no successful run exists and the base is unfetchable, or the diff fails. `rehearse` and `migrate` carry `if: success() && needs.pending.outputs.apply == 'true'`; `deploy` carries `needs: [pending, migrate]` and `if: !cancelled() && needs.pending.result == 'success' && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success')`. The `paths` filter (D392), the `deploy-production` concurrency group, `db-rehearsal.yml` and `migrate`'s steps are unchanged. Spec: `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md`.
Reason: the handoff of 2026-10-09 counted 97 `deploy` runs in the billing period, each cutting a Neon branch from production (a second compute endpoint plus a schema replay) and running the production migration runner, for merges that mostly touched no schema. D433 removed the heavy read from each rehearsal; this removes the rehearsal and the apply when they would apply nothing. The gate asks production rather than diffing alone because a `migrate` that failed on an earlier deploy leaves migrations pending and the next app-only merge must still land them before its Worker ships (#293, D288). The diff exists because dbmate cannot see seeds and `migrate` no longer re-applies them on every deploy; its base is the last successful run, not the last push, so a deploy that failed in seeding is not forgotten by the next merge. The status read is kept although the diff already covers #293: it is the only check that sees a schema change made outside this pipeline (a point-in-time restore, a manual `dbmate down`), and a catalog read costs one compute wake and kilobytes of transfer.
Consequences: an app-only merge touches Neon once (the status read in `pending`); a migration or seed merge runs the full chain as before. `deploy` now has two named ways in; a `migrate` skipped by a failed `rehearse` cannot pass as "skipped". Seeds are no longer re-applied on every deploy, so `app/DEPLOYMENT.md`'s "cheap insurance" note is reworded. `pending` adds one `npm ci` and one production connection per deploy. A `production` environment reviewer rule, if one is ever added, would prompt on `pending` as well as `migrate` and `deploy`. Left for separate decisions: `db-rehearsal.yml` still cuts a Neon branch on every PR push touching `app/package.json`; a migration merge still rehearses twice (PR time and merge time); dropping the status read if compute ever binds.
Supersedes: none
```

- [ ] **Step 3: Run the decision gates**

```bash
bash scripts/check-decision-ids.sh
bash scripts/check-doc-links.sh
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add decisions/context-system.md
git commit -m "docs(decisions): D434 deploy gate on pending schema

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Docs, File Inventory, history date

**Files:**
- Modify: `app/DEPLOYMENT.md:4`, `:83`, `:99`, `:178`
- Modify: `docs/architecture/05-Database/11-Neon-Integration.md:170-176`, `:184-187`
- Modify: `docs/architecture/00-File-Inventory.md` (new row after the `.github/workflows/integration.yml` row, line 615)
- Modify: `docs/architecture/00-Context-Map-History.md:5` (already `updated: 2026-10-09`; leave if so)

**Interfaces:**
- Consumes: D434 (Task 2), job name `pending` and reason lines (Task 1).

- [ ] **Step 1: `app/DEPLOYMENT.md` line 4 (Status line)**

Replace the sentence fragment

```
on push to `main` — schema rehearsal, production migrations + seeds, then the Worker (D288).
```

with

```
on push to `main` — a pending check against production, then schema rehearsal and production migrations + seeds only when it found something to apply, then the Worker (D288, D434).
```

- [ ] **Step 2: `app/DEPLOYMENT.md` line 83**

Replace

```
every merge to `main` applies the pending chain to production itself: `deploy.yml` runs `quality → rehearse → migrate → deploy`, where `rehearse` replays migrations + seeds + `db:verify` on a throwaway Neon branch cut from production, and `migrate` then applies them to production before the Worker ships.
```

with

```
every merge to `main` with something pending applies the chain to production itself: `deploy.yml` runs `quality → pending → rehearse → migrate → deploy`, where `pending` asks production (`dbmate status --exit-code`) and diffs migrations, seeds and the seed runner from the last successful deploy, `rehearse` replays migrations + seeds on a throwaway Neon branch cut from production, and `migrate` then applies them to production before the Worker ships. When `pending` finds nothing, `rehearse` and `migrate` are skipped and `deploy` runs straight after `quality` (D434, 2026-10-09).
```

- [ ] **Step 3: `app/DEPLOYMENT.md` line 99**

Replace

```
— which is also why the `migrate` job runs them on every deploy.
```

with

```
— which is also why the `migrate` job runs them whenever `pending` finds a migration pending or a seed changed since the last successful deploy (D434).
```

- [ ] **Step 4: `app/DEPLOYMENT.md` line 178**

Replace

```
which runs quality checks, rehearses the schema change on a throwaway Neon branch, applies migrations and seeds to production, then builds and deploys via `wrangler deploy`
```

with

```
which runs quality checks, asks production whether anything is pending, and only then rehearses the schema change on a throwaway Neon branch and applies migrations and seeds to production (an app-only merge skips both, D434), then builds and deploys via `wrangler deploy`
```

- [ ] **Step 5: `11-Neon-Integration.md` lines 170–176**

Replace the paragraph and table with:

```markdown
Merging to `main` applies the pending chain to production before the Worker ships — when there is one. `.github/workflows/deploy.yml` runs `quality` -> `pending` -> `rehearse` -> `migrate` -> `deploy`, inside the existing `deploy-production` concurrency group, so two merges cannot race the same migration and the Worker never runs ahead of its schema (D288, issue #293). `pending` decides whether the two schema jobs run at all; an app-only merge skips them and touches Neon exactly once (D434). <!-- 2026-09-17; gate 2026-10-09 -->

| Job | What it does | Against |
| --- | --- | --- |
| `pending` | `db:status:ci` (into the run summary; fails closed on a connection error) -> `dbmate status --exit-code` -> diff of `database/migrations/**`, `database/seeds/**`, `app/scripts/seed.ts` from the last successful `deploy` run's `headSha` (`gh run list`, runner token) -> `apply=true|false` with the reason in the summary (`pending migrations` / `schema files changed` / `nothing to apply`) | Production (one catalog read) |
| `rehearse` (`db-rehearsal.yml`) | Only when `apply=true`: creates a throwaway Neon branch from `main`, applies migrations + seeds, confirms nothing is left pending, deletes the branch in an `always()` step | Ephemeral child of production |
| `migrate` | Only when `apply=true`: `db:status:ci` (into the run summary) -> `db:migrate:ci` -> `db:seed:ci` -> `db:status:ci` again | Production |
| `deploy` | Build + `wrangler deploy`, after `migrate` succeeds or when `pending` found nothing to apply — never after a failed `rehearse` or `migrate` | Production |
```

- [ ] **Step 6: `11-Neon-Integration.md` secrets table (line ~186)**

Replace

```
| `DATABASE_URL` | `production` environment | `migrate` — the production pooled connection string |
```

with

```
| `DATABASE_URL` | `production` environment | `pending` and `migrate` — the production pooled connection string |
```

- [ ] **Step 7: File Inventory row**

Insert after the `.github/workflows/integration.yml` row (line 615 of `docs/architecture/00-File-Inventory.md`):

```markdown
| `.github/workflows/deploy.yml` | Push-to-`main` deploy: `quality` -> `pending` (asks production via `dbmate status --exit-code`, diffs migrations/seeds/seed runner from the last successful deploy run; fails closed on a connection error) -> `rehearse` + `migrate` only when something is pending -> `deploy` (explicit `if`: nothing pending, or `migrate` succeeded); path-filtered (D392), `deploy-production` concurrency (D288, D392, D434; gate 2026-10-09) | canonical |
```

- [ ] **Step 8: History date**

`docs/architecture/00-Context-Map-History.md` line 5 must read `updated: 2026-10-09`. It already does from Handoff 1; change nothing if so.

- [ ] **Step 9: Format and link gates**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npx --prefix app prettier --check app/DEPLOYMENT.md
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

Expected: Prettier `All matched files use Prettier code style!`; both scripts pass. If Prettier rewraps, run `npx --prefix app prettier --write app/DEPLOYMENT.md` and re-check.

- [ ] **Step 10: Commit**

```bash
git add app/DEPLOYMENT.md docs/architecture/05-Database/11-Neon-Integration.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md
git commit -m "docs(deploy): pending gate in DEPLOYMENT, Neon guide and inventory

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Gates, context maintenance, spec status note, review

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md` (status note at top, only if the build deviated)
- Run: `run-all-gates` and `context-maintenance` skills

- [ ] **Step 1: Run all gates**

Invoke the `run-all-gates` skill. The change set touches `app/` (`DEPLOYMENT.md`) and `docs/`, so the "always run" list applies; the `app/` list applies too (`validate:app` needs `DATABASE_URL` — with no Neon `dev` reachable or wanted, point it at the local `postgres:16` from Task 1 Step 6, or report the step as skipped and why). Report each script's result.

- [ ] **Step 2: Context maintenance**

Invoke the `context-maintenance` skill. Expected outcome: D434 registered, inventory row present, dates ISO, no stale "every deploy" claim left (`grep -rn 'every deploy' app/DEPLOYMENT.md docs/architecture` returns nothing about seeds).

- [ ] **Step 3: Spec status note (only if the build deviated from the spec)**

If any step changed a spec detail, add under the header blockquote a `## Status note (2026-10-09, post-implementation)` section listing each deviation in one line, as the Handoff 1 spec does. Never rewrite sections.

- [ ] **Step 4: Whole-branch review**

Dispatch a reviewer per `superpowers:requesting-code-review` with `BASE_SHA=$(git rev-parse 9c54c2a1)` (the spec commit) and `HEAD_SHA=$(git rev-parse HEAD)`, requirements = the spec. Fix Important findings; file Minor ones as discovered work **later, when `gh` is free** (list them in the completion report meanwhile).

- [ ] **Step 5: Completion report (local)**

State: commits on `ci/deploy-skip-idle-schema`; nothing pushed; pre-PR steps the owner runs when GitHub is free: `git fetch origin main`, rebase, `bash scripts/next-decision-id.sh` re-check, PR via `finishing-a-dart-branch`; post-merge proof the handoff asks for: one app-only merge (`rehearse`/`migrate` skipped, `nothing to apply`) and one migration or seed merge (all green, reason line shown); issues to file: PR-time rehearsal on `app/package.json`, double rehearsal per migration.
