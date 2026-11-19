---
id: D0447
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/alpine, state, recovery, session recovery]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# One `createSetupSession` mixin owns setup state and session recovery

## Context and Problem Statement
the fields and methods were byte-identical across five controllers and five context types, differing only in game key and play URL, so a fix to recovery had to land five times. `GameSetupPage` reads them, so a controller missing one broke the page silently.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`createSetupSession({ gameTypeKey, playHref })` (`lib/game/setup-session.ts`) returns the 13 shared setup fields and `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot`. `createPresetSetupController`, `fiveOhOneSetup`, `scoreTrainingSetup`, `oneTwentyOneSetup` and `tuodSetup` spread it. `SetupSessionContext` in `types.ts` is the matching type; the five setup context types intersect it.".

### Consequences
no behaviour, store, API or markup change. `start()`, `init()`, `addGuest()`, `addBot()` and the opt-outs from `createPresetSetupController` stay as they were (D216); the `SESSION_ALREADY_ACTIVE` and `init()` catch blocks stay duplicated by design.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-11
Supersedes: none (extends D216).
