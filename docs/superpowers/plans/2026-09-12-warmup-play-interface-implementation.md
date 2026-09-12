# Warm-Up Play Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Balanced Training's manual-advance Warm-Up screen (button + target-number text) with the approved design: an always-visible count-up timer for the step's total duration, a dartboard highlight around the current phase's target(s), and a ping sound on every phase change — no button, no text.

**Architecture:** All time-keeping and scheduling logic lives in `SegmentTimer` (extended to support variable-length count-up segments); all domain logic (phase→duration resolution, phase transitions) stays in `WarmUpEngine`, which gains one pure helper and no clock. The store wires the two together. The dartboard highlight is new SVG geometry, computed from existing board-geometry constants, rendered as a sibling overlay group so it never touches the parity-tested `dartboard-group` markup.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-warmup-play-interface-design.md`

## Global Constraints

- Branch `claude/training-warmup-interface-bzeeha` is already checked out and clean — do not create a new branch.
- Every `.ts` source file changed needs a covering test change in the *same* commit (D224, `scripts/check-test-coverage.sh`); `.astro` markup is exempt (D101 — no Astro-component test runner).
- No `//` or `/* */` comment inside a function/method body anywhere under `app/src/` (`.ts` files and `.astro` frontmatter alike) — JSDoc/block comments above the declaration only.
- Deep relative/aliased TYPE imports must go through `@lib/types` or `@modules/types`; VALUE imports (constants, functions, classes used as a value) are exempt and may import a deep path directly (D156) — this plan relies on that exemption for `BOARD_RADII_MM`, `SECTOR_ORDER`, `DARTBOARD_HIGHLIGHT_PATHS`.
- `WarmUpEngine`/`ExerciseEngine` stay clockless (D264) — no elapsed-time field is added to `WarmUpState`; the clock lives in `SegmentTimer` and the store only.
- Tailwind v4 semantic tokens only (`bg-accent`, `stroke-accent`, etc.) — no raw palette utilities, no `font-medium`, no important modifier, no `-prop-[…]`.
- Alpine v3 shorthand only (`:class`, `@click`) — never `x-bind:`/`x-on:`.
- Run `cd app && npx vitest run <file>` after every test-touching step in this plan.
- Before the task is done: `cd app && npm run validate:app` must exit zero (0 errors/warnings/hints), and `npm run format && npm run format:check` must be clean.

---

## Task 1: Extract `resolveWarmUpPhaseDurations` from `WarmUpEngine`

**Files:**
- Modify: `app/src/modules/exercise/warm-up.engine.module.ts`
- Test: `app/tests/modules/exercise/warm-up.engine.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function resolveWarmUpPhaseDurations(config: WarmUpEngineInput): number[]` from `@modules/exercise/warm-up.engine.module` — one duration in seconds per phase, in `config.phases` order, `Math.round(stepDurationSeconds * phase.weight / totalWeight)` each. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Edit `app/tests/modules/exercise/warm-up.engine.module.test.ts`. Change the import line at the top:

```ts
import {
  warmUpEngineFactory,
  resolveWarmUpPhaseDurations,
} from "@modules/exercise/warm-up.engine.module";
```

Append this new `describe` block at the end of the file (after the closing `});` of the existing `describe("warmUpEngineFactory", ...)`):

```ts
describe("resolveWarmUpPhaseDurations", () => {
  it("splits step duration evenly across equal-weight phases", () => {
    expect(
      resolveWarmUpPhaseDurations({
        phases: [
          { name: "Upper", targets: [5], weight: 1 },
          { name: "Lower", targets: [19], weight: 1 },
          { name: "Bull", targets: [25], weight: 1 },
        ],
        stepDurationSeconds: 180,
      }),
    ).toEqual([60, 60, 60]);
  });

  it("splits step duration proportionally to unequal phase weights", () => {
    expect(
      resolveWarmUpPhaseDurations({
        phases: [
          { name: "Long", targets: [20], weight: 3 },
          { name: "Short", targets: [19], weight: 1 },
        ],
        stepDurationSeconds: 600,
      }),
    ).toEqual([450, 150]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/modules/exercise/warm-up.engine.module.test.ts`
Expected: FAIL — `resolveWarmUpPhaseDurations` is not exported from the module.

- [ ] **Step 3: Extract the function**

In `app/src/modules/exercise/warm-up.engine.module.ts`, add this exported function above the `WarmUpEngine` class:

```ts
/**
 * Resolves each phase's own duration, in seconds, from the routine step's
 * total duration split proportionally to `phase.weight` (design spec
 * 2026-09-11 §5.1). One entry per phase, in `config.phases` order. Rounded
 * per phase, so the sum across all entries can differ from
 * `config.stepDurationSeconds` by a handful of seconds.
 */
export function resolveWarmUpPhaseDurations(
  config: WarmUpEngineInput,
): number[] {
  const totalWeight = config.phases.reduce(
    (sum, phase) => sum + phase.weight,
    0,
  );
  return config.phases.map((phase) =>
    Math.round((config.stepDurationSeconds * phase.weight) / totalWeight),
  );
}
```

Replace the body of `private deriveState(): WarmUpState` (currently computing `totalWeight`/`phaseDurationSeconds` inline) with:

```ts
  private deriveState(): WarmUpState {
    const phaseIndex = this.stages.length - 1;
    const phase = this.config.phases[phaseIndex];
    const phaseDurationSeconds = resolveWarmUpPhaseDurations(this.config)[
      phaseIndex
    ];
    return {
      phaseIndex,
      phaseName: phase.name,
      targets: [...phase.targets],
      phaseDurationSeconds,
      phaseCount: this.config.phases.length,
      status: this.complete ? "COMPLETE" : "IN_PROGRESS",
    };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/exercise/warm-up.engine.module.test.ts`
Expected: PASS — all existing tests plus the two new ones (10 total).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/exercise/warm-up.engine.module.ts app/tests/modules/exercise/warm-up.engine.module.test.ts
git commit -m "refactor(app): extract resolveWarmUpPhaseDurations from WarmUpEngine"
```

---

## Task 2: `SegmentTimer` — variable-length count-up segments

**Files:**
- Modify: `app/src/modules/ui/interfaces.ts`
- Modify: `app/src/modules/ui/segment-timer.module.ts`
- Test: `app/tests/modules/ui/segment-timer.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SegmentTimerOptions.segmentDurationsSeconds?: number[]` (`@modules/interfaces`). When supplied with `direction: "countup"`, `SegmentTimer` fires `onSegmentChange(segmentIndex)` + its own `playBeep()` at each cumulative boundary, and `onComplete()` once elapsed reaches the array's total. `totalMinutes`/`intervalMinutes` become optional (existing countdown callers are unaffected — they still pass both). Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/ui/segment-timer.module.test.ts`, inside the existing `describe("SegmentTimer", ...)` block (before its closing `});`):

```ts
  it("countup with segmentDurationsSeconds fires onSegmentChange at each cumulative boundary", () => {
    const onSegmentChange = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      direction: "countup",
      segmentDurationsSeconds: [2, 3],
      onSegmentChange,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(2000);
    expect(onSegmentChange).toHaveBeenCalledTimes(1);
    expect(onSegmentChange).toHaveBeenCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onSegmentChange).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("countup with a single segmentDurationsSeconds entry never fires onSegmentChange", () => {
    const onSegmentChange = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      direction: "countup",
      segmentDurationsSeconds: [3],
      onSegmentChange,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(3000);
    expect(onSegmentChange).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("throws when constructed with neither totalMinutes nor segmentDurationsSeconds", () => {
    expect(() => new SegmentTimer({})).toThrow();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/ui/segment-timer.module.test.ts`
Expected: FAIL — `segmentDurationsSeconds` doesn't exist on `SegmentTimerOptions` (type error) and the constructor never throws.

- [ ] **Step 3: Widen `SegmentTimerOptions`**

Replace the contents of `app/src/modules/ui/interfaces.ts`:

```ts
export interface SegmentTimerOptions {
  totalMinutes?: number;
  intervalMinutes?: number;
  direction?: "countdown" | "countup";
  segmentDurationsSeconds?: number[];
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
```

- [ ] **Step 4: Implement variable-length count-up segments**

Replace the top of `app/src/modules/ui/segment-timer.module.ts` (imports through the constructor) with:

```ts
import type { SegmentTimerOptions } from "./interfaces";

function cumulativeSums(durationsSeconds: number[]): number[] {
  let running = 0;
  return durationsSeconds.map((duration) => {
    running += duration;
    return running;
  });
}

export class SegmentTimer {
  private totalSeconds: number;
  private intervalSeconds: number;
  private segmentBoundaries: number[] | null;
  private remaining: number;
  private direction: "countdown" | "countup";
  private timerId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private segmentIndex = 0;

  private onTick?: (secondsRemaining: number) => void;
  private onSegmentChange?: (segmentIndex: number) => void;
  private onComplete?: () => void;

  constructor(options: SegmentTimerOptions) {
    if (
      options.segmentDurationsSeconds === undefined &&
      options.totalMinutes === undefined
    ) {
      throw new Error(
        "SegmentTimer requires either totalMinutes or segmentDurationsSeconds",
      );
    }
    this.segmentBoundaries = options.segmentDurationsSeconds
      ? cumulativeSums(options.segmentDurationsSeconds)
      : null;
    this.totalSeconds = this.segmentBoundaries
      ? this.segmentBoundaries[this.segmentBoundaries.length - 1]
      : options.totalMinutes! * 60;
    this.intervalSeconds = (options.intervalMinutes ?? 0) * 60;
    this.direction = options.direction ?? "countdown";
    this.remaining = this.direction === "countup" ? 0 : this.totalSeconds;

    this.onTick = options.onTick;
    this.onSegmentChange = options.onSegmentChange;
    this.onComplete = options.onComplete;
  }
```

Replace the existing `private tickCountup(): void { ... }` method with:

```ts
  private tickCountup(): void {
    this.remaining++;
    this.onTick?.(this.remaining);

    if (
      this.segmentBoundaries &&
      this.segmentIndex < this.segmentBoundaries.length - 1 &&
      this.remaining >= this.segmentBoundaries[this.segmentIndex]
    ) {
      this.segmentIndex++;
      this.playBeep();
      this.onSegmentChange?.(this.segmentIndex);
    }

    if (this.remaining >= this.totalSeconds) {
      this.completeTimer();
    }
  }
```

Every other method (`tickCountdown`, `completeTimer`, `start`, `stop`, `reset`, `getRemaining`, `getElapsed`, `playBeep`, `getAudioContext`) is unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/ui/segment-timer.module.test.ts`
Expected: PASS — all existing tests plus the three new ones.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/ui/interfaces.ts app/src/modules/ui/segment-timer.module.ts app/tests/modules/ui/segment-timer.module.test.ts
git commit -m "feat(app): give SegmentTimer variable-length count-up segments"
```

---

## Task 3: Dartboard highlight geometry

**Files:**
- Modify: `app/src/lib/game/board/board-geometry.module.ts`
- Modify: `app/tests/lib/game/board/board-geometry.module.test.ts`
- Create: `app/src/lib/game/board/board-highlight.module.ts`
- Create: `app/tests/lib/game/board/board-highlight.module.test.ts`

**Interfaces:**
- Consumes: `BOARD_RADII_MM`, `SECTOR_ORDER` (existing), newly-exported `SECTOR_WIDTH_DEGREES` — all from `@lib/game/board/board-geometry.module`; `BULL_TARGET_NUMBER` from `@modules/game/board-progression.module` (existing value export).
- Produces: `HIGHLIGHT_GAP_MM`, `wedgeOutlinePath(targetNumber, innerRadiusMm, outerRadiusMm): string`, `bullOutlinePath(radiusMm): string`, `DARTBOARD_HIGHLIGHT_PATHS: ReadonlyArray<{ number: number; d: string }>` from `@lib/game/board/board-highlight.module`. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Add `SECTOR_WIDTH_DEGREES` to the import list at the top of `app/tests/lib/game/board/board-geometry.module.test.ts`:

```ts
import {
  BOARD_RADII_MM,
  SECTOR_WIDTH_DEGREES,
  classify,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
```

Append this test inside the file's existing top-level `describe` for the module (add it as its own `describe` block at the end of the file):

```ts
describe("SECTOR_WIDTH_DEGREES", () => {
  it("is 18 degrees for 20 sectors", () => {
    expect(SECTOR_WIDTH_DEGREES).toBe(18);
  });
});
```

Create `app/tests/lib/game/board/board-highlight.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import {
  DARTBOARD_HIGHLIGHT_PATHS,
  HIGHLIGHT_GAP_MM,
  bullOutlinePath,
  wedgeOutlinePath,
} from "@lib/game/board/board-highlight.module";

function radiiIn(d: string): number[] {
  return [...d.matchAll(/A([\d.]+),/g)].map((m) => Number(m[1]));
}

describe("wedgeOutlinePath", () => {
  it("draws the full sector from innerRadiusMm to outerRadiusMm, no internal boundaries", () => {
    const d = wedgeOutlinePath(20, 11.9, 174);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(radiiIn(d)).toEqual([174, 11.9]);
  });

  it("throws for a number that isn't on the board", () => {
    expect(() => wedgeOutlinePath(21, 11.9, 174)).toThrow();
  });
});

describe("bullOutlinePath", () => {
  it("draws a full circle at the given radius", () => {
    const d = bullOutlinePath(19.9);
    expect(radiiIn(d)).toEqual([19.9, 19.9]);
  });
});

describe("DARTBOARD_HIGHLIGHT_PATHS", () => {
  it("has one entry per board number plus the bull, in sector order with the bull last", () => {
    expect(DARTBOARD_HIGHLIGHT_PATHS.map((p) => p.number)).toEqual([
      20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
      25,
    ]);
  });

  it("offsets a number's outline outward/inward by HIGHLIGHT_GAP_MM from the scoring boundary", () => {
    const wedge = DARTBOARD_HIGHLIGHT_PATHS.find((p) => p.number === 20)!;
    expect(radiiIn(wedge.d)).toEqual([
      BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
    ]);
  });

  it("offsets the bull outline outward by HIGHLIGHT_GAP_MM", () => {
    const bull = DARTBOARD_HIGHLIGHT_PATHS.find((p) => p.number === 25)!;
    expect(radiiIn(bull.d)).toEqual([
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/board/board-geometry.module.test.ts tests/lib/game/board/board-highlight.module.test.ts`
Expected: FAIL — `SECTOR_WIDTH_DEGREES` isn't exported, and `board-highlight.module.ts` doesn't exist.

- [ ] **Step 3: Export `SECTOR_WIDTH_DEGREES`**

In `app/src/lib/game/board/board-geometry.module.ts`, change:

```ts
const SECTOR_WIDTH_DEGREES = 360 / SECTOR_ORDER.length;
```

to:

```ts
export const SECTOR_WIDTH_DEGREES = 360 / SECTOR_ORDER.length;
```

- [ ] **Step 4: Create `board-highlight.module.ts`**

Create `app/src/lib/game/board/board-highlight.module.ts`:

```ts
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  SECTOR_WIDTH_DEGREES,
} from "./board-geometry.module";

/**
 * How far outside a target's actual scoring boundary the Warm-Up highlight
 * outline sits, in millimetres — the "ring-offset" gap
 * (docs/superpowers/specs/2026-09-12-warmup-play-interface-design.md §5.1).
 */
export const HIGHLIGHT_GAP_MM = 4;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function polarPoint(
  radiusMm: number,
  angleDeg: number,
): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: round3(radiusMm * Math.sin(radians)),
    y: round3(-radiusMm * Math.cos(radians)),
  };
}

/**
 * One continuous outline around `targetNumber`'s full angular sector, from
 * `innerRadiusMm` to `outerRadiusMm` — both radial edges plus the inner and
 * outer arcs, with no line at the internal single/treble/double boundaries.
 * Mirrors the quadrilateral-with-two-arcs shape `DartBoard.astro`'s own
 * per-ring paths already draw.
 */
export function wedgeOutlinePath(
  targetNumber: number,
  innerRadiusMm: number,
  outerRadiusMm: number,
): string {
  const index = SECTOR_ORDER.indexOf(targetNumber);
  if (index < 0) {
    throw new Error(`${targetNumber} is not a board number`);
  }
  const center = index * SECTOR_WIDTH_DEGREES;
  const half = SECTOR_WIDTH_DEGREES / 2;
  const outerStart = polarPoint(outerRadiusMm, center - half);
  const outerEnd = polarPoint(outerRadiusMm, center + half);
  const innerEnd = polarPoint(innerRadiusMm, center + half);
  const innerStart = polarPoint(innerRadiusMm, center - half);
  return (
    `M${outerStart.x},${outerStart.y}` +
    `A${outerRadiusMm},${outerRadiusMm},0,0,1,${outerEnd.x},${outerEnd.y}` +
    `L${innerEnd.x},${innerEnd.y}` +
    `A${innerRadiusMm},${innerRadiusMm},0,0,0,${innerStart.x},${innerStart.y}Z`
  );
}

/**
 * A full circle outline at `radiusMm`, drawn as two half-circle arcs since a
 * single SVG arc command cannot span 360 degrees.
 */
export function bullOutlinePath(radiusMm: number): string {
  return (
    `M${-radiusMm},0` +
    `A${radiusMm},${radiusMm},0,1,1,${radiusMm},0` +
    `A${radiusMm},${radiusMm},0,1,1,${-radiusMm},0Z`
  );
}

/**
 * One highlight outline per board number plus one for the bull, in
 * `SECTOR_ORDER` order with the bull last — computed once from
 * `BOARD_RADII_MM` rather than hand-authored. `DartBoard.astro`'s highlight
 * overlay renders exactly these.
 */
export const DARTBOARD_HIGHLIGHT_PATHS: ReadonlyArray<{
  readonly number: number;
  readonly d: string;
}> = [
  ...SECTOR_ORDER.map((number) => ({
    number,
    d: wedgeOutlinePath(
      number,
      BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
    ),
  })),
  {
    number: BULL_TARGET_NUMBER,
    d: bullOutlinePath(BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM),
  },
];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/board/board-geometry.module.test.ts tests/lib/game/board/board-highlight.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/board/board-geometry.module.ts app/src/lib/game/board/board-highlight.module.ts app/tests/lib/game/board/board-geometry.module.test.ts app/tests/lib/game/board/board-highlight.module.test.ts
git commit -m "feat(app): compute Warm-Up dartboard highlight outlines from board geometry"
```

---

## Task 4: Highlight overlay in `DartBoard.astro`

**Files:**
- Modify: `app/src/components/ui/DartBoard.astro`

**Interfaces:**
- Consumes: `DARTBOARD_HIGHLIGHT_PATHS` from Task 3 (`@lib/game/board/board-highlight.module`).
- Produces: new optional prop `highlightExpr?: string` — a raw Alpine expression string evaluating to `readonly number[]` (e.g. `"warmUpEngine.state().targets"`), following the same raw-expression-prop convention `StatCard.astro`'s `valueExpr` already uses. When supplied, renders a `<g class="board-highlight-group">` sibling to `dartboard-group` (never inside it — `dartboard-component-parity.test.ts` extracts and diffs `dartboard-group` against `dartboard.svg` verbatim, so new markup must not land inside that group) with one `<path>` per `DARTBOARD_HIGHLIGHT_PATHS` entry, toggled visible when its `data-number` is in the expression's array. Consumed by Task 6.

No dedicated new test: `.astro` markup is exempt from the per-file test-coverage gate (D101). This task instead re-runs the existing dartboard parity tests to prove no regression.

- [ ] **Step 1: Confirm the parity tests currently pass (baseline)**

Run: `cd app && npx vitest run tests/lib/game/board/dartboard-component-parity.test.ts tests/lib/game/board/svg-geometry-parity.test.ts`
Expected: PASS (both files, unmodified so far).

- [ ] **Step 2: Add the `highlightExpr` prop and overlay group**

In `app/src/components/ui/DartBoard.astro`, change the `Props` interface and destructure:

```ts
interface Props {
  boardRef?: string;
  class?: string;
  highlightExpr?: string;
  [key: string]: unknown;
}

// Props
const {
  boardRef,
  class: classNameProp,
  highlightExpr,
  ...props
}: Props = Astro.props;
```

Add an import alongside the existing `cn` import:

```ts
import { DARTBOARD_HIGHLIGHT_PATHS } from "@lib/game/board/board-highlight.module";
```

Update the component's doc comment (the block at the top of the file) by appending one sentence:

```
 * @param {string} [highlightExpr] Raw Alpine expression evaluating to the
 *   currently-targeted board numbers (e.g. `warmUpEngine.state().targets`);
 *   when supplied, renders a highlight outline overlay toggled by membership.
```

In the template, immediately after the closing `</g>` of `<g class="dartboard-group">` and still inside `<svg>...</svg>` (i.e. as a sibling of `dartboard-group`, never a child of it), add:

```astro
      {
        highlightExpr && (
          <g
            class="board-highlight-group pointer-events-none"
            aria-hidden="true"
          >
            {DARTBOARD_HIGHLIGHT_PATHS.map((p) => (
              <path
                d={p.d}
                data-number={p.number}
                stroke-width="3"
                class="fill-none stroke-accent opacity-0"
                :class={`{'opacity-100': (${highlightExpr}).includes(${p.number})}`}
              />
            ))}
          </g>
        )
      }
```

- [ ] **Step 3: Run the parity and type checks**

Run: `cd app && npx vitest run tests/lib/game/board/dartboard-component-parity.test.ts tests/lib/game/board/svg-geometry-parity.test.ts`
Expected: PASS — both suites still green, since the new group sits outside `dartboard-group` and neither test's extraction reaches it.

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ui/DartBoard.astro
git commit -m "feat(app): add an optional target-highlight overlay to DartBoard"
```

---

## Task 5: Store wiring — timer-driven Warm-Up

**Files:**
- Modify: `app/src/lib/training/types.ts`
- Modify: `app/src/lib/training/balanced-training-play.data.ts`
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `resolveWarmUpPhaseDurations` (Task 1, `@modules/exercise/warm-up.engine.module`), `SegmentTimer` (Task 2, `@modules/ui/segment-timer.module`).
- Produces on `BalancedTrainingPlayContext`: `warmUpTimer: SegmentTimer | null`, `warmUpElapsedSeconds: number`, `formattedWarmUpElapsed(): string`. Removes `advanceWarmUp(): void`. Consumed by Task 6 (`WarmUpPanel.astro`).

- [ ] **Step 1: Write the failing tests**

At the top of `app/tests/lib/training/balanced-training-play.data.test.ts`, add the environment pragma as the very first line of the file (before the existing `import` line):

```ts
// @vitest-environment jsdom
```

Replace the `describe("balancedTrainingPlay", ...)` block's `beforeEach`/`afterEach` (currently just `beforeEach` with `vi.clearAllMocks()` + the `location` stub) with:

```ts
describe("balancedTrainingPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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

Delete the existing `it("advanceWarmUp() moves the engine to its next phase", ...)` test entirely, and add these two in its place (still inside `describe("balancedTrainingPlay", ...)`, before its closing `});`):

```ts
  it("the Warm-Up timer advances the engine through its phase and completes the step at the end", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
    expect(store.warmUpTimer).not.toBeNull();

    vi.advanceTimersByTime(600_000);
    await vi.runAllTimersAsync();

    expect(globalThis.location.href).toBe("/training");
    expect(store.warmUpTimer).toBeNull();
  });

  it("formattedWarmUpElapsed() reports mm:ss as the timer ticks", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    vi.advanceTimersByTime(65_000);
    expect(store.formattedWarmUpElapsed()).toBe("1:05");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: FAIL — `store.warmUpTimer`/`store.formattedWarmUpElapsed` don't exist yet.

- [ ] **Step 3: Update `BalancedTrainingPlayContext`**

In `app/src/lib/training/types.ts`, add an import alongside the existing ones:

```ts
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
```

In the `BalancedTrainingPlayContext` type, replace this line:

```ts
  stepDeadline: ReturnType<typeof setTimeout> | null;
```

with:

```ts
  stepDeadline: ReturnType<typeof setTimeout> | null;
  warmUpTimer: SegmentTimer | null;
  warmUpElapsedSeconds: number;
```

Delete this line entirely:

```ts
  advanceWarmUp(this: BalancedTrainingPlayContext): void;
```

And add, near the other method signatures (after `startCurrentStep`'s signature):

```ts
  startWarmUpTimer(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string;
```

- [ ] **Step 4: Wire the timer into the store**

In `app/src/lib/training/balanced-training-play.data.ts`, change the import:

```ts
import "@modules/exercise/warm-up.engine.module";
```

to:

```ts
import { resolveWarmUpPhaseDurations } from "@modules/exercise/warm-up.engine.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
```

In the object returned by `balancedTrainingPlay()`, replace this line:

```ts
    stepDeadline: null,
```

with:

```ts
    stepDeadline: null,
    warmUpTimer: null,
    warmUpElapsedSeconds: 0,
```

Delete the entire `advanceWarmUp(this: BalancedTrainingPlayContext) { ... }` method, and add these two methods in its place:

```ts
    startWarmUpTimer(
      this: BalancedTrainingPlayContext,
      configuration: Record<string, unknown>,
    ) {
      this.warmUpElapsedSeconds = 0;
      this.warmUpTimer = new SegmentTimer({
        direction: "countup",
        segmentDurationsSeconds: resolveWarmUpPhaseDurations(
          configuration as WarmUpEngineInput,
        ),
        onTick: (elapsed) => {
          this.warmUpElapsedSeconds = elapsed;
        },
        onSegmentChange: () => {
          this.warmUpEngine?.advance();
        },
        onComplete: () => {
          this.warmUpEngine?.advance();
          void this.completeCurrentStep();
        },
      });
      this.warmUpTimer.start();
    },

    formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string {
      const minutes = Math.floor(this.warmUpElapsedSeconds / 60);
      const seconds = this.warmUpElapsedSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
```

In `startCurrentStep()`, replace:

```ts
      if (result.exerciseTypeKey === "WARM_UP") {
        this.buildWarmUpEngine(result.configuration);
      }
```

with:

```ts
      if (result.exerciseTypeKey === "WARM_UP") {
        this.buildWarmUpEngine(result.configuration);
        this.startWarmUpTimer(result.configuration);
      }
```

In `completeCurrentStep()`, replace:

```ts
      if (this.stepDeadline) {
        clearTimeout(this.stepDeadline);
        this.stepDeadline = null;
      }
```

with:

```ts
      if (this.stepDeadline) {
        clearTimeout(this.stepDeadline);
        this.stepDeadline = null;
      }
      if (this.warmUpTimer) {
        this.warmUpTimer.stop();
        this.warmUpTimer = null;
      }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: PASS — every test in the file, including the Switching/Double Pattern/Finishing describe blocks (unaffected by this change) and the two new Warm-Up tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/training/types.ts app/src/lib/training/balanced-training-play.data.ts app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "feat(app): drive Balanced Training's Warm-Up step from a count-up SegmentTimer"
```

---

## Task 6: `WarmUpPanel.astro` — timer + highlighted board only

**Files:**
- Modify: `app/src/components/layout/training/WarmUpPanel.astro`

**Interfaces:**
- Consumes: `DartBoard`'s `highlightExpr` prop (Task 4); `formattedWarmUpElapsed()` (Task 5).
- Produces: nothing consumed by a later task — this is the final visible screen.

No dedicated new test (D101). This task's own verification is Task 7's full run plus a manual check.

- [ ] **Step 1: Replace the panel markup**

Replace the entire contents of `app/src/components/layout/training/WarmUpPanel.astro` with:

```astro
---
import DartBoard from "@components/ui/DartBoard.astro";
---

<div
  class="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 p-4"
>
  <p
    class="text-2xl font-semibold text-foreground tabular-nums"
    x-text="formattedWarmUpElapsed()"
  >
  </p>
  <DartBoard
    highlightExpr="warmUpEngine.state().targets"
    class="max-w-xs"
  />
</div>
```

This drops the `Button` import, the "Next phase" button, the "Phase X of Y" counter text, the phase name text, and the raw target-number list — the count-up timer and the highlighted dartboard are the only things rendered.

- [ ] **Step 2: Type-check**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/training/WarmUpPanel.astro
git commit -m "feat(app): render Warm-Up as a count-up timer and a highlighted dartboard only"
```

---

## Task 7: Full validation

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd app && npx vitest run`
Expected: every test file passes, 0 failures.

- [ ] **Step 2: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: exits zero; the type-check step reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Format**

Run: `cd app && npm run format && npm run format:check`
Expected: `format:check` reports clean. If `format` produced a diff, stage and commit it:

```bash
git add -A
git commit -m "style(app): format Warm-Up interface changes"
```

- [ ] **Step 4: Confirm the structural gates pass**

Run from the repo root:

```bash
bash scripts/check-no-inline-comments.sh && \
bash scripts/check-type-barrels.sh && \
bash scripts/check-astro-conventions.sh && \
bash scripts/check-astro-class-composition.sh && \
bash scripts/check-style-tokens.sh && \
bash scripts/check-test-coverage.sh
```

Expected: every script exits zero.

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill (per root `CLAUDE.md`, mandatory before claiming any task done) — this task changes no schema, no doc-referenced file paths, and introduces no new decision, but the skill's own checklist (context-map registration, decision ledger, findings gate) must still be run and confirmed clean.
