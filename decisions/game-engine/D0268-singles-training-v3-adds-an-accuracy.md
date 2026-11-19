---
id: D0268
status: accepted
date: 2026-09-12
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Singles Training V3 adds an Accuracy scoring mode as a new ruleset version, not a V2 config widen

## Context and Problem Statement
Feature request to add a "large single ring only" precision-training mode to Singles Training, combinable with the existing Hard/Extreme difficulty. `SINGLES_V2`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data (same reasoning as D243/D245/D247). Clarifying questions resolved before implementation: keypad capture cannot support Accuracy at all (only VISUAL_BOARD's coordinate capture distinguishes outer/inner single), so the setup toggle is hidden under keypad app mode and the validator rejects the combination server-side as defense in depth; the bull, having no outer-single equivalent, scores a point on either ring under Accuracy; Accuracy is combinable with Hard/Extreme rather than mutually exclusive.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A new `SINGLES_V3` ruleset version (`SinglesV3Config`: same `order_mode`/`target_order`/`difficulty`/`points_*` fields as V2, plus `scoring_mode` `"STANDARD"|"ACCURACY"`) is registered alongside the untouched `SINGLES_V1`/`SINGLES_V2`, all three served by one `SinglesTrainingEngine` class via three `GameEngineFactory` registrations (Pattern 18) and a `scoringModeOf()` config normalizer that reads `"STANDARD"` for any config with no `scoringMode` key at all — every `SINGLES_V1`/`SINGLES_V2` config, unaffected by construction. Under `ACCURACY`, `trainingPointsFor` delegates to a new `accuracyPointsFor(target, observation)`: 1 point for an `OUTER_SINGLE` hit on the matching NUMBER target, or an `OUTER_BULL`/`INNER_BULL` hit on the BULL visit (the bull has no "outer single" equivalent, so either ring counts); 0 for everything else, including a genuine hit on the wrong ring or the wrong target. `isHitOnTarget` (the Hard/Extreme mandatory-hit bust check) is unchanged — "landed in the section at all" already meant something independent of point value, so Accuracy combines with Hard/Extreme with zero engine changes to the bust logic itself. `singlesTrainingV3Validator` composes `createThreeDartValidator` (per `three-dart.validator.ts`'s own stated guidance to compose rather than fork) and adds one extra rule: `scoring_mode: "ACCURACY"` is rejected outright under any capture pair other than `ANALYTICS`+`VISUAL_BOARD`, since the per-dart keypad (`RECREATIONAL`+`DETAILED_DARTS`) only ever emits a generic `SINGLE` zone key with no inner/outer distinction. `singlesTrainingSetup()`'s `configOverrides` sends `scoring_mode` only on the non-guested branch (which resolves to `SINGLES_V3`) — the guested branch still resolves to `SINGLES_V1`, whose `.strict()` schema has no such key, so sending it unconditionally would reject every guest/bot session at `toSnapshot`.".

### Consequences
`SinglesEngineConfig` widens to `Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot> | Seated<SinglesV3Snapshot>`; `singles-training-play.data.ts` carries its own unavoidable duplicate of `scoringModeOf`/`accuracyPointsFor` across the module boundary (the same duplication `SINGLE_ZONE_KEYS`/`trainingPointsFor` already had for V1/V2), used only for the play page's own hit/miss preview highlighting. `RESUMABLE_RULESET_VERSIONS` and `playAgain`'s wire-object builder (a `"scoringMode" in priorConfig` presence check, mirroring `configOverrides`'s guested/non-guested split) both gain `SINGLES_V3` support so a session started under any of the three versions resumes and replays correctly. `services/rulesets/registry.ts` gains `singlesTrainingV3Validator`; `capabilities.ts`'s `RULESET_CAPABILITIES` gains a `SINGLES_V3` entry identical to V1/V2's two declared pairs — no `RULESET_DARTBOT` entry, so `SINGLES_V3` stays solo-only, the same pre-existing gap `SINGLES_V2` has (`FINDINGS.md` F69, not fixed here). One new seed (`database/seeds/0018_singles_training_v3_game_engine_reference.sql`, a `ruleset_versions` row only) plus two appended `seeds/0007` capability rows and a new `database/verification/0031_singles_training_v3_capability_checks.sql` (numbered 0031, not 0018 — `verification/0018_visual_board_checks.sql` already occupies that slot for an unrelated migration-scoped check); the verification script requires a live Neon database and was not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. `docs/game-rules/rulesets/singles-training.md` gains a `### Accuracy mode (V3 — implemented)` subsection under "Later versions (V2+)", mirroring `### Hard / Extreme difficulty (V2 — implemented)`'s structure. Full design and implementation plan: `docs/superpowers/specs/2026-09-12-singles-training-accuracy-mode-design.md`, `docs/superpowers/plans/2026-09-12-singles-training-accuracy-mode.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-12
