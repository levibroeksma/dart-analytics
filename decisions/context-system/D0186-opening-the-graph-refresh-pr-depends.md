---
id: D0186
status: superseded
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [context-system, gate, branch, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0287
---
<!-- backfill: pending -->

# Opening the graph-refresh PR depends on a repo setting; the workflow degrades instead of failing

## Context and Problem Statement
measured on the first real post-merge run (run 30978978985, 2026-08-05). Every step succeeded — rebuild, the normalised gate, the commit, the force-push — and only the PR-open step 403'd, because `GITHUB_TOKEN` cannot open pull requests unless that repo setting is enabled. D185 asserted the job "opens/updates a PR" without recording that this is contingent on a setting the workflow cannot control.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`graph.yml`'s `refresh` job treats PR creation as best-effort. It always rebuilds, commits and force-pushes `chore/graph-refresh`; if `POST /pulls` returns 403 "GitHub Actions is not permitted to create or approve pull requests" it emits a warning plus a run summary carrying the branch, a `compare` link and the delta, and finishes green. Any other error from that call still fails the job. Full automation requires *Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"*, which is off by default on GitHub.".

### Consequences
with the setting off, the refreshed graph still lands on `chore/graph-refresh` and needs a one-click manual PR; the run stays green so `main` is not painted red on every merge, since a permanently-red required check is noise that gets ignored — the same not-noticing that let the graph go stale for four branches. The cost is that the pending branch is visible only in the run summary, so the setting is the preferred fix and the fallback is the safety net. Failing the run was rejected for the noise reason; silently succeeding with no summary was rejected because the waiting branch would be invisible.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-05
Refines: D185
