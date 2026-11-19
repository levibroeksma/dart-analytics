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

# Shanghai V2 adds a Target Needed (Normal/Hard) difficulty toggle as a new ruleset version, halving a seat's running total on any zero-hit round under Hard

## Context and Problem Statement
Feature request to add a difficulty toggle to Shanghai, available under both Recreational and Analytical capture modes. `SHANGHAI_V1`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data (same reasoning as D236/D237/D243). The halved value is the running total, not the round's own score (already 0 for a target-less round under the existing rules — halving that would be a no-op); this is the actual penalty Hard mode adds. No new persisted fact or migration: the halved total is derived from the same fact log (per-dart target hits) plus the session's `difficulty` config, exactly like every other derived stat.

## Decision Drivers
* `docs/game-rules/rulesets/shanghai.md` listed variants under "Later versions (V2+)" as open-ended prose, so Target Needed was not an implemented mechanic (spec, Summary).
* `SHANGHAI_V1` is already live against real session data, so a rule change ships as a new ruleset version, as `121_V2` did (spec, Summary).

## Considered Options
* Add a new `SHANGHAI_V2` ruleset version whose Hard difficulty halves the seat's running total on a zero-hit round (chosen).
* Halve the round's own score instead of the running total (rejected).
* Edit `SHANGHAI_V1`'s config schema in place (rejected).

## Decision Outcome
Chosen option: "A new `SHANGHAI_V2` ruleset version (`ShanghaiV2Config`: `difficulty` "NORMAL"/"HARD") is registered alongside the untouched `SHANGHAI_V1`, both served by one `ShanghaiEngine` class via two `GameEngineFactory` registrations (Pattern 18) and a `difficultyOf()` config normalizer that reads `"NORMAL"` for any config with no `difficulty` key at all — every `SHANGHAI_V1` config, unaffected by construction. Under `HARD`, a round (3-dart visit) that lands zero darts in the active number's single/double/treble halves the seat's running `totalScore` (`Math.round(totalScore / 2)`, round-half-up — safe here since `totalScore` is always non-negative); a round with at least one target hit is never halved, whatever it scores. The halving check runs in `applyShanghaiDart` immediately after the 3rd dart resolves a visit, ahead of the existing Shanghai/complete/advance branch — a zero-hit visit can never also be a Shanghai (which needs all three zone kinds present), so halving never changes which of those three outcomes a visit resolves to. `foldShanghaiState` threads the normalized `difficulty` into `foldSeatStates`' fold callback via a closure, since the shared `seat-state.module.ts` helper's 2-arity signature is never widened for ruleset-specific parameters (`app/CLAUDE.md`).".

### Consequences
`ShanghaiEngine`'s constructor gains an optional 3rd param `rulesetVersionKey: RulesetVersionKey = "SHANGHAI_V1"`, replacing its previous hardcoded literal field — mirrors `OneTwentyOneEngine`'s own V1/V2 constructor shape. `shanghai-setup.data.ts` switches to `createPresetSetupController`'s `configOverrides` hook (the same idiom Singles/Doubles Training already use) to inject the player-chosen `difficulty` into both the config snapshot and the create-session overrides, and creates `SHANGHAI_V2` sessions rather than `SHANGHAI_V1`. No new `configuration_templates` preset row: `configuration_templates` carries no `ruleset_version_id` column at all, `session.service.ts`'s `createSession` resolves `templateRef` scoped only by `game_type_id` and validates the *merged* template+overrides config server-side, and `configOverrides` always supplies `difficulty` — so `SHANGHAI_V2`'s setup controller reuses V1's existing empty (`{}`) "Shanghai — Standard" preset directly. A second preset row would have been a hazard, not merely redundant: `GET /api/configuration-templates?gameType=SHANGHAI` would then return two rows, and the generic `createPresetSetupController`'s `presets[0]` pick has no field to disambiguate them by (unlike `121_V2`, which filters its own several presets on `duration_type`). One new seed (`database/seeds/0012_shanghai_v2_game_engine_reference.sql`, a `ruleset_versions` row only) plus two appended `seeds/0007` capability rows and a new `database/verification/0012_shanghai_v2_capability_checks.sql`; the verification script requires a live Neon database and was not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. Full design and implementation plan: `docs/superpowers/specs/2026-08-28-shanghai-v2-target-mode-design.md`, `docs/superpowers/plans/2026-08-28-shanghai-v2-target-mode.md`.

* Neutral, because the spec limits V2 to the difficulty toggle. Round-range and instant-win-disable stay out of scope.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Testing section names these standing checks:
* `app/tests/modules/game/shanghai.engine.module.test.ts` for the Hard halving cases.
* `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts` for config parity.
* `app/tests/lib/game/rulesets/capabilities.test.ts` for capability parity.
* `app/tests/lib/game/shanghai-setup.data.test.ts` for the `difficulty` toggle.
* `bash scripts/check-game-engines.sh`.

## Pros and Cons of the Options
### New `SHANGHAI_V2` ruleset version with a running-total halving
* Good, because the penalty has an effect: a target-less round already scores 0, so halving the round's own score would change nothing (spec, Decisions).
* Good, because `SHANGHAI_V1` stays untouched while it is live against real session data (spec, Summary).

### Halve the round's own score
* Bad, because a target-less round already scores 0, so halving it is a no-op (spec, Decisions).

### Edit `SHANGHAI_V1` in place
* Bad, because `SHANGHAI_V1` is already live against real session data (spec, Summary).

## Evidence / More Information
Decided: 2026-08-28

* `docs/superpowers/specs/2026-08-28-shanghai-v2-target-mode-design.md` (Summary, Decisions, Testing): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `3731ce45` (2026-08-28; adds the D245 row): no section rebuilt.
