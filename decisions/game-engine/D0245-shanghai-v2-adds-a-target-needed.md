---
id: D0245
status: accepted
date: 2026-08-28
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, fact log, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Shanghai V2 adds a Target Needed (Normal/Hard) difficulty toggle as a new ruleset version, halving a seat's running total on any zero-hit round under Hard

## Context and Problem Statement
Feature request to add a difficulty toggle to Shanghai, available under both Recreational and Analytical capture modes. `SHANGHAI_V1`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data (same reasoning as D236/D237/D243). The halved value is the running total, not the round's own score (already 0 for a target-less round under the existing rules — halving that would be a no-op); this is the actual penalty Hard mode adds. No new persisted fact or migration: the halved total is derived from the same fact log (per-dart target hits) plus the session's `difficulty` config, exactly like every other derived stat.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A new `SHANGHAI_V2` ruleset version (`ShanghaiV2Config`: `difficulty` "NORMAL"/"HARD") is registered alongside the untouched `SHANGHAI_V1`, both served by one `ShanghaiEngine` class via two `GameEngineFactory` registrations (Pattern 18) and a `difficultyOf()` config normalizer that reads `"NORMAL"` for any config with no `difficulty` key at all — every `SHANGHAI_V1` config, unaffected by construction. Under `HARD`, a round (3-dart visit) that lands zero darts in the active number's single/double/treble halves the seat's running `totalScore` (`Math.round(totalScore / 2)`, round-half-up — safe here since `totalScore` is always non-negative); a round with at least one target hit is never halved, whatever it scores. The halving check runs in `applyShanghaiDart` immediately after the 3rd dart resolves a visit, ahead of the existing Shanghai/complete/advance branch — a zero-hit visit can never also be a Shanghai (which needs all three zone kinds present), so halving never changes which of those three outcomes a visit resolves to. `foldShanghaiState` threads the normalized `difficulty` into `foldSeatStates`' fold callback via a closure, since the shared `seat-state.module.ts` helper's 2-arity signature is never widened for ruleset-specific parameters (`app/CLAUDE.md`).".

### Consequences
`ShanghaiEngine`'s constructor gains an optional 3rd param `rulesetVersionKey: RulesetVersionKey = "SHANGHAI_V1"`, replacing its previous hardcoded literal field — mirrors `OneTwentyOneEngine`'s own V1/V2 constructor shape. `shanghai-setup.data.ts` switches to `createPresetSetupController`'s `configOverrides` hook (the same idiom Singles/Doubles Training already use) to inject the player-chosen `difficulty` into both the config snapshot and the create-session overrides, and creates `SHANGHAI_V2` sessions rather than `SHANGHAI_V1`. No new `configuration_templates` preset row: `configuration_templates` carries no `ruleset_version_id` column at all, `session.service.ts`'s `createSession` resolves `templateRef` scoped only by `game_type_id` and validates the *merged* template+overrides config server-side, and `configOverrides` always supplies `difficulty` — so `SHANGHAI_V2`'s setup controller reuses V1's existing empty (`{}`) "Shanghai — Standard" preset directly. A second preset row would have been a hazard, not merely redundant: `GET /api/configuration-templates?gameType=SHANGHAI` would then return two rows, and the generic `createPresetSetupController`'s `presets[0]` pick has no field to disambiguate them by (unlike `121_V2`, which filters its own several presets on `duration_type`). One new seed (`database/seeds/0012_shanghai_v2_game_engine_reference.sql`, a `ruleset_versions` row only) plus two appended `seeds/0007` capability rows and a new `database/verification/0012_shanghai_v2_capability_checks.sql`; the verification script requires a live Neon database and was not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. Full design and implementation plan: `docs/superpowers/specs/2026-08-28-shanghai-v2-target-mode-design.md`, `docs/superpowers/plans/2026-08-28-shanghai-v2-target-mode.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-28
