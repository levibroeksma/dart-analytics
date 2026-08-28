<!--
status: canonical
scope: shanghai-v2-target-mode-design
read-when: implementing or reviewing Shanghai V2's difficulty toggle
updated: 2026-08-28
-->

# Shanghai V2 — Target Needed (Normal/Hard) — Design Spec

## Summary

New ruleset version `SHANGHAI_V2`, adding exactly one setting on top of V1's fully
locked ruleset: **Target Needed**, a `difficulty` toggle of `NORMAL` (default) or
`HARD`. Everything else — rounds 1–20, Shanghai instant win, scoring — stays
identical to V1. `SHANGHAI_V1` is left untouched: it is already live against real
session data, so V2 ships as a new ruleset version rather than an edit to
`ShanghaiConfig`, mirroring `121_V2`'s precedent.

**Rule:** in Hard mode, a round where **zero** of the 3 darts land in the active
number's single/double/treble halves the player's running total score
(round-half-up), instead of just contributing 0 for that round as it already does
under Normal. A round with at least one target hit is never penalized, whatever it
scores. Halving is per seat.

Source: `docs/game-rules/rulesets/shanghai.md`'s "Later versions (V2+)" section
listed variants as open-ended prose; this spec is what turns "Target Needed" into
an implemented mechanic.

## Decisions (resolved during brainstorming)

- **What "cut in half" halves:** the player's running total score-so-far, not the
  round's own score (which is already 0 for a target-less round under the
  existing rules — halving it would be a no-op). This is the real penalty Hard
  mode adds.
- **Rounding:** round-half-up (`Math.round(totalScore / 2)`; e.g. 15 → 8, 13 → 7).
  Since `totalScore` is always non-negative, `Math.round` alone implements this
  correctly (JS `Math.round` rounds `.5` toward `+Infinity`).
- **V2 scope:** only the difficulty toggle. Round-range and instant-win-disable
  (both flagged "Later versions" in the source doc) are explicitly out of scope
  for this change.
- **Play/results UI:** no new indicator. The running total already reflects
  halving live since it is derived state; no "Hard" badge or results-modal note
  is added.

## Persistence shape (Hard Invariant)

No change from V1: capture mode `RECREATIONAL`/`DETAILED_DARTS` or
`ANALYTICS`/`VISUAL_BOARD`, one `EXERCISE_BLOCK` stage, one `TurnFact` per round
with exactly 3 `DartFact`s. The halved total is never stored — it is derived from
the same fact log (per-dart target hits) plus the session's `difficulty` config,
exactly like every other derived stat. No new fact fields, no migration.

## Config schema

`app/src/lib/game/rulesets/types.ts`:

```ts
export const ShanghaiV2Config = z
  .object({
    difficulty: z.enum(["NORMAL", "HARD"]),
  })
  .strict();
export type ShanghaiV2ConfigData = z.infer<typeof ShanghaiV2Config>;
export type ShanghaiV2Snapshot = {
  difficulty: ShanghaiV2ConfigData["difficulty"];
};
```

`RulesetVersionKey` gains `"SHANGHAI_V2"`; `RULESET_CONFIGS` and
`ConfigSnapshotFor` gain matching entries. `ShanghaiConfig`/`ShanghaiSnapshot`
(V1) are unchanged.

`app/src/lib/game/rulesets/capabilities.ts`: `SHANGHAI_V2: [DETAILED_DARTS,
VISUAL_BOARD]` — the same two mode pairs V1 declares, which is exactly what
makes Hard mode playable under both Recreational and Analytical without any
further wiring.

## Engine (`modules/game/shanghai.engine.module.ts`)

Extended in place — one file serves both ruleset versions, mirroring
`one-twenty-one.engine.module.ts`'s V1/V2 split:

- `type ShanghaiEngineConfig = Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>`.
- `function difficultyOf(config: ShanghaiEngineConfig): "NORMAL" | "HARD"` —
  reads `config.difficulty` when the key is present (V2), defaults to `"NORMAL"`
  when it is absent (every V1 config, whose schema has no `difficulty` key at
  all) — a V1-created engine behaves byte-for-byte as it does today.
- `applyShanghaiDart(state, observation, difficulty)` gains the `difficulty`
  param. At the existing 3rd-dart resolution point — after `dartsThisVisit`
  reaches length 3, before the Shanghai/complete/advance branch — insert: if
  `difficulty === "HARD"` and `dartsThisVisit.every((z) => z === null)` (no
  target hit landed all visit), replace `totalScore` with
  `Math.round(totalScore / 2)`. This sits ahead of the existing
  Shanghai/complete/advance branch since halving never changes which of those
  three a visit resolves to — a Shanghai requires all three zone kinds present
  (impossible on a target-less visit) and round-advance is score-independent.
- `foldShanghaiState`/`ShanghaiSeatState` fold threads `difficultyOf(config)`
  into every `applyShanghaiDart` call.
- `ShanghaiEngine`'s constructor takes an optional 3rd param
  `rulesetVersionKey: RulesetVersionKey = "SHANGHAI_V1"` (same pattern as
  `OneTwentyOneEngine`), stored and used to read `this.rulesetVersionKey`.
- Second factory `shanghaiV2EngineFactory` (`rulesetVersionKey: "SHANGHAI_V2"`,
  `create: (config, prior) => new ShanghaiEngine(config, prior, "SHANGHAI_V2")`),
  registered alongside the existing `shanghaiEngineFactory`.

## Server validator & registry

`app/src/services/rulesets/shanghai/shanghai.validator.ts`: `shanghaiValidator`
already wraps `createThreeDartValidator({ configSchema: ShanghaiConfig, ... })`
as a factory call — reuse it with `ShanghaiV2Config` for a new
`shanghaiV2Validator` export. `app/src/services/rulesets/registry.ts` gets
`SHANGHAI_V2: shanghaiV2Validator` — same pattern as `121_V1`/`121_V2`'s two
registry rows.

## Setup UI

- `app/src/lib/game/types.ts`: `ShanghaiSetupContext` changes from a bare
  `PresetSetupContext` alias to `PresetSetupContext & { difficulty: "NORMAL" |
  "HARD" }` — same shape as `SinglesTrainingSetupContext`'s `orderMode`
  addition.
- `app/src/lib/game/shanghai-setup.data.ts`: switches
  `rulesetVersionKey` to `"SHANGHAI_V2"`, adds `difficulty: "NORMAL" as
  ShanghaiSetupContext["difficulty"]` state, and passes
  `configOverrides: (ctx) => ({ difficulty: ctx.difficulty })` to
  `createPresetSetupController` — the same idiom
  `singles-training-setup.data.ts`/`doubles-training-setup.data.ts` already use
  for their one injected field. No hand-written setup controller needed (unlike
  121_V2 — Shanghai's toggle needs no extra numeric field or per-mode preset
  lookup).
- `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`: adds a
  `SettingSectionShell` containing a horizontal `Toggle` (`options: [{value:
  "NORMAL", label: "Normal"}, {value: "HARD", label: "Hard"}]`, `x-model=
  "difficulty"`), same placement/wiring pattern as
  `OneTwentyOneSetupForm.astro`'s format toggle.
- No play/results UI changes (see Decisions).

## Database (seed-only, no schema migration)

New `database/seeds/0012_shanghai_v2_game_engine_reference.sql`:

- `ruleset_versions` row — implementation key `SHANGHAI_V2`, same
  `game_type_id` as `SHANGHAI_V1` (no new `game_types` row).
- `configuration_templates` — one system preset, `configuration: {"difficulty":
  "NORMAL"}`.
- Mirrors `0011_one_twenty_one_v2_game_engine_reference.sql`'s shape and
  comment structure (UUID allocation continuing the established range, no
  `game_type_features` row — same reasoning as V1's).

Capability rows (`SHANGHAI_V2` + `RECREATIONAL`/`DETAILED_DARTS`, `SHANGHAI_V2`
+ `ANALYTICS`/`VISUAL_BOARD`) appended to
`database/seeds/0007_ruleset_version_capabilities.sql`, the single running
capability ledger every ruleset appends to.

New `database/verification/0012_shanghai_v2_capability_checks.sql`, mirroring
`0011_one_twenty_one_v2_capability_checks.sql`.

`app/src/lib/game/rulesets/games-visibility.ts`'s `GAME_CARDS` entry for
Shanghai is left pointing at `SHANGHAI_V1` — unchanged. This mirrors the
established 121_V2 precedent: the card's `rulesetVersionKey` only gates
capability-based visibility (identical mode pairs on both versions), while the
setup data's own hardcoded `rulesetVersionKey` decides which version new
sessions actually create.

## Testing

- Engine unit tests (extending `app/tests/modules/game/shanghai.engine.module.test.ts`):
  a target-less round halves the running total under `HARD` (including the
  round-half-up case, e.g. total 15 → 7.5 → 8); a round with ≥1 target hit is
  never halved under `HARD`, whatever it scores; `NORMAL` difficulty is a
  complete no-op versus current behavior; a `SHANGHAI_V1` config (no
  `difficulty` key at all) folds identically to today via `difficultyOf`'s
  default; a Shanghai (all 3 zone kinds hit) is unaffected by difficulty since
  it can never coincide with a zero-hit visit.
- `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`: parity
  extension for `SHANGHAI_V2`'s config schema.
- `app/tests/lib/game/rulesets/capabilities.test.ts`: `SHANGHAI_V2` capability
  parity (code vs. seed).
- `app/tests/lib/game/shanghai-setup.data.test.ts`: `difficulty` toggle flows
  into `configOverrides` and the created session's config snapshot.
- `bash scripts/check-game-engines.sh` green (new ruleset version + validator
  land in the same commit).

## Open questions carried from V1 (not blocking V2)

- Multiplayer tie-break when two players Shanghai in the same round — still
  deferred with multiplayer itself; Hard mode's halving does not change this,
  since a Shanghai always short-circuits the match regardless of either seat's
  total.
