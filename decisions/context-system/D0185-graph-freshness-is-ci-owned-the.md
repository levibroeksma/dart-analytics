---
id: D0185
status: accepted
date: 2026-08-03
origin: contemporaneous
original-date:
tags: [context-system, gate, CI, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Graph freshness is CI-owned; the local CLI is optional

## Context and Problem Statement
`scripts/refresh-graph.sh` exited 0 whenever the CLI was absent, so any clone that skipped the manual install silently skipped the rebuild too — four consecutive branches (score-training configurable-duration, bottom-nav iPhone Home Screen fix, 501-recreational-v1, decision-ledger-split) shipped knowledge-graph-staleness disclosures instead of a refreshed graph. By the time this was corrected, the committed graph had drifted to 2,321 nodes / 2,762 links against 2,872 / 4,085 on a clean rebuild, and its `built_at_commit` (`391d2dd`) was no longer reachable in history.

## Decision Drivers
* Graph freshness must not depend on each clone having a manually installed CLI (spec, Goal).
* `main` is protected, so a bot cannot push to it directly (spec, Design, Job 1).
* A broken CI install must not no-op silently, as the local warn-and-exit-0 path does (spec, Facts established by measurement, item 4).

## Considered Options
* Keep the local `refresh-graph.sh` as the only refresh path, which exits 0 when the CLI is absent (the state before this record; spec, Problem).
* A CI-owned refresh in `graph.yml`: a `refresh` job on push to `main` opens a PR, and a `delta` job comments on PRs (chosen).
* A blocking `verify` gate that rebuilds, normalises and fails on drift (rejected; spec, Why not enforce).
* Grant `github-actions[bot]` a ruleset bypass so the job pushes directly. The spec calls it simpler, but it needs a repo-settings change only the owner can make (spec, Design, Job 1).

## Decision Outcome
Chosen option: "Knowledge-graph freshness is owned by CI, not by each agent/clone. `.github/workflows/graph.yml` rebuilds `graphify-out/graph.json` on every push to `main` (`GRAPH_REFRESH_STRICT=1`) and opens/updates a PR carrying the rebuild, since `main` is protected and the workflow cannot push directly to it; on pull requests it posts a non-blocking delta comment instead. Installing the `graphify` CLI locally remains optional, for `graphify query/path/explain` while working, and is no longer a per-clone requirement.".

### Consequences
`GRAPH_REFRESH_STRICT=1` makes a broken CI install fail the workflow loudly instead of no-op-ing the way the local default does. Delta comparison must normalise `built_at_commit` away as the sole volatile field, or every run would register as dirty even with no real content change. A hard-blocking PR gate on graph freshness was considered and rejected: it would make graphify CLI availability a prerequisite for contributing at all, which is the exact assumption that had already failed to hold across four branches.

* Good, because no contributor or agent needs `graphify` locally for the committed graph to stay current (spec, Goal).
* Bad, because the refresh PR can sit unmerged when auto-merge is unavailable. The spec judges that better than the silent skip (spec, Risks and mitigations).
* Neutral, because the workflow pins `graphifyy[sql]>=0.9.32,<0.10`, so a pin bump is a reviewable change (spec, Version pinning).
* Neutral, because the push trigger carries `paths-ignore: ['graphify-out/**']`, so merging the graph PR does not retrigger the job (spec, Design, Job 1).

### Confidence
Rationale unknown — no source found.

### Revisit When
Graph staleness proves to matter enough to block on. The spec says "B can be layered on top once A has made local installs unnecessary" (Why not enforce).

### Confirmation
`.github/workflows/graph.yml` runs `scripts/refresh-graph.sh` with `GRAPH_REFRESH_STRICT=1` in both the `refresh` and `delta` jobs, and pins `graphifyy[sql]>=0.9.32,<0.10`. Its `Check for changes` step gates on `graph-delta.py` printing `identical`, not on a byte diff.

## Pros and Cons of the Options
### Local refresh only
* Bad, because any clone that skipped the manual install skipped the rebuild silently, and four consecutive branches shipped with a staleness disclosure.

### CI-owned refresh
* Good, because it removes the root cause instead of policing it (spec, Design, Job 1).
* Bad, because the refresh PR waits for a human when auto-merge is unavailable (spec, Risks and mitigations).

### Blocking `verify` gate
* Good, because it matches how the repo treats its other invariants and would have failed all four recent branches (spec, Why not enforce).
* Bad, because it makes `graphify` a hard prerequisite for contributing, and its only remedy is an install step people skip (spec, Why not enforce).

### Bot ruleset bypass
* Good, because the PR machinery disappears (spec, Design, Job 1).
* Bad, because it needs a repo-settings change only the owner can make (spec, Design, Job 1).

## Evidence / More Information
Decided: 2026-08-03

* `docs/superpowers/specs/2026-08-03-graph-refresh-ci-design.md` (Problem, Goal, Facts, Design, Why not enforce, Risks and mitigations): rebuilt Decision Drivers, Considered Options, Consequences, Revisit When and Pros and Cons.
* `docs/superpowers/plans/2026-08-03-graph-refresh-ci.md` (Global Constraints; the correction note on the change gate): rebuilt Confirmation.
* Commit `bb68a5e5` (2026-08-03; adds the D185 block and repoints the consumers): no section rebuilt from it.
* Refined by D186 and D287.
