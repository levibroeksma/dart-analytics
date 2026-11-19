---
id: D0170
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/astro, component, page]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `Button.astro`'s `loadingExpr` prop defaults to `"typeof loading !== 'undefined' &&

## Context and Problem Statement
Final whole-branch review executed the real Alpine build against the actual DOM shape and found the design spec's diagnosis of Alpine's undefined-variable behavior was factually wrong, misdirecting the original fix at the wrong component

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`Button.astro`'s `loadingExpr` prop defaults to `"typeof loading !== 'undefined' && loading"`, not the bare `"loading"` originally shipped — an out-of-scope Alpine expression reference throws inside Alpine's evaluator and resolves falsy (hides the element), it does not evaluate `undefined` as truthy as first assumed. The unsafe default silently blanked `ConfirmDialog`'s Cancel button inside `ExitModal.astro` (rendered in `GameLayout.astro`'s bare `x-data` scope, which never declares `loading`) — this, not the Score Training play page's Retry button, was issue #49's actual "Ending session modal … title not showing"".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-29
