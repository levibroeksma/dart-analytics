# Deploy skips rehearse and migrate when nothing is pending — design

> **Date:** 2026-10-09
> **Source:** Handoff 2 of `docs/superpowers/handoffs/2026-10-09-neon-network-transfer-handoff.md`
> **Branch:** `ci/deploy-skip-idle-schema`
> **Decision id reserved:** D434 (`decisions/context-system.md`, CI domain)

## Status note (2026-10-09, post-implementation)

- Built on `ci/deploy-pending-gate` (fresh from `main`), not `ci/deploy-skip-idle-schema`.
- §1 step 4: a failing `gh run list` now applies (`schema=1`) instead of falling back to `github.event.before`; only an empty result falls back. `--jq` gained `// empty`. The snippet's `2>/dev/null || true` broke this spec's own "detector errors never skip the apply" rule.
- `pending` makes two production reads (`db:status:ci`, then `status --exit-code`), not one; both land inside the same compute wake. Docs and D434 say two (D434 was corrected while still unmerged).
- Worker-only deploy failure: the next merge re-rehearses from the older base; `11-Neon-Integration.md` names "Re-run failed jobs" as the way to avoid it.

## Goal

A `deploy` run cuts a Neon rehearsal branch and runs the production migration runner only when production has something to apply. An app-only merge runs `quality → pending → deploy`. A migration or seed merge runs the full chain as today.

## Why

97 `deploy` runs this billing period each called `rehearse`, so each cut a Neon branch from production — a second compute endpoint and a schema replay — for a change that, in most runs, touched no schema. Handoff 1 (D433) removed the heavy read from each rehearsal; this removes the rehearsal itself when it rehearses nothing. The free tier's binding limit is network transfer (4.05 GB of a believed 5 GB); compute sits at 8.33 CU-h of a believed 100 CU-h. Both caps are unverified.

The gate asks production, not only the diff: a `migrate` that failed on an earlier deploy leaves migrations pending, and a later app-only merge must still apply them before its Worker ships (#293). Seeds are the exception dbmate cannot see, so the diff covers them — measured from the last deploy that succeeded, not from the last push.

## Scope

- Modify: `.github/workflows/deploy.yml` only (code).
- Docs: `app/DEPLOYMENT.md`, `docs/architecture/05-Database/11-Neon-Integration.md`, `docs/architecture/00-File-Inventory.md`, new D434.
- Out of scope: `db-rehearsal.yml`, the `paths` filter (D392), the `migrate` job's steps, skipping `deploy` on seed-only merges (D392 left that as a separate decision), PR-time rehearsal triggers (see Deferred).

## Design

### 1. `pending` job

```yaml
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
```

Steps, in order:

1. `actions/checkout@v4` (default depth 1), `actions/setup-node@v4` (node 22, npm cache on `app/package-lock.json`), `npm ci`.
2. **Require the production connection string** — same step text as `migrate`. Missing secret fails the job; `deploy` is then skipped (§3).
3. **Pending migrations** (`id: status`) — two dbmate calls, each with one job:

   ```bash
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
   ```

   The first call is the existing `db:status:ci`: it fails the step — and so the job — on any connection or auth error, exactly as `migrate` does today, so an unreachable production never cuts a Neon branch and never deploys. The second call runs only after the first proved the connection; its `--exit-code` (1 = pending) is dbmate's documented contract, so nothing parses output. No `package.json` script is added: an `app/package.json` edit would re-trigger `db-rehearsal`, `integration` and `schema` for a one-file CI change.
4. **Schema files changed since the last successful deploy** (`id: diff`) — dbmate status does not see seeds, and `migrate` no longer re-applies them on every deploy, so a seed change must be found in git. The range starts at the last `deploy` run on `main` that succeeded, so a failed deploy's seeds stay in range until a deploy lands them (the seed analogue of #293). Migrations are in the pathspec too, as a second net under `--exit-code`.

   ```bash
   set -u
   base=$(gh run list --workflow deploy.yml --branch main --status success --limit 1 --json headSha --jq '.[0].headSha' 2>/dev/null || true)
   if [ -z "$base" ]; then
     base='${{ github.event.before }}'
     echo "::notice::no successful deploy run found; diffing from the push base $base"
   fi
   if [ "$base" = "0000000000000000000000000000000000000000" ] || [ '${{ github.event.forced }}' = "true" ]; then
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
   ```

   `gh run list` excludes the current run (it is in progress). The runner's `GITHUB_TOKEN` with `actions: read` is enough; nothing here reads a personal credential. Every failure of this detector — no prior success, zero `before`, forced push, unfetchable base, diff error — falls toward applying.
5. **Decide** (`id: decide`): `apply=true` when `migrations=1` or `schema=1`, else `apply=false`. One line to the step summary naming the reason (`pending migrations`, `schema files changed`, `nothing to apply`), so the run page shows why `rehearse` ran or was skipped.

### 2. `rehearse` and `migrate`

```yaml
rehearse:
  needs: pending
  if: success() && needs.pending.outputs.apply == 'true'
  uses: ./.github/workflows/db-rehearsal.yml
  secrets: inherit

migrate:
  needs: [pending, rehearse]
  if: success() && needs.pending.outputs.apply == 'true'
  ...unchanged steps...
```

`success()` is written out. GitHub adds it implicitly to a job `if` with no status function, but the expression reads as a bare output check otherwise, and the rule here is that a failed `quality` or `pending` never reaches a Neon branch or production. `migrate` lists `pending` in `needs` so its `if` can read the output.

### 3. `deploy`

```yaml
deploy:
  needs: [pending, migrate]
  if: >-
    ${{ !cancelled()
        && needs.pending.result == 'success'
        && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success') }}
```

A skipped `needs` skips dependents by default, so the `if` is explicit about the two ways in: nothing was pending, or `migrate` succeeded. A `migrate` skipped because `rehearse` failed is neither, so it cannot pass as "skipped, so fine". `!failure()` would also work but leans on ancestor-failure semantics the reader has to know.

| Scenario | `pending.apply` | `rehearse` | `migrate` | `deploy` |
| --- | --- | --- | --- | --- |
| App-only merge, nothing pending | `false` | skipped | skipped | runs |
| Migration merge | `true` | runs | runs | runs |
| Seed-only merge | `true` | runs | runs | runs |
| Seed runner (`app/scripts/seed.ts`) change | `true` | runs | runs | runs |
| Earlier `migrate` failed in migrations; app-only merge now | `true` (status) | runs | runs | runs |
| Earlier `migrate` failed in seeds; app-only merge now | `true` (diff from last success) | runs | runs | runs |
| Production restored to an older point in time | `true` (status) | runs | runs | runs |
| `rehearse` fails | `true` | fails | skipped | skipped |
| `migrate` fails | `true` | passes | fails | skipped |
| Production unreachable | — (`pending` fails) | skipped | skipped | skipped |
| `DATABASE_URL` missing | — (`pending` fails) | skipped | skipped | skipped |
| `quality` fails | — (`pending` skipped) | skipped | skipped | skipped |
| First push / force push to `main` | `true` | runs | runs | runs |
| No successful deploy run yet, base unfetchable | `true` | runs | runs | runs |
| Re-run failed jobs after a `deploy` failure | reused output | reused | reused | re-runs |
| Run cancelled | — | — | — | skipped |

### 4. Unchanged

- `on.push.paths` (D392), `concurrency: deploy-production`, `cancel-in-progress: false`. Runs stay serial, so `gh run list` in a later run always sees the earlier run's final conclusion.
- `db-rehearsal.yml`, including its `workflow_call` entry and `app/.neon`.
- `migrate`'s step list (status → migrate → seed → migrate → status).
- `deploy`'s steps. The build has no `DATABASE_URL`, so an app-only run touches Neon exactly once: the status read in `pending`.

## Neon budget

| Path | Before | After |
| --- | --- | --- |
| App-only merge | branch create + replay + delete; production status + migrate + seed + status | production status only (one catalog read, one compute wake ≈ 0.02 CU-h if production was suspended) |
| Migration or seed merge | as above | unchanged |
| PR touching migrations/seeds/`seed.ts`/`app/package.json` | one rehearsal per push (`db-rehearsal.yml`) | unchanged — see Deferred |

The status read is kept although the diff from the last successful deploy already catches a failed `migrate`: it is the only check that sees a schema change made outside this pipeline (a point-in-time restore, a manual `dbmate down`). Removing it is a one-line change if compute ever becomes the binding cap; the diff alone then still covers #293.

## Error handling

- Detector errors never skip the apply: no prior success, zero `before`, forced push, fetch failure, diff failure all yield `apply=true`.
- Connection errors fail closed: `db:status:ci` fails `pending`, nothing is rehearsed, nothing deploys. Same behaviour as today's `migrate` on the same error.
- A missing `DATABASE_URL` fails `pending` with the same message `migrate` prints.

## Testing

- Local: `actionlint .github/workflows/deploy.yml` where available; `run-all-gates` skill.
- The job graph is observable only in Actions. Done-when for the owner, after merge: one app-only merge shows `rehearse`/`migrate` skipped and `deploy` green with `nothing to apply` in the summary; one migration or seed merge shows all four green with the reason line.

## Assumptions

- The `production` environment carries no required-reviewer rule. `pending` needs `environment: production` to read `DATABASE_URL`; a reviewer rule would add one approval prompt per deploy. Unverifiable from the repo.
- The repository's default `GITHUB_TOKEN` permissions allow `actions: read`; the job declares it explicitly so a restricted default still works.
- `github.event.before` is set on every `push` event (zero on branch creation).

## Deferred (not this spec; filed as #859 and #860 on 2026-10-09)

- `db-rehearsal.yml` cuts a Neon branch on every PR push that touches `app/package.json`, so a dependency bump rehearses. Narrowing that trigger (or keying it on the dbmate line) is its own decision.
- A migration merge rehearses twice: once at PR time, once at merge time. Accepted — production may change between the two.
- `dev` branch egress (0.11 GB) comes from local `validate:app`, not CI.

## Context maintenance

- D434 in `decisions/context-system.md`, citing D392, D288 and #293 and this spec.
- `app/DEPLOYMENT.md`: §4 line "every merge to `main` applies the pending chain" → "every merge with something pending"; chain becomes `quality → pending → (rehearse → migrate) → deploy`; §"Deploys are automatic" likewise; the seed note "which is also why the `migrate` job runs them on every deploy" → runs them whenever `pending` finds something to apply.
- `11-Neon-Integration.md` §"Merging to main": add a `pending` row to the job table; fix "Merging to `main` applies the pending chain" to say when.
- `00-File-Inventory.md`: `deploy.yml` row gains the gate.
- `docs/architecture/00-Context-Map-History.md` front-matter date.
