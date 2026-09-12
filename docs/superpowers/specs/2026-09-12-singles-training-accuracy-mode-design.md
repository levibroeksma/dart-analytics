# Singles Training — Accuracy Mode Design

Status: approved (brainstorming). Scope: engine, config, setup UI, play data, seeds, docs for a new Singles Training scoring mode. New ruleset version `SINGLES_V3` (solo only, mirroring `SINGLES_V2`'s current scope).

Source: `docs/game-rules/rulesets/singles-training.md`, `app/src/modules/game/singles-training.engine.module.ts`, `app/src/lib/game/singles-training-play.data.ts`, `app/src/lib/game/rulesets/types.ts`, `app/src/services/rulesets/singles-training/singles-training.validator.ts`, `decisions/game-engine.md` D247 (V2 precedent), `FINDINGS.md` F69.

## 1. Scope & Non-Goals

**In scope:** a `scoring_mode` toggle — `STANDARD` (today's ring-quality scoring, byte-identical) and `ACCURACY` (1 point for the outer/large single on a number target, or either bull ring; 0 for everything else — miss, double, treble, inner single, wrong target). Setup screen gets a third horizontal toggle, default `STANDARD`. Combinable with the existing Hard/Extreme difficulty: the mandatory-hit bust check stays "landed anywhere in the section," independent of which ring actually scores.

**Non-goals (deferred):** fixing F69 (guest/bot setup not hiding the difficulty toggle) — `SINGLES_V3` inherits the same solo-only scope `SINGLES_V2` has today, unrelated bug, not this task's to fix. Any change to `SINGLES_V1`/`SINGLES_V2` behavior. A keypad-capture version of Accuracy — keypad (`RECREATIONAL`+`DETAILED_DARTS`) only ever records a generic `SINGLE` zone key with no inner/outer distinction, so Accuracy is coordinate-capture-only (`ANALYTICS`+`VISUAL_BOARD`).

## 2. Config / Data Model

`app/src/lib/game/rulesets/types.ts` — new schema, carrying every `SinglesV2Config` field unchanged plus one new field (same reasoning D243/D245/D247 give for not widening a shipped version's schema in place):

```ts
export const SinglesV3Config = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
    difficulty: z.enum(["EASY", "HARD", "EXTREME"]),
    scoring_mode: z.enum(["STANDARD", "ACCURACY"]),
    points_single: z.number().int().default(1),
    points_double: z.number().int().default(2),
    points_treble: z.number().int().default(3),
  })
  .strict()
  .superRefine(/* same target_order check as V1/V2 */);
```

`RulesetVersionKey` gains `"SINGLES_V3"`; `RULESET_CONFIGS`, `ConfigSnapshotFor` gain the matching branch. New snapshot type:

```ts
export type SinglesV3Snapshot = {
  orderMode: SinglesV3ConfigData["order_mode"];
  targetOrder: SinglesV3ConfigData["target_order"];
  difficulty: SinglesV3ConfigData["difficulty"];
  scoringMode: SinglesV3ConfigData["scoring_mode"];
  pointsSingle: SinglesV3ConfigData["points_single"];
  pointsDouble: SinglesV3ConfigData["points_double"];
  pointsTreble: SinglesV3ConfigData["points_treble"];
};
```

No seed/preset changes beyond a new `ruleset_versions` row: same "one preset per game type" pattern as V2 — the setup screen supplies `order_mode`/`target_order`/`difficulty`/`scoring_mode` via `configOverrides` on top of the existing "Singles — Low to High, Easy" preset.

## 3. Engine (`singles-training.engine.module.ts`)

`SinglesEngineConfig` widens to `Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot> | Seated<SinglesV3Snapshot>`.

Presence-check helper, mirroring `shanghai.engine.module.ts`'s `difficultyOf`:

```ts
function scoringModeOf(config: SinglesEngineConfig): "STANDARD" | "ACCURACY" {
  return "scoringMode" in config ? config.scoringMode : "STANDARD";
}
```

`trainingPointsFor` branches at the top on `scoringModeOf(config)`; `STANDARD` keeps its existing body unchanged. New function for the other branch:

```ts
function accuracyPointsFor(
  target: BoardTarget,
  observation: DartObservation,
): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    return observation.hitZoneKey === "OUTER_BULL" ||
      observation.hitZoneKey === "INNER_BULL"
      ? 1
      : 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  return observation.hitZoneKey === "OUTER_SINGLE" ? 1 : 0;
}
```

`isHitOnTarget` (Hard/Extreme's mandatory-hit check) is unchanged — it already means "landed in the section at all," and stays that meaning under Accuracy too. Nothing else in the engine (seat state shape, `foldSinglesTrainingState`, `record`/`undo`/`wouldComplete`) changes: the existing `Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot>` union already threads through every function generically, so widening it to include `SinglesV3Snapshot` is the only structural change needed.

New factory registration, same pattern as `singlesTrainingV2EngineFactory`:

```ts
export const singlesTrainingV3EngineFactory: GameEngineFactory<
  Seated<SinglesV3Snapshot>,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V3",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesV3Snapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior, "SINGLES_V3");
  },
};
registerEngineFactory(singlesTrainingV3EngineFactory);
```

## 4. Validator (`singles-training.validator.ts`)

`createThreeDartValidator` only cross-checks the capture/input pair against a fixed allowlist (`DETAILED_DARTS` or `VISUAL_BOARD`) — it has no way to look inside `config` for `scoring_mode`. `SINGLES_V3` needs one extra rule: `ACCURACY` is invalid under keypad capture. Compose, per `three-dart.validator.ts`'s own guidance ("a ruleset needing more than these assertions composes rather than forks"):

```ts
export const singlesTrainingV3Validator: RulesetValidator = (() => {
  const base = createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV3Config,
    dartlessIssue: DARTLESS_ISSUE,
  });
  return {
    ...base,
    validateConfig(input) {
      const result = base.validateConfig(input);
      if (
        result.valid &&
        result.config.scoring_mode === "ACCURACY" &&
        !isVisualBoardCapture(input.captureModeKey, input.inputModeKey)
      ) {
        return {
          valid: false,
          issues: [
            "Singles Training Accuracy mode requires ANALYTICS + VISUAL_BOARD capture",
          ],
        };
      }
      return result;
    },
  };
})();
```

`isVisualBoardCapture` is already exported from `visual-board.validator.ts` and already imported into `three-dart.validator.ts`.

`services/rulesets/registry.ts` registers `singlesTrainingV3Validator` under `"SINGLES_V3"`.

## 5. Capabilities

`rulesets/capabilities.ts`: `RULESET_CAPABILITIES.SINGLES_V3 = [DETAILED_DARTS, VISUAL_BOARD]` — same two declared pairs as V1/V2 (the `ACCURACY`-under-keypad rejection lives in the validator, not here — this table says which pairs the engine implements at all, and `STANDARD` under `SINGLES_V3` works fine under either). No `RULESET_DARTBOT` entry — stays solo-only, same gap `SINGLES_V2` has today (F69).

## 6. Setup UI

`app/src/lib/game/types.ts`: `SinglesTrainingSetupContext` gains `scoringMode: SinglesV3ConfigData["scoring_mode"]`.

`app/src/lib/game/singles-training-setup.data.ts`:

```ts
export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    scoringMode: "STANDARD" as SinglesTrainingSetupContext["scoringMode"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: (ctx) => (guested(ctx) ? "SINGLES_V1" : "SINGLES_V3"),
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) =>
        guested(ctx)
          ? {
              order_mode: ctx.orderMode,
              target_order: targetOrderFor(ctx.orderMode),
              difficulty: ctx.difficulty,
            }
          : {
              order_mode: ctx.orderMode,
              target_order: targetOrderFor(ctx.orderMode),
              difficulty: ctx.difficulty,
              scoring_mode: ctx.scoringMode,
            },
    }),
    addGuest(this: SinglesTrainingSetupContext) {
      if (addTypedGuest(this)) {
        this.difficulty = "EASY";
        this.scoringMode = "STANDARD";
      }
    },
    addBot(this: SinglesTrainingSetupContext) {
      if (addBotOpponent(this)) {
        this.difficulty = "EASY";
        this.scoringMode = "STANDARD";
      }
    },
  };
}
```

The guested branch must omit `scoring_mode` entirely — `SinglesConfig` (V1) is `.strict()` with no such key, so sending it unconditionally would reject every guest/bot session at `toSnapshot`.

`SinglesTrainingSetupForm.astro`: a third `Toggle` row, wrapped in a capture-mode guard (same `x-show`+`x-cloak` idiom `AddGuestButton.astro` already uses):

```astro
const scoringModeOpts = [
  { value: "STANDARD", label: "Standard" },
  { value: "ACCURACY", label: "Accuracy" },
];
```

```astro
<div x-show="$store.settings.captureModeKey === 'ANALYTICS'" x-cloak>
  <label class={labelClass}>Scoring</label>
  <Toggle
    orientation="horizontal"
    options={scoringModeOpts}
    x-model="scoringMode"
    class="w-full"
  />
</div>
```

Under keypad app mode the toggle is hidden and `scoringMode` stays its `STANDARD` default, so a keypad session never sends `ACCURACY`.

`InfoSection` description gains one sentence: "Accuracy mode only scores the outer (large) single ring on a number target, or either bull ring — misses, doubles, trebles, the inner single, and the wrong target all score nothing."

## 7. Play Data (`singles-training-play.data.ts`)

`SinglesConfigSnapshot` widens to `SinglesSnapshot | SinglesV2Snapshot | SinglesV3Snapshot`. `RESUMABLE_RULESET_VERSIONS` gains `"SINGLES_V3"`.

The file's own duplicated `trainingPointsFor` (used only for preview-segment hit/miss highlighting — the design spec for Hard/Extreme already flagged this duplication as unavoidable across the module boundary) gets the identical `scoringModeOf`/`accuracyPointsFor` branch as the engine's copy. `previewSegmentsFor` needs no other change — it already just checks `trainingPointsFor(...) > 0`.

`targetHitCounts`/`singleCountFor`/`doubleCountFor`/`trebleCountFor`/`missCountFor` are unaffected: they're descriptive ring-category counts (did this dart land on the section, and with which ring), not point totals, and keep the same meaning regardless of scoring mode.

`playAgain`'s wire-object builder gains the same presence-check as `configOverrides`:

```ts
(priorConfig) => {
  const targetOrder = targetOrderFor(priorConfig.orderMode);
  return {
    snapshot: { ...priorConfig, targetOrder },
    wire: {
      order_mode: priorConfig.orderMode,
      target_order: targetOrder,
      difficulty: priorConfig.difficulty,
      ...("scoringMode" in priorConfig
        ? { scoring_mode: priorConfig.scoringMode }
        : {}),
    },
  };
};
```

## 8. Seeds

New `database/seeds/0018_singles_training_v3_game_engine_reference.sql` (next free number after `0017`), same shape as `0013`'s `SINGLES_V2` row: one `ruleset_versions` insert under the existing `SINGLES_TRAINING` game type, no new `configuration_templates`/`game_type_features`/`exercise_templates` row. `seeds/0007_ruleset_version_capabilities.sql` gets two appended rows (`SINGLES_V3` + `DETAILED_DARTS`, `SINGLES_V3` + `VISUAL_BOARD`). New `database/verification/0018_singles_training_v3_capability_checks.sql` asserting those rows, mirroring `0013`'s.

## 9. Docs

`docs/game-rules/rulesets/singles-training.md`:
- Features table: add a row "Accuracy mode: only outer single / either bull ring scores" at `V3`.
- New `### Accuracy mode (V3 — implemented)` subsection under "Later versions (V2+)", describing the scoring rule and the `ANALYTICS`+`VISUAL_BOARD`-only restriction.
- Config & presets table: add a `Scoring` row, "Editable", values `STANDARD` (default) / `ACCURACY`.

Context-maintenance pass (root `CLAUDE.md`) at implementation time: context map / `decisions/game-engine.md` entry (new decision, `Supersedes:` not needed — this is additive, not a reversal) / findings as needed.

## 10. Testing Plan

**Engine (`singles-training.engine.module.test.ts`):**
- `accuracyPointsFor`: outer single on the right number → 1; inner single, double, treble, wrong number, miss → 0; outer bull and inner bull → 1 each; wrong-target bull-number combos → 0.
- `scoringModeOf`: absent on V1/V2 configs → `"STANDARD"`; present on V3 → its own value.
- `STANDARD` under `SINGLES_V3` is byte-identical to `SINGLES_V2`'s existing scoring (regression check).
- Hard/Extreme mandatory-hit check is unaffected by `scoring_mode` — a visit landing an inner single (0 accuracy points) still counts as a "hit" for the bust threshold.

**Validator (`singles-training.validator.test.ts`):** `SinglesV3Config` accepts `scoring_mode: "STANDARD"|"ACCURACY"`, rejects anything else. `singlesTrainingV3Validator.validateConfig` rejects `ACCURACY` under `RECREATIONAL`+`DETAILED_DARTS`, accepts it under `ANALYTICS`+`VISUAL_BOARD`, and still accepts `STANDARD` under either.

**Setup/play data tests:** `singles-training-setup.data.test.ts` — `scoringMode` override reaches `configOverrides` only on the non-guested branch; guested `configOverrides` never contains a `scoring_mode` key. `singles-training-play.data.test.ts` — play-data's own `trainingPointsFor` copy scores identically to the engine's for the same inputs under both modes; `playAgain`'s wire object carries `scoring_mode` only when replaying a `SINGLES_V3` session.

**Capability parity test** (existing, generic): `SINGLES_V3` rows in `capabilities.ts` and `seeds/0007` agree.

## 11. Open Questions

None blocking.
