---
id: D0209
status: superseded
date: 2026-08-15
origin: contemporaneous
original-date:
tags: [frontend/architecture, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0211
---

# Doubles/Singles Training's lifecycle overlap deduped ahead of D208's own trigger, once it became a CI gate rather than an observation

## Context and Problem Statement
D208 treated the 42-clone-group `fallow` count as accepted debt because it matched `main`'s own pre-existing baseline shape (mirrored-ruleset duplication tolerated since D182). What D208 didn't have yet was the discovery, made once a PR was opened against this branch, that `.github/workflows/quality.yml`'s "Stale-usage gate" runs `npx fallow` as a hard pass/fail CI check — and that the branch's duplication percentage (13.2%) had crossed whatever threshold gates that exit code, up from `main`'s own 11.4% (confirmed via a clean clone of `main` at the same commit). That reclassified the deferred overlap from "debt owed to a future cleanup" to "the specific thing failing CI on this PR." The owner chose to pay it down now rather than merge a permanently-red required check.

## Decision Drivers
* `.github/workflows/quality.yml`'s "Stale-usage gate" runs `npx fallow` as a hard pass/fail CI check.
* The branch's duplication (13.2%) was above `main`'s own 11.4%, so the deferred overlap became the thing failing CI on this PR.
* The owner chose to pay the debt down now rather than merge a permanently red required check.

## Considered Options
* Keep D208's deferral: leave the lifecycle overlap as accepted debt until a fourth sample appears.
* Extract the 8 lifecycle functions into `lib/game/play-lifecycle.ts` now (chosen).

## Decision Outcome
Chosen option: "The `init`/`retryReconciliation`/`commitDart`/`undoVisit`/`uploadAndCompleteSession`/`back`/`abandonAndExit`/`playAgain` overlap between `doubles-training-play.data.ts` and `singles-training-play.data.ts` — the exact piece D208 deferred — is now extracted into `lib/game/play-lifecycle.ts`: eight functions generic over `<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>` (the new `PlayLifecycleContext<TConfig, TEngine, TResults>` type in `lib/game/types.ts`, per the type-raising convention), taking an explicit `context` parameter rather than a `this` parameter to sidestep TypeScript's weak generic inference through `.call()`. Each ruleset's own file keeps only what's genuinely specific: its `resumeEngine` callback, its `resultsSnapshot`-building callback, and its `instanceof` engine-narrowing callback. Bob's 27 (`VISUAL_BOARD`/`hiddenTimer` branch) and 501/Score Training (`ScoreInputBuffer` shape) stay out, unchanged from D208.".

### Consequences
Duplication is back to 10.9%, under `main`'s own 11.4% baseline — `npx fallow` now exits 0. `play-lifecycle.ts` is registered in the File Inventory below. The still-open question is whether Bob's 27 belongs in this same abstraction eventually (D208's original four-way framing) — nothing here forecloses that, but nothing forces it either; the module is written generically enough that folding Bob's 27 in later means adding its `hiddenTimer` branch as another parameter, not a rewrite.

* Good, because `npx fallow` now exits 0 with duplication at 10.9%, under `main`'s own 11.4% baseline.
* Neutral, because Bob's 27 and 501/Score Training stay out of the abstraction, unchanged from D208. Folding Bob's 27 in later means adding its `hiddenTimer` branch as a parameter, not a rewrite.

### Confidence
Rationale unknown — no source found.

### Revisit When
Whether Bob's 27 belongs in this same abstraction eventually, which is D208's original four-way framing.

### Confirmation
`npx fallow` exits 0, with duplication at 10.9% against `main`'s 11.4% baseline.

## Pros and Cons of the Options
### Keep D208's deferral
* Good, because D208 judged three samples a narrow basis for choosing a generic lifecycle abstraction.
* Bad, because the deferred overlap became the specific thing failing the required `fallow` CI check on this PR.

### Extract the lifecycle into `play-lifecycle.ts`
* Good, because duplication falls to 10.9%, under `main`'s 11.4%, and `npx fallow` exits 0.
* Good, because the explicit `context` parameter, in place of a `this` parameter, sidesteps TypeScript's weak generic inference through `.call()`.
* Good, because each ruleset's file keeps only its specific callbacks: `resumeEngine`, the `resultsSnapshot` builder and the `instanceof` engine narrowing.

## Evidence / More Information
Decided: 2026-08-13
Supersedes: D208 (only the "deferred, wait for a fourth sample" scope decision — D208's account of what happened and why is left intact as history)

* Commit `19dfd1aa` (2026-08-14; adds the D209 row and registers `play-lifecycle.ts`): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When and Confirmation.
* Applied in: `docs/superpowers/plans/2026-08-19-consistency.md` (cites D209 for the CI "Stale-usage gate" as a hard pass/fail).
* Superseded by D211 (`docs/superpowers/specs/2026-08-15-singles-doubles-training-analytics-design.md`, § Decisions), which generalizes `play-lifecycle.ts` for `VISUAL_BOARD` input.
