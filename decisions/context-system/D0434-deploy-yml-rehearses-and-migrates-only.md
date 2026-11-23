---
id: D0434
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [context-system, docs, gate, CI, deploy, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `deploy.yml` rehearses and migrates only when production has something to apply

## Context and Problem Statement
the handoff of 2026-10-09 counted 97 `deploy` runs in the billing period, each cutting a Neon branch from production (a second compute endpoint plus a schema replay) and running the production migration runner, for merges that mostly touched no schema. D433 removed the heavy read from each rehearsal; this removes the rehearsal and the apply when they would apply nothing. The gate asks production rather than diffing alone because a `migrate` that failed on an earlier deploy leaves migrations pending and the next app-only merge must still land them before its Worker ships (#293, D288). The diff exists because dbmate cannot see seeds and `migrate` no longer re-applies them on every deploy; its base is the last successful run, not the last push, so a deploy that failed in seeding is not forgotten by the next merge. The status read is kept although the diff already covers #293: it is the only check that sees a schema change made outside this pipeline (a point-in-time restore, a manual `dbmate down`), and a catalog read costs one compute wake and kilobytes of transfer.

## Decision Drivers
* 97 `deploy` runs in the billing period each cut a Neon branch and ran the production migration runner, for merges that mostly touched no schema.
* The free tier's binding limit is network transfer (4.05 GB of a believed 5 GB); compute sits at 8.33 CU-h of a believed 100 CU-h. The spec calls both caps unverified.
* A `migrate` that failed on an earlier deploy leaves migrations pending, and a later app-only merge must still apply them before its Worker ships (#293).
* dbmate cannot see seeds, so a seed change must be found in git.

## Considered Options
* Keep rehearsing and migrating on every deploy (the behaviour described in Context).
* Gate on a git diff alone.
* Gate on production's pending status plus a diff from the last successful deploy (chosen).

## Decision Outcome
Chosen option: "`deploy.yml` gains a `pending` job between `quality` and `rehearse` (`environment: production`, `permissions: contents: read, actions: read`). It runs `db:status:ci` (fails closed on any connection error), then `npx dbmate … status --exit-code` for the verdict, then diffs `database/migrations/**`, `database/seeds/**` and `app/scripts/seed.ts` from the `headSha` of the last successful `deploy` run on `main` (`gh run list`, runner token), falling back to `github.event.before`. `apply=true` when dbmate reports pending, the diff is non-empty, `before` is all zeros, the push was forced, no successful run exists and the base is unfetchable, or the diff fails. `rehearse` and `migrate` carry `if: success() && needs.pending.outputs.apply == 'true'`; `deploy` carries `needs: [pending, migrate]` and `if: !cancelled() && needs.pending.result == 'success' && (needs.pending.outputs.apply == 'false' || needs.migrate.result == 'success')`. The `paths` filter (D392), the `deploy-production` concurrency group, `db-rehearsal.yml` and `migrate`'s steps are unchanged. Spec: `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md`.".

### Consequences
an app-only merge touches Neon only through `pending`'s two catalog reads (`db:status:ci`, then `status --exit-code`), both inside one compute wake; a migration or seed merge runs the full chain as before. `deploy` now has two named ways in; a `migrate` skipped by a failed `rehearse` cannot pass as "skipped". Seeds are no longer re-applied on every deploy, so `app/DEPLOYMENT.md`'s "cheap insurance" note is reworded. `pending` adds one `npm ci` and two production connections per deploy, where `migrate` used to add one. A `production` environment reviewer rule, if one is ever added, would prompt on `pending` as well as `migrate` and `deploy`. Left for separate decisions: `db-rehearsal.yml` still cuts a Neon branch on every PR push touching `app/package.json`; a migration merge still rehearses twice (PR time and merge time); dropping the status read if compute ever binds.

### Confidence
Rationale unknown — no source found.

### Revisit When
The spec says dropping the status read is a one-line change if compute ever becomes the binding cap; the diff alone then still covers #293.

### Confirmation
The spec's done-when, for the owner after merge: one app-only merge shows `rehearse` and `migrate` skipped and `deploy` green with `nothing to apply` in the summary. One migration or seed merge shows all four jobs green with the reason line. The spec also names `actionlint .github/workflows/deploy.yml` where available. `.github/workflows/deploy.yml` carries the `pending` job today.

## Pros and Cons of the Options
### Keep rehearsing and migrating on every deploy
* Bad, because each run cuts a Neon branch from production (a second compute endpoint plus a schema replay) and runs the migration runner, for merges that mostly touch no schema.

### Gate on a git diff alone
* Bad, because the spec says the gate asks production, not only the diff. The status read is the only check that sees a schema change made outside the pipeline, such as a point-in-time restore or a manual `dbmate down`.
* Good, because the spec notes the diff from the last successful deploy already covers #293 if the status read is dropped.

### Gate on pending status plus a diff from the last successful deploy
* Good, because an app-only merge runs `quality → pending → deploy` and touches Neon only through the status reads.
* Good, because the status read catches a failed earlier `migrate` and out-of-pipeline schema changes, and the diff catches seeds, which dbmate cannot see.
* Bad, because the status read still costs one compute wake and kilobytes of transfer.

## Evidence / More Information
Decided: 2026-10-09

* `docs/superpowers/specs/2026-10-09-deploy-skip-idle-schema-design.md` (Why, § 1, § 3, Neon budget, Testing, Deferred): rebuilt Decision Drivers, Considered Options, Confirmation, Revisit When and Pros and Cons.
* Commit `4a30b687` (2026-10-09; adds the D434 row to `decisions/context-system.md`): source of the Context and Consequences text.
