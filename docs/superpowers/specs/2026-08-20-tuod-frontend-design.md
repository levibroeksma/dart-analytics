# Ten Up One Down — Frontend Design

> **Date:** 2026-08-20
> **Status:** approved (brainstorming consensus)
> **Scope:** The frontend fan-out that turns TUOD from an engine-only ruleset into a playable game — setup/play/results pages, Alpine controllers, shared-registry wiring, tests. Follows the touch list in `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
> **Out of scope:** `TuodEngine`, `tuodValidator`, DB schema/seeds — all shipped in D153 and unchanged here. Any V2+ variant from `docs/game-rules/rulesets/ten-up-one-down.md` (start-score floor, configurable step sizes, end target, multiplayer).

---

## Context

`app/src/modules/game/tuod.engine.module.ts` and `app/src/services/rulesets/tuod/tuod.validator.ts` already implement `TUOD_V1` (D153): a checkout ladder starting at a configured target, one `EXERCISE_BLOCK` stage, one turn per attempt carrying the checked-out target or `0`, RECREATIONAL + QUICK_SCORE (no dart rows). `database/seeds/0001`/`0002`/`0007` already seed the game type, two configuration presets ("TUOD — 10 Rounds", "TUOD — 10 Minutes"), and the capability row.

Per `games-visibility.ts`'s own comment, TUOD is deliberately absent from the games list — "a ruleset joins this list only once its `href` resolves" — because none of the frontend exists: no setup/play/results pages, no controllers, no route wiring. This design is that missing half.

Route slug = code slug = `tuod` (the name "Ten Up One Down" doesn't start with a digit, and the existing engine/validator files already establish `tuod` as the code slug).

**Decisions made during brainstorming:**
- Frontend wiring only — no engine/validator/DB changes.
- Attempt capture is two direct buttons, **Checked out** / **Missed** — no darts-used picker, no per-attempt double-confirmation modal. Under double-out rules, reaching exactly 0 always means a double, so `checkedOut` and `finishedOnDouble` are set together; a bust is indistinguishable from a miss, per the ruleset's V1 resolution.
- Setup uses a **bespoke controller**, not `createPresetSetupController` — the factory hardcodes `presets[0]` (built for exactly one seeded preset per game) and TUOD is seeded with two, between which the raw rules say the player picks. Precedent: 501 and Score Training already opt out of the factory for their own reasons; this is a third, narrower reason (preset *selection*, not custom `start` logic).
- Play screen includes an undo action (`engine.undo()`), matching every other game.
- Results modal shows: final ladder target reached, attempts, successes, failures. No checkout-% or streak — display-only derived stats stay minimal, matching what the engine's `TuodState` already exposes.

---

## Design

### 1. Setup — `lib/game/tuod-setup.data.ts` (bespoke)

Modeled directly on `ScoreTrainingSetupContext`'s `selectMode(type)` / `presetForMode(type)` shape (`lib/game/types.ts`), swapped from a free-typed duration value to a locked preset pick:

```typescript
export type TuodSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: "ROUNDS" | "MINUTES";
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: { game: {...}; settings: {...} };
  init(this: TuodSetupContext): Promise<void>;
  reconcile(this: TuodSetupContext, activeSessions: SessionActiveData[]): Promise<void>;
  retryReconciliation(this: TuodSetupContext): Promise<void>;
  continueSession(this: TuodSetupContext): void;
  abandonSession(this: TuodSetupContext): Promise<void>;
  selectMode(this: TuodSetupContext, type: "ROUNDS" | "MINUTES"): void;
  presetForMode(this: TuodSetupContext, type: "ROUNDS" | "MINUTES"): ConfigurationPresetData | undefined;
  start(this: TuodSetupContext): Promise<void>;
};
```

`init()` fetches both presets (`fetchConfigurationPresets("TUOD")`) and reconciles any active session, copying `createPresetSetupController`'s `init`/`reconcile`/`retryReconciliation`/`continueSession`/`abandonSession` bodies verbatim (same reasoning as Score Training's copy: the factory's single-preset assumption doesn't fit, but the reconciliation flow is identical). `selectMode(type)` sets `durationType`. `start()` resolves `presetForMode(durationType)`, errors if missing, then calls `createSession` with that preset's `configurationTemplateId` as `templateRef` and no overrides — the whole configuration (`starting_target`, `finish_bonus`, `miss_penalty`, `duration_value`, `max_darts_per_turn`) comes from the preset as-is, since V1's config screen locks everything but session length.

`TuodSetupForm.astro`: `SetupShell title="Ten Up One Down"` + `UserSection` + `InfoSection` (identity blurb: "Checkout ladder under pressure — start at 41, climb +10 on a finish, slip −1 on a miss.") + `SettingSectionShell` wrapping a `Toggle` bound to `durationType` with options `[{value:"ROUNDS", label:"10 Rounds"}, {value:"MINUTES", label:"10 Minutes"}]` — no numeric input, since the value itself isn't editable in V1.

### 2. Play — `lib/game/tuod-play.data.ts`

```typescript
export type TuodPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: { target: number; attempts: number; successes: number; failures: number } | null;
  pendingAttempt: boolean | null; // the checkedOut value awaiting finish-confirm
  showFinishConfirm: boolean;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  $store: {...};
  currentTargetLabel(this: TuodPlayContext): string;
  attemptCountLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string; // MINUTES mode only
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
  recordAttempt(this: TuodPlayContext, checkedOut: boolean): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoAttempt(this: TuodPlayContext): void;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  back(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
};
```

Structure mirrors `score-training-play.data.ts` (`resumeEngine`, `currentFacts`, `startCountdown`, D88 reconciliation in `init()`) with the visit-entry/board-input machinery removed, since there's no typed score and no per-dart capture:

- `recordAttempt(checkedOut)`: if `engine.wouldComplete({checkedOut, finishedOnDouble: checkedOut})` is true, defer to `pendingAttempt` + `showFinishConfirm` (same irreversible-upload gate as Score Training/121); otherwise call `engine.record(...)` directly, mirror facts to the store, clear `error`.
- `confirmFinish()`: records `pendingAttempt`, uploads via `uploadAndCompleteSession()`, mirrors `scoreTrainingPlay`'s `confirmFinish`.
- `cancelFinish()`: discards `pendingAttempt` (no buffer to restore, unlike a mistyped keypad score).
- `undoAttempt()`: `engine.undo()` + `recordFacts`, disabled while `showFinishConfirm` or `finished`.
- MINUTES timer: identical `SegmentTimer` wiring to `startCountdown` in `score-training-play.data.ts` — `onComplete` sets `game.timerExpired = true` and calls `engine.expireTimer()`, current attempt always allowed to finish.
- `computeStats(turns)`: `{ target: <final currentTarget from deriveState>, attempts: turns.length, successes: turns.filter(t => t.totalScore > 0).length, failures: turns.length - successes }`.

`TenUpOneDown.astro` interface:

```astro
<SinglePlayerDisplay isTarget target="currentTargetLabel()" class="max-h-2/5 h-full">
  <div slot="progress" ...>
    <dl class="w-full space-y-1">
      <StatRow label="Attempts" value="$store.game.turns.length" />
      <StatRow label="Successes" value="..." />
      <StatRow label="Failures" value="..." />
    </dl>
  </div>
</SinglePlayerDisplay>
<!-- MINUTES countdown label, shown/hidden exactly like ScoreTraining.astro -->
<div class="flex justify-center items-center gap-2 px-3"
     x-show="$store.game.configSnapshot?.durationType === 'MINUTES'" x-cloak>
  <p x-text="remainingLabel()"></p>
</div>
<p class="alert alert-error ..." x-show="error" x-text="error" x-cloak></p>
<div class="flex gap-3">
  <Button variant="primary" title="Checked out" @click="recordAttempt(true)"
          :disabled="showFinishConfirm || finished" />
  <Button variant="secondary" title="Missed" @click="recordAttempt(false)"
          :disabled="showFinishConfirm || finished" />
</div>
<Button variant="ghost" title="Undo" @click="undoAttempt()"
        :disabled="!$store.game.turns.length || showFinishConfirm || finished" />
```

No `BoardInputPanel`, no `ScoreInput` — TUOD has no `VISUAL_BOARD`/`ANALYTICS` pair (`RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE]` only), so the keypad/board branch that every other quick-score game carries for mode-switching doesn't apply here.

`pages/games/tuod/play/index.astro` mirrors `score-training/play/index.astro`: `ReconciliationBlocked`, `NoSessionPanel`, `TenUpOneDown` (gameplay), a `ConfirmDialog` "Finish session?" gated on `showFinishConfirm`, `TenUpOneDownResults` overlay.

### 3. Results — `TenUpOneDownResults.astro`

Same shell as `ScoreTrainingResults.astro` (live stats while saving, `resultsSnapshot` once succeeded, `IsLoading`/retry/`playAgain`/`back`):

```astro
<StatRow label="Target reached" value="... currentTargetLabel or resultsSnapshot?.target" />
<StatRow label="Attempts" value="$store.game.turns.length / resultsSnapshot?.attempts" />
<StatRow label="Successes" value="... / resultsSnapshot?.successes" />
<StatRow label="Failures" value="... / resultsSnapshot?.failures" />
```

### 4. Wiring

- `lib/game/rulesets/games-visibility.ts`: new `GAME_CARDS` entry —
  ```typescript
  {
    rulesetVersionKey: "TUOD_V1",
    href: "/games/tuod/setup",
    title: "Ten Up One Down",
    caption: "Climb the checkout ladder — +10 on a finish, −1 on a miss.",
  }
  ```
  (list order: appended at the end, after `AROUND_THE_CLOCK_V1` — `GAME_CARDS` has no ordering rule beyond "display order," so a new entry appends.)
- `lib/client/alpine/register-route-data.ts`: import + `Alpine.data("tuodSetup", tuodSetup)` / `Alpine.data("tuodPlay", tuodPlay)`.
- `pages/games/tuod/setup/index.astro` (`x-data="tuodSetup()"`), `pages/games/tuod/play/index.astro` (`x-data="tuodPlay()"`).
- `lib/game/types.ts`: add `TuodSetupContext`, `TuodPlayContext` next to the other per-game context types.

### 5. Testing

- `app/tests/lib/game/tuod-setup.data.test.ts` — preset fetch/selection, `presetForMode` lookup, `start()` create-session call shape, reconciliation (mirrors `score-training-setup.data.test.ts`).
- `app/tests/lib/game/tuod-play.data.test.ts` — `wouldComplete` gating for both ROUNDS and MINUTES, finish-confirm defer/cancel, undo, timer expiry mid-session, `computeStats` correctness (mirrors `score-training-play.data.test.ts`).
- `app/tests/lib/game/rulesets/games-visibility.test.ts` — TUOD card appears under RECREATIONAL mode, not under ANALYTICS-only filtering.
- No engine/validator test changes — `tuod.engine.module.test.ts` and `tuod.validator.test.ts` already cover the logic this design only surfaces.
- `.astro` pages: no test runner (D101) — verified manually via `/run` after implementation.

### 6. Edge cases

- MINUTES mode expiring before any attempt completes: `completesAt()` already guards `attemptCount >= 1` in the engine — no frontend change needed, but `recordAttempt` must still allow one more attempt after expiry, exactly like Score Training's "let the current visit finish."
- `start()` finding no preset for the selected `durationType` (fetch returned fewer than 2, or the seed changed): `error` is set, matching the factory's `"Could not find a preset for ${label}."` message.
- Reload mid-session: `resumeEngine` replays `$store.game.turns` through `TuodEngine.create(config, prior)`, exactly like every other resumable game — the ladder position is re-derived, never persisted client-side beyond the fact log.
- `playAgain()`: replays the same `templateRef` the session started with (no `overrides`, since V1 has nothing to override), matching `scoreTrainingPlay.playAgain`'s pattern minus the `duration_value` override it needs and TUOD doesn't.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol, at implementation time:
- `07-Frontend/09-Adding-A-Game.md` — no rule change; TUOD's fan-out follows the existing touch list exactly. Its own note ("TUOD is absent despite declaring capabilities") becomes stale once this ships and must be updated or removed.
- `05-Database/10-Database-Agent-Guide.md`, engine/validator, seeds — no change; this is frontend-only.
- `DECISIONS.md` / `decisions/game-engine.md` (or `decisions/architecture.md`) — new entry recording TUOD's frontend fan-out and the bespoke-setup-controller precedent (three games now opt out of `createPresetSetupController`, for three distinct reasons: custom `start` logic (501, Score Training) vs. multi-preset selection (TUOD)).
- `graphify-out/graph.json` — refresh via `scripts/refresh-graph.sh` once code lands.
- This spec is docs-only; no code changes ship in this task. Implementation is the next phase (`writing-plans`), on a dedicated branch, PR to `main` on completion.
