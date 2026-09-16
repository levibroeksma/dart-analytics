# Knowledge-graph freshness — design

**Date:** 2026-09-16
**Issue:** #345 — committed knowledge graph 692 commits stale; CI's refresh PR silently never created
**Status:** approved, not implemented

---

## Problem

`CLAUDE.md` § Knowledge Graph tells every agent to consult `graphify-out/graph.json` before broad
exploration, and states freshness is CI-owned. Both halves fail together:

- `graphify-out/graph.json` on `main` carries `built_at_commit 13377e0` (2026-08-03), 692 commits behind.
- `.github/workflows/graph.yml`'s `refresh` job rebuilds correctly and force-pushes `chore/graph-refresh`
  — that head sits at `bb4c4e2`, built at `e1465cb`, one commit ahead of current `main`, 5412 nodes over
  798 files. The rebuild is not broken.
- `pulls.create` returns 403 because *Allow GitHub Actions to create and approve pull requests* is off
  (`can_approve_pull_request_reviews: false`, confirmed via the API). D186 documents this degradation;
  the workflow catches the 403, writes a run-summary notice and finishes green.
- Nothing reads run summaries. No refresh PR has ever been opened, and no signal exists that one is owed.

The rebuild works. The landing step does not, and its absence is invisible.

## Decision

Keep the graph authoritative-as-a-map and make the documented model true, at the cost of one human
approval per refresh. Rejected alternatives:

- **Direct commit to `main` from CI.** Needs `github-actions` as a ruleset bypass actor. True zero-touch,
  but relaxes `main`'s PR-and-approval rule for a bot. Rejected on least privilege.
- **Demote the graph to best-effort.** Cheapest, changes no settings, discards the map the instruction
  exists to exploit. Rejected as a loss of capability, not a fix.

## Constraints discovered

`main`'s ruleset (`Main branch protection`, active) requires a pull request, 1 approving review,
code-owner review, required signatures and linear history, with one bypass actor (the owner). A bot
cannot approve its own PR, so **no repo setting makes this fully automatic.** The reachable model is:

> CI rebuilds → CI opens the PR and arms auto-merge → the owner approves → it squash-merges itself.

Anything claiming more than that in the docs is the same defect as the one being fixed.

## Change set

### 1. Land the pending refresh (independent)

Open a PR from the existing `origin/chore/graph-refresh` and squash-merge after approval. Carries no
code. Clears the 692-commit staleness immediately, regardless of the rest.

### 2. Repo settings (owner, manual)

| Setting | Path | Change |
| --- | --- | --- |
| Allow GitHub Actions to create and approve pull requests | Settings → Actions → General → Workflow permissions | off → **on** |
| Allow auto-merge | Settings → General → Pull Requests | off → **on** |

`default_workflow_permissions` stays `read`; the `refresh` job declares its own permissions.
Auto-merge being off is why the workflow's existing `enablePullRequestAutoMerge` step has always no-op'd.

### 3. `.github/workflows/graph.yml`

- Add `issues: write` to the `refresh` job's `permissions`.
- On 403 from `pulls.create`: open-or-update a single tracking issue instead of only a run summary.
  - Marker `<!-- graph-refresh-blocked -->` for idempotent lookup; title `graph: refresh PR could not be opened`.
  - Labels `discovered-work`, `type:infrastructure`, `severity:high` (all exist).
  - Body: branch name, `compare` link, the delta block, and the exact setting to flip.
  - Keep the run summary too.
- On the success path: if that tracking issue is open, close it with a comment naming the new PR.
- Unchanged: the run stays green on 403; any non-403 error still throws; the normalised
  `graph-delta.py` change gate; the `delta` job.

### 4. Documentation

| File | Change |
| --- | --- |
| `CLAUDE.md:51` | Replace the freshness bullet: CI rebuilds and opens a PR, landing needs owner approval, a blocked open files a tracking issue. |
| `decisions/context-system.md` | New `D286`, `Supersedes: D186 · Refines: D185`. |
| `app/CLAUDE.md:33` | Re-point the `D185` citation; the "do not stage it yourself" rule stays true. |
| `.claude/skills/validate-app/SKILL.md:14` | Re-point the `D185` citation. |

## Verification

The 403 path is exercisable today, because the setting is still off. Sequence the work to prove both
branches rather than assume them:

1. Merge the `graph.yml` change **with both settings still off**. The next push to `main` must 403 and
   open the tracking issue. This also settles the one open assumption — that `issues: write` is not
   gated by the same repo setting — by observation rather than by reading docs.
2. Flip both settings. The following push to `main` must open the refresh PR, arm auto-merge, and close
   the tracking issue.
3. Land the documentation and `D286` only after both observations, so the docs describe measured
   behaviour.

Plus the standard doc gates (`check-context-map.sh`, `check-decision-ids.sh`, `check-doc-links.sh` via
`run-all-gates`). No `app/` or `database/` code changes, so `validate:app` does not apply.

## Out of scope

Captured separately if wanted, not fixed here: the `graphify-out/graph.html` report, the `.astro`
partial-parse caveat, and any hard-blocking PR gate on graph freshness (explicitly rejected by D185).
