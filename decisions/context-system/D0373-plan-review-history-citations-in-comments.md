---
id: D0373
status: accepted
date: 2026-09-29
origin: contemporaneous
original-date:
tags: [context-system, docs, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Plan/review-history citations in comments fail the no-inline-comments gate

## Context and Problem Statement
D255 barred decision-history in doc comments but was prose-only; plan/task numbers point into `docs/superpowers/plans/` or a gitignored ledger that readers cannot resolve, and they went stale.

## Decision Drivers
* D255 barred decision history in doc comments but was prose-only.
* Plan and task numbers point into `docs/superpowers/plans/` or a gitignored ledger that readers cannot resolve.
* Such citations went stale.

## Considered Options
* Keep the D255 bar as prose only (the prior state).
* Add a grep for plan and review-history phrases to `scripts/check-no-inline-comments.sh` (chosen).

## Decision Outcome
Chosen option: "`scripts/check-no-inline-comments.sh` also greps `app/src/**/*.{ts,astro}` for `ruling R|controller ruling|plan decision|Task [0-9]|fix-round|reviewer finding` and fails on any match. The 26 phase 1–5 statistics comments that carried such citations were rewritten to state the reason plainly (#647).", because D255 barred decision-history in doc comments but was prose-only; plan/task numbers point into `docs/superpowers/plans/` or a gitignored ledger that readers cannot resolve, and they went stale.

### Consequences
a comment may still cite a recorded decision id (`D372`); it may not cite a plan step, task number or review round. Detail that needs a home goes in `decisions/**` or `docs/architecture/**`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-no-inline-comments.sh` sets `history_re` to `ruling R|controller ruling|plan decision|Task [0-9]|fix-round|reviewer finding`. The `quality` workflow runs the script, and a match fails the check.

## Pros and Cons of the Options
### Keep the D255 bar as prose only
* Bad, because the rule was prose-only, so citations to plan and task numbers kept appearing and went stale.

### Gate the history phrases with a grep
* Good, because the check fails on any match in `app/src/**/*.{ts,astro}`.

## Evidence / More Information
Decided: 2026-09-29

* Commit `71e6679b` (PR #647, adds the D373 row and the `check-no-inline-comments.sh` grep; rewrites 26 statistics comments): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
