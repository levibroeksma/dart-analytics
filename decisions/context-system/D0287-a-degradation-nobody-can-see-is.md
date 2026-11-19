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
<!-- backfill: pending -->

# A degradation nobody can see is an outage; the graph fallback files an issue

## Context and Problem Statement
D186's fallback was correct about not painting `main` red and wrong about where the signal goes. A `core.warning` plus a run summary is read by nobody: the committed graph reached 692 commits and six weeks of staleness — every subsystem in `app/src/modules/exercise/`, `training/`, `dartbot/` and migrations `0024`–`0032` missing from the map agents are told to consult *first* — while every graph run reported success (#345). Absence from the graph reads as absence from the repo, so the failure mode was agents confidently answering from a map of a codebase that no longer existed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`graph.yml`'s blocked-PR fallback opens or updates a tracking issue (`graph: refresh PR could not be opened`, labelled `discovered-work`/`type:infrastructure`/`severity:high`, keyed on a `<!-- graph-refresh-blocked -->` body marker and matched on both that marker and the bot author) instead of only writing a run summary, and closes that issue on the next run that does open a PR. `issues: write` is added to the `refresh` job. The repo settings *Allow GitHub Actions to create and approve pull requests* and *Allow auto-merge* are both enabled, so the documented path is: CI rebuilds, opens the PR and arms auto-merge pinned to `SQUASH`; the owner approves; it squash-merges. The ruleset's approval requirement is not waived and the graph refresh is not exempted from it.".

### Consequences
the blocked state is now visible in the issue list, where work is already tracked, and costs `main` nothing — the run still finishes green and any non-403 error still fails the job, both per D186. The fallback's issue lookup is scoped to the `discovered-work` label, so an issue whose labels are stripped by hand goes unmatched and the next run opens a duplicate. The fallback was merged *before* the repo settings were flipped, so its blocked branch executed at least once against the real API rather than being assumed correct from the docs; it then fired for real (issue #373) and self-closed on the first successful open (PR #374). Auto-merge arming is measured only in its failing form so far: the first armed attempt was rejected with "merge commits are not allowed on this repository" because `main`'s ruleset requires linear history, which is why the call is pinned to `SQUASH`; no refresh has produced a graph delta since that pin, so the success path is reasoned, not observed, and the next real delta is its first test. One human approval per refresh remains, which is the price of not making a bot a ruleset bypass actor — direct-commit-to-`main` was the considered alternative and was rejected on least privilege.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
Supersedes: D186
Refines: D185
