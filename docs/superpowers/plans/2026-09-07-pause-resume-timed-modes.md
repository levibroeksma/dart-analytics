# Pause/Resume for Timed Game Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pause/Resume toggle to the 3 rulesets that run a `MINUTES` countdown (Score Training, TUOD, 121 `_V2`), freezing gameplay while paused and resuming the clock from wherever it stopped.

**Architecture:** One new persisted store flag (`timerPaused`), one shared toggle function in `play-lifecycle.ts`, guard additions at every place a visit/dart/undo can be recorded (both the two shared `play-lifecycle.ts` choke points and each game's own keypad/undo methods), and two new icons rendered through the existing `Button` primitive next to each game's existing countdown label.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

## Global Constraints

- No `SegmentTimer` module changes — `stop()`/`start()` already preserve `remaining`.
- `timerPaused` is ephemeral client state: persisted via `$persist`, never uploaded as part of the events batch, never read by any engine.
- Semantic tokens only, `Button` primitive only for standalone actions, no `x-init`, Alpine v3 shorthand (`:attr`/`@event`) — see `app/CLAUDE.md`.
- `bash scripts/check-test-coverage.sh`: every changed runtime `.ts` file needs a covering test edit. `.astro`/`.svg` files are exempt (no test runner for `.astro`, D101).
- `npm run validate:app` and `npm run format:check` must both be clean before the branch is done (see Task 8).

---

### Task 1: `timerPaused` on the game store

**Files:**
- Modify: `app/src/stores/game.store.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/stores/game.store.test.ts`

**Interfaces:**
- Produces: `gameStore(persist).timerPaused: boolean` (persisted, default `false`), reset to `false` by both `startSession()` and `reset()`. `PlayStoreContext<TConfig>["game"].timerPaused?: boolean`.

- [ ] **Step 1: Write the failing test — startSession/reset clear `timerPaused`**

Edit `app/tests/stores/game.store.test.ts`. In the existing `"startSession clears any fact log and upload state left by a prior session"` test, add a set-then-assert pair for the new field:

```ts
  it("startSession clears any fact log and upload state left by a prior session", () => {
    const store = gameStore(stubPersistFactory());
    store.recordFacts(FACTS);
    store.idempotencyKey = "old-key";
    store.timerRemainingMs = 1000;
    store.timerStartedAt = "2026-07-25T09:00:00.000Z";
    store.timerExpired = true;
    store.timerPaused = true;

    store.startSession({ ...SESSION_INPUT });

    expect(store.stages).toEqual([]);
    expect(store.turns).toEqual([]);
    expect(store.idempotencyKey).toBeNull();
    expect(store.timerRemainingMs).toBeNull();
    expect(store.timerStartedAt).toBeNull();
    expect(store.timerExpired).toBe(false);
    expect(store.timerPaused).toBe(false);
  });
```

In `"clears every field on reset"`, do the same:

```ts
  it("clears every field on reset", () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({ ...SESSION_INPUT });
    store.recordFacts(FACTS);
    store.idempotencyKey = "key";
    store.timerRemainingMs = 5000;
    store.timerStartedAt = "2026-07-25T09:00:00.000Z";
    store.timerExpired = true;
    store.timerPaused = true;

    store.reset();

    expect(store.gameTypeKey).toBeNull();
    expect(store.sessionId).toBeNull();
    expect(store.rulesetVersionKey).toBeNull();
    expect(store.seats).toEqual([]);
    expect(store.templateRef).toBeNull();
    expect(store.configSnapshot).toBeNull();
    expect(store.stages).toEqual([]);
    expect(store.turns).toEqual([]);
    expect(store.timerRemainingMs).toBeNull();
    expect(store.timerStartedAt).toBeNull();
    expect(store.timerExpired).toBe(false);
    expect(store.timerPaused).toBe(false);
    expect(store.idempotencyKey).toBeNull();
  });
```

In the D91 discard test (`"discards persisted state written by an incompatible store version once init() runs"`), add `"game.timerPaused": true` to the rehydrated map and assert it is discarded:

```ts
    it("discards persisted state written by an incompatible store version once init() runs", () => {
      const store = gameStore(
        rehydratingPersistFactory({
          "game._v": 1,
          "game.gameTypeKey": "SCORE_TRAINING",
          "game.rulesetVersionKey": "SCORE_TRAINING_V1",
          "game.sessionId": "stale-session",
          "game.configSnapshot": SESSION_INPUT.configSnapshot,
          "game.templateRef": "tpl-1",
          "game.stages": [],
          "game.turns": [V1_TURN],
          "game.timerRemainingMs": 5000,
          "game.timerStartedAt": "2026-07-20T10:00:00.000Z",
          "game.timerExpired": true,
          "game.timerPaused": true,
          "game.idempotencyKey": "stale-key",
        }),
      );

      store.init();

      expect(store.turns).toEqual([]);
      expect(store.stages).toEqual([]);
      expect(store.sessionId).toBeNull();
      expect(store.gameTypeKey).toBeNull();
      expect(store.rulesetVersionKey).toBeNull();
      expect(store.seats).toEqual([]);
      expect(store.configSnapshot).toBeNull();
      expect(store.templateRef).toBeNull();
      expect(store.timerRemainingMs).toBeNull();
      expect(store.timerStartedAt).toBeNull();
      expect(store.timerExpired).toBe(false);
      expect(store.timerPaused).toBe(false);
      expect(store.idempotencyKey).toBeNull();
    });
```

Finally, update the persist-isolation test's expected alias count and order — it enumerates every `$persist` field in construction order:

```ts
    gameStore(factory);
    for (const init of pendingInits) init();

    expect(factoryCalls).toBe(15);
    expect(aliasesAtInit).toEqual([
      "game._v",
      "game.gameTypeKey",
      "game.rulesetVersionKey",
      "game.sessionId",
      "game.captureModeKey",
      "game.inputModeKey",
      "game.configSnapshot",
      "game.templateRef",
      "game.stages",
      "game.turns",
      "game.timerRemainingMs",
      "game.timerStartedAt",
      "game.timerExpired",
      "game.timerPaused",
      "game.idempotencyKey",
    ]);
    expect(new Set(aliasesAtInit).size).toBe(aliasesAtInit.length);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts`
Expected: FAIL — `store.timerPaused` is `undefined`, `factoryCalls` is `14`, not `15`.

- [ ] **Step 3: Add `timerPaused` to the store**

Edit `app/src/stores/game.store.ts`. Add the field right after `timerExpired` (own `persist()` call — D120, never reuse one `persist()` across fields):

```ts
    timerExpired: persist()<boolean>(false).as("game.timerExpired"),
    timerPaused: persist()<boolean>(false).as("game.timerPaused"),
    idempotencyKey: persist()<string | null>(null).as("game.idempotencyKey"),
```

In `startSession(...)`, add the reset line next to the other timer fields:

```ts
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.timerPaused = false;
      this.idempotencyKey = null;
    },
```

In `reset()`, add the same:

```ts
    reset() {
      this.gameTypeKey = null;
      this.rulesetVersionKey = null;
      this.sessionId = null;
      this.configSnapshot = null;
      this.templateRef = null;
      this.captureModeKey = null;
      this.inputModeKey = null;
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.timerPaused = false;
      this.idempotencyKey = null;
      this.loading = false;
    },
```

- [ ] **Step 4: Add the type field**

Edit `app/src/lib/game/types.ts`, in `PlayStoreContext<TConfig>["game"]`, right after `timerExpired?: boolean;`:

```ts
    timerRemainingMs?: number | null;
    timerStartedAt?: string | null;
    timerExpired?: boolean;
    timerPaused?: boolean;
    idempotencyKey?: string | null;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add app/src/stores/game.store.ts app/src/lib/game/types.ts app/tests/stores/game.store.test.ts
git commit -m "Add timerPaused to the game store"
```

---

### Task 2: Shared pause guards in `play-lifecycle.ts`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: `PlayLifecycleContext<TConfig, TEngine, TResults>` (existing), `$store.game.timerPaused?: boolean` (Task 1).
- Produces: `playToggleTimerPause(context: PlayLifecycleContext<...> & { timer: SegmentTimer | null }): void`. `playCommitDart` and `playRunBotVisualBoardVisit` both become no-ops while `context.$store.game.timerPaused` is `true`.

- [ ] **Step 1: Write the failing tests**

Edit `app/tests/lib/game/play-lifecycle.test.ts`. Add a `SegmentTimer` import and a new `describe` block for `playToggleTimerPause` right after the `describe("playRetryReconciliation", ...)` block (before `describe("playCommitDart", ...)`):

```ts
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
```

(add this alongside the other `import type` lines near the top of the file, next to the existing `PlayLifecycleContext` import)

```ts
function makeTimerStub(): SegmentTimer {
  return { start: vi.fn(), stop: vi.fn() } as unknown as SegmentTimer;
}

describe("playToggleTimerPause", () => {
  it("stops the timer and marks the store paused when running", async () => {
    const timer = makeTimerStub();
    const context = { ...makeContext(), timer };
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    playToggleTimerPause(context);

    expect(timer.stop).toHaveBeenCalledTimes(1);
    expect(timer.start).not.toHaveBeenCalled();
    expect(context.$store.game.timerPaused).toBe(true);
  });

  it("starts the timer and clears the paused flag when already paused", async () => {
    const timer = makeTimerStub();
    const context = { ...makeContext(), timer };
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    context.$store.game.timerPaused = true;

    playToggleTimerPause(context);

    expect(timer.start).toHaveBeenCalledTimes(1);
    expect(timer.stop).not.toHaveBeenCalled();
    expect(context.$store.game.timerPaused).toBe(false);
  });

  it("does nothing without a timer", async () => {
    const context = { ...makeContext(), timer: null };
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    playToggleTimerPause(context);

    expect(context.$store.game.timerPaused).toBeUndefined();
  });

  it("does nothing once the session has finished", async () => {
    const timer = makeTimerStub();
    const context = { ...makeContext(), timer, finished: true };
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    playToggleTimerPause(context);

    expect(timer.start).not.toHaveBeenCalled();
    expect(timer.stop).not.toHaveBeenCalled();
  });
});
```

Also import `playToggleTimerPause` in the existing import block from `@lib/game/play-lifecycle`:

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playFoldBotQuickScoreVisit,
  playPreviewSegments,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

Now add a pause case to the existing `describe("playCommitDart", ...)` block (append inside it, after the `"does nothing when there is no engine"` test):

```ts
  it("does nothing while the session is paused", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    context.$store.game.timerPaused = true;

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.$store.game.turns).toHaveLength(0);
  });
```

Append two cases to `describe("playRunBotVisualBoardVisit", ...)`:

```ts
  it("does nothing while the session is paused", async () => {
    const engine = new BotFakeEngine(TWO_BOT_SEATS);
    engine.record(dartAt(20));
    const context = makeBotContext(engine, TWO_BOT_SEATS);
    context.$store.game.timerPaused = true;
    const wait = vi.fn().mockResolvedValue(undefined);

    await playRunBotVisualBoardVisit(context, BOT_REF, stubThrower([19]), wait);

    expect(engine.facts().turns).toHaveLength(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("stops throwing mid-visit once the session is paused during the pre-throw delay", async () => {
    const engine = new BotFakeEngine(TWO_BOT_SEATS);
    engine.record(dartAt(20));
    const context = makeBotContext(engine, TWO_BOT_SEATS);
    const wait = vi.fn().mockImplementation(async () => {
      context.$store.game.timerPaused = true;
    });

    await playRunBotVisualBoardVisit(context, BOT_REF, stubThrower([19]), wait);

    expect(engine.facts().turns).toHaveLength(1);
    expect(context.botThrowing).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: FAIL — `playToggleTimerPause` is not exported; the two new `playCommitDart`/`playRunBotVisualBoardVisit` pause cases record a turn instead of staying at length 1/0.

- [ ] **Step 3: Implement the guards**

Edit `app/src/lib/game/play-lifecycle.ts`. Add the `SegmentTimer` type import next to the existing `RulesetVersionKey`/`Seated` import:

```ts
import type { RulesetVersionKey, Seated } from "@lib/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
```

Add the guard to `playCommitDart`'s first line:

```ts
export async function playCommitDart<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  observation: DartObservation,
): Promise<void> {
  if (!context.engine || context.$store.game.timerPaused) return;
  try {
    context.engine.record(observation);
```

Add the guard to `playRunBotVisualBoardVisit`'s entry check and while loop:

```ts
export async function playRunBotVisualBoardVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
    botThrowing: boolean;
  },
  botParticipantRef: string,
  throwDart: BotDartThrower,
  wait: (ms: number) => Promise<void> = defaultBotWait,
): Promise<void> {
  if (context.botThrowing || !context.engine) return;
  if (context.$store.game.timerPaused) return;
  if (context.engine.state().activeParticipantRef !== botParticipantRef) return;

  context.botThrowing = true;
  try {
    while (
      !context.finished &&
      !context.$store.game.timerPaused &&
      context.engine.state().activeParticipantRef === botParticipantRef
    ) {
      const { observation, pacing } = throwDart();
      await wait(pacing.preThrowMs);
      if (
        context.finished ||
        context.$store.game.timerPaused ||
        context.engine.state().activeParticipantRef !== botParticipantRef
      ) {
        return;
      }
      await playCommitDart(context, observation);
      await wait(pacing.postThrowMs);
    }
  } finally {
    context.botThrowing = false;
  }
}
```

Add the new export, placed right after `playRetryReconciliation` (before `clearTimerHandle`):

```ts
/**
 * Toggles a MINUTES-mode countdown: stops it and marks the store paused, or
 * resumes it from wherever `SegmentTimer.stop()` left `remaining`. A no-op
 * without a timer or once the session has finished.
 */
export function playToggleTimerPause<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
    timer: SegmentTimer | null;
  },
): void {
  if (!context.timer || context.finished) return;
  if (context.$store.game.timerPaused) {
    context.timer.start();
    context.$store.game.timerPaused = false;
  } else {
    context.timer.stop();
    context.$store.game.timerPaused = true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "Add playToggleTimerPause and pause guards to play-lifecycle.ts"
```

---

### Task 3: Icons + shared board-input pause gate

**Files:**
- Create: `app/src/icons/pause.svg`
- Create: `app/src/icons/play.svg`
- Modify: `app/src/components/layout/games/BoardInputPanel.astro`

**Interfaces:**
- Produces: `PauseIcon`, `PlayIcon` (default SVG component exports, same shape as `app/src/icons/exit.svg`) for Task 4/5/6 to import. `BoardInputPanel` hides itself (pointer surface + undo + bounce-out) while `$store.game.timerPaused` is true.

No test file — `.svg`/`.astro` are exempt from `check-test-coverage.sh`.

- [ ] **Step 1: Create the icons**

`app/src/icons/pause.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
		<path d="M7 5.5h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
		<path d="M15 5.5h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
	</g>
</svg>
```

`app/src/icons/play.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M7.5 5.147c0-.909 1.008-1.457 1.771-.964l10.157 6.553c.792.511.755 1.677-.066 2.137L9.34 19.4c-.797.446-1.777-.13-1.777-1.043z" />
</svg>
```

- [ ] **Step 2: Gate the board panel on pause**

Edit `app/src/components/layout/games/BoardInputPanel.astro`. Extend the wrapping `x-show`:

```astro
<div
  x-show="!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'"
  x-cloak
  class="mt-3 flex min-h-0 flex-col items-center gap-3"
>
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 4: Commit**

```bash
git add app/src/icons/pause.svg app/src/icons/play.svg app/src/components/layout/games/BoardInputPanel.astro
git commit -m "Add pause/play icons; gate the visual board on timerPaused"
```

---

### Task 4: Score Training pause/resume

**Files:**
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `playToggleTimerPause` (Task 2), `PauseIcon`/`PlayIcon` (Task 3).
- Produces: `scoreTrainingPlay().togglePause(): void`; `ScoreTrainingPlayContext` gains no new fields (the type already declares `timer: SegmentTimer | null`).

- [ ] **Step 1: Write the failing tests**

Edit `app/tests/lib/game/score-training-play.data.test.ts`. Add a new `describe` block inside the outer `describe("scoreTrainingPlay", ...)`, right after the `"MINUTES duration mode timer wiring"` block:

```ts
  describe("togglePause", () => {
    it("stops the timer and sets timerPaused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      component.togglePause();

      expect(segmentTimerInstances[0].stop).toHaveBeenCalledTimes(1);
      expect(store.timerPaused).toBe(true);
    });

    it("resumes the timer and clears timerPaused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();

      component.togglePause();

      expect(segmentTimerInstances[0].start).toHaveBeenCalledTimes(2);
      expect(store.timerPaused).toBe(false);
    });

    it("leaves a persisted-paused timer stopped on reload instead of auto-resuming it", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        timerRemainingMs: 5 * 60 * 1000,
        timerPaused: true,
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      const instance = segmentTimerInstances[0];
      expect(instance.start).toHaveBeenCalledTimes(1);
      expect(instance.stop).toHaveBeenCalledTimes(1);
      expect(store.timerRemainingMs).toBe(5 * 60 * 1000);
    });

    it("submitVisit does nothing while paused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();
      component.scoreInput.setValue("40");

      await component.submitVisit.call(component);

      expect(store.turns).toHaveLength(0);
    });

    it("undoVisit does nothing while paused", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        turns: [turnFact("t1", 1, 40)],
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();

      component.undoVisit();

      expect(store.turns).toHaveLength(1);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t togglePause`
Expected: FAIL — `component.togglePause` is not a function.

- [ ] **Step 3: Implement**

Edit `app/src/lib/game/score-training-play.data.ts`. Import `playToggleTimerPause` alongside the other `play-lifecycle.ts` imports:

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

In `init()`'s `MINUTES` branch, stop the freshly-built timer immediately if the store says it was already paused before this reload:

```ts
        if (config.durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
            if (this.$store.game.timerPaused) {
              this.timer.stop();
            }
          }
        }
```

Add `togglePause`, right after `destroy`:

```ts
    destroy(this: ScoreTrainingPlayContext) {
      this.timer?.stop();
    },

    togglePause(this: ScoreTrainingPlayContext) {
      playToggleTimerPause(this);
    },
```

Add the `timerPaused` guard to `submitVisit`, `recordDart`, `undoVisit`, and `maybeRunBotVisit`:

```ts
    async submitVisit(this: ScoreTrainingPlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
      this.loading = true;
```

```ts
    async recordDart(
      this: ScoreTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm || this.$store.game.timerPaused)
        return;
      if (!this.engine) return;
```

```ts
    async maybeRunBotVisit(this: ScoreTrainingPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (
        !botSeat ||
        !this.engine ||
        this.finished ||
        this.$store.game.timerPaused
      )
        return;
```

In `playAgain`'s `resetLocalState` callback, clear `timerPaused` alongside the other timer fields:

```ts
        () => {
          this.$store.game.timerRemainingMs = null;
          this.$store.game.timerStartedAt = null;
          this.$store.game.timerExpired = false;
          this.$store.game.timerPaused = false;
          this.pendingFinishScore = null;
          this.pendingDartObservation = null;
          this.showFinishConfirm = false;
          this.scoreInput.clear();
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS (all tests green, including the pre-existing ones).

- [ ] **Step 5: Add the button to the UI**

Edit `app/src/components/layout/games/interfaces/ScoreTraining.astro`. Add the icon imports:

```astro
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import Button from "@components/forms/Button.astro";

// Icons
import PauseIcon from "@icons/pause.svg";
import PlayIcon from "@icons/play.svg";
```

Replace the countdown block:

```astro
  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="`${remainingLabel()}`"
    >
    </p>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Pause timer"
      :disabled="finished || showFinishConfirm"
      @click="togglePause()"
      x-show="!$store.game.timerPaused"
      x-cloak
    >
      <PauseIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Resume timer"
      :disabled="finished || showFinishConfirm"
      @click="togglePause()"
      x-show="$store.game.timerPaused"
      x-cloak
    >
      <PlayIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
  </div>
```

Add `|| $store.game.timerPaused` to the `ScoreInput` disable expressions:

```astro
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
```

- [ ] **Step 6: Run the full suite and the Astro check**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts && npx astro check`
Expected: PASS; 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/score-training-play.data.ts app/src/components/layout/games/interfaces/ScoreTraining.astro app/tests/lib/game/score-training-play.data.test.ts
git commit -m "Add pause/resume to Score Training's MINUTES countdown"
```

---

### Task 5: TUOD pause/resume

**Files:**
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/TenUpOneDown.astro`
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `playToggleTimerPause` (Task 2), `PauseIcon`/`PlayIcon` (Task 3).
- Produces: `tuodPlay().togglePause(): void`.

- [ ] **Step 1: Write the failing tests**

Edit `app/tests/lib/game/tuod-play.data.test.ts`. First check its existing helper names — it mirrors `score-training-play.data.test.ts`'s `gameStub`/`settingsStub`/`minutes(...)`/`segmentTimerInstances` pattern (same `vi.mock("@modules/ui/segment-timer.module", ...)` setup). Add this `describe` block inside the file's outer `describe("tuodPlay", ...)`, near its own `"MINUTES duration mode timer wiring"` block:

```ts
  describe("togglePause", () => {
    it("stops the timer and sets timerPaused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      component.togglePause();

      expect(segmentTimerInstances[0].stop).toHaveBeenCalledTimes(1);
      expect(store.timerPaused).toBe(true);
    });

    it("resumes the timer and clears timerPaused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();

      component.togglePause();

      expect(segmentTimerInstances[0].start).toHaveBeenCalledTimes(2);
      expect(store.timerPaused).toBe(false);
    });

    it("leaves a persisted-paused timer stopped on reload instead of auto-resuming it", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        timerRemainingMs: 5 * 60 * 1000,
        timerPaused: true,
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      const instance = segmentTimerInstances[0];
      expect(instance.start).toHaveBeenCalledTimes(1);
      expect(instance.stop).toHaveBeenCalledTimes(1);
      expect(store.timerRemainingMs).toBe(5 * 60 * 1000);
    });

    it("submitVisit does nothing while paused", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();
      component.scoreInput.setValue("40");

      await component.submitVisit.call(component);

      expect(store.turns).toHaveLength(0);
    });

    it("undoVisit does nothing while paused", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        turns: [turnFact("t1", 1, 40)],
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.togglePause();

      component.undoVisit();

      expect(store.turns).toHaveLength(1);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t togglePause`
Expected: FAIL — `component.togglePause` is not a function.

- [ ] **Step 3: Implement**

Edit `app/src/lib/game/tuod-play.data.ts`. Import `playToggleTimerPause`:

```ts
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

In `init()`'s `MINUTES` branch:

```ts
        if (config.durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
            if (this.$store.game.timerPaused) {
              this.timer.stop();
            }
          }
        }
```

Add `togglePause`, right after `destroy`:

```ts
    destroy(this: TuodPlayContext) {
      this.timer?.stop();
    },

    togglePause(this: TuodPlayContext) {
      playToggleTimerPause(this);
    },
```

Add the `timerPaused` guard to `submitVisit`, `recordAttempt`, `recordDart`, `undoVisit`, `maybeRunBotVisit`:

```ts
    async submitVisit(this: TuodPlayContext): Promise<void> {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    async recordAttempt(
      this: TuodPlayContext,
      input: TuodAttemptInput,
    ): Promise<void> {
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    async recordDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    undoVisit(this: TuodPlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
      if (!this.engine) return;
```

```ts
    async maybeRunBotVisit(this: TuodPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (
        !botSeat ||
        !this.engine ||
        this.finished ||
        this.$store.game.timerPaused
      )
        return;
```

In `playAgain`'s `resetLocalState` callback:

```ts
        () => {
          this.$store.game.timerRemainingMs = null;
          this.$store.game.timerStartedAt = null;
          this.$store.game.timerExpired = false;
          this.$store.game.timerPaused = false;
          this.pendingAttempt = null;
          this.pendingDartObservation = null;
          this.showFinishConfirm = false;
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the button to the UI**

Edit `app/src/components/layout/games/interfaces/TenUpOneDown.astro`. Add the icon imports:

```astro
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import Button from "@components/forms/Button.astro";

// Icons
import PauseIcon from "@icons/pause.svg";
import PlayIcon from "@icons/play.svg";
```

Replace the countdown block:

```astro
  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="remainingLabel()"
    >
    </p>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Pause timer"
      :disabled="finished || showDoubleConfirm || showFinishConfirm"
      @click="togglePause()"
      x-show="!$store.game.timerPaused"
      x-cloak
    >
      <PauseIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Resume timer"
      :disabled="finished || showDoubleConfirm || showFinishConfirm"
      @click="togglePause()"
      x-show="$store.game.timerPaused"
      x-cloak
    >
      <PlayIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
  </div>
```

Add `|| $store.game.timerPaused` to the `ScoreInput` disable expressions:

```astro
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
```

- [ ] **Step 6: Run the full suite and the Astro check**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts && npx astro check`
Expected: PASS; 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/tuod-play.data.ts app/src/components/layout/games/interfaces/TenUpOneDown.astro app/tests/lib/game/tuod-play.data.test.ts
git commit -m "Add pause/resume to TUOD's MINUTES countdown"
```

---

### Task 6: 121 (V2) pause/resume

**Files:**
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `playToggleTimerPause` (Task 2), `PauseIcon`/`PlayIcon` (Task 3).
- Produces: `oneTwentyOnePlay().togglePause(): void`.

121 differs from the other two in two ways: `init()` calls a local `maybeResumeCountdown(game, config, engine)` helper instead of inlining the `MINUTES` branch, so the pause-on-reload logic goes there instead; and `one-twenty-one-play.data.test.ts` has no `SegmentTimer` mock and no `gameStub`/`settingsStub`/`minutes(...)` helpers at all yet — unlike the other two test files, it builds its store via a `baseStore()` function and calls `play.init()` directly (no `.call(component)`). Timer-driven behavior for 121_V2 has no test coverage today; this task adds the `SegmentTimer` mock this task's own tests need.

- [ ] **Step 1: Write the failing tests**

Edit `app/tests/lib/game/one-twenty-one-play.data.test.ts`. Add the `SegmentTimer` mock near the top of the file, right after the existing `vi.mock("@client/api/sessions");` line:

```ts
vi.mock("@client/api/sessions");

const segmentTimerInstances: Array<{
  options: Record<string, unknown>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("@modules/ui/segment-timer.module", () => ({
  SegmentTimer: vi.fn().mockImplementation(function (
    options: Record<string, unknown>,
  ) {
    const instance = { options, start: vi.fn(), stop: vi.fn() };
    segmentTimerInstances.push(instance);
    return instance;
  }),
}));
```

Add a new top-level `describe` block, mirroring the file's own `"oneTwentyOnePlay — 121_V2 resume/replay and round/time UI"` block's local `store`/`createPlay` pattern, placed after that block:

```ts
describe("oneTwentyOnePlay — pause/resume (121_V2 MINUTES)", () => {
  let store: OneTwentyOnePlayContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    store = baseStore();
    store.game.rulesetVersionKey = "121_V2";
    store.game.configSnapshot = {
      seats: SEATS,
      durationType: "MINUTES",
      durationValue: 15,
    } as any;
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "session-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
    ]);
  });

  function createPlay(
    overrides: Partial<OneTwentyOnePlayContext> = {},
  ): OneTwentyOnePlayContext {
    return {
      ...oneTwentyOnePlay(),
      $store: store,
      ...overrides,
    } as OneTwentyOnePlayContext;
  }

  it("stops the timer and sets timerPaused", async () => {
    const play = createPlay();
    await play.init();

    play.togglePause();

    expect(segmentTimerInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(store.game.timerPaused).toBe(true);
  });

  it("resumes the timer and clears timerPaused", async () => {
    const play = createPlay();
    await play.init();
    play.togglePause();

    play.togglePause();

    expect(segmentTimerInstances[0].start).toHaveBeenCalledTimes(2);
    expect(store.game.timerPaused).toBe(false);
  });

  it("leaves a persisted-paused timer stopped on reload instead of auto-resuming it", async () => {
    store.game.timerRemainingMs = 5 * 60 * 1000;
    store.game.timerPaused = true;
    const play = createPlay();

    await play.init();

    const instance = segmentTimerInstances[0];
    expect(instance.start).toHaveBeenCalledTimes(1);
    expect(instance.stop).toHaveBeenCalledTimes(1);
    expect(store.game.timerRemainingMs).toBe(5 * 60 * 1000);
  });

  it("submitVisit does nothing while paused", async () => {
    const play = createPlay();
    await play.init();
    play.togglePause();
    play.scoreInput.setValue("40");

    await play.submitVisit();

    expect(store.game.turns).toHaveLength(0);
  });

  it("undoVisit does nothing while paused", async () => {
    const play = createPlay();
    play.engine = oneTwentyOneV2EngineFactory.create(
      store.game.configSnapshot as any,
    ) as any;
    play.engine!.record({ scoreAttempted: 60 });
    store.game.recordFacts(play.engine!.facts());
    play.togglePause();

    play.undoVisit();

    expect(store.game.turns).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t "pause/resume"`
Expected: FAIL — `play.togglePause` is not a function.

- [ ] **Step 3: Implement**

Edit `app/src/lib/game/one-twenty-one-play.data.ts`. Import `playToggleTimerPause`:

```ts
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

Update `maybeResumeCountdown` to leave a persisted-paused timer stopped:

```ts
function maybeResumeCountdown(
  game: OneTwentyOnePlayContext["$store"]["game"],
  config: NonNullable<
    OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"]
  >,
  engine: OneTwentyOneEngine,
): SegmentTimer | null {
  if (durationTypeOf(config) !== "MINUTES") return null;
  if (game.timerExpired) {
    engine.expireTimer();
    return null;
  }
  const durationValue = durationValueOf(config);
  if (durationValue == null) return null;
  const timer = startCountdown(game, durationValue, engine);
  if (game.timerPaused) {
    timer.stop();
  }
  return timer;
}
```

Add `togglePause`, right after `destroy`:

```ts
    destroy(this: OneTwentyOnePlayContext) {
      this.timer?.stop();
    },

    togglePause(this: OneTwentyOnePlayContext) {
      playToggleTimerPause(this);
    },
```

Add the `timerPaused` guard to `recordVisit`, `submitVisit`, `recordDart`, `undoVisit`, `maybeRunBotVisit`:

```ts
    async recordVisit(
      this: OneTwentyOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine || this.$store.game.timerPaused) return;
```

```ts
    async submitVisit(this: OneTwentyOnePlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    async recordDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
```

```ts
    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
      if (!this.engine) return;
```

```ts
    async maybeRunBotVisit(this: OneTwentyOnePlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (
        !botSeat ||
        !this.engine ||
        this.finished ||
        this.$store.game.timerPaused
      )
        return;
```

In `playAgain`'s `resetLocalState` callback:

```ts
        () => {
          this.$store.game.timerRemainingMs = null;
          this.$store.game.timerStartedAt = null;
          this.$store.game.timerExpired = false;
          this.$store.game.timerPaused = false;
          this.pendingCheckoutScore = null;
          this.pendingDartObservation = null;
          this.showDoubleConfirm = false;
          this.showSessionFinishConfirm = false;
          this.scoreInput.clear();
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the button to the UI**

Edit `app/src/components/layout/games/interfaces/OneTwentyOne.astro`. Add the icon imports:

```astro
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import Button from "@components/forms/Button.astro";

// Icons
import PauseIcon from "@icons/pause.svg";
import PlayIcon from "@icons/play.svg";
```

121's `MINUTES` display already lives inside `SinglePlayerDisplay`'s `progress` slot as a `StatRow` (`durationType() === 'MINUTES'`), not the standalone countdown block the other two games use — 121 only renders that standalone block for the 1v1 case (`SplitScoreboard` has no such row). Add the pause/resume button next to the existing standalone `MINUTES` block (used for the 1v1 layout):

```astro
  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="remainingLabel()"
    >
    </p>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Pause timer"
      :disabled="finished || showDoubleConfirm || showSessionFinishConfirm"
      @click="togglePause()"
      x-show="!$store.game.timerPaused"
      x-cloak
    >
      <PauseIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      icon
      ariaLabel="Resume timer"
      :disabled="finished || showDoubleConfirm || showSessionFinishConfirm"
      @click="togglePause()"
      x-show="$store.game.timerPaused"
      x-cloak
    >
      <PlayIcon
        class="size-5 text-muted"
        slot="iconBefore"
      />
    </Button>
  </div>
```

This block already exists in the file between the solo `SinglePlayerDisplay` and the `SplitScoreboard` templates (lines 55-65 of the current file) — replace it in place; do not duplicate the solo-view `StatRow` for `MINUTES`, which stays as-is (it has no room for a button and 121 is `MINUTES`-solo-only per the ruleset spec, so the standalone block below it is the only one ever visible when `MINUTES` is active).

Add `|| $store.game.timerPaused` to the `ScoreInput` disable expressions:

```astro
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
    class="px-3"
  />
```

- [ ] **Step 6: Run the full suite and the Astro check**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts && npx astro check`
Expected: PASS; 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/one-twenty-one-play.data.ts app/src/components/layout/games/interfaces/OneTwentyOne.astro app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "Add pause/resume to 121's MINUTES countdown"
```

---

### Task 7: Full validation, gates, context maintenance

**Files:** none (verification-only task).

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Format check**

Run: `cd app && npm run format && npm run format:check`
Expected: clean; if `format` produced a diff, stage and commit it separately:

```bash
git add -A
git commit -m "Format"
```

(skip this commit if `format` produced no changes)

- [ ] **Step 3: Run the repo's structural gates**

Invoke the `run-all-gates` skill (dispatches the `check-*.sh` scripts relevant to the changed `app/` files — file-locations, astro-conventions, game-wiring, test-coverage, style-tokens, no-inline-comments, among others).

Expected: every dispatched script reports pass.

- [ ] **Step 4: Manual smoke test**

Invoke the `run` skill (or `astro dev --background` directly) and, for each of Score Training, TUOD, and 121, start a `MINUTES` session and confirm: the pause button stops the countdown label; the keypad and undo become disabled while paused; the resume button continues the countdown from the same remaining time; a reload while paused stays paused (label unchanged, button still shows "resume").

- [ ] **Step 5: Context maintenance**

Invoke the `context-maintenance` skill (mandatory before claiming any Dart Analytics task done — CLAUDE.md sync, context-map registration if any doc moved/added, `decisions/**` entry if warranted, `FINDINGS.md` check).

- [ ] **Step 6: Push**

```bash
git push -u origin claude/pause-restart-timed-modes-0l1z9p
```
