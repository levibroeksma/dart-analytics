---
id: D0144
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Singles Training dart facts record **no intention at all**

## Context and Problem Statement
Honesty over completeness in the intention pair — the alternative writes an intent the player never held; nulling only the zone was tried first and found unpersistable (rejected by `chk_dart_target_consistency`), corrected the same day

## Decision Drivers
* Intended-vs-hit accuracy analysis (D06) reads the intention pair, so a fabricated intent would corrupt it.
* Migration `0007` `chk_dart_target_consistency` admits both intention columns NULL, or the zone NOT NULL.

## Considered Options
* Null both `intendedTargetNumber` and `intendedZoneKey` (chosen).
* Record the target number with a null zone (the first attempt).
* Record a fabricated "minimum ring" zone as the intent.

## Decision Outcome
Chosen option: "Singles Training dart facts record **no intention at all** — both `intendedTargetNumber` and `intendedZoneKey` null, not just the zone: single, double and treble on that segment are all valid intentional outcomes, so a fabricated "minimum ring" would corrupt the D06 intended-vs-hit accuracy analysis, and a target number paired with a null zone is rejected by `chk_dart_target_consistency` regardless. Bob's 27 and Doubles Training record a genuine `DOUBLE` intent (`INNER_BULL` on the bull target); Singles' intended target is recoverable from the visit index instead, since it plays one fixed target per visit".

### Consequences
* Neutral, because commit `d6305e62` added a cross-engine regression test and reconciled the docs and ledger text that described the older shape.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/dart-fact-target-consistency.test.ts` asserts every engine's dart facts satisfy the `chk_dart_target_consistency` pairing. `app/tests/modules/game/singles-training.engine.module.test.ts` asserts null `intendedTargetNumber`.

## Pros and Cons of the Options
### Null the whole intention pair
* Good, because the player's real intent is not misstated, and the intended target stays recoverable from the visit index.

### Target number with a null zone
* Bad, because `chk_dart_target_consistency` rejects every such dart row at INSERT (commit `d6305e62`).

### Fabricated minimum ring
* Bad, because single, double and treble are all valid intentional outcomes, so a minimum ring records an intent the player never held.

## Evidence / More Information
Decided: 2026-07-26

* Commit `d6305e62` (2026-07-26; "fix: null the whole intention pair for Singles Training darts"): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. It amended the D144 row the same day.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Task 7, persistence rule): the plan's original shape drew intention from the current target.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the first D144 row.
