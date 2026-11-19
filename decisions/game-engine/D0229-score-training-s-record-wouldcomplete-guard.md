---
id: D0229
status: accepted
date: 2026-08-22
origin: contemporaneous
original-date:
tags: [game-engine, engine, fact log, Score Training, visit, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training's `record()`/`wouldComplete()` guard against a decided 1v1 match, scoped to `isMatchDecided()` rather than `isComplete()`

## Context and Problem Statement
Code review flagged that `recordVisitTotal`/`recordDart` had no completion guard at all — with `winningSideKey` computed as an uncapped `reduce` sum over every closed turn per seat (no budget cap), a stray extra `record()` call after both 1v1 seats finish their shared ROUNDS budget can inflate one seat's `totalScore` past the other's and flip the already-decided outcome. The literal fix (guard on `isComplete()`, matching TUOD verbatim) was tried first and broke a real, passing production test (`score-training-play.data.test.ts`'s "drives a MINUTES session to completion once the timer expires"): a solo MINUTES session's `isComplete()` can read `true` from `expireTimer()` alone, once at least one visit is already recorded — before the one remaining visit `confirmFinish` still legitimately has to record, per `submitVisit`'s own documented design (`wouldComplete` gates the finish confirm; the deferred visit is recorded exactly once, by `confirmFinish`, after the player agrees). A 1v1 match carries no equivalent risk: it is ROUNDS-only (`durationType` never `MINUTES` for `seats.length > 1`), so `status` only turns terminal as the direct result of the very `record()` call that reaches the last seat's own budget, never ahead of it — unlike `timerExpired`, an external signal `expireTimer()` can set independently of any `record()` call.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`ScoreTrainingEngine.recordVisitTotal`/`recordDart` now throw before any fact-log mutation, and `wouldComplete` now answers `false`, once a private `isMatchDecided()` reads true — `deriveState().seats.length > 1 && status !== "IN_PROGRESS"`. This mirrors `TuodEngine`'s existing completion guard (`recordDart`/`rejectionReason`/`wouldCompleteDart` all check `isComplete()`) but is deliberately narrower: `isMatchDecided()` never trips for a solo (1-seat) session, where `isComplete()` would.".

### Consequences
`score-training.engine.module.ts`'s `isComplete()` is unchanged and untouched by this guard; `isMatchDecided()` is a new private method, not exported. Three regression tests were added to `score-training.engine.module.test.ts` (`describe("ScoreTrainingEngine — 1v1 completion guard")`) reproducing the exact corruption scenario: a 2-seat, single-round match completes, then a further `record()`/`wouldComplete()` call on either seat is rejected rather than silently mutating the fact log. No existing test was re-pointed at a different input; the full `app/` suite (2636 tests) and `bash scripts/check-game-engines.sh` both pass unchanged. `TuodEngine` itself is untouched — whether its own blanket `isComplete()` guard has the identical MINUTES-mid-completing-visit gap this decision found for Score Training (no test currently exercises "record once before expiry, then again after expiry" for TUOD) is noted as a new finding (F21), not fixed here.

* Good, because 3 regression tests in the "ScoreTrainingEngine — 1v1 completion guard" describe reproduce the corruption scenario.
* Neutral, because the record names a new finding, F21: `TuodEngine`'s blanket `isComplete()` guard may have the same MINUTES gap, and the work did not fix it.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The "ScoreTrainingEngine — 1v1 completion guard" describe in `app/tests/modules/game/score-training.engine.module.test.ts` and `scripts/check-game-engines.sh`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-22

* Commit `9ec2e517` (PR #162, 2026-08-23; adds the 1v1 support the guard protects): rebuilt Consequences; the D229 row text is in Context.
* `docs/superpowers/specs/2026-09-02-tuod-hardening-design.md` (§ on `TuodEngine`): describes D229 as the fix for the identical shape in `ScoreTrainingEngine`. Applied in that spec and `docs/superpowers/plans/2026-09-02-tuod-hardening.md`.
