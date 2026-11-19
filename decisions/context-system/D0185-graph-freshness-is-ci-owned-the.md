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
<!-- backfill: pending -->

# Graph freshness is CI-owned; the local CLI is optional

## Context and Problem Statement
`scripts/refresh-graph.sh` exited 0 whenever the CLI was absent, so any clone that skipped the manual install silently skipped the rebuild too — four consecutive branches (score-training configurable-duration, bottom-nav iPhone Home Screen fix, 501-recreational-v1, decision-ledger-split) shipped knowledge-graph-staleness disclosures instead of a refreshed graph. By the time this was corrected, the committed graph had drifted to 2,321 nodes / 2,762 links against 2,872 / 4,085 on a clean rebuild, and its `built_at_commit` (`391d2dd`) was no longer reachable in history.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Knowledge-graph freshness is owned by CI, not by each agent/clone. `.github/workflows/graph.yml` rebuilds `graphify-out/graph.json` on every push to `main` (`GRAPH_REFRESH_STRICT=1`) and opens/updates a PR carrying the rebuild, since `main` is protected and the workflow cannot push directly to it; on pull requests it posts a non-blocking delta comment instead. Installing the `graphify` CLI locally remains optional, for `graphify query/path/explain` while working, and is no longer a per-clone requirement.".

### Consequences
`GRAPH_REFRESH_STRICT=1` makes a broken CI install fail the workflow loudly instead of no-op-ing the way the local default does. Delta comparison must normalise `built_at_commit` away as the sole volatile field, or every run would register as dirty even with no real content change. A hard-blocking PR gate on graph freshness was considered and rejected: it would make graphify CLI availability a prerequisite for contributing at all, which is the exact assumption that had already failed to hold across four branches.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-03
