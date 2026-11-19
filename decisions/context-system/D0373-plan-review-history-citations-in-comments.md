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
<!-- backfill: pending -->

# Plan/review-history citations in comments fail the no-inline-comments gate

## Context and Problem Statement
D255 barred decision-history in doc comments but was prose-only; plan/task numbers point into `docs/superpowers/plans/` or a gitignored ledger that readers cannot resolve, and they went stale.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-no-inline-comments.sh` also greps `app/src/**/*.{ts,astro}` for `ruling R|controller ruling|plan decision|Task [0-9]|fix-round|reviewer finding` and fails on any match. The 26 phase 1–5 statistics comments that carried such citations were rewritten to state the reason plainly (#647).", because D255 barred decision-history in doc comments but was prose-only; plan/task numbers point into `docs/superpowers/plans/` or a gitignored ledger that readers cannot resolve, and they went stale.

### Consequences
a comment may still cite a recorded decision id (`D372`); it may not cite a plan step, task number or review round. Detail that needs a home goes in `decisions/**` or `docs/architecture/**`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-29
