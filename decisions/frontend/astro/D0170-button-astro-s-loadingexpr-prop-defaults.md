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

# `Button.astro`'s `loadingExpr` prop defaults to `"typeof loading !== 'undefined' &&

## Context and Problem Statement
Final whole-branch review executed the real Alpine build against the actual DOM shape and found the design spec's diagnosis of Alpine's undefined-variable behavior was factually wrong, misdirecting the original fix at the wrong component
The Alpine loading-state spec adds a `loadingExpr` prop to `Button.astro` with the default `"loading"`. It assumed an out-of-scope Alpine reference evaluates `undefined` and shows the element. The final whole-branch review ran the real Alpine build and found otherwise: the reference throws inside the evaluator and resolves falsy, which hides the element.

## Decision Drivers
* The default must be safe in Alpine scopes that never declare `loading`.
* `GameLayout.astro` renders `ExitModal.astro` in a bare `x-data` scope that never declares `loading`, and the unsafe default blanked `ConfirmDialog`'s Cancel button there.

## Considered Options
* Default `"typeof loading !== 'undefined' && loading"` (chosen).
* Bare default `"loading"`, the original shipped value. It is unsafe for out-of-scope references.

## Decision Outcome
Chosen option: "`Button.astro`'s `loadingExpr` prop defaults to `"typeof loading !== 'undefined' && loading"`, not the bare `"loading"` originally shipped — an out-of-scope Alpine expression reference throws inside Alpine's evaluator and resolves falsy (hides the element), it does not evaluate `undefined` as truthy as first assumed. The unsafe default silently blanked `ConfirmDialog`'s Cancel button inside `ExitModal.astro` (rendered in `GameLayout.astro`'s bare `x-data` scope, which never declares `loading`) — this, not the Score Training play page's Retry button, was issue #49's actual "Ending session modal … title not showing"".

### Consequences
* Good, because `ConfirmDialog`'s Cancel button inside `ExitModal.astro` renders again.
* Neutral, because the commit identifies this blanked button, not the Score Training play page's Retry button, as issue #49's "Ending session modal … title not showing".

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The final whole-branch review executed the real Alpine build against the actual DOM shape. `.astro` components have no Vitest coverage (D101; spec § 8), so this check is manual.

## Pros and Cons of the Options
### Safe `typeof` default
* Good, because buttons in scopes without `loading` stay visible.

### Bare `"loading"` default
* Bad, because an out-of-scope reference throws in Alpine's evaluator and hides the element.

## Evidence / More Information
Decided: 2026-07-29

* `docs/superpowers/specs/2026-07-28-alpine-loading-state-design.md` (§ 2, § 4, § 8): rebuilt Context and Confirmation. Its diagnosis of Alpine's undefined-variable behaviour is the one the review corrected.
* `docs/superpowers/plans/2026-07-28-alpine-loading-state.md` (Task 4): the original `"loading"` default.
* Commit `49b3ebdf` (2026-07-29; changes the default and adds the D170 row): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
