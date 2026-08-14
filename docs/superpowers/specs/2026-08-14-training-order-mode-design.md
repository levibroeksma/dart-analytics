# Singles/Doubles Training Order Mode — Design

Status: draft — pending user review
Date: 2026-08-14

## Scope

Add an editable target-order setting to Singles Training and Doubles Training setup, identical in both games:

- **Low → High** (default, today's only value): `1, 2, …20, BULL`
- **High → Low**: `BULL, 20, 19, …1` — BULL leads, not trails
- **Random**: all 21 targets (1–20 + BULL) shuffled together, BULL can land anywhere

The chosen sequence is resolved once at session creation and stored in the session's immutable config snapshot, so resume and undo replay the same order — never reshuffled mid-session. Play Again always mints a fresh session, so Random gets a fresh shuffle there too.

## Out of scope

- Difficulty variants (Hard/Extreme/Professional for Singles; Hard/Challenge for Doubles)
- Multiplayer
- Bob's 27 — shares one helper module with Doubles Training but not its config shape or setup; verified no code path there needs to change

## 1. Config schema

`app/src/lib/game/rulesets/types.ts`. Both `SinglesConfig` and `DoublesTrainingConfig` currently lock `order_mode: z.enum(["LOW_TO_HIGH"])`. Widen both identically:

```ts
order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
target_order: z.array(z.number().int()).length(21),
```

`target_order` gets a `.superRefine` requiring it to be a permutation of `[1..20, 25]` — 25 reuses the existing `BULL_TARGET_NUMBER` sentinel (`board-progression.module.ts`) rather than inventing a new one. `order_mode` stays descriptive; `target_order` is the concrete, already-resolved sequence the engine actually plays. This mirrors 501's `starting_score` precedent: the config `overrides` path (`POST /api/sessions`, `06-API/04-Endpoint-Contracts.md` §Discriminated config input) already merges arbitrary overrides onto a template and re-validates — no API/endpoint change needed.

Adding the `.superRefine` requires a matching entry in `refinement-contract.ts` (`scripts/check-refinement-coverage.sh` gate) with accept/reject probes: accept a valid permutation, reject a duplicate value and a wrong-length array.

`ConfigSnapshotFor`'s camelCase snapshot types (`SinglesSnapshot`, `DoublesTrainingSnapshot`) gain `orderMode`/`targetOrder` — `config-codec.ts`'s `mapKeys` is fully generic, so no manual wiring needed (same as 501's `starting_score` → `startingScore`).

## 2. Shared target-order helper

New `app/src/lib/game/target-order.ts`, used identically by both games' setup data — this is what makes the two games' options the same, by sharing code rather than parallel copies:

```ts
export function ascendingTargetOrder(): number[]; // [1..20, 25]
export function descendingTargetOrder(): number[]; // [25, 20, 19, …1]
export function randomTargetOrder(): number[]; // Fisher–Yates shuffle of the 21 values
export function targetOrderFor(mode: "LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM"): number[];
```

`Math.random()`-based shuffle — no cryptographic requirement for ordering dart targets.

## 3. Engine changes

`board-progression.module.ts`: `numbersPath()` / `doublesPath()` gain an **optional** `order?: readonly number[]` parameter — build the 21-target path from it when given, else fall back to today's fixed ascending array. Bob's 27's two call sites (`bobs27.engine.module.ts`) keep calling with no arguments and are unaffected.

**Completion logic unifies.** Singles currently completes when `target.kind === "BULL"`; since BULL can now sit anywhere in the path, this becomes index-based — `targetIndex === 20` (last of 21) — exactly matching Doubles' existing hardcoded check. Net simplification, not just a workaround.

`applyDoublesTrainingDart` currently takes no config (order was always fixed); it gains a `config: DoublesTrainingSnapshot` parameter to read `targetOrder`, mirroring `applySinglesTrainingDart`'s existing shape (which already threads config through, just wasn't using it for path). `DoublesTrainingEngine`'s constructor currently *deliberately discards* its config with a JSDoc explaining why nothing reads it (`_config` unused, avoiding a `ts(6138)` warning) — that comment becomes false and the config must now be retained and threaded through `deriveState()`, `record()`, `wouldComplete()`.

Both engines' `record()` methods call `numbersPath(config.targetOrder)` / `doublesPath(config.targetOrder)` in place of the current no-arg calls. Fact-log shape is unchanged — no new fields on `DartFact`/`TurnFact`; `target_order` lives in config, never in the fact log (config is "what configuration this session used," not gameplay that happened).

## 4. Setup UI

`SinglesTrainingSetupForm.astro` / `DoublesTrainingSetupForm.astro` (currently zero editable settings) each gain the same `Toggle` block 501 already uses for its starting-score picker, inside a new `SettingSectionShell`:

```astro
<Toggle
  orientation="horizontal"
  options={[
    { value: "LOW_TO_HIGH", label: "Low → High" },
    { value: "HIGH_TO_LOW", label: "High → Low" },
    { value: "RANDOM", label: "Random" },
  ]}
  x-model="orderMode"
  class="w-full"
/>
```

Identical markup/options/labels in both forms.

`singles-training-setup.data.ts` / `doubles-training-setup.data.ts` add:

- `orderMode: "LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM"`, default `"LOW_TO_HIGH"` — plain reactive field, not `$persist`ed (matches 501's `startingScoreOption` precedent, not the `.form.ts` draft-preference pattern)

`start()` computes `target_order` from the shared helper and sends both as overrides, same shape as 501:

```ts
const targetOrder = targetOrderFor(this.orderMode);
// …
overrides: { order_mode: this.orderMode, target_order: targetOrder }
```

The local `wire`/`toSnapshot()` build follows 501's pattern exactly (spread preset config, then override the two keys) so the client's `configSnapshot` matches what the server materializes.

## 5. Play Again

`play-lifecycle.ts`'s shared `runPlayAgain` currently sends zero overrides — its own doc comment says "every current adopter of this module has zero editable settings," which stops being true. Only Singles Training and Doubles Training call `runPlayAgain` today (verified — no other ruleset uses it), so this is a contained change to shared code:

`runPlayAgain` gains an optional `buildOverrides` callback, called with the previous session's `configSnapshot` and included in the new session's `config.overrides` when provided. Singles/Doubles pass a callback that reads the prior `orderMode` off the outgoing snapshot and recomputes `target_order` via `targetOrderFor` — a fresh shuffle every time for Random, a re-derived (identical) sequence for the two deterministic modes. Callers that omit the callback keep today's exact behavior (no overrides) — no regression for any future adopter that genuinely has zero editable settings.

## 6. Seed data

`database/seeds/0002_default_templates.sql`: the single seeded preset row for `SINGLES_V1` and for `DOUBLES_TRAINING_V1` each gain `"order_mode": "LOW_TO_HIGH"` (already present) plus `"target_order": [1,2,…20,25]` so the preset independently satisfies the now-stricter `.strict()` schema, matching 501's precedent where every preset key stands alone as a valid config. No new preset rows — `start()` always overrides both keys regardless, same as 501's single base preset.

## 7. Docs

`docs/game-rules/rulesets/singles-training.md` / `doubles-training.md` (non-canonical, but the source of the bull-placement rules confirmed above):

- Features table: Order rows (`high → low`, `randomized`) flip from `TBD` to `v1`
- Config & presets table: Order row flips from "Shown, locked" to "Editable"
- "Later versions (V2+)" bullets for Order move up into the V1 "How to play" section
- Glossary `High → Low` / `Random` rows' Version column: `V2+` → `V1`

No architecture-doc changes needed: no new table/column (config stays `jsonb`), no new stage type, no capture/input mode change (`RECREATIONAL + DETAILED_DARTS` unchanged for both), `GameEngine` contract members (`04-Architecture-patterns.md` Pattern 18) unchanged in shape.

## 8. Testing

- `target-order.ts`: unit tests for `ascendingTargetOrder`/`descendingTargetOrder` (exact arrays) and `randomTargetOrder` (permutation property — same 21 values, order varies across calls)
- Refinement contract: accept a valid permutation, reject a duplicate value, reject wrong length
- `board-progression.module.test.ts`: `numbersPath(order)`/`doublesPath(order)` build the expected path from a given order; no-arg calls unchanged (Bob's 27 regression guard)
- Engine tests: both engines' completion now fires at `targetIndex === 20` regardless of what target sits there — add a High→Low case (BULL first) proving the session does *not* complete after the first visit, and completes after the 21st; add a Random case with BULL mid-sequence proving the same
- `singles-training-setup.data.ts` / `doubles-training-setup.data.ts` tests: `start()` override payload carries `order_mode`/`target_order` for each toggle value
- `play-lifecycle.test.ts`: `runPlayAgain` with and without `buildOverrides` — omitted case unchanged, provided case's overrides land in `createSession`'s call
- No `GameEngine` contract shape change — `check-game-engines.sh` unaffected

## Files touched

- New: `app/src/lib/game/target-order.ts`
- Edited: `app/src/lib/game/rulesets/types.ts`, `app/src/lib/game/rulesets/refinement-contract.ts`, `app/src/modules/game/board-progression.module.ts`, `app/src/modules/game/singles-training.engine.module.ts`, `app/src/modules/game/doubles-training.engine.module.ts`, `app/src/lib/game/play-lifecycle.ts`, `app/src/lib/game/singles-training-setup.data.ts`, `app/src/lib/game/doubles-training-setup.data.ts`, `app/src/lib/game/singles-training-play.data.ts`, `app/src/lib/game/doubles-training-play.data.ts`, `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`, `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- Seed: `database/seeds/0002_default_templates.sql`
- Docs: `docs/game-rules/rulesets/singles-training.md`, `docs/game-rules/rulesets/doubles-training.md`
- New/updated tests under `app/tests/` mirroring the above paths
