# Singles Training — Frontend Design

Status: approved (brainstorming). Scope: setup page, play page, results, games-index card. Reuses the existing `SinglesTrainingEngine`, `singlesTrainingValidator`, and `SINGLES_V1: [DETAILED_DARTS]` capability as-is — no engine/validator/capability changes.

Source: `docs/game-rules/rulesets/singles-training.md`, `docs/superpowers/specs/2026-07-24-singles-training-engine-design.md`, `app/src/modules/game/singles-training.engine.module.ts`. Pattern precedent: Bob's 27 Phases 3-4 (`docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`), adapted for DETAILED_DARTS-only (no `VISUAL_BOARD`, no board component, no reveal-then-clear timer).

## 1. Scope & Non-Goals

**In scope:** setup page (locked config, zero editable settings), play page (tap-based dart entry, target-aware S/D/T/Miss vs Bull/Bullseye/Miss), 3-dart visit preview, results (total training points only), games-index card, session lifecycle (create/reconcile/continue/abandon/complete/play-again) mirroring Bob's 27's shape.

**Non-goals (deferred, per ruleset doc):** HIGH_TO_LOW/RANDOM order, HARD/EXTREME/PROFESSIONAL difficulty, multiplayer, per-target results breakdown, `VISUAL_BOARD` input (not a declared capability for `SINGLES_V1`).

**GAME_TYPE_KEY:** `SINGLES_TRAINING` (seed `0003_game_engine_reference.sql`). **RULESET_VERSION_KEY:** `SINGLES_V1`.

## 2. Games Index Card

`app/src/lib/game/rulesets/games-visibility.ts`, append to `GAME_CARDS`:

```ts
{
  rulesetVersionKey: "SINGLES_V1",
  href: "/games/singles-training/setup",
  title: "Singles training",
  caption: "Section training, one target at a time.",
},
```

No other change — `visibleGames` already filters on `supportsCaptureMode`, which already declares `SINGLES_V1` under `DETAILED_DARTS` (`RECREATIONAL` capture mode).

## 3. Setup Page

`app/src/pages/games/singles-training/setup/index.astro` — same shape as `pages/games/bobs27/setup/index.astro` (`AppLayout`, `ContinueSessionModal`, reconciliation-failed alert, `IsLoading`), swapped to `singlesTrainingSetup()` / `SinglesTrainingSetupForm`.

`app/src/lib/game/singles-training-setup.data.ts` — mirrors `bobs27-setup.data.ts` verbatim in shape: `presets`/`loading`/`error`/`activeSession`/`showActiveSessionModal`/`loadingReconciliation`/`reconciliationFailed` state; `init()` fetches the one seeded preset + active sessions, reconciles; `continueSession()`, `abandonSession()`, `start()` (sends `config: { source: "template", templateRef }`, no overrides — V1 has zero editable settings, same rule Bob's 27 follows). `GAME_TYPE_KEY = "SINGLES_TRAINING"`, `RULESET_VERSION_KEY = "SINGLES_V1"`.

`app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro` — `SetupShell` + `UserSection` + `InfoSection` only (no settings block; ruleset doc marks Players/Order/Difficulty/Points all "Shown, locked"). `InfoSection` copy: title "Singles training rules", description drawn from the ruleset doc's Identity section (one target at a time, three darts each, training points S=1/D=2/T=3, bull outer=1/inner=2).

`Bobs27SetupContext`-equivalent type (`SinglesTrainingSetupContext`) added to `app/src/lib/game/types.ts`, registered in `register-route-data.ts` as `Alpine.data("singlesTrainingSetup", ...)`.

## 4. Play Page — Display

`app/src/components/layout/games/interfaces/SinglesTraining.astro` (new) assembles:

- `SinglePlayerDisplay` hero = `currentPoints()` (running `totalPoints`, `isTarget={false}`), progress slot `StatRow` label "Target" value `currentTargetLabel()`.
- `currentTargetLabel()`: `state().targetIndex` → `targetAt(numbersPath(), targetIndex)` → `"1"`…`"20"` for `NUMBER`, `"BULL"` for `BULL`. Reuses `numbersPath`/`targetAt`/`BULL_TARGET_NUMBER` from `board-progression.module.ts` (already imported by the engine).
- error alert row (`x-show="error"`), same pattern as `Bobs27.astro`.
- `SinglesVisitPreview` (below).
- `SinglesRecreationalInput` (below) — no `BoardInputPanel`, no mode-gate `x-show`; `SINGLES_V1` never enters `VISUAL_BOARD`, so the tap row is the only input surface, unconditionally rendered.

## 5. Play Page — Visit Preview

`app/src/components/layout/games/SinglesVisitPreview.astro` — structurally identical to `Bobs27VisitPreview.astro` (3 segments in a divided row + "D1 D2 D3" caption below), driven by a new `previewSegments()` method on `singlesTrainingPlay()`.

Segment status differs from Bob's 27's hit/miss-vs-intent (Singles darts carry `intendedTargetNumber: null`/`intendedZoneKey: null` — there is no single "intended" ring to compare against, per the engine's own doc comment). Status is derived from the ring's point value instead: `hit` if the dart scored > 0 training points against the visit's target, `miss` if it scored 0 (off-target or `MISS`). This reuses the same `CheckIcon`/`CrossIcon`/empty-dot visual as Bob's 27's preview — no new icon needed.

```ts
function previewSegmentsFor(turns, hiddenTurnKey): SinglesPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) return EMPTY_SEGMENTS;
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.score > 0 ? "hit" : "miss" }; // dart.score = board score, see note below
  });
}
```

Note: `dart.score` on a `DartFact` is the dart's **board** score (per the engine module's doc comment — "never the training points"), not training points. Board score and training points are both zero only on an actual miss, and both nonzero on any real hit on the current target — but a dart hitting a *different* number (e.g. S5 thrown at target 12) scores board points (5) while earning 0 training points. Segment status must therefore be computed from training points, not `dart.score`. `previewSegmentsFor` recomputes each dart's training-point contribution locally via a pure helper mirroring `trainingPointsFor` (engine-internal, not exported) — reimplemented at the same signature (`target`, `config`, `observation`) in the `.data.ts` module, since the two live in different layers (module vs. lib) and the engine doesn't export it. This is the one place this design duplicates engine logic; flagged for a future shared-export cleanup, out of scope here.

## 6. Play Page — Input Row

`app/src/components/layout/games/SinglesRecreationalInput.astro` — target-aware tap row, reusing `InputButton.astro` and `UndoIcon` exactly as `Bobs27RecreationalInput.astro` does:

- **Number target** (`targetIndex` 0-19): `Undo` `S` `D` `T` `Miss` (5 buttons).
- **BULL target** (`targetIndex` 20): `Undo` `Bull` `Bullseye` `Miss` (4 buttons); `Bull` = outer bull (`OUTER_BULL`, training points = `pointsSingle`), `Bullseye` = inner bull (`INNER_BULL`, training points = `pointsDouble`). No treble button — no treble-bull zone exists on a real board.

Row content switches on `isBullVisit()` (`targetIndex === 20`), a new method on `singlesTrainingPlay()`.

Each tap synthesizes a `DartObservation` and calls `recordTap(ring)`:

```ts
async recordTap(this, ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS") {
  if (!this.engine || this.finished) return;
  const target = targetAt(numbersPath(), this.engine.state().targetIndex);
  const observation: DartObservation =
    ring === "MISS"
      ? { hitTargetNumber: null, hitZoneKey: "MISS", locationX: null, locationY: null }
      : target.kind === "BULL"
        ? { hitTargetNumber: BULL_TARGET_NUMBER, hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL", locationX: null, locationY: null }
        : { hitTargetNumber: target.number, hitZoneKey: ring, locationX: null, locationY: null };
  await this.commitDart(observation);
}
```

`Bull`/`Bullseye` buttons call `recordTap("SINGLE")`/`recordTap("DOUBLE")` respectively (same ring vocabulary as the number-target S/D buttons — the label differs, the underlying tap doesn't). `commitDart` mirrors `bobs27-play.data.ts`'s: `engine.record()` (catch → `this.error`), mirror facts to `$store.game`, on the visit's 3rd dart mark it resolved (no reveal-then-clear timer — `SINGLES_V1` never enters `VISUAL_BOARD`, so `hiddenTurnKey` is set immediately, synchronously, like Bob's 27's non-`VISUAL_BOARD` branch), `isComplete()` → `finished = true` → `uploadAndCompleteSession()`.

`undoVisit()` calls `engine.undo()`, mirrors facts, clears `error`/`hiddenTurnKey` — same shape as Bob's 27's.

## 7. Results

`app/src/components/layout/games/result-modals/SinglesTrainingResults.astro` — mirrors `Bobs27Results.astro`'s modal shell (fixed overlay, glass card, completion-status states, retry/back/play-again buttons) with two differences:

- Heading is static: `"Session complete"` (Singles has no win/loss outcome — `SinglesTrainingState.status` is only `IN_PROGRESS`/`COMPLETE`).
- Stats block shows one `StatRow`: `label="Total points" value="resultsSnapshot?.points"`. No darts-thrown row (out of the approved scope).

`resultsSnapshot` shape: `{ points: number } | null`, computed in `uploadAndCompleteSession()` from `this.engine.state().totalPoints` before any store reset, mirroring Bob's 27's `computeStats`.

## 8. Play Data Module

`app/src/lib/game/singles-training-play.data.ts` — mirrors `bobs27-play.data.ts`'s shape and lifecycle (`init`/reconciliation/resume/`recordTap`/`commitDart`/`undoVisit`/`uploadAndCompleteSession`/`back`/`abandonAndExit`/`playAgain`), with these removals since `SINGLES_V1` never enters `VISUAL_BOARD`:

- No `...boardInputData(...)` spread, no `visitMarkers()`, no `recordDart(observation)` board-input entry point.
- No `hiddenTimer`/reveal-then-clear scheduling — `hiddenTurnKey` is set synchronously on visit resolution (equivalent to Bob's 27's non-`VISUAL_BOARD` branch, made unconditional here).

`resumeEngine()` mirrors Bob's 27's: rebuilds `SinglesTrainingEngine` from `$store.game.configSnapshot` + persisted `stages`/`turns` via the engine registry, narrowed with `instanceof SinglesTrainingEngine`.

`SinglesTrainingPlayContext`/`SinglesPreviewSegment` types added to `app/src/lib/game/types.ts` alongside the setup context type; registered in `register-route-data.ts` as `Alpine.data("singlesTrainingPlay", ...)`.

## 9. Route Wiring

`app/src/pages/games/singles-training/play/index.astro` — `GameLayout` (`title="Singles Training — Play"`, `gameTitle="SINGLES TRAINING"`) + `ReconciliationBlocked` + `NoSessionPanel href="/games/singles-training/setup"` + `SinglesTraining` (`x-show="!finished && hasActiveSession"`) + `SinglesTrainingResults`, `x-data="singlesTrainingPlay()"`, `@confirm-exit.window="abandonAndExit()"` — identical structure to `pages/games/bobs27/play/index.astro`.

## 10. Testing Plan

TDD per `app/CLAUDE.md`. `.astro` markup is not unit-tested (D101) — coverage is on the two new `.data.ts` modules, mirroring `bobs27-setup.data.test.ts`/`bobs27-play.data.test.ts`'s case shapes:

**`singles-training-setup.data.test.ts`:** init loads preset + active sessions; reconcile match → modal shown; reconcile no-active → form shown; reconcile abandon-failed → blocked state; `start()` sends template ref with no overrides; `continueSession()`/`abandonSession()` navigate/reset correctly.

**`singles-training-play.data.test.ts`:** `recordTap` on a number target synthesizes the correct `DartObservation` for S/D/T/Miss; `recordTap` on the BULL visit (`isBullVisit()` true) maps `Bull`→`OUTER_BULL`/`Bullseye`→`INNER_BULL`, no treble path reachable; `commitDart` records, mirrors facts, sets `hiddenTurnKey` synchronously on visit resolution (no timer); `previewSegments()` computes `hit`/`miss` from training points, not board score (the off-target-nonzero-board-score case from §5 gets its own test — a dart scoring board points on a different number than the current target must preview as `miss`); completion triggers upload with `resultsSnapshot.points` set before any store reset; `undoVisit()` reverts one dart including across a visit/completion boundary; `abandonAndExit()`/`playAgain()` mirror Bob's 27's cases.

## 11. Out of Scope / Future Steps

- `VISUAL_BOARD` capability for `SINGLES_V1` (not declared; would need capability + seed `0007` + validator changes, all out of this frontend-only spec).
- Per-target results breakdown (deferred by user decision during brainstorming — total points only for V1).
- The `previewSegments()` training-point reimplementation (§5) duplicates engine-internal `trainingPointsFor` logic across the module/lib boundary — a future cleanup could export a shared pure function from the engine module instead. Not resolved here.
- The ruleset doc's flagged seed inconsistency (`0002_default_templates.sql`'s HIGH_TO_LOW/RANDOM/NORMAL/HARD presets referencing V2+ config ahead of the ruleset's V1 scope) is pre-existing, out of scope for this frontend spec.
