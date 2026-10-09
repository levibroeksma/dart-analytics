# Deploy skips rehearse and migrate when nothing is pending — design

> **Date:** 2026-10-09
> **Source:** Handoff 2 of `docs/superpowers/handoffs/2026-10-09-neon-network-transfer-handoff.md`
> **Branch:** `ci/deploy-skip-idle-schema`
> **Decision id reserved:** D434 (`decisions/context-system.md`, CI domain)

## Goal

A `deploy` run cuts a Neon rehearsal branch and runs the production migration runner only when production has something to apply. An app-only merge runs `quality → pending → deploy`. A migration or seed merge runs the full chain as today.

## Why

97 `deploy` runs this billing period each called `rehearse`, so each cut a Neon branch from production for a change that, in most runs, touched no schema. Handoff 1 (D433) removed the heavy read from each rehearsal; this removes the rehearsal itself when it rehearses nothing. The gate asks production, not the diff: a `migrate` that failed on an earlier deploy leaves migrations pending, and a later app-only merge must still apply them before its Worker ships (#293).

## Scope

- Modify: `.github/workflows/deploy.yml` only (code).
- Docs: `app/DEPLOYMENT.md` §4, `docs/architecture/05-Database/11-Neon-Integration.md` job table, `docs/architecture/00-File-Inventory.md` row for `deploy.yml`, new D434.
- Out of scope: `db-rehearsal.yml`, the `paths` filter (D392), the `migrate` job's steps, skipping `deploy` on seed-only merges (D392 left that as a separate decision).

## Design

### 1. `pending` job

```yaml
pending:
  needs: quality
  runs-on: ubuntu-latest
  environment: production
  outputs:
    apply: ${{ steps.decide.outputs.apply }}
  defaults:
    run:
      working-directory: app
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Steps, in order:

1. `actions/checkout@v4` (default depth 1), `actions/setup-node@v4` (node 22, npm cache on `app/package-lock.json`), `npm ci`.
2. **Require the production connection string** — same step text as `migrate`. Missing secret fails the job; `deploy` is then skipped (§3).
3. **Pending migrations** — writes the status to `$GITHUB_STEP_SUMMARY` under `### Pending on production`, as `migrate` does today, then asks dbmate for the verdict with its own flag:

   ```bash
   if npx dbmate --no-dump-schema --migrations-dir ../database/migrations status --exit-code; then
     echo "migrations=0" >> "$GITHUB_OUTPUT"
   else
     echo "migrations=1" >> "$GITHUB_OUTPUT"
   fi
   ```

   `--exit-code` returns 1 when any migration is pending. No `package.json` script is added: an `app/package.json` edit would re-trigger `db-rehearsal`, `integration` and `schema` for a one-file CI change, and the flag is dbmate's documented contract, so there is nothing to parse.
4. **Seed changes in the push range** — dbmate status does not see seeds, and `migrate` currently re-applies seeds on every deploy. The seed runner is included because it decides which rows land.

   ```bash
   set -u
   before='${{ github.event.before }}'
   if [ "$before" = "0000000000000000000000000000000000000000" ] || [ '${{ github.event.forced }}' = "true" ]; then
     echo "seeds=1" >> "$GITHUB_OUTPUT"; exit 0
   fi
   if git fetch --depth=1 origin "$before" \
      && changed=$(git diff --name-only "$before" "$GITHUB_SHA" -- ../database/seeds scripts/seed.ts); then
     if [ -n "$changed" ]; then echo "seeds=1" >> "$GITHUB_OUTPUT"; else echo "seeds=0" >> "$GITHUB_OUTPUT"; fi
   else
     echo "::warning::could not diff $before..$GITHUB_SHA; applying"
     echo "seeds=1" >> "$GITHUB_OUTPUT"
   fi
   ```

   Every failure of the detector falls toward applying.
5. **Decide** (`id: decide`): `apply=true` if `migrations=1` or `seeds=1`, else `apply=false`. One line to the step summary saying which, so the run page shows why `rehearse` ran or was skipped.

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
  if: ${{ !failure() && !cancelled() }}
```

A skipped `needs` skips dependents by default; this `if` lets `deploy` run after a skipped `rehearse`/`migrate` and still blocks it when any ancestor failed (`failure()` is true for a failed ancestor anywhere in the chain) or the run was cancelled.

| Scenario | `pending.apply` | `rehearse` | `migrate` | `deploy` |
| --- | --- | --- | --- | --- |
| App-only merge, nothing pending | `false` | skipped | skipped | runs |
| Migration merge | `true` | runs | runs | runs |
| Seed-only merge | `true` | runs | runs | runs |
| Earlier `migrate` failed; app-only merge now | `true` | runs | runs | runs |
| `rehearse` fails | `true` | fails | skipped | skipped |
| `migrate` fails | `true` | passes | fails | skipped |
| `pending` fails (no secret, dbmate error) | — | skipped | skipped | skipped |
| `quality` fails | — | skipped | skipped | skipped |
| First push / force push to `main` | `true` | runs | runs | runs |
| `before` unfetchable | `true` | runs | runs | runs |

### 4. Unchanged

- `on.push.paths` (D392), `concurrency: deploy-production`, `cancel-in-progress: false`.
- `db-rehearsal.yml`, including its `workflow_call` entry.
- `migrate`'s step list (status → migrate → seed → migrate → status). It re-runs status itself; the extra read in `pending` is one catalog query.

## Error handling

- Detector errors never skip the apply: zero `before`, forced push, fetch failure, diff failure all yield `apply=true`.
- A missing `DATABASE_URL` fails `pending` with the same message `migrate` prints; nothing deploys.
- A dbmate connection error exits non-zero and is read as "pending" by the `if` above, so the chain runs and `migrate` surfaces the real error with its own status step.

## Testing

- Local: `actionlint .github/workflows/deploy.yml` where available; `run-all-gates` skill.
- The job graph itself is observable only in Actions. Done-when for the owner, after merge: one app-only merge shows `rehearse`/`migrate` skipped and `deploy` green; one migration or seed merge shows all four green.

## Assumptions

- The `production` environment carries no required-reviewer rule. `pending` needs `environment: production` to read `DATABASE_URL`; a reviewer rule would add one approval prompt per deploy. Unverifiable from the repo.
- `github.event.before` is set on every `push` event (it is; zero on branch creation).

## Context maintenance

- D434 in `decisions/context-system.md`, citing D392 and #293 and this spec.
- `app/DEPLOYMENT.md` §4 and the deploy flow line in §"Deploys are automatic": chain becomes `quality → pending → (rehearse → migrate) → deploy`.
- `11-Neon-Integration.md` §"Merging to main": add a `pending` row to the job table.
- `00-File-Inventory.md`: `deploy.yml` row gains the gate.
- `docs/architecture/00-Context-Map-History.md` front-matter date.
