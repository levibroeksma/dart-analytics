---
id: D0208
status: accepted
date: 2026-08-13
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Partial dedup of the Doubles Training frontend's mirrored duplication; the rest stays accepted debt, per D182's own revisit clause

## Context and Problem Statement
`doubles-training-play.data.ts` is exactly the "third RECREATIONAL/QUICK_SCORE-shaped game" D182's rationale named as the revisit trigger (Bob's 27, Singles Training, now Doubles Training all share this lifecycle shape). `fallow` confirms the shape: comparing this branch against its base commit, the pre-existing `bobs27-play.data.ts`+`singles-training-play.data.ts` clone family (4 groups) is joined by `doubles-training-play.data.ts` without changing its group count, and a new `doubles-training-play.data.ts`+`singles-training-play.data.ts` family appears (4 groups, 117 lines) — the exact lifecycle overlap left out of scope above. Total `fallow` dupe count moves from 38 clone groups (base) to 42 (this branch); `fallow`'s dead-code count (2 issues) is unchanged, pre-existing on both. Three same-shaped samples are still a narrow basis for choosing a generic lifecycle abstraction that would need to serve Bob's 27's extra `VISUAL_BOARD`/`hiddenTimer` branch too, so full unification is deferred rather than forced into this branch's diff.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DOUBLES_TRAINING_V1`'s frontend was built by mirroring Bob's 27's play-data module and recreational-input component, per its implementation plan — the same pattern D182 already accepted for 501/Score Training. A final whole-branch review flagged the resulting duplication; the owner chose to dedup the specific pieces that encode a real invariant (the BULL/DOUBLE hit-zone mapping, the doubles-path target-label/visit-preview derivation, and the byte-identical input component) into a new shared module (`lib/game/doubles-path-play.ts`) and component (`DoublesPathRecreationalInput.astro`), used by Bob's 27 and Doubles Training. The broader lifecycle duplication (`init`/`retryReconciliation`/`commitDart`/`undoVisit`/`uploadAndCompleteSession`/`back`/`abandonAndExit`/`playAgain`) that Doubles Training also shares with Singles Training — not just Bob's 27 — was explicitly left out of that dedup's scope.".

### Consequences
`fallow`'s dupes gate stays red on this branch, as it already was on `main` before it — not a new regression, and not blocking per `validate-app`'s DB-independent-gates-still-checked, engine/schema-unaffected completion bar. The next ruleset that shares this lifecycle shape (a fourth sample) is the trigger to actually design the shared abstraction, covering all of Bob's 27, Singles Training, and Doubles Training at once rather than pairwise.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-13
Referenced by D0209's `Supersedes:` line.
