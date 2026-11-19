---
id: D0287
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [context-system, docs, CI, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0186
superseded-by:
---

# A degradation nobody can see is an outage; the graph fallback files an issue

## Context and Problem Statement
D186's fallback was correct about not painting `main` red and wrong about where the signal goes. A `core.warning` plus a run summary is read by nobody: the committed graph reached 692 commits and six weeks of staleness — every subsystem in `app/src/modules/exercise/`, `training/`, `dartbot/` and migrations `0024`–`0032` missing from the map agents are told to consult *first* — while every graph run reported success (#345). Absence from the graph reads as absence from the repo, so the failure mode was agents confidently answering from a map of a codebase that no longer existed.

## Decision Drivers
* The graph rebuild works, but the landing step fails and its absence is invisible: nothing reads run summaries (spec, Problem).
* `main`'s ruleset requires a PR, 1 approving review, code-owner review, required signatures and linear history. No repo setting makes the refresh fully automatic (spec, Constraints discovered).

## Considered Options
* Keep the run-summary-only fallback from D186 (the state before this record; spec, Problem).
* Commit directly to `main` from CI, with `github-actions` as a ruleset bypass actor (rejected on least privilege; spec, Decision).
* Demote the graph to best-effort (rejected as a loss of capability; spec, Decision).
* File a tracking issue on the 403, enable both repo settings and keep one human approval per refresh (chosen).

## Decision Outcome
Chosen option: "`graph.yml`'s blocked-PR fallback opens or updates a tracking issue (`graph: refresh PR could not be opened`, labelled `discovered-work`/`type:infrastructure`/`severity:high`, keyed on a `<!-- graph-refresh-blocked -->` body marker and matched on both that marker and the bot author) instead of only writing a run summary, and closes that issue on the next run that does open a PR. `issues: write` is added to the `refresh` job. The repo settings *Allow GitHub Actions to create and approve pull requests* and *Allow auto-merge* are both enabled, so the documented path is: CI rebuilds, opens the PR and arms auto-merge pinned to `SQUASH`; the owner approves; it squash-merges. The ruleset's approval requirement is not waived and the graph refresh is not exempted from it.".

### Consequences
the blocked state is now visible in the issue list, where work is already tracked, and costs `main` nothing — the run still finishes green and any non-403 error still fails the job, both per D186. The fallback's issue lookup is scoped to the `discovered-work` label, so an issue whose labels are stripped by hand goes unmatched and the next run opens a duplicate. The fallback was merged *before* the repo settings were flipped, so its blocked branch executed at least once against the real API rather than being assumed correct from the docs; it then fired for real (issue #373) and self-closed on the first successful open (PR #374). Auto-merge arming is measured only in its failing form so far: the first armed attempt was rejected with "merge commits are not allowed on this repository" because `main`'s ruleset requires linear history, which is why the call is pinned to `SQUASH`; no refresh has produced a graph delta since that pin, so the success path is reasoned, not observed, and the next real delta is its first test. One human approval per refresh remains, which is the price of not making a bot a ruleset bypass actor — direct-commit-to-`main` was the considered alternative and was rejected on least privilege.

* Neutral, because the spec and plan named this decision D286. The record carries D287.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.github/workflows/graph.yml` carries `issues: write` on the `refresh` job, the `<!-- graph-refresh-blocked -->` marker, and the issue lookup scoped to the `discovered-work` label and the bot author. It closes the tracking issue when a PR opens. The spec (Verification) required two observations. With both settings off, the 403 path opens the issue. With both on, the success path opens the PR and closes the issue.

## Pros and Cons of the Options
### Run-summary-only fallback
* Bad, because nothing reads run summaries, so no signal exists that a refresh PR is owed (spec, Problem).

### Direct commit to `main` from CI
* Good, because it is truly zero-touch (spec, Decision).
* Bad, because it relaxes `main`'s PR-and-approval rule for a bot (spec, Decision).

### Demote the graph to best-effort
* Good, because it is the cheapest option and changes no settings (spec, Decision).
* Bad, because it discards the map the instruction exists to exploit (spec, Decision).

### Tracking issue plus settings and one approval
* Good, because the spec expects the blocked state to show in the issue list, at the cost of one human approval per refresh (spec, Decision; Change set, item 3).

## Evidence / More Information
Decided: 2026-09-17
Supersedes: D186
Refines: D185

* `docs/superpowers/specs/2026-09-16-graph-freshness-design.md` (Problem, Decision, Constraints discovered, Change set, Verification): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-16-graph-freshness.md` (Global Constraints; Task 2, Task 3, Task 4): confirmed the sequence behind Confirmation.
* Commit `f679d951` (2026-09-18; "docs: state the real graph-freshness model (D287)"): no section rebuilt from it.
* Partly changed by D289 (commit `0238dce7`, PR #387), which stops arming auto-merge.
