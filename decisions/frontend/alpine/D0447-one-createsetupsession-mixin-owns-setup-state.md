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

# One `createSetupSession` mixin owns setup state and session recovery

## Context and Problem Statement
the fields and methods were byte-identical across five controllers and five context types, differing only in game key and play URL, so a fix to recovery had to land five times. `GameSetupPage` reads them, so a controller missing one broke the page silently.

## Decision Drivers
* `createPresetSetupController` and 4 hand-written controllers declare the same 13 state fields and the same 6 method bodies. Fallow reports a 20-line clone with 5 instances.
* A fix to session recovery lands 5 times, so the behaviour can drift.
* `GameSetupPage` reads these fields, so a controller missing one breaks the page silently.
* No visible or behavioural change is allowed.

## Considered Options
* One `createSetupSession` mixin that the 5 controllers spread (chosen).
* Keep the fields and methods copied in each controller and its context type.

## Decision Outcome
Chosen option: "`createSetupSession({ gameTypeKey, playHref })` (`lib/game/setup-session.ts`) returns the 13 shared setup fields and `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot`. `createPresetSetupController`, `fiveOhOneSetup`, `scoreTrainingSetup`, `oneTwentyOneSetup` and `tuodSetup` spread it. `SetupSessionContext` in `types.ts` is the matching type; the five setup context types intersect it.".

### Consequences
no behaviour, store, API or markup change. `start()`, `init()`, `addGuest()`, `addBot()` and the opt-outs from `createPresetSetupController` stay as they were (D216); the `SESSION_ALREADY_ACTIVE` and `init()` catch blocks stay duplicated by design.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Verification section lists the checks: `app/tests/lib/game/setup-session.test.ts` covers reconcile, retry, continue, abandon, `removeGuest`, `removeBot` and fresh state per call. The per-game `*-setup.data.test.ts` files pass unchanged, and `bash scripts/fallow-gate.sh` no longer reports the clone group. The spec's Review focus asks that 2 controller instances never share `guests` or `bot` state.

## Pros and Cons of the Options
### One `createSetupSession` mixin
* Good, because recovery behaviour and the page scope contract live in one place, `app/src/lib/game/setup-session.ts`, with one `SetupSessionContext` type.
* Good, because Alpine sees the same object shape as before.
* Bad, because the 2 catch blocks stay duplicated.

### Keep the copies
* Bad, because a fix to recovery must land 5 times.
* Bad, because a controller missing a field breaks `GameSetupPage` silently.

## Evidence / More Information
Decided: 2026-10-11
Supersedes: none (extends D216).

* `docs/superpowers/specs/2026-10-11-setup-session-mixin-design.md` (Goal, Evidence, Design, Untouched, Verification, Review focus): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `e3e9ba7c` (2026-10-11, adds the D447 row): source of the Context, Decision Outcome and Consequences text.
