# Exercise Play Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle routine exercise play to `Exercise Play.dc.html`: routine-level ready gate, game-style header, exercise shell built from the game-play primitives, Warm-Up spotlight board.

**Architecture:** Extend the shared game-play components with optional props whose defaults reproduce today's markup (games stay byte-identical, proven by a build diff); delete the exercise-only copy `ExerciseBoardInputPanel`. Logic lives in pure TS helpers (TDD); `.astro` files only bind them.

**Tech Stack:** Astro (prerendered pages), Alpine.js, TypeScript, Tailwind v4 (no arbitrary values, D451), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-exercise-play-restyle-design.md`

## Global Constraints

- Precondition: #915 task B (`refactor/915-seated-play-screen`) merged to `main`. Before Task 0, `git fetch && git rebase origin/main` on `feat/exercise-play-restyle`.
- Engines (`app/src/modules/training/exercises/*`), facts, API and DB unchanged.
- Game play pages: rendered HTML byte-identical before/after (D445 method, Task 0 / Task 8).
- No Tailwind arbitrary values (`prop-[…]`), no `!important`, no `{...rest}` spread named `rest` — `scripts/check-style-tokens.sh`. Dynamic geometry goes through Alpine `:style`; fixed odd values through a named `@utility` in `app/src/styles/global.css`.
- No inline `//` comments inside function bodies (gate); JSDoc on exported functions.
- Tests under `app/tests/` mirroring `app/src/`. Commands from `app/`: `npm test`, `npm run check`, `npm run build`.
- Colours: design "SKY" = `accent-bright` token; accent = `accent`.
- Commit after each task; end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Incidental findings → GitHub issue via `capturing-discovered-work`; never fixed in this branch.

## Review Focus

1. **Resume path:** a reopened routine (`resumeOpenRoutine` → `beginRoutine(result, n)`) must show the gate and, on confirm, start step n+1 — not step 1. Test in Task 2.
2. **Double-confirm:** a second slide / Enter while the first `startCurrentStep()` is in flight must not start the step twice. Test in Task 2.
3. **Step failure behind the gate:** a `startTrainingStep` rejection after confirm surfaces `error`, and the blocking-session modal still works. Test in Task 2.
4. **Double Pattern variable visit length:** a 2-dart pattern followed by a 3-dart pattern renders 2 then 3 preview columns, and a finished visit still shows its own darts until the next dart. Test in Task 4.
5. **Header after finish:** once the last step completes, header title = routine name, subtitle `COMPLETE`, no clock pill. Test in Task 1.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `app/src/lib/training/routines/adapters/interfaces.ts` | modify | `StepAdapter.title` |
| `app/src/lib/training/routines/adapters/*.adapter.ts`, `step-adapter.registry.ts`, `game.adapter.ts` | modify | Title Case `title` per step kind |
| `app/src/lib/training/routines/routine-header.ts` | create | pure header title / subtitle / clock |
| `app/src/lib/training/routines/ready-gate.ts` | create | pure gate eyebrow + rows |
| `app/src/lib/training/routines/exercise-preview.ts` | create | pure exercise visit-preview segments + sequences |
| `app/src/lib/training/routines/routine-play.data.ts` | modify | gate flow, header methods, preview, sequences, Warm-Up paths |
| `app/src/lib/training/routines/types.ts` | modify | context fields/methods |
| `app/src/stores/training-session.store.ts` | modify | remove `headerLabel` getter |
| `app/src/lib/game/types.ts` | modify | `PreviewSegment.label`, `"value"` |
| `app/src/lib/ui/play-display.ts` | modify | `previewColumnState` passes label |
| `app/src/lib/game/board/board-highlight.module.ts` | modify | `dartboardDimPath`, `sectionRingPaths` |
| `app/src/pages/training/routines/play/index.astro` | modify | `x-data` onto `GameLayout`, header exprs, gate, pill |
| `app/src/components/layout/games/HeaderClockPill.astro` | create | header clock pill |
| `app/src/components/layout/training/routines/RoutineReadyGate.astro` | create | gate card |
| `app/src/components/forms/SlideToStart.astro` | modify | `inline` prop |
| `app/src/components/layout/games/VisitPreview.astro` | modify | labels, `"value"`, column count |
| `app/src/components/layout/games/PlayStatTile.astro` | modify | `highlight`, `fit` |
| `app/src/components/layout/games/RouteChips.astro` | modify | `currentExpr` |
| `app/src/components/layout/games/BoardInputPanel.astro` | modify | `showExpr`, `undoDisabledExpr` |
| `app/src/components/layout/training/exercises/ExercisePanelShell.astro` | modify | caption / chip / tiles |
| `app/src/components/layout/training/exercises/*Panel.astro` (9) | modify | new shell props |
| `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro` | delete | replaced by `BoardInputPanel` |
| `app/src/components/layout/training/exercises/WarmUpPanel.astro` | rewrite | spotlight board |
| `app/src/components/ui/DartBoard.astro` | modify | `dimPathExpr`, outline glow |
| `app/src/components/ui/SectionRing.astro` | create | sectioned progress ring overlay |
| `app/src/styles/global.css` | modify | `section-ring-inset`, `highlight-glow` utilities |

---

### Task 0: Parity baseline

**Files:** none in repo (scratchpad only).

- [ ] **Step 1: Rebase and build the baseline**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
git fetch origin && git rebase origin/main
cd app && npm run build
```
Expected: build succeeds.

- [ ] **Step 2: Snapshot every game play route**

```bash
SNAP=/private/tmp/claude-502/-Users-levi-broeksma-Dev-dart-analytics/46838d8f-373d-41fc-baf5-ab4b3754325a/scratchpad/parity-before
rm -rf "$SNAP" && mkdir -p "$SNAP"
cd /Users/levi.broeksma/Dev/dart-analytics/app/dist
find games -path '*/play/index.html' -exec cp --parents {} "$SNAP" \; 2>/dev/null || \
  find games -path '*/play/index.html' | while read f; do mkdir -p "$SNAP/$(dirname "$f")"; cp "$f" "$SNAP/$f"; done
find "$SNAP" -name index.html | wc -l
```
Expected: one file per game play route (≥ 11). Record the count.

No commit.

---

### Task 1: Step titles + routine header

**Files:**
- Modify: `app/src/lib/training/routines/adapters/interfaces.ts`, every `adapters/*.adapter.ts`, `adapters/step-adapter.registry.ts`, `adapters/game.adapter.ts`
- Create: `app/src/lib/training/routines/routine-header.ts`
- Create: `app/src/components/layout/games/HeaderClockPill.astro`
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `app/src/lib/training/routines/types.ts`
- Modify: `app/src/stores/training-session.store.ts`
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/routine-header.test.ts` (create), `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts` (create or extend if present), `app/tests/stores/training-session.store.test.ts`

**Interfaces:**
- Produces: `StepAdapter.title: string`.
- Produces: `routineHeader(input: RoutineHeaderInput): { title: string; subtitle: string; clock: string; clockLabel: string }` where
  ```ts
  export type RoutineHeaderInput = {
    routineName: string;
    ready: boolean;
    finished: boolean;
    stepIndex: number;        // 0-based index into steps, -1 when none
    stepCount: number;
    adapter: { title: string; panel: string } | null;
    stepRemaining: string | null; // formatted, null when no step timer
    warmUpElapsed: string;
  };
  ```
- Produces on `routinePlay()`: `headerTitle(): string`, `headerSubtitle(): string`, `headerClock(): string`, `headerClockLabel(): string`.

- [ ] **Step 1: Failing tests**

`app/tests/lib/training/routines/routine-header.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { routineHeader } from "@lib/training/routines/routine-header";
import type { RoutineHeaderInput } from "@lib/training/routines/routine-header";

const base: RoutineHeaderInput = {
  routineName: "Pre-match warm-up",
  ready: true,
  finished: false,
  stepIndex: 1,
  stepCount: 5,
  adapter: { title: "Switching", panel: "switching" },
  stepRemaining: "3:48",
  warmUpElapsed: "0:00",
};

describe("routineHeader", () => {
  it("names the step and its position while a scored step runs", () => {
    expect(routineHeader(base)).toEqual({
      title: "Switching",
      subtitle: "STEP 2 OF 5",
      clock: "3:48",
      clockLabel: "Step time remaining",
    });
  });

  it("shows the Warm-Up's elapsed time instead of a countdown", () => {
    const header = routineHeader({
      ...base,
      stepIndex: 0,
      adapter: { title: "Warm-Up", panel: "warm-up" },
      stepRemaining: null,
      warmUpElapsed: "0:42",
    });
    expect(header.clock).toBe("0:42");
    expect(header.clockLabel).toBe("Elapsed");
  });

  it("shows no clock on a game step, which keeps its own countdown", () => {
    const header = routineHeader({
      ...base,
      adapter: { title: "Ten Up One Down", panel: "tuod" },
      stepRemaining: null,
    });
    expect(header.title).toBe("Ten Up One Down");
    expect(header.clock).toBe("");
  });

  it("names the routine, with no subtitle or clock, behind the ready gate", () => {
    expect(routineHeader({ ...base, ready: false, adapter: null })).toEqual({
      title: "Pre-match warm-up",
      subtitle: "",
      clock: "",
      clockLabel: "",
    });
  });

  it("names the routine as complete once the last step finishes", () => {
    expect(routineHeader({ ...base, finished: true })).toEqual({
      title: "Pre-match warm-up",
      subtitle: "COMPLETE",
      clock: "",
      clockLabel: "",
    });
  });
});
```

Adapter titles — append to (or create) `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { STEP_ADAPTERS } from "@lib/training/routines/adapters/step-adapter.registry";

describe("STEP_ADAPTERS titles", () => {
  it("gives every step kind a Title Case header title", () => {
    expect(
      Object.fromEntries(
        Object.values(STEP_ADAPTERS).map((adapter) => [adapter.key, adapter.title]),
      ),
    ).toMatchInlineSnapshot();
  });
});
```
Run once with `npx vitest run -u <file>` only after Step 3, then hand-check the snapshot equals the table in Step 3 (do not accept it blind).

Store — in `app/tests/stores/training-session.store.test.ts` delete the four tests that assert `headerLabel` ("starts empty, with no header label…", "renders the routine clock beside the running step", "keeps counting past an hour's worth of minutes", the `headerLabel` line in "reset() clears…" and "markComplete()…"). Their guarantee (header names the running step / complete) is re-pointed at `routineHeader` above. Keep `elapsedLabel` / `stepLabel` tests.

In `app/tests/lib/training/routines/routine-play.data.test.ts`, the tests "the routine clock starts with the Warm-Up and reports the running step in the header", "the routine clock keeps running across a step change, and the header names the new step" and "stops the routine clock and marks the header complete…": replace each `trainingSession.headerLabel` assertion with the equivalent `store.headerTitle()` / `store.headerSubtitle()` assertion (e.g. `expect(store.headerTitle()).toBe("Warm-Up"); expect(store.headerSubtitle()).toBe("STEP 1 OF 2")`; complete → routine name + `"COMPLETE"`). Keep their `elapsedSeconds` assertions.

- [ ] **Step 2: Run, expect FAIL**

Run: `cd app && npm test`
Expected: FAIL — `routine-header` module not found; `title` undefined; `headerTitle is not a function`.

- [ ] **Step 3: Implement**

`interfaces.ts` — add under `headerLabel`:

```ts
  /** The play header's own title for this step, Title Case ("Target Scoring"). */
  title: string;
```

Titles (add `title:` beside each `headerLabel:`; `gameAdapter` input gains `title: string` and returns `title: input.title`):

| key | title |
|---|---|
| WARM_UP | `Warm-Up` |
| SWITCHING | `Switching` |
| DOUBLE_PATTERN | `Double Pattern` |
| TARGET_SCORING | `Target Scoring` |
| SWITCHING_TARGET_SCORING | `Switch Target Scoring` |
| SCORE_THRESHOLD | `65 or More` |
| BULLSEYE_CHECKOUT | `Bullseye Checkouts` |
| BULL_UP | `Bull Up Practice` |
| CHECKOUT_SEQUENCE | `Catch 40` |
| RANDOM_CHECKOUT | `Random Checkout` |
| GAME (headerLabel "finishing") | `Ten Up One Down` |
| GAME ("scoring") | `Score Training` |
| GAME ("121") | `121` |
| GAME ("around the clock") | `Around the Clock` |

`app/src/lib/training/routines/routine-header.ts`:

```ts
export type RoutineHeaderInput = {
  routineName: string;
  ready: boolean;
  finished: boolean;
  stepIndex: number;
  stepCount: number;
  adapter: { title: string; panel: string } | null;
  stepRemaining: string | null;
  warmUpElapsed: string;
};

export type RoutineHeader = {
  title: string;
  subtitle: string;
  clock: string;
  clockLabel: string;
};

/**
 * The routine play header (design `Exercise Play.dc.html`): the step's
 * title over `STEP n OF m`, and the step clock — a countdown for a scored
 * exercise, elapsed time for Warm-Up, nothing for a game step (its own
 * countdown sits above the game). Behind the ready gate and after the last
 * step, the routine's name stands in.
 */
export function routineHeader(input: RoutineHeaderInput): RoutineHeader {
  const idle = { clock: "", clockLabel: "" };
  if (input.finished) {
    return { title: input.routineName, subtitle: "COMPLETE", ...idle };
  }
  if (!input.ready || !input.adapter || input.stepIndex < 0) {
    return { title: input.routineName, subtitle: "", ...idle };
  }
  const subtitle = `STEP ${input.stepIndex + 1} OF ${input.stepCount}`;
  if (input.adapter.panel === "warm-up") {
    return {
      title: input.adapter.title,
      subtitle,
      clock: input.warmUpElapsed,
      clockLabel: "Elapsed",
    };
  }
  if (input.stepRemaining !== null) {
    return {
      title: input.adapter.title,
      subtitle,
      clock: input.stepRemaining,
      clockLabel: "Step time remaining",
    };
  }
  return { title: input.adapter.title, subtitle, ...idle };
}
```

`routine-play.data.ts` — add (and declare in `RoutinePlayContext` in `types.ts`; `routineReady: boolean` is added in Task 2 — for now add the field with initial value `true` so Task 1 is green on its own):

```ts
    header(this: RoutinePlayContext): RoutineHeader {
      const step = this.currentStep();
      return routineHeader({
        routineName: this.routineName,
        ready: this.routineReady,
        finished: this.routineFinished,
        stepIndex: step ? this.steps.indexOf(step) : -1,
        stepCount: this.steps.length,
        adapter: this.adapter,
        stepRemaining: this.stepTimer ? this.formattedStepRemaining() : null,
        warmUpElapsed: this.formattedWarmUpElapsed(),
      });
    },

    headerTitle(this: RoutinePlayContext): string {
      return this.header().title;
    },

    headerSubtitle(this: RoutinePlayContext): string {
      return this.header().subtitle;
    },

    headerClock(this: RoutinePlayContext): string {
      return this.header().clock;
    },

    headerClockLabel(this: RoutinePlayContext): string {
      return this.header().clockLabel;
    },
```

If `steps.indexOf(currentStep())` is not the step's position (check `currentStep()`'s source first), use `step.sequenceNumber - 1` instead and say so in the commit.

`training-session.store.ts` — delete the `headerLabel` getter and its line in the JSDoc; leave `COMPLETE_LABEL`/`stepLabel` (still read by `stepLabel` tests). Grep `headerLabel` under `app/src` afterwards: only adapter `headerLabel` fields, `replay.store.ts`, `routine-stats.store.ts` may remain.

`HeaderClockPill.astro`:

```astro
---
/**
 * The play header's clock pill (design `Exercise Play.dc.html`): a 44px
 * `inset-well` mono readout in `GameLayout`'s `header-end` slot, with no
 * control — unlike `CountdownPauseControl`, it cannot pause.
 * @param {string} valueExpr Alpine expression for the clock text
 * @param {string} ariaLabelExpr Alpine expression for the accessible name
 * @param {string} showExpr Alpine expression; hidden while false
 */
interface Props {
  valueExpr: string;
  ariaLabelExpr: string;
  showExpr: string;
}

// Props
const { valueExpr, ariaLabelExpr, showExpr }: Props = Astro.props;
---

<span
  class="inset-well flex h-11 min-w-19 shrink-0 items-center justify-center rounded-full px-3 font-mono text-body-sm font-medium tabular-nums text-foreground"
  role="timer"
  x-show={showExpr}
  x-cloak
  x-text={valueExpr}
  {...{ ":aria-label": ariaLabelExpr }}
></span>
```
(`min-w-19` / `text-body-sm` must exist in the theme — `h-19` and `text-body-sm` are used today; if `min-w-19` is rejected by `npm run check`/style gate, use `min-w-18`.)

`pages/training/routines/play/index.astro` — move the play scope onto the layout so header expressions resolve in it (D432; rest props land on the wrapper around header and main):

```astro
<GameLayout
  title="Routine — Play"
  gameTitleExpr="headerTitle()"
  gameSubtitleExpr="headerSubtitle()"
  x-data="routinePlay()"
  @confirm-exit.window="abandonAndExit()"
>
  <HeaderClockPill
    slot="header-end"
    valueExpr="headerClock()"
    ariaLabelExpr="headerClockLabel()"
    showExpr="headerClock() !== ''"
  />
  <div class="flex flex-col flex-1 min-h-0">
```
(remove `x-data`/`@confirm-exit.window` from that inner `div`; add the `HeaderClockPill` import.)

`ExercisePanelShell.astro` — delete the appended `Time` row (`allRows` becomes `rows`).

- [ ] **Step 4: Run, expect PASS**

Run: `cd app && npm test && npm run check`
Expected: all pass, 0 errors/hints.

- [ ] **Step 5: Commit**

```bash
git add -A app/src app/tests
git commit -m "feat(routines): step title header with clock pill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Routine ready gate

**Files:**
- Create: `app/src/lib/training/routines/ready-gate.ts`
- Create: `app/src/components/layout/training/routines/RoutineReadyGate.astro`
- Modify: `app/src/components/forms/SlideToStart.astro`
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `types.ts`, `adapters/warm-up.adapter.ts`
- Modify: `app/src/components/layout/training/exercises/WarmUpPanel.astro` (remove gate only; restyle is Task 7)
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/ready-gate.test.ts` (create), `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Consumes: `StepAdapter.title`, `resolveStepAdapter`, `stepAdapterKey` (existing).
- Produces: `readyGate(steps: { title: string; durationSeconds: number }[]): { eyebrow: string; rows: { number: string; title: string; duration: string }[] }`.
- Produces on `routinePlay()`: `routineReady: boolean` (initial `false`), `confirmingReady: boolean`, `confirmRoutineReady(): Promise<void>`, `readyGateView(): ReturnType<typeof readyGate>`.
- Removes: `warmUpReady`, `confirmWarmUpReady()`.

- [ ] **Step 1: Failing tests**

`app/tests/lib/training/routines/ready-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readyGate } from "@lib/training/routines/ready-gate";

describe("readyGate", () => {
  it("counts the steps and their minutes, and lists each step", () => {
    expect(
      readyGate([
        { title: "Warm-Up", durationSeconds: 300 },
        { title: "Switching", durationSeconds: 270 },
      ]),
    ).toEqual({
      eyebrow: "2 STEPS · 10 MIN",
      rows: [
        { number: "01", title: "Warm-Up", duration: "5:00" },
        { number: "02", title: "Switching", duration: "4:30" },
      ],
    });
  });

  it("rounds the total up to a whole minute and says STEP for one", () => {
    expect(readyGate([{ title: "Catch 40", durationSeconds: 61 }]).eyebrow).toBe(
      "1 STEP · 2 MIN",
    );
  });
});
```

`routine-play.data.test.ts`:
- Add helper near `makeStore`:
  ```ts
  async function startRoutine(store: RoutinePlayContext) {
    await store.init();
    await store.confirmRoutineReady();
  }
  ```
  Replace every `await store.init();` in tests that then expect a running step with `await startRoutine(store);` (mechanical; tests asserting init errors / no-routine / open-routine modal keep `init()`).
- Delete "startCurrentStep() for WARM_UP does not start the timer until confirmWarmUpReady() runs" and "confirmWarmUpReady() unlocks the timer's audio synchronously…" — their guarantees move to the new tests below (same guarantee: audio unlocked inside the gesture, timer not running before it).
- New tests in the first `describe("routinePlay")`:

```ts
  it("init() builds the routine but starts no step until the gate is confirmed", async () => {
    const store = makeStore();
    vi.mocked(trainingApi.startTraining).mockResolvedValue(twoStepRoutine());
    await store.init();
    expect(store.routineReady).toBe(false);
    expect(trainingApi.startTrainingStep).not.toHaveBeenCalled();
  });

  it("confirmRoutineReady() unlocks audio before it starts the first step", async () => {
    const order: string[] = [];
    vi.spyOn(audioCue, "unlockAudioCues").mockImplementation(() => {
      order.push("unlock");
    });
    vi.mocked(trainingApi.startTrainingStep).mockImplementation(async () => {
      order.push("start");
      return warmUpStepResponse();
    });
    const store = makeStore();
    vi.mocked(trainingApi.startTraining).mockResolvedValue(twoStepRoutine());
    await startRoutine(store);
    expect(order).toEqual(["unlock", "start"]);
    expect(store.routineReady).toBe(true);
  });

  it("a Warm-Up step opened after the gate starts its timer at once", async () => {
    const store = makeStore();
    vi.mocked(trainingApi.startTraining).mockResolvedValue(twoStepRoutine());
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue(warmUpStepResponse());
    await startRoutine(store);
    expect(store.warmUpTimer).not.toBeNull();
  });

  it("a second confirm while the first is in flight starts the step once", async () => {
    const store = makeStore();
    vi.mocked(trainingApi.startTraining).mockResolvedValue(twoStepRoutine());
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue(warmUpStepResponse());
    await store.init();
    await Promise.all([store.confirmRoutineReady(), store.confirmRoutineReady()]);
    expect(trainingApi.startTrainingStep).toHaveBeenCalledTimes(1);
  });

  it("a failed first step after the gate surfaces the error", async () => {
    const store = makeStore();
    vi.mocked(trainingApi.startTraining).mockResolvedValue(twoStepRoutine());
    vi.mocked(trainingApi.startTrainingStep).mockRejectedValue(new Error("offline"));
    await startRoutine(store);
    expect(store.error).not.toBe("");
  });

  it("a resumed routine shows the gate, then starts the step it stands on", async () => {
    const store = makeStore();
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue(warmUpStepResponse());
    await store.beginRoutine(twoStepRoutine(), 1);
    expect(trainingApi.startTrainingStep).not.toHaveBeenCalled();
    await store.confirmRoutineReady();
    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith(
      expect.any(String),
      2,
    );
  });
```
`twoStepRoutine()` / `warmUpStepResponse()`: reuse the file's existing fixtures for a routine and a WARM_UP start-step response (they exist around L99–200 — use their real names; add `import * as audioCue from "@modules/ui/audio-cue.module";`). For the resume test, make step 2 of the fixture a WARM_UP or reuse whichever fixture has ≥ 2 steps; assert the second step's `sequenceNumber`.

- [ ] **Step 2: Run, expect FAIL**

Run: `cd app && npm test`
Expected: FAIL — `ready-gate` missing; `confirmRoutineReady is not a function`; `startTrainingStep` called during `init()`.

- [ ] **Step 3: Implement**

`ready-gate.ts`:

```ts
export type ReadyGateRow = { number: string; title: string; duration: string };
export type ReadyGateView = { eyebrow: string; rows: ReadyGateRow[] };

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/**
 * The routine ready gate's copy: `n STEPS · m MIN` (minutes rounded up)
 * and one row per step — two-digit number, title, `m:ss`.
 */
export function readyGate(
  steps: readonly { title: string; durationSeconds: number }[],
): ReadyGateView {
  const totalSeconds = steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  const noun = steps.length === 1 ? "STEP" : "STEPS";
  return {
    eyebrow: `${steps.length} ${noun} · ${Math.ceil(totalSeconds / 60)} MIN`,
    rows: steps.map((step, index) => ({
      number: String(index + 1).padStart(2, "0"),
      title: step.title,
      duration: clock(step.durationSeconds),
    })),
  };
}
```

`routine-play.data.ts`:
- State: `routineReady: false`, `confirmingReady: false`; remove `warmUpReady`.
- `beginRoutine`: replace the final `await this.startCurrentStep();` with `this.routineReady = false;`.
- Add:

```ts
    /**
     * The routine's one ready gate. Runs inside the slide's gesture, which is
     * what lets `unlockAudioCues()` unlock the `AudioContext` — every later
     * cue (step change, Warm-Up section beeps, countdown end) plays from a
     * timer, which alone can never satisfy browser autoplay policy. No
     * server step starts before this, so the gate costs no step time.
     */
    async confirmRoutineReady(this: RoutinePlayContext) {
      if (this.routineReady || this.confirmingReady) return;
      this.confirmingReady = true;
      unlockAudioCues();
      this.routineReady = true;
      try {
        await this.startCurrentStep();
      } catch (err: unknown) {
        this.error = stepAdvanceErrorMessage(err);
      } finally {
        this.confirmingReady = false;
      }
    },

    readyGateView(this: RoutinePlayContext): ReadyGateView {
      return readyGate(
        this.steps.map((step) => ({
          title: resolveStepAdapter(stepAdapterKey(step))?.title ?? step.exerciseTypeKey,
          durationSeconds: step.durationSeconds,
        })),
      );
    },
```
(import `unlockAudioCues` from `@modules/ui/audio-cue.module`, `readyGate`/`ReadyGateView` from `./ready-gate`; check `stepAdvanceErrorMessage` is the right message helper for a start failure — if `routineStartErrorMessage` fits better, use it; the test only asserts non-empty.)
- Delete `confirmWarmUpReady`. In `startWarmUpTimer` replace the JSDoc with: "Called from the warm-up adapter's `open()`. Audio was unlocked by the routine ready gate's gesture (`confirmRoutineReady`); `unlockAudio()` here is a harmless repeat." Keep `this.warmUpTimer.unlockAudio();`.
- `types.ts`: replace `warmUpReady: boolean` with `routineReady: boolean; confirmingReady: boolean;`, replace `confirmWarmUpReady` with `confirmRoutineReady(this: RoutinePlayContext): Promise<void>; readyGateView(this: RoutinePlayContext): ReadyGateView;`.

`warm-up.adapter.ts` `open()`: replace `ctx.warmUpReady = false;` with `ctx.startWarmUpTimer(result.configuration);` (after `warmUpConfiguration` is set). If `startWarmUpTimer` is not on the ctx type the adapter sees, it is — `RoutinePlayContext` declares it.

`SlideToStart.astro` — add prop `inline?: boolean` (default `false`), JSDoc `@param {boolean} [inline] Sit in flow inside a card instead of fixed above BottomNav`, and:

```ts
const className = cn(
  inline
    ? "block w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-muted rounded-full"
    : "fixed inset-x-4 z-30 mx-auto max-w-lg bottom-above-nav focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-muted rounded-full",
  classNameProp,
);
```

`RoutineReadyGate.astro`:

```astro
---
/**
 * The routine's one ready gate (design `Exercise Play.dc.html` 2b): a glass
 * card listing every step with its duration, started by `SlideToStart`.
 * The slide is the gesture that unlocks audio for the whole routine.
 * Reads `readyGateView()`, `confirmRoutineReady()` and `confirmingReady`
 * from the routine play scope.
 */

// Components
import SlideToStart from "@components/forms/SlideToStart.astro";
---

<div class="flex min-h-0 flex-1 flex-col justify-center">
  <form
    class="glass flex flex-col items-center gap-5 rounded-3xl px-5 pt-7 pb-5"
    @submit.prevent="confirmRoutineReady()"
  >
    <div class="flex flex-col items-center gap-2">
      <span
        class="font-mono text-eyebrow font-semibold uppercase tracking-widest text-accent-bright"
        x-text="readyGateView().eyebrow"
      ></span>
      <h2 class="font-display text-2xl leading-tight text-foreground">
        Are you ready?
      </h2>
    </div>
    <ol class="flex w-full flex-col gap-2">
      <template
        x-for="row in readyGateView().rows"
        :key="row.number"
      >
        <li class="inset-well flex h-12 items-center gap-3 rounded-2xl px-4">
          <span
            class="font-mono text-eyebrow font-semibold text-muted"
            x-text="row.number"
          ></span>
          <span
            class="min-w-0 flex-1 truncate text-control font-medium text-foreground"
            x-text="row.title"
          ></span>
          <span
            class="font-mono text-body-sm font-medium tabular-nums text-soft-foreground"
            x-text="row.duration"
          ></span>
        </li>
      </template>
    </ol>
    <SlideToStart
      inline
      disabledExpr="confirmingReady"
      failedExpr="error"
    />
  </form>
</div>
```
(Every class must already exist — `text-control`, `text-body-sm`, `text-eyebrow`, `rounded-2xl`, `rounded-3xl` are used in the repo; verify with `npm run check` + `bash ../scripts/check-style-tokens.sh`.)

`play/index.astro` — first child of the inner column, before `ErrorAlert`'s panels:

```astro
    <template x-if="!loading && !routineReady && training">
      <RoutineReadyGate />
    </template>
```
and gate every step panel `x-if` with `routineReady &&` (prepend to each `!loading && adapter?.panel === …` expression — 14 templates).

`WarmUpPanel.astro` — remove the `!warmUpReady` template; unwrap the `warmUpReady` template's content.

- [ ] **Step 4: Run, expect PASS**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/src app/tests
git commit -m "feat(routines): one ready gate at routine start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Labelled, variable-width visit preview

**Files:**
- Modify: `app/src/lib/game/types.ts:161`, `app/src/lib/ui/play-display.ts:69-77`
- Modify: `app/src/components/layout/games/VisitPreview.astro`
- Test: `app/tests/lib/ui/play-display.test.ts`

**Interfaces:**
- Produces: `PreviewSegment = { status: "hit" | "miss" | "value" | "empty"; label?: string }`.
- Produces: `previewColumnState(segments): { status; next: boolean; label?: string }[]` — `next` = first `"empty"`.

- [ ] **Step 1: Failing test** (append to the `previewColumnState` describe)

```ts
  it("passes each label through and treats a value dart as filled", () => {
    expect(
      previewColumnState([
        { status: "value", label: "S20" },
        { status: "empty", label: "T19" },
        { status: "empty", label: "T18" },
      ]),
    ).toEqual([
      { status: "value", next: false, label: "S20" },
      { status: "empty", next: true, label: "T19" },
      { status: "empty", next: false, label: "T18" },
    ]);
  });

  it("leaves label undefined when a segment has none", () => {
    expect(previewColumnState([{ status: "hit" }])[0]).toEqual({
      status: "hit",
      next: false,
      label: undefined,
    });
  });
```
If an existing test uses `toEqual` on columns without `label`, `toEqual` treats `label: undefined` as absent — no change needed.

- [ ] **Step 2: Run, expect FAIL** — `npm test`: type error / label missing.

- [ ] **Step 3: Implement**

`types.ts`:
```ts
/** One dart slot of a visit preview; `label` replaces the HIT / MISS / DART n caption (exercise previews only). */
export type PreviewSegment = {
  status: "hit" | "miss" | "value" | "empty";
  label?: string;
};
```
`play-display.ts` `previewColumnState`: type the param as `readonly PreviewSegment[]` (or `{ status: PreviewStatus; label?: string }[]`), map to `{ status: segment.status, next: index === nextIndex, label: segment.label }`; widen `PreviewColumn`/`PreviewStatus` to include `"value"` and `label?: string`.

`VisitPreview.astro` — add prop `labelled?: boolean` (default `false`; JSDoc `@param {boolean} [labelled] Exercise preview: per-dart labels, value darts, one column per segment`). With `labelled` false the component renders **exactly today's markup** (games stay byte-identical). Branch at build time:

```astro
{
  labelled ? (
    <div
      class="glass grid shrink-0 gap-2 rounded-key px-4.5 py-3"
      :style="`grid-template-columns: repeat(${previewSegments().length}, minmax(0, 1fr))`"
      {...props}
    >
      <template
        x-for="(column, index) in $previewColumnState(previewSegments())"
        :key="index"
      >
        <div class="flex min-w-0 flex-col items-center gap-1.5">
          <div class="flex h-4.5 items-center font-mono text-eyebrow font-semibold uppercase">
            <template x-if="column.status === 'hit'">
              <span class="flex items-center gap-1 text-accent">
                <CheckIcon class="size-3.5" />
                <span x-text="column.label ?? 'HIT'"></span>
              </span>
            </template>
            <template x-if="column.status === 'value'">
              <span class="text-accent" x-text="column.label"></span>
            </template>
            <template x-if="column.status === 'miss'">
              <span class="flex items-center gap-1 text-muted">
                <CrossIcon class="size-3" />
                MISS
              </span>
            </template>
            <template x-if="column.status === 'empty'">
              <span
                :class="column.next ? 'text-soft-foreground' : 'text-faint-foreground'"
                x-text="column.label ?? 'DART ' + (index + 1)"
              ></span>
            </template>
          </div>
          <span
            class="h-1.5 w-full rounded-full"
            :class="column.status === 'hit' || column.status === 'value' ? 'bg-accent' : column.status === 'miss' ? 'bg-white/22' : column.next ? 'next-dart-ring' : 'inset-well'"
          ></span>
        </div>
      </template>
    </div>
  ) : (
    /* today's markup, unchanged, moved here verbatim */
  )
}
```
Replace the `/* … */` with the current root `<div>` and its children exactly as they are now (cut/paste, no edits). The `{...props}` here is the component's existing spread, not a new `{...rest}`. Design centres each column's caption (`items-center`), so the labelled branch adds `items-center` / `w-full` — only there.

- [ ] **Step 4: Run, expect PASS** — `npm test && npm run check`.

- [ ] **Step 5: Commit** — `feat(play): labelled visit preview for exercises`.

---

### Task 4: Exercise preview segments + sequences

**Files:**
- Create: `app/src/lib/training/routines/exercise-preview.ts`
- Modify: `app/src/lib/training/routines/routine-play.data.ts` (`previewSegments()` body, new sequence getters, `stepConfiguration`), `types.ts`
- Test: `app/tests/lib/training/routines/exercise-preview.test.ts` (create), `routine-play.data.test.ts` (existing `previewSegments()` tests)

**Interfaces:**
- Consumes: `PreviewSegment` (Task 3), `dartLabel(dart)` from `@modules/stats/sections/checkout-path.module` (`T20`, `D16`, `20`, `25`, `BULL`, `MISS`).
- Produces:
  ```ts
  export type DartJudgement = "hit" | "miss" | "value";
  export function visitPreview(input: {
    turns: readonly TurnFact[];
    visitLabels: (visitIndex: number) => readonly (string | undefined)[]; // one per dart slot of that visit; undefined = default caption
    judge: (dart: DartFact, index: number) => DartJudgement;
  }): PreviewSegment[];
  export function bullUpPreview(throws: number): PreviewSegment[];
  export function cycleFrom<T>(items: readonly T[], start: number, length: number): T[];
  ```
- Produces on `routinePlay()`: `stepConfiguration: Record<string, unknown> | null`, `switchingSequence(): string`, `doublePatternSequence(): string`, `switchingTargetScoringSequence(): string`.

Rules (spec §2):
- Slots = `visitLabels(lastIndex)` for the last turn (index `turns.length - 1`), or `visitLabels(0)` when there are no turns. A dart present in slot i → `judge` status; label = `dartLabel(dart)` unless status is `"miss"` (then no label → `MISS`). Empty slot → `{ status: "empty", label: visitLabels(...)[i] }`.
- Visit k labels per exercise:
  - Switching: `config.targets.map(String)` (one visit = one pass).
  - Double Pattern: `config.patterns[k % patterns.length].map((n) => `D${n}`)`.
  - Target Scoring: three × `targetScoringTargetLabel(state.currentTargetNumber)`.
  - Switching Target Scoring: `cycleFrom(config.targets, state.targetIndex - dartsInOpenVisit, 3).map(targetScoringTargetLabel)` — for a finished visit no empties exist, so only the open visit's prediction matters.
  - 65 or More, Catch 40, Random Checkout, Bullseye Checkouts: `["", "", ""]` labels → empty slot falls back to `DART n` (use `undefined`, not `""`, so the caption fallback applies).
- `judge`: today's hit rules, moved verbatim from `previewSegments()`; free-aim exercises return `"value"` where today they return `"hit"`; Bullseye's dart aimed at the bull keeps hit/miss.
- Bull Up: `bullUpPreview(state.throws)` → `[{ status: "empty", label: `THROW ${throws + 1}` }]` (shows the next throw; the last throw reads from the board markers and the Last tile).

- [ ] **Step 1: Failing tests**

`exercise-preview.test.ts` — build `TurnFact`/`DartFact` fixtures with the same helper the engine tests use (grep `app/tests/modules/training/exercises/` for a `dart(` / `observation(` builder and import it; if none is exported, write a local `dart({ hitZoneKey, hitTargetNumber, intendedTargetNumber })` returning a full `DartFact` with the remaining fields from an existing fixture):

```ts
describe("visitPreview", () => {
  it("labels a hit with its zone and empties with their upcoming targets", () => {
    const turns = [turn([dart({ hitZoneKey: "TREBLE", hitTargetNumber: 20, intendedTargetNumber: 20 })])];
    expect(
      visitPreview({
        turns,
        visitLabels: () => ["T20", "T19", "T18"],
        judge: () => "hit",
      }),
    ).toEqual([
      { status: "hit", label: "T20" },
      { status: "empty", label: "T19" },
      { status: "empty", label: "T18" },
    ]);
  });

  it("captions a miss MISS and a free-aim dart with its value", () => {
    const turns = [turn([
      dart({ hitZoneKey: "SINGLE", hitTargetNumber: 20, intendedTargetNumber: null }),
      dart({ hitZoneKey: "MISS", hitTargetNumber: null, intendedTargetNumber: null }),
    ])];
    expect(
      visitPreview({
        turns,
        visitLabels: () => [undefined, undefined, undefined],
        judge: (d) => (d.hitZoneKey === "MISS" ? "miss" : "value"),
      }),
    ).toEqual([
      { status: "value", label: "20" },
      { status: "miss" },
      { status: "empty", label: undefined },
    ]);
  });

  it("sizes each visit by its own labels — a finished 2-dart pattern, then a 3-dart one", () => {
    const labels = (k: number) => (k === 0 ? ["D16", "D8"] : ["D20", "D10", "D5"]);
    const twoDarts = [turn([dart({ hitZoneKey: "DOUBLE", hitTargetNumber: 16, intendedTargetNumber: 16 }), dart({ hitZoneKey: "DOUBLE", hitTargetNumber: 8, intendedTargetNumber: 8 })])];
    expect(visitPreview({ turns: twoDarts, visitLabels: labels, judge: () => "hit" })).toHaveLength(2);
    const nextVisit = [...twoDarts, turn([dart({ hitZoneKey: "DOUBLE", hitTargetNumber: 20, intendedTargetNumber: 20 })])];
    expect(visitPreview({ turns: nextVisit, visitLabels: labels, judge: () => "hit" })).toEqual([
      { status: "hit", label: "D20" },
      { status: "empty", label: "D10" },
      { status: "empty", label: "D5" },
    ]);
  });

  it("shows the first visit's empty slots before any dart", () => {
    expect(visitPreview({ turns: [], visitLabels: () => ["20", "19"], judge: () => "hit" })).toEqual([
      { status: "empty", label: "20" },
      { status: "empty", label: "19" },
    ]);
  });
});

describe("bullUpPreview", () => {
  it("is one slot naming the next throw", () => {
    expect(bullUpPreview(42)).toEqual([{ status: "empty", label: "THROW 43" }]);
  });
});

describe("cycleFrom", () => {
  it("wraps around the list", () => {
    expect(cycleFrom([20, 19, 18], 2, 3)).toEqual([18, 20, 19]);
  });
  it("wraps a negative start", () => {
    expect(cycleFrom([20, 19, 18], -1, 2)).toEqual([18, 20]);
  });
});
```

`routine-play.data.test.ts`: update the existing `previewSegments()` tests ("marks an on-target dart hit…", "counts only the double as a hit", "marks a double on the target as a miss") to expect the labelled shapes (e.g. `{ status: "hit", label: "T20" }`), keeping each test's hit/miss guarantee. Add per-family checks:

```ts
  it("switchingSequence() lists the targets with the current one first-class", async () => {
    // after startRoutine on a SWITCHING step with targets [20, 19, 18]
    expect(store.switchingSequence()).toBe("20 19 18");
  });
```
(and the same for `doublePatternSequence()` → current pattern `"D16 D8 D4"`, `switchingTargetScoringSequence()` → `"T20 T19 T18"` using `targetScoringTargetLabel`). Free-aim: a 65-or-More dart on S20 previews `{ status: "value", label: "20" }`. Bull Up: `previewSegments()` has length 1.

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement**

`exercise-preview.ts`:

```ts
import { dartLabel } from "@modules/stats/sections/checkout-path.module";
import type { DartFact, TurnFact } from "@modules/types";
import type { PreviewSegment } from "@lib/types";

export type DartJudgement = "hit" | "miss" | "value";

/** `length` items of `items` from `start`, wrapping both ways. */
export function cycleFrom<T>(items: readonly T[], start: number, length: number): T[] {
  const size = items.length;
  return Array.from({ length }, (_, i) => items[(((start + i) % size) + size) % size]);
}

/**
 * The exercise visit preview (design `Exercise Play.dc.html`): the latest
 * visit's darts, one slot per dart that visit throws. A landed dart is
 * captioned with its zone (`T20`, `25`) unless it missed; an empty slot
 * with the target it will be thrown at. A finished visit stays on screen
 * until the next dart opens a new one — as the game preview does.
 */
export function visitPreview(input: {
  turns: readonly TurnFact[];
  visitLabels: (visitIndex: number) => readonly (string | undefined)[];
  judge: (dart: DartFact, index: number) => DartJudgement;
}): PreviewSegment[] {
  const visitIndex = Math.max(input.turns.length - 1, 0);
  const darts = input.turns.at(-1)?.darts ?? [];
  return input.visitLabels(visitIndex).map((label, index) => {
    const dart = darts[index];
    if (!dart) return { status: "empty", label };
    const status = input.judge(dart, index);
    return status === "miss" ? { status } : { status, label: dartLabel(dart) };
  });
}

/** Bull Up's one-slot preview: the throw about to be made. */
export function bullUpPreview(throws: number): PreviewSegment[] {
  return [{ status: "empty", label: `THROW ${throws + 1}` }];
}
```
(If `DartFact`/`TurnFact` are exported from `@modules/game/types` rather than `@modules/types`, import from the barrel the rest of `routine-play.data.ts` uses.)

`routine-play.data.ts`:
- `openStep`: `this.stepConfiguration = result.configuration;` before `adapter.open(...)`; initial `stepConfiguration: null`.
- Replace `previewSegments()` body:

```ts
    previewSegments(this: RoutinePlayContext): PreviewSegment[] {
      if (this.bullUpEngine) return bullUpPreview(this.bullUpEngine.state().throws);
      const turns = this.activeDartEngine()?.facts().turns ?? [];
      return visitPreview({
        turns,
        visitLabels: (k) => this.exerciseVisitLabels(k),
        judge: (dart) => this.judgeExerciseDart(dart),
      });
    },
```
  with two new context methods: `judgeExerciseDart(dart): DartJudgement` holding the old `isHit` chain verbatim but returning `"value"` (not `"hit"`) for the free-aim branch (`scoreThreshold || checkoutSequence || randomCheckout`, and Bullseye's non-bull darts), and `exerciseVisitLabels(k): (string | undefined)[]` per the rules table above, reading `this.stepConfiguration` cast to the step's config type (`SwitchingConfigData`, `DoublePatternConfigData`, `SwitchingTargetScoringConfigData` from `@lib/types`), defaulting to `[undefined, undefined, undefined]`.
- Sequences:

```ts
    switchingSequence(this: RoutinePlayContext): string {
      const config = this.stepConfiguration as SwitchingConfigData | null;
      return config?.targets.map(String).join(" ") ?? "";
    },

    doublePatternSequence(this: RoutinePlayContext): string {
      const config = this.stepConfiguration as DoublePatternConfigData | null;
      const index = this.doublePatternEngine?.state().patternIndex ?? 0;
      return config?.patterns[index]?.map((n) => `D${n}`).join(" ") ?? "";
    },

    switchingTargetScoringSequence(this: RoutinePlayContext): string {
      const config = this.stepConfiguration as SwitchingTargetScoringConfigData | null;
      return config?.targets.map(targetScoringTargetLabel).join(" ") ?? "";
    },
```
  Check `config.targets` / `config.patterns` element types against `lib/training/exercises/rulesets/types.ts` before writing (Double Pattern patterns are board numbers per `doublePatternLabel()`'s `D${double}`).
- `types.ts`: declare the new fields/methods.

- [ ] **Step 4: Run, expect PASS** — `npm test && npm run check`.

- [ ] **Step 5: Commit** — `feat(routines): labelled exercise preview segments and sequences`.

---

### Task 5: Shared board input for exercises

**Files:**
- Modify: `app/src/components/layout/games/BoardInputPanel.astro`
- Delete: `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro`
- Test: Task 8 parity diff (games), `npm run check` (no dangling import).

**Interfaces:**
- Produces: `BoardInputPanel` props `showExpr?: string` (default `"!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'"`), `undoDisabledExpr?: string` (default `"!$store.game.turns.length"`).

- [ ] **Step 1: Props** — in the frontmatter:

```ts
interface Props {
  showExpr?: string;
  undoDisabledExpr?: string;
}

// Props
const {
  showExpr = "!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'",
  undoDisabledExpr = "!$store.game.turns.length",
}: Props = Astro.props;
```
Replace the root's literal `x-show="…"` with `x-show={showExpr}` and the undo button's `:disabled="…"` with `:disabled={undoDisabledExpr}`. Append to the JSDoc: "`showExpr` / `undoDisabledExpr` let a routine exercise mount it: an exercise is always VISUAL_BOARD, has no pause and unmounts the panel itself when the step ends (replaces `ExerciseBoardInputPanel`)."

- [ ] **Step 2: Delete** `ExerciseBoardInputPanel.astro`; `grep -rn ExerciseBoardInputPanel app/src` → only docs remain (fixed in Task 8).

- [ ] **Step 3: Verify + commit**

Run: `cd app && npm test && npm run check`
Commit: `refactor(exercises): reuse BoardInputPanel, drop ExerciseBoardInputPanel`.

---

### Task 6: Exercise card — caption, chip, stat tiles

**Files:**
- Modify: `app/src/components/layout/games/PlayStatTile.astro`, `RouteChips.astro`
- Modify: `app/src/components/layout/training/exercises/ExercisePanelShell.astro` and the 9 `*Panel.astro`
- Test: none new in TS (D101 `.astro` carve-out); parity build in Task 8 covers games; visual check in Task 8 covers exercises.

**Interfaces:**
- Consumes: `BoardInputPanel` `showExpr` / `undoDisabledExpr` (Task 5); `switchingSequence()`, `doublePatternSequence()`, `switchingTargetScoringSequence()` (Task 4); `VisitPreview labelled` (Task 3).
- Produces: `ExercisePanelShell` props `{ score: string; caption: string; chip?: { routeExpr: string; currentExpr?: string }; tiles: { label: string; value: string; showWhen?: string }[] }`.
- Produces: `PlayStatTile` props `highlight?: boolean`, `fit?: boolean`; `RouteChips` prop `currentExpr?: string`.

- [ ] **Step 1: `PlayStatTile`** — add props (defaults `false`), JSDoc lines, and:

```ts
const className = cn(
  "inset-well flex min-w-0",
  compact
    ? "h-11 shrink-0 items-center justify-between gap-2 rounded-row px-3"
    : fit
      ? "min-h-0 max-h-19 flex-1 flex-col-reverse items-center justify-center gap-1 rounded-xl px-2"
      : "h-19 flex-col-reverse items-center justify-center gap-1 rounded-xl px-2",
);
const valueClass = cn(
  "shrink-0 font-mono font-medium tabular-nums",
  highlight ? "text-accent-bright" : "text-foreground",
  compact ? "text-sm" : "text-stat",
);
```
Parity: `cn` output for the default path must equal today's string (`"shrink-0 font-mono font-medium tabular-nums text-foreground text-stat"` vs today's order `… tabular-nums text-foreground` + size) — keep class order identical to today's so the rendered `class` attribute is byte-equal.

- [ ] **Step 2: `RouteChips`** — add `currentExpr?: string`. In the part `<span>` that renders text, when `currentExpr` is set render `:class={`part === (${currentExpr}) ? 'text-accent-bright' : 'text-faint-foreground'`}`; when unset render exactly today's markup (branch at build time with `currentExpr ? (…) : (…)`).

- [ ] **Step 3: `ExercisePanelShell`** — replace props/markup:

```astro
---
/**
 * Play surface shared by the scored exercise panels (#915, restyled to
 * `Exercise Play.dc.html`): a `SinglePlayerDisplay` with the step's big
 * value, its caption, an optional `RouteChips` chip and `PlayStatTile`s
 * (first one lit), then the labelled `VisitPreview` and the shared
 * `BoardInputPanel`. Reads the routine play page scope.
 * @param {string} score Alpine expression for the big value
 * @param {string} caption Mono caption under the big value
 * @param {object} [chip] `{ routeExpr, currentExpr? }` for `RouteChips`
 * @param {object[]} tiles `{ label, value, showWhen? }` — Alpine expressions; a tile with `showWhen` is hidden while it is false
 */
interface ExerciseTile {
  label: string;
  value: string;
  showWhen?: string;
}

interface ExerciseChip {
  routeExpr: string;
  currentExpr?: string;
}

interface Props {
  score: string;
  caption: string;
  chip?: ExerciseChip;
  tiles: ExerciseTile[];
}

// Props
const { score, caption, chip, tiles }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import RouteChips from "@components/layout/games/RouteChips.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div class="flex min-h-0 flex-1 flex-col gap-2">
  <SinglePlayerDisplay
    isTarget={false}
    score={score}
    caption={caption}
  >
    {
      chip && (
        <RouteChips
          slot="route"
          routeExpr={chip.routeExpr}
          currentExpr={chip.currentExpr}
        />
      )
    }
    {
      tiles.map((tile, index) =>
        tile.showWhen ? (
          <template x-if={tile.showWhen}>
            <PlayStatTile label={tile.label} valueExpr={tile.value} highlight={index === 0} fit />
          </template>
        ) : (
          <PlayStatTile label={tile.label} valueExpr={tile.value} highlight={index === 0} fit />
        ),
      )
    }
  </SinglePlayerDisplay>

  <VisitPreview labelled />

  <BoardInputPanel
    showExpr="true"
    undoDisabledExpr="!activeDartEngine()?.facts().turns.length"
  />
</div>
```

- [ ] **Step 4: The 9 panels** — each becomes (exact values):

| Panel | score | caption | chip | tiles |
|---|---|---|---|---|
| Switching | `switchingPoints()` | `POINTS` | `{ routeExpr: "switchingSequence()", currentExpr: "switchingTargetLabel()" }` | Target `switchingTargetLabel()`; Darts `dartsThrown()` |
| DoublePattern | `doublePatternPoints()` | `POINTS` | `{ routeExpr: "doublePatternSequence()", currentExpr: "doublePatternLabel()" }` | Double `doublePatternLabel()`; Darts `dartsThrown()` |
| TargetScoring | `targetScoringChain()` | `CHAIN` | — | Target `targetScoringTargetLabel()`; To beat `targetScoringMarkToBeat()` showWhen `targetScoringMarkToBeat() !== null`; Best `targetScoringBestChain()` |
| SwitchingTargetScoring | `switchingTargetScoringChain()` | `CHAIN` | `{ routeExpr: "switchingTargetScoringSequence()", currentExpr: "switchingTargetScoringTargetLabel()" }` | Target `switchingTargetScoringTargetLabel()`; To beat `switchingTargetScoringMarkToBeat()` showWhen `… !== null`; Best `switchingTargetScoringBestChain()` |
| ScoreThreshold | `scoreThresholdBeats()` | `BEATS` | — | This visit `scoreThresholdVisitTotal()`; Last `scoreThresholdLastVisitTotal()` showWhen `… !== null`; Visits `scoreThresholdVisits()`; Rate `scoreThresholdBeatRate()` |
| BullseyeCheckout | `bullseyeCheckoutCheckouts()` | `CHECKOUTS` | `{ routeExpr: "bullseyeCheckoutLastResult() === '—' ? '' : 'LAST ' + bullseyeCheckoutLastResult()" }` | Left `bullseyeCheckoutLeft()`; Visits `bullseyeCheckoutVisits()`; Rate `bullseyeCheckoutRate()` |
| BullUp | `bullUpBullseyes()` | `BULLSEYES` | `{ routeExpr: "'BULL ' + bullUpBullRate() + ' EYE ' + bullUpBullseyeRate()" }` | Last `bullUpLastResult()`; Throws `bullUpThrows()`; Bulls `bullUpBulls()` |
| CheckoutSequence | `checkoutSequencePoints()` | `POINTS` | `{ routeExpr: "checkoutSequenceLastResult() === '—' ? '' : 'LAST ' + checkoutSequenceLastResult()" }` | Outshot `checkoutSequenceOutshot()`; Left `checkoutSequenceLeft()`; Dart `` `${checkoutSequenceAttemptDart()} / 6` ``; Checkouts `checkoutSequenceCheckouts()` |
| RandomCheckout | `randomCheckoutCheckouts()` | `CHECKOUTS` | `{ routeExpr: "randomCheckoutLastResult() === '—' ? '' : 'LAST ' + randomCheckoutLastResult()" }` | Start `randomCheckoutStart()`; Left `randomCheckoutLeft()`; Dart `` `${randomCheckoutAttemptDart()} / 3` ``; Rate `randomCheckoutRate()` |

` ` must be a real U+00A0 in the expression string (Alpine evaluates JS, so the ` ` escape inside the JS string literal works as written). Verify each `*LastResult()` getter's "none" value is `"—"` (Bullseye's is; check the other two and use their actual sentinel).

Example (Switching):
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="switchingPoints()"
  caption="POINTS"
  chip={{ routeExpr: "switchingSequence()", currentExpr: "switchingTargetLabel()" }}
  tiles={[
    { label: "Target", value: "switchingTargetLabel()" },
    { label: "Darts", value: "dartsThrown()" },
  ]}
/>
```

- [ ] **Step 5: Verify + commit**

Run: `cd app && npm test && npm run check && bash ../scripts/check-style-tokens.sh`
Expected: PASS.
Commit: `feat(exercises): game-style exercise card`.

---

### Task 7: Warm-Up spotlight board

**Files:**
- Modify: `app/src/lib/game/board/board-highlight.module.ts`
- Modify: `app/src/components/ui/DartBoard.astro:640-665`
- Create: `app/src/components/ui/SectionRing.astro`
- Modify: `app/src/styles/global.css` (utilities)
- Rewrite: `app/src/components/layout/training/exercises/WarmUpPanel.astro`
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `types.ts`
- Test: `app/tests/lib/game/board/board-highlight.module.test.ts`, `routine-play.data.test.ts`

**Interfaces:**
- Consumes: `dartboardHighlightPath`, `bullOutlinePath`, `BOARD_RADII_MM` (existing; board circle radius = the DartBoard viewBox half-width, 220).
- Produces:
  ```ts
  export const BOARD_FACE_RADIUS_MM = 220;
  export function dartboardDimPath(targetNumbers: readonly number[]): string;
  export function sectionRingPaths(
    durationsSeconds: readonly number[],
    elapsedSeconds: number,
    radiusMm: number,
  ): { track: string; fill: string };
  ```
- Produces on `routinePlay()`: `warmUpDimPath(): string`, `warmUpRingTrack(): string`, `warmUpRingFill(): string`.

- [ ] **Step 1: Failing tests** (append to `board-highlight.module.test.ts`)

```ts
describe("dartboardDimPath", () => {
  it("is the board face with the active outline cut out", () => {
    expect(dartboardDimPath([20])).toBe(
      bullOutlinePath(BOARD_FACE_RADIUS_MM) + dartboardHighlightPath([20]),
    );
  });

  it("is empty with no active targets, so nothing is dimmed", () => {
    expect(dartboardDimPath([])).toBe("");
  });
});

describe("sectionRingPaths", () => {
  it("draws one track arc per section, with a 2.5° gap at each end", () => {
    const { track } = sectionRingPaths([60, 60, 60, 60], 0, 232);
    expect(track.match(/M/g)).toHaveLength(4);
    expect(track.startsWith("M")).toBe(true);
  });

  it("draws no fill before the run starts", () => {
    expect(sectionRingPaths([60, 60], 0, 232).fill).toBe("");
  });

  it("fills completed sections whole and the running one in part", () => {
    const { fill } = sectionRingPaths([60, 60, 60], 90, 232);
    expect(fill.match(/M/g)).toHaveLength(2);
  });

  it("fills every section once elapsed reaches the total", () => {
    const { track, fill } = sectionRingPaths([60, 60], 120, 232);
    expect(fill).toBe(track);
  });

  it("splits the ring by duration, not evenly", () => {
    const even = sectionRingPaths([60, 60], 0, 232).track;
    const weighted = sectionRingPaths([30, 90], 0, 232).track;
    expect(weighted).not.toBe(even);
  });
});
```
(import `BOARD_FACE_RADIUS_MM`, `dartboardDimPath`, `sectionRingPaths`, `bullOutlinePath`, `dartboardHighlightPath`.)

`routine-play.data.test.ts`, Warm-Up describe:

```ts
  it("warmUpDimPath() and the ring follow the running Warm-Up", async () => {
    // startRoutine on the WARM_UP fixture; advance fake timers 1s
    expect(store.warmUpDimPath()).toContain(store.warmUpHighlightPath());
    expect(store.warmUpRingTrack()).not.toBe("");
    expect(store.warmUpRingFill()).not.toBe("");
  });
```
(use the file's existing fake-timer pattern from "formattedWarmUpElapsed() reports mm:ss as the timer ticks".)

- [ ] **Step 2: Run, expect FAIL** — `npm test`.

- [ ] **Step 3: Implement**

`board-highlight.module.ts`:

```ts
/** The DartBoard SVG's own face radius — its viewBox is `-220,-220,440,440`. */
export const BOARD_FACE_RADIUS_MM = 220;

/** Degrees left clear at each end of a section ring arc. */
const RING_GAP_DEGREES = 2.5;

function arcPath(radiusMm: number, fromDeg: number, toDeg: number): string {
  const start = polarPoint(radiusMm, fromDeg);
  const end = polarPoint(radiusMm, toDeg);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M${start.x},${start.y}A${radiusMm},${radiusMm},0,${largeArc},1,${end.x},${end.y}`;
}

/**
 * The Warm-Up spotlight's dimming mask: the whole board face plus the
 * active outline, for `fill-rule="evenodd"` — everything outside the
 * section is covered, the section itself is not. Empty with no targets.
 */
export function dartboardDimPath(targetNumbers: readonly number[]): string {
  const outline = dartboardHighlightPath(targetNumbers);
  return outline ? bullOutlinePath(BOARD_FACE_RADIUS_MM) + outline : "";
}

/**
 * A ring split into one arc per section, sized by duration, from 12
 * o'clock clockwise with `RING_GAP_DEGREES` clear at each end. `fill`
 * covers the elapsed share: finished sections whole, the running one in
 * part.
 */
export function sectionRingPaths(
  durationsSeconds: readonly number[],
  elapsedSeconds: number,
  radiusMm: number,
): { track: string; fill: string } {
  const total = durationsSeconds.reduce((sum, d) => sum + d, 0);
  let track = "";
  let fill = "";
  let angle = 0;
  let before = 0;
  for (const duration of durationsSeconds) {
    const span = total > 0 ? (360 * duration) / total : 0;
    const from = angle + RING_GAP_DEGREES;
    const to = angle + span - RING_GAP_DEGREES;
    track += arcPath(radiusMm, from, to);
    const done = Math.min(Math.max(elapsedSeconds - before, 0), duration);
    if (done > 0 && duration > 0) {
      fill += arcPath(radiusMm, from, from + ((to - from) * done) / duration);
    }
    angle += span;
    before += duration;
  }
  return { track, fill };
}
```

`routine-play.data.ts`:

```ts
    warmUpDimPath(this: RoutinePlayContext): string {
      return dartboardDimPath(this.warmUpEngine?.state().targets ?? []);
    },

    warmUpRing(this: RoutinePlayContext): { track: string; fill: string } {
      const configuration = this.warmUpConfiguration as WarmUpEngineInput | null;
      if (!configuration) return { track: "", fill: "" };
      return sectionRingPaths(
        resolveWarmUpPhaseDurations(configuration),
        this.warmUpElapsedSeconds,
        232,
      );
    },

    warmUpRingTrack(this: RoutinePlayContext): string {
      return this.warmUpRing().track;
    },

    warmUpRingFill(this: RoutinePlayContext): string {
      return this.warmUpRing().fill;
    },
```
(declare all four in `types.ts`.)

`DartBoard.astro` — add prop `dimPathExpr?: string` (JSDoc: "Raw Alpine expression for an even-odd mask path dimming the board outside the highlight"); render the group when either expr is set, mask first:

```astro
    {
      (highlightPathExpr || dimPathExpr) && (
        <g
          class="board-highlight-group pointer-events-none"
          aria-hidden="true"
        >
          {dimPathExpr && (
            <path
              class="fill-black/60"
              fill-rule="evenodd"
              {...{ ":d": dimPathExpr }}
            />
          )}
          {highlightPathExpr && (
            <path
              stroke-width="3"
              class="fill-none stroke-accent"
              {...{ ":d": highlightPathExpr }}
            />
          )}
        </g>
      )
    }
```
Parity: today only Warm-Up passes `highlightPathExpr`, and no game passes either — game markup unchanged. Add `highlight-glow` to the outline's class (utility below). The `{...{ ":d": … }}` spread is the existing idiom in this file (not a `{...rest}`), so the style gate allows it.

`global.css` (next to `board-dim`):

```css
@utility highlight-glow {
  filter: drop-shadow(0 0 6px color-mix(in oklch, var(--accent) 70%, transparent));
}

@utility section-ring-inset {
  inset: 4.1667%;
}
```

`SectionRing.astro`:

```astro
---
/**
 * A sectioned progress ring drawn around a square board (design
 * `Exercise Play.dc.html` 2c): an overlay SVG at `viewBox -240` whose
 * slot content sits inset 220/240 (`section-ring-inset`), so a 232mm ring
 * clears the board's rim. Paths come from `sectionRingPaths`.
 * @param {string} trackExpr Alpine expression for the full ring path
 * @param {string} fillExpr Alpine expression for the elapsed share
 * @slot default The board
 */
interface Props {
  trackExpr: string;
  fillExpr: string;
}

// Props
const { trackExpr, fillExpr }: Props = Astro.props;
---

<div class="relative aspect-square h-full max-w-full">
  <div class="section-ring-inset absolute">
    <slot />
  </div>
  <svg
    class="pointer-events-none absolute inset-0 size-full overflow-visible"
    viewBox="-240 -240 480 480"
    aria-hidden="true"
  >
    <path
      class="fill-none stroke-black/50"
      stroke-width="7"
      stroke-linecap="round"
      {...{ ":d": trackExpr }}
    />
    <path
      class="fill-none stroke-accent"
      stroke-width="7"
      stroke-linecap="round"
      {...{ ":d": fillExpr }}
    />
  </svg>
</div>
```

`WarmUpPanel.astro`:

```astro
---
/**
 * Warm-Up play (design `Exercise Play.dc.html` 3a): the board fills the
 * play column inside an `input-well`, dimmed outside the running section
 * and outlined around it, with a `SectionRing` filling over the run. No
 * dart input. Elapsed time is the header clock pill; the ready gate is
 * the routine's (`RoutineReadyGate`).
 */

// Components
import DartBoard from "@components/ui/DartBoard.astro";
import SectionRing from "@components/ui/SectionRing.astro";
---

<div class="input-well flex flex-col items-center">
  <div class="flex min-h-0 w-full flex-1 items-center justify-center">
    <SectionRing
      trackExpr="warmUpRingTrack()"
      fillExpr="warmUpRingFill()"
    >
      <DartBoard
        dimPathExpr="warmUpDimPath()"
        highlightPathExpr="warmUpHighlightPath()"
      />
    </SectionRing>
  </div>
</div>
```

- [ ] **Step 4: Run, expect PASS** — `npm test && npm run check && bash ../scripts/check-style-tokens.sh`. If the gate rejects `fill-black/60` / `stroke-black/50` as unlisted modifiers, use the opacity tokens already used in the repo (e.g. `bg-white/22` exists → `/NN` opacity modifiers on palette colours are allowed; if not, move both into `@utility` rules).

- [ ] **Step 5: Commit** — `feat(warm-up): spotlight board with section ring`.

---

### Task 8: Parity, visual check, docs, gates, PR

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`, `docs/architecture/07-Frontend/07-Style-Guide.md`, `docs/architecture/09-Training/01-Routines.md`
- Modify: one file in `decisions/frontend/` (append a block) — pick per `DECISIONS.md` routing (`astro.md` for component structure)
- Modify: `docs/superpowers/specs/2026-10-13-exercise-play-restyle-design.md` only if implementation deviated (status note)

- [ ] **Step 1: Game parity diff**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics/app && npm run build
SNAP=/private/tmp/claude-502/-Users-levi-broeksma-Dev-dart-analytics/46838d8f-373d-41fc-baf5-ab4b3754325a/scratchpad
rm -rf "$SNAP/parity-after" && mkdir -p "$SNAP/parity-after"
cd dist && find games -path '*/play/index.html' | while read f; do mkdir -p "$SNAP/parity-after/$(dirname "$f")"; cp "$f" "$SNAP/parity-after/$f"; done
diff -r "$SNAP/parity-before" "$SNAP/parity-after" && echo PARITY-OK
```
Expected: `PARITY-OK`. Any diff → find the component default that leaked and fix it (do not accept the diff). Asset-hash-only diffs (`/_astro/*.css` names) mean CSS changed (expected: new utilities) — compare with hashes normalised: `sed -E 's/_astro\/[^"]+/_astro\/X/g'` on both trees, then diff again; that must be clean.

- [ ] **Step 2: Visual check** — run the app (`run` skill or `npm run dev`), at 390×844 open a routine: gate; Warm-Up (dim, outline, ring, header elapsed); one target exercise (Switching: chip, labels, pill countdown); one free-aim (65 or More: value labels, 4 tiles fit); Bull Up (one slot). Compare to `Exercise Play.dc.html` phones. Note gaps; fix only what this plan specifies; anything else → discovered-work issue.

- [ ] **Step 3: Docs**
- Component Inventory: add rows `HeaderClockPill`, `RoutineReadyGate`, `SectionRing`; update `BoardInputPanel` (props), `VisitPreview` (`labelled`), `PlayStatTile` (`highlight`, `fit`), `RouteChips` (`currentExpr`), `SlideToStart` (`inline`), `DartBoard` (`highlightPathExpr`, `dimPathExpr`), `ExercisePanelShell` (new props), `WarmUpPanel`; delete the `ExerciseBoardInputPanel` row; fix `CountdownPauseControl` row only if it now contradicts (it says routine play renders its own above each game — still true).
- Style Guide play-header note: routine header = step title, `STEP n OF m`, `HeaderClockPill`.
- `09-Training/01-Routines.md`: one ready gate at routine start (audio unlock), replaces Warm-Up's per-step gate.
- Decision block (next free D-number from `DECISIONS.md`): "Routine ready gate moves to routine start; exercise screens reuse game primitives via default-preserving optional props; `ExerciseBoardInputPanel` deleted." Cite spec path.

- [ ] **Step 4: Gates** — run skills `validate-app`, `run-all-gates`, `context-maintenance`; quote each result.

- [ ] **Step 5: Commit + PR** — commit docs (`docs: exercise play restyle inventory + decision`), then `finishing-a-dart-branch` (push + PR, Option 2). PR body: parity output, gate results, visual-check notes, `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
