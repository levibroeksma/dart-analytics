---
id: D0210
status: accepted
date: 2026-08-14
origin: contemporaneous
original-date:
tags: [game-engine, engine, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Training order mode: target_order frozen into the config snapshot at session creation; bull leads High→Low, shuffles fully in Random, always re-minted on Play Again

## Context and Problem Statement
The user asked for the setting to be identical across both games and for a session's random order to survive a correction via undo without reshuffling — undo replays the engine's reducer against `facts()`, so the order it reads must be stable across that replay, and the existing config-snapshot-copy-once mechanism (already how every other editable setting works, e.g. D177/D178's `duration_value`) already guarantees exactly that without a new persisted-fact field. Bull's placement (lead vs. trail vs. shuffled) and Play Again's reshuffle-vs-reuse behavior were both genuine alternatives weighed with the product owner rather than obvious defaults.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Singles Training and Doubles Training gain an identical editable `order_mode` setting (`LOW_TO_HIGH` | `HIGH_TO_LOW` | `RANDOM`), resolved client-side (`lib/game/target-order.ts`) into a concrete 21-value `target_order` array (1–20 plus `25` as the BULL sentinel) once at session creation and copied into the immutable `SinglesConfig`/`DoublesTrainingConfig` snapshot — never re-resolved on undo or resume. On `HIGH_TO_LOW`, BULL **leads** (`BULL, 20, 19, …1`) for both games, not "ends on bull" as Doubles Training's pre-existing non-canonical doc had claimed. On `RANDOM`, all 21 targets (1–20 and BULL) shuffle together via Fisher–Yates, so BULL can land anywhere. Both engines' completion checks move from "is this target BULL" to "is this the 21st (last) target in `config.targetOrder`" — index-based, since BULL is no longer always last. Play Again always calls `targetOrderFor(priorConfig.orderMode)` again rather than reusing the just-finished session's array, so a Random session gets a fresh shuffle every replay.".

### Consequences
`board-progression.module.ts`'s `numbersPath`/`doublesPath` gained an optional explicit-order parameter, defaulting to the original fixed ascending array when omitted, so Bob's 27's two zero-argument call sites are unaffected. `applyDoublesTrainingDart` gained a required `config` first parameter (was state-only), and `DoublesTrainingEngine`'s constructor now retains `config` as a field instead of discarding it — both engines are now genuinely config-driven, closing a gap D144/D153's precedent had left open for Doubles Training specifically. `runPlayAgain` (`play-lifecycle.ts`) gained an optional `buildOverrides` hook (`PlayAgainOverrides<TConfig>`, `lib/game/types.ts`) that, when supplied, sends `config.overrides` on the replay's `POST /api/sessions` call and reassigns `$store.game.configSnapshot`; omitted, behavior is byte-for-byte unchanged, so every other game's Play Again call is untouched. `docs/game-rules/rulesets/doubles-training.md` corrected in the same change — its Order rows and Progress section previously said High→Low "ends on bull," which never matched this decision's actual convention.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-14
