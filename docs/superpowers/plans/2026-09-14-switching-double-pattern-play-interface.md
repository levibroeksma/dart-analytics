# Switching / Double Pattern Play Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Balanced Training's Switching and Double Pattern steps the same play screen shape as the app's games — points as the big number, a three-dart visit preview, and a visible step countdown.

**Architecture:** UI and play-data only. Both panels compose the existing game components (`SinglePlayerDisplay`, `VisitPreview`, `StatRow`) above the existing `ExerciseBoardInputPanel`, exactly as `interfaces/SinglesTraining.astro` composes them above `BoardInputPanel`. The step's hidden `setTimeout` deadline is replaced by a countdown `SegmentTimer` that drives both the on-screen clock and step expiry. `SwitchingEngine` and `DoublePatternEngine` stay `ExerciseEngine`s (D264) and are not touched.

**Tech Stack:** Astro 5, Alpine.js 3, TypeScript, Vitest, Tailwind v4.

Spec: `docs/superpowers/specs/2026-09-14-switching-double-pattern-play-interface-design.md`.

## Global Constraints

- Branch: `claude/training-routine-scoring-bug-6dfi3l` (already checked out; no worktrees — root `CLAUDE.md`).
- Engines are out of scope: no edits to `app/src/modules/exercise/**`, `app/src/services/**`, `database/**`.
- No board highlight: neither panel passes `highlightPathExpr` to `DartBoard`. That overlay stays Warm-Up-only.
- No pause/resume: the countdown is read-only. Do not add `CountdownPauseControl`, `CountdownResumePrompt`, or any `timerPaused` field.
- Alpine v3 shorthand only (`:attr`, `@event`); no `x-init`; every `x-show` also carries `x-cloak`.
- Semantic tokens only; build-time classes via `cn()`; no `font-medium`; no important modifier in either form.
- No `//` or `/* */` comments inside function bodies in `app/src/**/*.ts` — JSDoc above the declaration only.
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated.
- `cd app` before every `npm` command. Commit from the repo root.

---

### Task 1: Replace the step deadline with a countdown timer

**Files:**
- Modify: `app/src/lib/training/types.ts:27` (field), `:66-69` (method signature)
- Modify: `app/src/lib/training/balanced-training-play.data.ts:77` (field default), `:211-218` (call sites), `:271-280` (`armStepDeadline`), `:316-327` (`completeCurrentStep`), `:349-370` (`abandonAndExit`)
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `SegmentTimer` from `@modules/ui/segment-timer.module` (already imported by this file at line 12).
- Produces: `stepTimer: SegmentTimer | null`, `stepRemainingSeconds: number`, `startStepTimer(durationSeconds: number): void`, `formattedStepRemaining(): string` — Tasks 2 and 4 use `formattedStepRemaining()`.

- [ ] **Step 1: Add the AudioContext stub to the two dart-exercise describes**

`SegmentTimer.completeTimer()` calls `playBeep()`, which constructs an `AudioContext`. jsdom has none, so without a stub the timer throws on expiry and `onComplete` never runs. The first describe in this file already stubs it (lines 51-72); the `— Switching` and `— Double Pattern` describes do not.

In `app/tests/lib/training/balanced-training-play.data.test.ts`, add this helper directly above `describe("balancedTrainingPlay — Switching"`:

```ts
function stubAudioContext(): void {
  vi.stubGlobal(
    "AudioContext",
    vi.fn().mockImplementation(function () {
      return {
        createOscillator: () => ({
          connect: vi.fn(),
          frequency: {},
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: () => ({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }),
        destination: {},
        currentTime: 0,
      };
    }),
  );
}
```

Then in BOTH the `— Switching` and `— Double Pattern` describes, call it inside `beforeEach` (right after `vi.useFakeTimers();`) and unstub in `afterEach`:

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubAudioContext();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Write the failing tests**

Add these three tests inside `describe("balancedTrainingPlay — Switching"`, after the existing `recordSwitchingDart()` test:

```ts
  it("startCurrentStep() for SWITCHING starts a countdown that ticks stepRemainingSeconds", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.stepRemainingSeconds).toBe(300);
    vi.advanceTimersByTime(5_000);
    expect(store.stepRemainingSeconds).toBe(295);
  });

  it("formattedStepRemaining() renders m:ss", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    vi.advanceTimersByTime(19_000);
    expect(store.formattedStepRemaining()).toBe("4:41");
    vi.advanceTimersByTime(281_000);
    expect(store.formattedStepRemaining()).toBe("0:00");
  });

  it("completeCurrentStep() stops the step timer", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    await store.completeCurrentStep();
    expect(store.stepTimer).toBeNull();
    const afterStop = store.stepRemainingSeconds;
    vi.advanceTimersByTime(10_000);
    expect(store.stepRemainingSeconds).toBe(afterStop);
  });
```

Also rename the two existing test titles that say "arms a deadline" to "starts the countdown" — one in the `— Switching` describe (line ~317), one in `— Double Pattern` (line ~404). The assertions inside them do not change.

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: the three new tests FAIL — `stepRemainingSeconds` is `undefined` and `formattedStepRemaining` is not a function.

- [ ] **Step 4: Update the context type**

In `app/src/lib/training/types.ts`, replace the `stepDeadline` field (line 27):

```ts
  stepDeadline: ReturnType<typeof setTimeout> | null;
```

with:

```ts
  stepTimer: SegmentTimer | null;
  stepRemainingSeconds: number;
```

and replace the `armStepDeadline` signature (lines 66-69):

```ts
  armStepDeadline(
    this: BalancedTrainingPlayContext,
    durationSeconds: number,
  ): void;
```

with:

```ts
  startStepTimer(
    this: BalancedTrainingPlayContext,
    durationSeconds: number,
  ): void;
  formattedStepRemaining(this: BalancedTrainingPlayContext): string;
```

`SegmentTimer` is already imported at line 3 of that file.

- [ ] **Step 5: Swap the deadline for the timer in the play data**

In `app/src/lib/training/balanced-training-play.data.ts`:

(a) Replace the field default (line 77) `stepDeadline: null,` with:

```ts
    stepTimer: null,
    stepRemainingSeconds: 0,
```

(b) Replace `armStepDeadline` (lines 271-280) with:

```ts
    /**
     * The step's own clock. `SegmentTimer` drives both the on-screen
     * countdown and expiry, so there is no second scheduler to drift
     * against it. The engines stay clockless (D264): expiry reaches them
     * as `expireTimer()`.
     */
    startStepTimer(
      this: BalancedTrainingPlayContext,
      durationSeconds: number,
    ) {
      this.stepRemainingSeconds = durationSeconds;
      this.stepTimer = new SegmentTimer({
        segmentDurationsSeconds: [durationSeconds],
        direction: "countdown",
        onTick: (remaining) => {
          this.stepRemainingSeconds = remaining;
        },
        onComplete: () => {
          this.switchingEngine?.expireTimer();
          this.doublePatternEngine?.expireTimer();
          void this.completeCurrentStep();
        },
      });
      this.stepTimer.start();
    },

    formattedStepRemaining(this: BalancedTrainingPlayContext): string {
      const remaining = Math.max(0, this.stepRemainingSeconds);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
```

(c) Update both call sites in `startCurrentStep` (lines 213 and 217) from `this.armStepDeadline(step.durationSeconds);` to:

```ts
        this.startStepTimer(step.durationSeconds);
```

(d) In `completeCurrentStep` (lines 320-323), replace:

```ts
      if (this.stepDeadline) {
        clearTimeout(this.stepDeadline);
        this.stepDeadline = null;
      }
```

with:

```ts
      if (this.stepTimer) {
        this.stepTimer.stop();
        this.stepTimer = null;
      }
```

(e) In `abandonAndExit`, make the same replacement at BOTH occurrences — the `finishing` early-return branch (lines 351-354) and the main branch (lines 361-364).

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: PASS, whole file green — including the pre-existing "expires the engine and completes the step" tests, which now expire through the timer.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format
cd /home/user/dart-analytics && git add app/src/lib/training/types.ts app/src/lib/training/balanced-training-play.data.ts app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat: drive training step expiry from a visible countdown timer

One SegmentTimer replaces the hidden setTimeout deadline, so the step's
remaining time is readable state instead of an invisible schedule.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ba9XVnAr6oRpvPGRhjr6jf
EOF
)"
```

---

### Task 2: Points, target and darts view methods

**Files:**
- Modify: `app/src/lib/training/types.ts` (method signatures, beside `formattedStepRemaining`)
- Modify: `app/src/lib/training/balanced-training-play.data.ts` (methods, beside `undoVisit`)
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `activeDartEngine(): SwitchingEngine | DoublePatternEngine | null` (existing, line 92).
- Produces: `switchingPoints(): number`, `switchingTargetLabel(): string`, `doublePatternPoints(): number`, `doublePatternLabel(): string`, `dartsThrown(): number` — Task 4's markup binds all five.

- [ ] **Step 1: Write the failing tests**

Add to the `— Switching` describe:

```ts
  it("switchingPoints() and switchingTargetLabel() read the engine's derived state", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.switchingPoints()).toBe(0);
    expect(store.switchingTargetLabel()).toBe("20");
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -103,
    });
    expect(store.switchingPoints()).toBe(3);
    expect(store.switchingTargetLabel()).toBe("19");
    expect(store.dartsThrown()).toBe(1);
  });
```

Add to the `— Double Pattern` describe:

```ts
  it("doublePatternPoints() and doublePatternLabel() read the engine's derived state", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.doublePatternLabel()).toBe("D20");
    expect(store.doublePatternPoints()).toBe(0);
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    expect(store.doublePatternPoints()).toBe(1);
    expect(store.doublePatternLabel()).toBe("D10");
    expect(store.dartsThrown()).toBe(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: FAIL — `store.switchingPoints is not a function`.

- [ ] **Step 3: Add the signatures to the context type**

In `app/src/lib/training/types.ts`, directly after the `formattedStepRemaining` signature added in Task 1:

```ts
  switchingPoints(this: BalancedTrainingPlayContext): number;
  switchingTargetLabel(this: BalancedTrainingPlayContext): string;
  doublePatternPoints(this: BalancedTrainingPlayContext): number;
  doublePatternLabel(this: BalancedTrainingPlayContext): string;
  dartsThrown(this: BalancedTrainingPlayContext): number;
```

- [ ] **Step 4: Implement the methods**

In `app/src/lib/training/balanced-training-play.data.ts`, directly above `undoVisit` (line ~298):

```ts
    switchingPoints(this: BalancedTrainingPlayContext): number {
      return this.switchingEngine?.state().totalPoints ?? 0;
    },

    switchingTargetLabel(this: BalancedTrainingPlayContext): string {
      const target = this.switchingEngine?.state().currentTargetNumber;
      return target === undefined ? "" : String(target);
    },

    doublePatternPoints(this: BalancedTrainingPlayContext): number {
      return this.doublePatternEngine?.state().totalPoints ?? 0;
    },

    doublePatternLabel(this: BalancedTrainingPlayContext): string {
      const double = this.doublePatternEngine?.state().currentDoubleNumber;
      return double === undefined ? "" : `D${double}`;
    },

    dartsThrown(this: BalancedTrainingPlayContext): number {
      return this.activeDartEngine()?.state().dartsThrown ?? 0;
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: PASS, whole file green.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format
cd /home/user/dart-analytics && git add app/src/lib/training/types.ts app/src/lib/training/balanced-training-play.data.ts app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat: expose switching and double pattern readouts to the play screen

Points, current target and darts thrown, each derived from the engine's
own state() rather than accumulated on the play context.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ba9XVnAr6oRpvPGRhjr6jf
EOF
)"
```

---

### Task 3: Visit preview segments

**Files:**
- Modify: `app/src/lib/training/types.ts` (signature + `PreviewSegment` import on line 11)
- Modify: `app/src/lib/training/balanced-training-play.data.ts` (method + `playPreviewSegments` import)
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `playPreviewSegments(turns, hiddenTurnKey, classify)` from `@lib/game/play-lifecycle`; `PreviewSegment = { status: "hit" | "miss" | "empty" }` from `@lib/types`.
- Produces: `previewSegments(): PreviewSegment[]` — Task 4's `<VisitPreview />` binds it.

- [ ] **Step 1: Let the real `playPreviewSegments` through the module mock**

The test file mocks `@lib/game/play-lifecycle` wholesale (lines 14-16), so `playPreviewSegments` would be `undefined` under test. Replace that mock with a passthrough that keeps every real export and stubs only `playAbandonAndExit`:

```ts
vi.mock("@lib/game/play-lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lib/game/play-lifecycle")>()),
  playAbandonAndExit: vi.fn(),
}));
```

- [ ] **Step 2: Write the failing tests**

Add to the `— Switching` describe:

```ts
  it("previewSegments() marks an on-target dart hit and an off-target dart miss", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.previewSegments()).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: -120,
    });
    store.recordSwitchingDart({
      hitTargetNumber: 7,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 120,
    });
    expect(store.previewSegments()).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
```

Add to the `— Double Pattern` describe:

```ts
  it("previewSegments() counts only the double as a hit", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    store.recordDoublePatternDart({
      hitTargetNumber: 10,
      hitZoneKey: "SINGLE",
      locationX: 120,
      locationY: 40,
    });
    expect(store.previewSegments()).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: FAIL — `store.previewSegments is not a function`.

- [ ] **Step 4: Add the signature and type import**

In `app/src/lib/training/types.ts`, extend the existing `@lib/types` import (line 11) to carry both types:

```ts
import type { BoardMarker, PreviewSegment } from "@lib/types";
```

and add the signature beside the Task 2 methods:

```ts
  previewSegments(this: BalancedTrainingPlayContext): PreviewSegment[];
```

- [ ] **Step 5: Implement the method**

In `app/src/lib/training/balanced-training-play.data.ts`, add the import beside the other `@lib/game` imports:

```ts
import { playPreviewSegments } from "@lib/game/play-lifecycle";
```

and add `PreviewSegment` to the existing `@lib/types` type import block. Then add the method directly below `visitMarkers` (line ~98):

```ts
    /**
     * Hit/miss marks for the current visit's darts. Each dart carries the
     * target it was thrown at (`intendedTargetNumber`), so no config lookup
     * is needed; Double Pattern additionally requires the double, since
     * nothing else scores under `DOUBLE_PATTERN_V1`.
     */
    previewSegments(this: BalancedTrainingPlayContext): PreviewSegment[] {
      const turns = this.activeDartEngine()?.facts().turns ?? [];
      const requireDouble = this.doublePatternEngine !== null;
      return playPreviewSegments(turns, null, (dart) =>
        dart.hitTargetNumber === dart.intendedTargetNumber &&
        (!requireDouble || dart.hitZoneKey === "DOUBLE")
          ? "hit"
          : "miss",
      );
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: PASS, whole file green.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format
cd /home/user/dart-analytics && git add app/src/lib/training/types.ts app/src/lib/training/balanced-training-play.data.ts app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
feat: derive visit preview segments for the dart exercises

Reuses the games' playPreviewSegments, classifying each dart against the
intendedTargetNumber the engines already stamp on every fact.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ba9XVnAr6oRpvPGRhjr6jf
EOF
)"
```

---

### Task 4: Rebuild both panels on the game shape

**Files:**
- Modify: `app/src/components/layout/training/SwitchingPanel.astro` (whole file)
- Modify: `app/src/components/layout/training/DoublePatternPanel.astro` (whole file)

**Interfaces:**
- Consumes: `switchingPoints()`, `switchingTargetLabel()`, `doublePatternPoints()`, `doublePatternLabel()`, `dartsThrown()`, `formattedStepRemaining()`, `previewSegments()` — all from Tasks 1-3, all in scope because both panels mount inside the page's `x-data="balancedTrainingPlay()"`.
- Produces: nothing consumed by later tasks.

No unit test: there is no Astro component test runner in this project, and per D101 branching logic stays inline in the component rather than being extracted to make it testable. `scripts/check-test-coverage.sh` covers runtime `.ts` under `app/src/` — `.astro` files are outside it, so this task commits without a test edit.

- [ ] **Step 1: Rewrite `SwitchingPanel.astro`**

Replace the entire contents of `app/src/components/layout/training/SwitchingPanel.astro` with:

```astro
---
// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <SinglePlayerDisplay
    isTarget={false}
    score="switchingPoints()"
    class="max-h-2/5 h-full"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="Target"
          value="switchingTargetLabel()"
        />
        <StatRow
          label="Darts"
          value="dartsThrown()"
        />
        <StatRow
          label="Time"
          value="formattedStepRemaining()"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>

  <VisitPreview />

  <ExerciseBoardInputPanel />
</div>
```

- [ ] **Step 2: Rewrite `DoublePatternPanel.astro`**

Replace the entire contents of `app/src/components/layout/training/DoublePatternPanel.astro` with:

```astro
---
// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <SinglePlayerDisplay
    isTarget={false}
    score="doublePatternPoints()"
    class="max-h-2/5 h-full"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="Double"
          value="doublePatternLabel()"
        />
        <StatRow
          label="Darts"
          value="dartsThrown()"
        />
        <StatRow
          label="Time"
          value="formattedStepRemaining()"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>

  <VisitPreview />

  <ExerciseBoardInputPanel />
</div>
```

- [ ] **Step 3: Run the markup gates**

```bash
cd /home/user/dart-analytics && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh
```

Expected: all four exit 0 with no findings for the two panels.

- [ ] **Step 4: Type-check**

```bash
cd app && npx astro check --minimumFailingSeverity hint
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format
cd /home/user/dart-analytics && git add app/src/components/layout/training/SwitchingPanel.astro app/src/components/layout/training/DoublePatternPanel.astro
git commit -m "$(cat <<'EOF'
feat: give the dart exercises the game play-screen shape

Points as the primary readout with target, darts and remaining time as
stat rows, over the shared three-dart visit preview.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ba9XVnAr6oRpvPGRhjr6jf
EOF
)"
```

---

### Task 5: Docs, decision, and full validation

**Files:**
- Modify: `decisions/frontend/astro.md` (append D275)
- Modify: `docs/architecture/09-training-routines.md` §17 (two "Implemented" notes)
- Modify: `docs/architecture/00-File-Inventory.md` (the `09-training-routines.md` row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append spec + plan rows)

**Interfaces:**
- Consumes: everything Tasks 1-4 shipped.
- Produces: nothing.

- [ ] **Step 1: Append the decision**

Append to the end of `decisions/frontend/astro.md`:

```markdown
### D275 — Dart exercise panels adopt the game play-screen shape; a timed step's clock is a countdown `SegmentTimer`
Status: Accepted · Date: 2026-09-14
Decision: `SwitchingPanel.astro` and `DoublePatternPanel.astro` render the skeleton every board-input game already uses — `SinglePlayerDisplay` (`isTarget={false}`, total points as the big number) with target/darts/remaining-time `StatRow`s in its `progress` slot, `VisitPreview` beneath it, then the existing `ExerciseBoardInputPanel`. Neither passes `DartBoard`'s `highlightPathExpr`: that overlay stays Warm-Up-only. The step's hidden `setTimeout` deadline is replaced by one countdown `SegmentTimer` (`segmentDurationsSeconds: [durationSeconds]`, `direction: "countdown"`) whose `onTick` publishes `stepRemainingSeconds` and whose `onComplete` runs the engine's `expireTimer()` then `completeCurrentStep()` — the same expiry the `setTimeout` performed. The countdown is read-only; no pause/resume, no `timerPaused` for exercises.
Reason: the reported "the second game's scoring on 20's doesn't have an input" was not a capture defect — `classify()` resolves the 20 sector correctly and `SwitchingEngine` scores it like any other target. What the screen lacked was every confirmation a game gives: no score in the familiar shape, no per-dart hit/miss mark, no sense of how long the step had left. Reusing the game components rather than inventing panel-specific markup makes the exercise read as what it is. One clock rather than a timer plus a deadline removes the possibility of the display and the expiry disagreeing.
Consequences: the step now ends with `SegmentTimer`'s completion beep (440 Hz, 0.6 s), where it previously ended silently mid-visit; no interim beeps fire, since `intervalMinutes` is not passed and `tickCountdown`'s `remaining % 0` never matches. `playPreviewSegments` renders exactly three slots, which matches a Switching visit (one pass through `config.targets`) and a Double Pattern visit (one pattern) in the seeded Balanced Training configuration — a future four-target configuration would show only its first three darts. `SwitchingEngine` and `DoublePatternEngine` remain `ExerciseEngine`s (D264): no `RulesetVersionKey`, no seats, no `game_types` row. D101 applies to both panels — markup only, no component test.
Supersedes: none.
```

- [ ] **Step 2: Record the shipped UI in the architecture doc**

In `docs/architecture/09-training-routines.md` §17, append one sentence to the Switching "**Implemented**" paragraph (the one ending "…by omission rather than by a configured value."):

```markdown
Its play screen renders total points as the primary readout with target/darts/remaining-time stat rows and a three-dart visit preview, the same shape a board-input game uses (D275, 2026-09-14).
```

and one to the Double Patterns "**Implemented**" paragraph (ending "…One point per hit double; nothing else scores."):

```markdown
Its play screen uses the same shape as Switching's, labelling the current target `D20` and counting only a hit double as a preview hit (D275, 2026-09-14).
```

- [ ] **Step 3: Update the file inventory row**

In `docs/architecture/00-File-Inventory.md` line 32, append to the `09-training-routines.md` row's description, before the closing `|`:

```markdown
; Switching/Double Pattern play screens rebuilt on the game shape with a visible step countdown per `docs/superpowers/specs/2026-09-14-switching-double-pattern-play-interface-design.md` (D275, 2026-09-14)
```

- [ ] **Step 4: Append the history rows**

Append to `docs/architecture/00-Context-Map-History.md`:

```markdown
| `docs/superpowers/specs/2026-09-14-switching-double-pattern-play-interface-design.md` | Design giving Balanced Training's Switching and Double Pattern steps the game play-screen shape — `SinglePlayerDisplay` points readout, `VisitPreview`, stat rows — plus one countdown `SegmentTimer` replacing the hidden `setTimeout` step deadline. Records that the reported "no input on 20" was a feedback gap, not a capture defect: `classify()` and `SwitchingEngine` handle 20 correctly today. Out of scope: engine conversion (they stay `ExerciseEngine`s per D264), the Warm-Up-only board highlight, pause/resume (2026-09-14) | historical |
| `docs/superpowers/plans/2026-09-14-switching-double-pattern-play-interface.md` | The 5-task plan implementing that spec: countdown timer swap (Task 1), points/target/darts view methods (Task 2), visit preview segments (Task 3), both panels' markup (Task 4), docs + D275 + full validation (Task 5) (2026-09-14) | historical |
```

- [ ] **Step 5: Run the context and gate checks**

```bash
cd /home/user/dart-analytics && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh
```

Expected: all three exit 0.

- [ ] **Step 6: Run full app validation**

```bash
cd app && npm run validate:app && npm run format:check
```

Expected: every step exits 0, `npx fallow` included, and the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit and push**

```bash
cd /home/user/dart-analytics && git add decisions/frontend/astro.md docs/architecture/09-training-routines.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md
git commit -m "$(cat <<'EOF'
docs: record D275 and the shipped exercise play screens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ba9XVnAr6oRpvPGRhjr6jf
EOF
)"
git push -u origin claude/training-routine-scoring-bug-6dfi3l
```

---

## Manual verification

Unit tests cannot prove the screen looks right. After Task 5, run the app and play the routine through step 3:

```bash
cd app && npx astro dev --background
```

Open `/training/balanced-training`, start the routine, skip through the warm-up, and confirm on the Switching step: points sit in the big card, the target reads `20`, the countdown ticks down, a dart on the 20 wedge marks the first preview slot as a hit and advances the target to `19`, undo reverses it, and the step ends with a beep and advances to Double Pattern.
