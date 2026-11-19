---
id: D0116
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Converted `results/index.astro`'s non-trivial inline `x-data` (getters over

## Context and Problem Statement
Per PR review and this project's established `.data.ts` convention: only the trivial `{open: false}` shape is allowed inline

## Decision Drivers
* A PR review asked for the conversion.
* The project's `.data.ts` convention allows only the trivial `{open: false}` shape inline in `x-data`.

## Considered Options
* Move the non-trivial `x-data` into a `scoreTrainingResults()` factory in `lib/game/score-training-results.data.ts`, registered in `register-route-data.ts` (chosen).
* Keep the getters over `URLSearchParams` inline in `results/index.astro` (the state before the conversion).

## Decision Outcome
Chosen option: "Converted `results/index.astro`'s non-trivial inline `x-data` (getters over `URLSearchParams`) to a `scoreTrainingResults()` factory in new `lib/game/score-training-results.data.ts`, registered in `register-route-data.ts`", because Per PR review and this project's established `.data.ts` convention: only the trivial `{open: false}` shape is allowed inline.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Factory in `.data.ts`
* Good, because it follows the project's `.data.ts` convention for non-trivial `x-data`.

### Inline `x-data`
* Bad, because the convention allows only the trivial `{open: false}` shape inline.

## Evidence / More Information
Decided: 2026-07-17

* Commit `cd80aa80` (PR #29, 2026-07-21; adds the `DECISIONS.md` rows D111–D120, including D116, dated 2026-07-17): rebuilt Decision Drivers, Considered Options and Pros and Cons. No spec or plan names this record.
