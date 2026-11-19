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

# Opening the graph-refresh PR depends on a repo setting; the workflow degrades instead of failing

## Context and Problem Statement
measured on the first real post-merge run (run 30978978985, 2026-08-05). Every step succeeded — rebuild, the normalised gate, the commit, the force-push — and only the PR-open step 403'd, because `GITHUB_TOKEN` cannot open pull requests unless that repo setting is enabled. D185 asserted the job "opens/updates a PR" without recording that this is contingent on a setting the workflow cannot control.

## Decision Drivers
* The first real post-merge run failed on its last step with a 403. A repo setting that the workflow cannot control is off by default (commit `4d08e1b0` message).
* A permanently red required check on every merge is noise that gets ignored (commit `4d08e1b0` message).

## Considered Options
* Fail the job on the 403 (rejected).
* Succeed silently with no summary (rejected).
* Catch the 403 specifically, warn and write a run summary (chosen).
* Enable the repo setting. The commit calls it the preferred fix, and the fallback the safety net.

## Decision Outcome
Chosen option: "`graph.yml`'s `refresh` job treats PR creation as best-effort. It always rebuilds, commits and force-pushes `chore/graph-refresh`; if `POST /pulls` returns 403 "GitHub Actions is not permitted to create or approve pull requests" it emits a warning plus a run summary carrying the branch, a `compare` link and the delta, and finishes green. Any other error from that call still fails the job. Full automation requires *Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"*, which is off by default on GitHub.".

### Consequences
with the setting off, the refreshed graph still lands on `chore/graph-refresh` and needs a one-click manual PR; the run stays green so `main` is not painted red on every merge, since a permanently-red required check is noise that gets ignored — the same not-noticing that let the graph go stale for four branches. The cost is that the pending branch is visible only in the run summary, so the setting is the preferred fix and the fallback is the safety net. Failing the run was rejected for the noise reason; silently succeeding with no summary was rejected because the waiting branch would be invisible.

* Good, because any other error from the call still fails the job: the commit reports that a mocked generic 500 still throws.
* Bad, because, per the later 2026-09-16 spec, nobody reads a warning and a run summary. That spec records that no refresh PR was ever opened and no signal said one was owed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.github/workflows/graph.yml` still catches the 403 on `POST /pulls` and finishes green, and any other error throws. Commit `4d08e1b0` reports an ad hoc check: it extracted the `github-script` body and ran it against a mocked octokit. The 403 path finished with a warning and summary, a generic 500 threw, and the happy path was unchanged.

## Pros and Cons of the Options
### Fail the job on the 403
* Bad, because a permanently red required check on every merge is noise that gets ignored, the same not-noticing that let the graph go stale.

### Succeed silently
* Bad, because the waiting branch would be invisible.

### Catch the 403, warn and write a summary
* Good, because `main` is not painted red on every merge.

## Evidence / More Information
Decided: 2026-08-05
Refines: D185

* Commit `4d08e1b0` (2026-08-05; first post-merge run 30978978985): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-09-16-graph-freshness-design.md` (Problem): rebuilt Consequences.
* Superseded by D287.
