---
id: D0247
status: accepted
date: 2026-08-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Singles Training V2 adds Hard/Extreme mandatory-hit elimination as a new ruleset version, not a V1 config widen

## Context and Problem Statement
The approved design spec and its implementation plan (`docs/superpowers/specs/2026-08-29-singles-training-hard-extreme-design.md`, `docs/superpowers/plans/2026-08-29-singles-training-hard-extreme.md`) originally widened `SinglesConfig.difficulty` on `SINGLES_V1` in place — a genuine rule-shape change (a new elimination/`LOST` outcome) on an already-shipped version. This was caught during this same task's context-maintenance pass against D243 (121 V2) and D245 (Shanghai V2), both from the immediately preceding day, which independently established: "`<X>_V1`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data." The spec/plan predate that precedent being checked against them and are left as historical artifacts (`docs/superpowers/` status notes only, never rewrites); this decision and the code it describes are the corrected implementation, confirmed with the user before redoing the work.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Widen `SinglesConfig.difficulty` on `SINGLES_V1` in place (the original spec and plan).
* Add `SINGLES_V2` alongside the untouched `SINGLES_V1` (chosen).

## Decision Outcome
Chosen option: "A new `SINGLES_V2` ruleset version (`SinglesV2Config`: same `order_mode`/`target_order`/`points_*` fields as V1, `difficulty` widened to `"EASY"|"HARD"|"EXTREME"`) is registered alongside the untouched `SINGLES_V1`, both served by one `SinglesTrainingEngine` class via two `GameEngineFactory` registrations (Pattern 18) and a constructor `rulesetVersionKey` parameter defaulting to `"SINGLES_V1"` — mirroring `ShanghaiEngine`'s V1/V2 split exactly. Unlike Shanghai V1 (an empty `{}` config), `SinglesConfig` already carried a `difficulty` field locked to `"EASY"`, so no `difficultyOf()`-style presence check is needed: the engine reads `config.difficulty` directly off a `Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot>` union, and V1's own narrower `"EASY"` literal type is structurally assignable into it. `applySinglesTrainingDart` gains a `hitsThisVisit` counter and a `requiredHitsFor(difficulty)` lookup (0/1/2 for EASY/HARD/EXTREME); failing the requirement at a visit's 3rd dart sets `status: "LOST"`, and `foldSinglesTrainingState` resolves the match via the existing `eliminationWinner` (Bob's 27 pattern) the instant any seat is `LOST`, ahead of the unchanged score-compare path. `record()`/`wouldComplete()` gain the same top-level `before.status !== "IN_PROGRESS"` guard `Bobs27Engine`/`ShanghaiEngine` already carry, since elimination — unlike V1's original lockstep completion — can now end the match while another seat's own status still reads `IN_PROGRESS`. `singlesTrainingSetup()`'s `createPresetSetupController` call creates every new session (even Easy) under `SINGLES_V2`, reusing V1's existing "Singles — Low to High, Easy" preset via `configOverrides` — mirroring `shanghaiSetup()`'s identical choice.".

### Consequences
`SinglesTrainingSeatState` gains `hitsThisVisit: number` (alongside unchanged `dartsThisVisit`) and its `status` widens to include `"LOST"`; `SinglesTrainingState.status` widens to include `"LOST"` — both types are shared by the one engine class across V1 and V2, but `LOST` is provably unreachable under V1's `"EASY"`-only config (`requiredHitsFor("EASY") === 0`, so the failure branch's `hitsThisVisit < 0` condition never holds), so V1's own observable behavior is byte-identical to before. `singlesTrainingPlay()`'s `resumeEngine`/`playAgain` read `rulesetVersionKey` dynamically (a `RESUMABLE_RULESET_VERSIONS` set of both versions) instead of a hardcoded `SINGLES_V1` constant, so a session started under either version resumes and replays correctly — mirroring `shanghaiPlay()`'s identical mechanism. `resultsSnapshot.status` widens to `"COMPLETE"|"TIE"|"WON"|"LOST"` via a new `resultStatusFor(finalState, ownerSeat)` helper: the failing seat's own owner (solo or 1v1) sees `LOST`; a 1v1 survivor sees `WON` when elimination (not score-compare) decided the match. `services/rulesets/registry.ts` gains `singlesTrainingV2Validator` (same `createThreeDartValidator` shape as V1, parameterised on `SinglesV2Config`, mirroring `shanghai.validator.ts`'s split); `capabilities.ts`'s `RULESET_CAPABILITIES` gains a `SINGLES_V2` entry identical to V1's. One new seed (`database/seeds/0013_singles_training_v2_game_engine_reference.sql`, a `ruleset_versions` row only) plus two appended `seeds/0007` capability rows and a new `database/verification/0013_singles_training_v2_capability_checks.sql`; the verification script requires a live Neon database and was not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. `docs/game-rules/rulesets/singles-training.md`'s Hard/Extreme rows move to a `### Hard / Extreme difficulty (V2 — implemented)` subsection under "Later versions (V2+)", mirroring `shanghai.md`'s "Target Needed (V2 — implemented)" structure, rather than being folded into "How to play (V1)".

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0013_singles_training_v2_capability_checks.sql` covers the new seed rows. `app/tests/modules/game/singles-training.golden.test.ts` exists for the engine.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-29

* `docs/superpowers/specs/2026-08-29-singles-training-hard-extreme-design.md` (§ 1, § 2): the original in-place widen design; supplies the first Considered Options entry.
* `docs/superpowers/plans/2026-08-29-singles-training-hard-extreme.md` (Goal, Architecture): the same original design.
* Commit `4f8573bb` (PR #204, 2026-08-29; adds the D247 row): no section rebuilt.
