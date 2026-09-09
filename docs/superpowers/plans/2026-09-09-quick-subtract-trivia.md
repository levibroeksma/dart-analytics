# Quick Subtract Trivia Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "Quick Subtract" — an ephemeral, client-only checkout-arithmetic drill (`start − subtraction = ?`) — as a new Trivia section outside the dartboard-game pipeline.

**Architecture:** A plain OOP module (`QuickSubtractGame`, `modules/trivia/`) drives independent random rounds and is driven by an additive, backward-compatible extension to the existing `SegmentTimer` (adds a `countup` direction + `getElapsed()`). A single Alpine factory (`lib/trivia/quick-subtract-play.data.ts`, no store, no persistence) wires it to one page (`pages/trivia/quick-subtract/index.astro`) whose markup (`components/layout/trivia/QuickSubtract.astro`) swaps setup → play → summary views. A new top-level Trivia nav entry and landing page complete the surface. No `game_types` row, no `GameEngine` contract, no server involvement.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md`

## Global Constraints

- Ephemeral V1: no persistence, no `$store`, no `$persist`, no API calls.
- Independent rounds: `start` (2–501) and `subtraction` (any one-dart score ≤ `start`) are generated fresh every round — never chained off the previous result.
- `SegmentTimer` changes must be additive only — the 3 existing countdown consumers (Score Training, TUOD, 121) must keep working unchanged, and their own tests must not be touched.
- No `.engine.module.ts` suffix, no `modules/game/` placement, no `services/rulesets/registry.ts` entry — this tool is outside `check-game-engines.sh`'s scope by design.
- Every exported `type` lives in the owning folder's `types.ts`; every exported `interface` lives in its `interfaces.ts` — never inline in an implementation file (`scripts/check-type-barrels.sh`).
- Every `.ts` file touched under `app/src/` needs a covering test edited in the same commit (`scripts/check-test-coverage.sh`, D224). `.astro` files are exempt (no component test runner in this project).
- Reuse existing components before hand-rolling markup: `ScoreInput.astro` (keypad), `Toggle.astro`/`Input.astro`/`SettingSectionShell.astro` (setup controls), `Button.astro` (every action), `StatRow.astro` (summary), `GameCard.astro`/`CardWrapper.astro` (landing card).
- Semantic Tailwind tokens only, `cn()` for class composition, every `x-show` paired with `x-cloak` (`scripts/check-astro-conventions.sh`).

---

## Task 1: Dart-score pool (`modules/trivia/dart-scores.module.ts`)

**Files:**
- Create: `app/src/modules/trivia/dart-scores.module.ts`
- Test: `app/tests/modules/trivia/dart-scores.module.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ONE_DART_SCORES: readonly number[]` (every reachable one-dart score, 1–60, ascending, deduped), `getRandomDartScore(maxScore: number): number` (throws if no candidate is ≤ `maxScore`) — consumed by Task 4's `QuickSubtractGame`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/trivia/dart-scores.module.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ONE_DART_SCORES,
  getRandomDartScore,
} from "@modules/trivia/dart-scores.module";

describe("ONE_DART_SCORES", () => {
  it("contains every reachable one-dart score exactly once, sorted ascending", () => {
    expect(ONE_DART_SCORES[0]).toBe(1);
    expect(ONE_DART_SCORES[ONE_DART_SCORES.length - 1]).toBe(60);
    expect(new Set(ONE_DART_SCORES).size).toBe(ONE_DART_SCORES.length);
    expect([...ONE_DART_SCORES]).toEqual(
      [...ONE_DART_SCORES].sort((a, b) => a - b),
    );
    expect(ONE_DART_SCORES).toContain(25);
    expect(ONE_DART_SCORES).toContain(50);
    expect(ONE_DART_SCORES).not.toContain(21);
    expect(ONE_DART_SCORES).not.toContain(41);
  });
});

describe("getRandomDartScore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 when maxScore is 1 (the only reachable score)", () => {
    expect(getRandomDartScore(1)).toBe(1);
  });

  it("never returns a score greater than maxScore", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(getRandomDartScore(10)).toBeLessThanOrEqual(10);
  });

  it("throws when no reachable score is at most maxScore", () => {
    expect(() => getRandomDartScore(0)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/trivia/dart-scores.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/trivia/dart-scores.module'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/modules/trivia/dart-scores.module.ts
const SINGLES = Array.from({ length: 20 }, (_, i) => i + 1);
const DOUBLES = SINGLES.map((n) => n * 2);
const TREBLES = SINGLES.map((n) => n * 3);
const BULLS = [25, 50];

export const ONE_DART_SCORES: readonly number[] = Array.from(
  new Set<number>([...SINGLES, ...DOUBLES, ...TREBLES, ...BULLS]),
).sort((a, b) => a - b);

export function getRandomDartScore(maxScore: number): number {
  const candidates = ONE_DART_SCORES.filter((score) => score <= maxScore);
  if (candidates.length === 0) {
    throw new Error(`no reachable one-dart score for maxScore ${maxScore}`);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/trivia/dart-scores.module.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/trivia/dart-scores.module.ts app/tests/modules/trivia/dart-scores.module.test.ts
git commit -m "$(cat <<'EOF'
feat(trivia): add one-dart score pool for Quick Subtract

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 2: `modules/trivia` type barrels + area-root raising

**Files:**
- Create: `app/src/modules/trivia/types.ts`
- Create: `app/src/modules/trivia/interfaces.ts`
- Modify: `app/src/modules/types.ts`
- Modify: `app/src/modules/interfaces.ts`

**Interfaces:**
- Consumes: nothing (pure type declarations)
- Produces: `GameStatus` (`modules/trivia/types.ts`, raised to `@modules/types`); `Calculation`, `AnswerResult`, `QuickSubtractOptions` (`modules/trivia/interfaces.ts`, raised to `@modules/interfaces`) — `QuickSubtractOptions.timer` types as `SegmentTimer` (imported as a value-position type reference, not raised — classes stay outside the barrel convention). Consumed by Task 4 (`quick-subtract.module.ts`) and Task 5 (`quick-subtract-play.data.ts`).

No test: type-only files declare no runtime value (`scripts/check_test_coverage.py`'s `declares_runtime` check is false for them), so `scripts/check-test-coverage.sh` does not require a covering test edit for this task.

- [ ] **Step 1: Create the trivia barrels**

```typescript
// app/src/modules/trivia/types.ts
export type GameStatus = "idle" | "running" | "finished";
```

```typescript
// app/src/modules/trivia/interfaces.ts
import type { SegmentTimer } from "../ui/segment-timer.module";

export interface Calculation {
  readonly start: number;
  readonly subtraction: number;
  readonly expression: string;
}

export interface AnswerResult {
  readonly valid: boolean;
  readonly correct: boolean;
  readonly expected: number | null;
  readonly calculation: Calculation | null;
}

export interface QuickSubtractOptions {
  mode: "count" | "timer";
  count?: number;
  timer: SegmentTimer;
}
```

- [ ] **Step 2: Raise both barrels into the `modules/` area root**

Edit `app/src/modules/types.ts`:

```typescript
export * from "./dartbot/types";
export * from "./game/types";
export * from "./stats/types";
export * from "./trivia/types";
export * from "./ui/types";
```

Edit `app/src/modules/interfaces.ts`:

```typescript
export * from "./dartbot/interfaces";
export * from "./game/interfaces";
export * from "./trivia/interfaces";
export * from "./ui/interfaces";
```

- [ ] **Step 3: Verify the type-barrel gate passes**

Run: `bash scripts/check-type-barrels.sh`
Expected: `OK: ... no inline exported type/interface and no deep aliased or relative barrel TYPE import ...`

(`../ui/segment-timer.module` in `interfaces.ts` is a relative **value-position type import of a class**, not a barrel path — it does not end in `/types` or `/interfaces`, so rule 4 does not apply to it.)

- [ ] **Step 4: Commit**

```bash
git add app/src/modules/trivia/types.ts app/src/modules/trivia/interfaces.ts app/src/modules/types.ts app/src/modules/interfaces.ts
git commit -m "$(cat <<'EOF'
feat(trivia): add modules/trivia type barrels, raised to area root

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 3: `SegmentTimer` additive `direction`/`getElapsed()` extension

**Files:**
- Modify: `app/src/modules/ui/interfaces.ts`
- Modify: `app/src/modules/ui/segment-timer.module.ts`
- Test: `app/tests/modules/ui/segment-timer.module.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `SegmentTimerOptions.direction?: "countdown" | "countup"` (default `"countdown"`), `SegmentTimer.getElapsed(): number` — consumed by Task 4/5 (Quick Subtract's count-mode elapsed-time tracking and timer-mode countdown).

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/ui/segment-timer.module.test.ts` (inside the existing `describe("SegmentTimer", ...)` block, after the two existing `it(...)` cases):

```typescript
  it("counts up and calls onComplete when remaining reaches totalSeconds (countup)", () => {
    const onTick = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 2 / 60,
      intervalMinutes: 1 / 60,
      direction: "countup",
      onTick,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(2);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("countup direction never fires onSegmentChange", () => {
    const onSegmentChange = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 5 / 60,
      intervalMinutes: 1 / 60,
      direction: "countup",
      onSegmentChange,
    });
    timer.start();
    vi.advanceTimersByTime(4000);
    expect(onSegmentChange).not.toHaveBeenCalled();
    timer.stop();
  });

  it("getElapsed() reports elapsed seconds for both directions", () => {
    const countdown = new SegmentTimer({ totalMinutes: 1, intervalMinutes: 1 });
    expect(countdown.getElapsed()).toBe(0);
    countdown.start();
    vi.advanceTimersByTime(3000);
    expect(countdown.getElapsed()).toBe(3);
    countdown.stop();

    const countup = new SegmentTimer({
      totalMinutes: 1,
      intervalMinutes: 1,
      direction: "countup",
    });
    expect(countup.getElapsed()).toBe(0);
    countup.start();
    vi.advanceTimersByTime(3000);
    expect(countup.getElapsed()).toBe(3);
    countup.stop();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd app && npx vitest run tests/modules/ui/segment-timer.module.test.ts`
Expected: the 2 pre-existing tests PASS, the 3 new tests FAIL (`direction` not recognized / `getElapsed` not a function)

- [ ] **Step 3: Extend the options interface**

Edit `app/src/modules/ui/interfaces.ts`:

```typescript
export interface SegmentTimerOptions {
  totalMinutes: number;
  intervalMinutes: number;
  direction?: "countdown" | "countup";
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
```

- [ ] **Step 4: Implement the countup branch and `getElapsed()`**

Edit `app/src/modules/ui/segment-timer.module.ts`. Add a `direction` field and set it in the constructor:

```typescript
export class SegmentTimer {
  private totalSeconds: number;
  private intervalSeconds: number;
  private remaining: number;
  private direction: "countdown" | "countup";
  private timerId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  private onTick?: (secondsRemaining: number) => void;
  private onSegmentChange?: (segmentIndex: number) => void;
  private onComplete?: () => void;

  constructor(options: SegmentTimerOptions) {
    this.totalSeconds = options.totalMinutes * 60;
    this.intervalSeconds = options.intervalMinutes * 60;
    this.remaining = this.totalSeconds;
    this.direction = options.direction ?? "countdown";

    this.onTick = options.onTick;
    this.onSegmentChange = options.onSegmentChange;
    this.onComplete = options.onComplete;
  }
```

Replace the body of `start()` with a direction branch — the countdown path is byte-identical to the original so the 3 existing consumers see no behavior change:

```typescript
  start(): void {
    if (this.timerId !== null) return;

    let segmentIndex = 0;

    this.timerId = setInterval(() => {
      if (this.direction === "countup") {
        this.remaining++;
        this.onTick?.(this.remaining);

        if (this.remaining >= this.totalSeconds) {
          this.stop();
          this.playBeep(440, 0.6);
          this.onComplete?.();
        }
        return;
      }

      this.remaining--;
      this.onTick?.(this.remaining);

      if (this.remaining > 0 && this.remaining % this.intervalSeconds === 0) {
        segmentIndex++;
        this.playBeep();
        this.onSegmentChange?.(segmentIndex);
      }

      if (this.remaining <= 0) {
        this.stop();
        this.playBeep(440, 0.6);
        this.onComplete?.();
      }
    }, 1000);
  }
```

Add `getElapsed()` next to `getRemaining()`, and drop the `fallow-ignore-next-line` above `getRemaining()` — Task 4 gives it its first real caller (`QuickSubtractGame.getRemainingTime()` in timer mode), so it stops being dead code:

```typescript
  getRemaining(): number {
    return this.remaining;
  }

  getElapsed(): number {
    return this.direction === "countup"
      ? this.remaining
      : this.totalSeconds - this.remaining;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/ui/segment-timer.module.test.ts`
Expected: PASS (5 tests — the 2 original countdown tests must still pass unchanged)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/ui/interfaces.ts app/src/modules/ui/segment-timer.module.ts app/tests/modules/ui/segment-timer.module.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): add additive countup direction + getElapsed() to SegmentTimer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 4: `QuickSubtractGame` engine

**Files:**
- Create: `app/src/modules/trivia/quick-subtract.module.ts`
- Test: `app/tests/modules/trivia/quick-subtract.module.test.ts`

**Interfaces:**
- Consumes: `ONE_DART_SCORES`/`getRandomDartScore` (Task 1, `@modules/trivia/dart-scores.module`), `GameStatus` (Task 2, `@modules/types`), `Calculation`/`AnswerResult`/`QuickSubtractOptions` (Task 2, `@modules/interfaces`), `SegmentTimer` (Task 3, `@modules/ui/segment-timer.module`).
- Produces: `class QuickSubtractGame` with `start(): void`, `answer(value: number | string): AnswerResult`, `finish(): void`, `destroy(): void`, `getStatus(): GameStatus`, `getCurrent(): Calculation | null`, `getCorrectAnswers(): number`, `getAttempts(): number`, `getIncorrectAnswers(): number`, `getGenerated(): number`, `getElapsedTime(): number`, `getRemainingTime(): number` — consumed by Task 5 (`quick-subtract-play.data.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/tests/modules/trivia/quick-subtract.module.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { QuickSubtractGame } from "@modules/trivia/quick-subtract.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";

function countupTimer() {
  return new SegmentTimer({
    totalMinutes: 180,
    intervalMinutes: 0,
    direction: "countup",
  });
}

describe("QuickSubtractGame", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a count-mode session and generates the first calculation deterministically", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    expect(game.getStatus()).toBe("running");
    expect(game.getCurrent()).toEqual({
      start: 2,
      subtraction: 1,
      expression: "2 - 1",
    });
    expect(game.getGenerated()).toBe(1);
  });

  it("records a correct answer, advances to a new round, and reports the result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("1");
    expect(result).toEqual({
      valid: true,
      correct: true,
      expected: 1,
      calculation: { start: 2, subtraction: 1, expression: "2 - 1" },
    });
    expect(game.getCorrectAnswers()).toBe(1);
    expect(game.getAttempts()).toBe(1);
    expect(game.getIncorrectAnswers()).toBe(0);
    expect(game.getGenerated()).toBe(2);
    expect(game.getStatus()).toBe("running");
  });

  it("records an incorrect answer without finishing the session", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("99");
    expect(result.valid).toBe(true);
    expect(result.correct).toBe(false);
    expect(game.getIncorrectAnswers()).toBe(1);
    expect(game.getStatus()).toBe("running");
  });

  it("rejects an empty answer without consuming an attempt", () => {
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("");
    expect(result).toEqual({
      valid: false,
      correct: false,
      expected: null,
      calculation: null,
    });
    expect(game.getAttempts()).toBe(0);
  });

  it("finishes a count-mode session once correctAnswers reaches count, stopping the timer", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const timer = countupTimer();
    const stopSpy = vi.spyOn(timer, "stop");
    const game = new QuickSubtractGame({ mode: "count", count: 1, timer });
    game.start();
    game.answer("1");
    expect(game.getStatus()).toBe("finished");
    expect(stopSpy).toHaveBeenCalled();
  });

  it("returns 0 remaining time in count mode and the timer's remaining time in timer mode", () => {
    const countGame = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    expect(countGame.getRemainingTime()).toBe(0);

    const timerGame = new QuickSubtractGame({
      mode: "timer",
      timer: new SegmentTimer({ totalMinutes: 5, intervalMinutes: 5 }),
    });
    expect(timerGame.getRemainingTime()).toBe(300);
  });

  it("destroy() stops the timer", () => {
    const timer = countupTimer();
    const stopSpy = vi.spyOn(timer, "stop");
    const game = new QuickSubtractGame({ mode: "count", count: 5, timer });
    game.destroy();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("never throws across 1000 independently generated rounds regardless of the prior result (no chained dead end)", () => {
    const game = new QuickSubtractGame({
      mode: "count",
      count: 1000,
      timer: countupTimer(),
    });
    game.start();
    expect(() => {
      for (let i = 0; i < 1000; i++) {
        const current = game.getCurrent()!;
        game.answer(String(current.start - current.subtraction));
      }
    }).not.toThrow();
    expect(game.getStatus()).toBe("finished");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/trivia/quick-subtract.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/trivia/quick-subtract.module'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/modules/trivia/quick-subtract.module.ts
import { getRandomDartScore } from "./dart-scores.module";
import type { SegmentTimer } from "../ui/segment-timer.module";
import type { GameStatus } from "./types";
import type {
  AnswerResult,
  Calculation,
  QuickSubtractOptions,
} from "./interfaces";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextCalculation(): Calculation {
  const start = randomInt(2, 501);
  const subtraction = getRandomDartScore(start);
  return { start, subtraction, expression: `${start} - ${subtraction}` };
}

export class QuickSubtractGame {
  private mode: "count" | "timer";
  private targetCount: number | null;
  private timer: SegmentTimer;
  private status: GameStatus = "idle";
  private current: Calculation | null = null;
  private correctAnswers = 0;
  private attempts = 0;
  private incorrectAnswers = 0;
  private generated = 0;

  constructor(options: QuickSubtractOptions) {
    this.mode = options.mode;
    this.targetCount = options.mode === "count" ? (options.count ?? null) : null;
    this.timer = options.timer;
  }

  start(): void {
    if (this.status !== "idle") return;
    this.status = "running";
    this.timer.start();
    this.nextRound();
  }

  answer(value: number | string): AnswerResult {
    if (this.status !== "running" || !this.current) {
      return { valid: false, correct: false, expected: null, calculation: null };
    }
    const numeric = typeof value === "number" ? value : Number(value);
    if (value === "" || !Number.isFinite(numeric)) {
      return { valid: false, correct: false, expected: null, calculation: null };
    }

    const calculation = this.current;
    const expected = calculation.start - calculation.subtraction;
    const correct = numeric === expected;

    this.attempts++;
    if (correct) {
      this.correctAnswers++;
    } else {
      this.incorrectAnswers++;
    }

    if (this.mode === "count" && this.correctAnswers >= (this.targetCount ?? Infinity)) {
      this.finish();
    } else {
      this.nextRound();
    }

    return { valid: true, correct, expected, calculation };
  }

  finish(): void {
    if (this.status !== "running") return;
    this.status = "finished";
    this.timer.stop();
  }

  destroy(): void {
    this.timer.stop();
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getCurrent(): Calculation | null {
    return this.current;
  }

  getCorrectAnswers(): number {
    return this.correctAnswers;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getIncorrectAnswers(): number {
    return this.incorrectAnswers;
  }

  getGenerated(): number {
    return this.generated;
  }

  getElapsedTime(): number {
    return this.timer.getElapsed();
  }

  getRemainingTime(): number {
    return this.mode === "count" ? 0 : this.timer.getRemaining();
  }

  private nextRound(): void {
    this.current = nextCalculation();
    this.generated++;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/trivia/quick-subtract.module.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/trivia/quick-subtract.module.ts app/tests/modules/trivia/quick-subtract.module.test.ts
git commit -m "$(cat <<'EOF'
feat(trivia): add QuickSubtractGame engine with independent rounds

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 5: Alpine factory + route registration

**Files:**
- Create: `app/src/lib/trivia/quick-subtract-play.data.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Test: `app/tests/lib/trivia/quick-subtract-play.data.test.ts`
- Test: `app/tests/lib/client/alpine/register-route-data.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `QuickSubtractGame` (Task 4), `SegmentTimer` (Task 3), `GameStatus`/`Calculation`/`AnswerResult` (Task 2).
- Produces: `quickSubtractPlay()` returning `{ status, current, value, correctAnswers, attempts, incorrectAnswers, elapsedTime, remainingTime, lastAnswer, game, startCount(count), startTimer(minutes), digit(d), backspace(), submit(), reset(), destroy() }` — consumed by Task 6's page/component markup via `x-data="quickSubtractPlay()"`.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/tests/lib/trivia/quick-subtract-play.data.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { quickSubtractPlay } from "@lib/trivia/quick-subtract-play.data";

describe("quickSubtractPlay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts idle with no active game", () => {
    const ctx = quickSubtractPlay();
    expect(ctx.status).toBe("idle");
    expect(ctx.game).toBeNull();
  });

  it("startCount() builds a running count-mode game and seeds the first calculation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    expect(ctx.status).toBe("running");
    expect(ctx.current).toEqual({
      start: 2,
      subtraction: 1,
      expression: "2 - 1",
    });
  });

  it("startTimer() builds a running timer-mode game", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startTimer(5);
    expect(ctx.status).toBe("running");
    expect(ctx.current).not.toBeNull();
  });

  it("digit()/backspace() edit the typed value", () => {
    const ctx = quickSubtractPlay();
    ctx.digit(4);
    ctx.digit(1);
    expect(ctx.value).toBe("41");
    ctx.backspace();
    expect(ctx.value).toBe("4");
  });

  it("submit() records the answer, syncs stats, and clears the typed value", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    ctx.value = "1";
    ctx.submit();
    expect(ctx.value).toBe("");
    expect(ctx.correctAnswers).toBe(1);
    expect(ctx.attempts).toBe(1);
    expect(ctx.lastAnswer?.correct).toBe(true);
  });

  it("reset() tears down the game and returns to idle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    ctx.reset();
    expect(ctx.status).toBe("idle");
    expect(ctx.game).toBeNull();
    expect(ctx.correctAnswers).toBe(0);
    expect(ctx.current).toBeNull();
  });

  it("destroy() stops the underlying game's timer", () => {
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    const destroySpy = vi.spyOn(ctx.game!, "destroy");
    ctx.destroy();
    expect(destroySpy).toHaveBeenCalled();
  });
});
```

```typescript
// app/tests/lib/client/alpine/register-route-data.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerRouteData } from "@lib/client/alpine/register-route-data";
import { quickSubtractPlay } from "@lib/trivia/quick-subtract-play.data";

describe("registerRouteData", () => {
  it("registers quickSubtractPlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("quickSubtractPlay", quickSubtractPlay);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/trivia/quick-subtract-play.data.test.ts tests/lib/client/alpine/register-route-data.test.ts`
Expected: FAIL — `Cannot find module '@lib/trivia/quick-subtract-play.data'`

- [ ] **Step 3: Write the Alpine factory**

```typescript
// app/src/lib/trivia/quick-subtract-play.data.ts
import { QuickSubtractGame } from "@modules/trivia/quick-subtract.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { AnswerResult, Calculation } from "@modules/interfaces";
import type { GameStatus } from "@modules/types";

export function quickSubtractPlay() {
  return {
    status: "idle" as GameStatus,
    current: null as Calculation | null,
    value: "",
    correctAnswers: 0,
    attempts: 0,
    incorrectAnswers: 0,
    elapsedTime: 0,
    remainingTime: 0,
    lastAnswer: null as AnswerResult | null,
    game: null as QuickSubtractGame | null,

    startCount(count: number) {
      let game: QuickSubtractGame;
      const timer = new SegmentTimer({
        totalMinutes: 180,
        intervalMinutes: 0,
        direction: "countup",
        onTick: (seconds) => {
          this.elapsedTime = seconds;
        },
        onComplete: () => game.finish(),
      });
      game = new QuickSubtractGame({ mode: "count", count, timer });
      this.game = game;
      game.start();
      this.status = game.getStatus();
      this.current = game.getCurrent();
    },

    startTimer(minutes: number) {
      let game: QuickSubtractGame;
      const timer = new SegmentTimer({
        totalMinutes: minutes,
        intervalMinutes: minutes,
        onTick: (seconds) => {
          this.remainingTime = seconds;
        },
        onComplete: () => game.finish(),
      });
      game = new QuickSubtractGame({ mode: "timer", timer });
      this.game = game;
      game.start();
      this.status = game.getStatus();
      this.current = game.getCurrent();
    },

    digit(d: number) {
      this.value += String(d);
    },

    backspace() {
      this.value = this.value.slice(0, -1);
    },

    submit() {
      if (!this.game || !this.value) return;
      const result = this.game.answer(this.value);
      this.lastAnswer = result;
      this.value = "";
      this.correctAnswers = this.game.getCorrectAnswers();
      this.attempts = this.game.getAttempts();
      this.incorrectAnswers = this.game.getIncorrectAnswers();
      this.current = this.game.getCurrent();
      this.elapsedTime = this.game.getElapsedTime();
      this.remainingTime = this.game.getRemainingTime();
      this.status = this.game.getStatus();
    },

    reset() {
      this.game?.destroy();
      this.game = null;
      this.status = "idle";
      this.current = null;
      this.value = "";
      this.correctAnswers = 0;
      this.attempts = 0;
      this.incorrectAnswers = 0;
      this.elapsedTime = 0;
      this.remainingTime = 0;
      this.lastAnswer = null;
    },

    destroy() {
      this.game?.destroy();
    },
  };
}
```

- [ ] **Step 4: Register it**

Edit `app/src/lib/client/alpine/register-route-data.ts` — add the import and the call, alphabetically grouped with the other `@lib/` imports:

```typescript
import { quickSubtractPlay } from "@lib/trivia/quick-subtract-play.data";
```

```typescript
  Alpine.data("quickSubtractPlay", quickSubtractPlay);
```

(Add the import line alongside the existing `@lib/game/*` imports and the `Alpine.data(...)` call alongside the existing registrations, e.g. right after the `tuodPlay`/`gamesIndex` lines.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/trivia/quick-subtract-play.data.test.ts tests/lib/client/alpine/register-route-data.test.ts`
Expected: PASS (7 + 1 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/trivia/quick-subtract-play.data.ts app/src/lib/client/alpine/register-route-data.ts app/tests/lib/trivia/quick-subtract-play.data.test.ts app/tests/lib/client/alpine/register-route-data.test.ts
git commit -m "$(cat <<'EOF'
feat(trivia): add quickSubtractPlay Alpine factory and register it

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 6: Quick Subtract page + interface component

**Files:**
- Create: `app/src/components/layout/trivia/QuickSubtract.astro`
- Create: `app/src/pages/trivia/quick-subtract/index.astro`

**Interfaces:**
- Consumes: `quickSubtractPlay()`'s Alpine scope (Task 5) — `status`, `current`, `value`, `correctAnswers`, `attempts`, `incorrectAnswers`, `startCount(count)`, `startTimer(minutes)`, `digit(d)`, `backspace()`, `submit()`, `reset()`. Reuses `ScoreInput.astro`, `Button.astro`, `Toggle.astro`, `Input.astro`, `SettingSectionShell.astro`, `StatRow.astro`.
- Produces: the `/trivia/quick-subtract` route — consumed by Task 7's landing-page card and `BottomNav` link.

No test: `.astro` files carry no runtime `.ts` export and are exempt from `scripts/check-test-coverage.sh` (app/CLAUDE.md: "there is no Astro-component test runner in this project").

- [ ] **Step 1: Write the interface component**

```astro
---
// app/src/components/layout/trivia/QuickSubtract.astro

// Components
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import Button from "@components/forms/Button.astro";
import Toggle from "@components/layout/games/setup/Toggle.astro";
import Input from "@components/forms/Input.astro";
import SettingSectionShell from "@components/layout/games/setup/SettingSectionShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";

// Data
const modeOptions = [
  { value: "count", label: "Fixed Count" },
  { value: "timer", label: "Timer" },
];
---

<div
  class="flex flex-col gap-4"
  x-data="{ mode: 'count', count: 20, minutes: 5 }"
>
  <div
    class="flex flex-col gap-4"
    x-show="status === 'idle'"
    x-cloak
  >
    <SettingSectionShell>
      <Toggle
        orientation="horizontal"
        options={modeOptions}
        x-model="mode"
        class="w-full"
      />
      <template x-if="mode === 'count'">
        <div class="contents">
          <Input
            id="count"
            name="count"
            type="number"
            inputmode="numeric"
            min="10"
            max="100"
            x-model.number="count"
            class="glass border-tab-border rounded-full mt-4"
          />
          <label
            for="count"
            class="text-xs text-muted-foreground px-4 py-0 italic"
          >
            Correct answers to finish (10–100)
          </label>
        </div>
      </template>
      <template x-if="mode === 'timer'">
        <div class="contents">
          <Input
            id="minutes"
            name="minutes"
            type="number"
            inputmode="numeric"
            min="1"
            max="15"
            x-model.number="minutes"
            class="glass border-tab-border rounded-full mt-4"
          />
          <label
            for="minutes"
            class="text-xs text-muted-foreground px-4 py-0 italic"
          >
            Minutes (1–15)
          </label>
        </div>
      </template>
    </SettingSectionShell>
    <Button
      type="button"
      variant="primary"
      title="Start"
      class="rounded-full w-full"
      @click="mode === 'count' ? startCount(count) : startTimer(minutes)"
    />
  </div>

  <div
    class="flex flex-col gap-4"
    x-show="status === 'running'"
    x-cloak
  >
    <div
      class="text-center text-3xl font-mono font-bold tabular-nums"
      x-text="current?.expression ?? ''"
    >
    </div>
    <ScoreInput
      value="value"
      digitHandler="digit"
      onDelete="backspace()"
      onSubmit="submit()"
    />
    <div class="flex justify-between text-sm text-muted-foreground">
      <span x-text="`Correct: ${correctAnswers}`"></span>
      <span x-text="`Incorrect: ${incorrectAnswers}`"></span>
    </div>
  </div>

  <div
    class="flex flex-col gap-4"
    x-show="status === 'finished'"
    x-cloak
  >
    <h2 class="text-xl font-semibold text-center text-foreground">
      Session complete
    </h2>
    <div class="flex flex-col gap-1">
      <StatRow
        label="Correct"
        value="correctAnswers"
      />
      <StatRow
        label="Incorrect"
        value="incorrectAnswers"
      />
      <StatRow
        label="Attempts"
        value="attempts"
      />
    </div>
    <Button
      type="button"
      variant="secondary"
      title="Play Again"
      class="rounded-full w-full"
      @click="reset()"
    />
  </div>
</div>
```

- [ ] **Step 2: Write the page**

```astro
---
// app/src/pages/trivia/quick-subtract/index.astro
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import QuickSubtract from "@components/layout/trivia/QuickSubtract.astro";
---

<AppLayout title="Quick Subtract">
  <div
    class="p-4"
    x-data="quickSubtractPlay()"
  >
    <QuickSubtract />
  </div>
</AppLayout>
```

- [ ] **Step 3: Verify astro conventions gate passes**

Run: `bash scripts/check-astro-conventions.sh`
Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.`

- [ ] **Step 4: Manually verify in the browser**

Run: `cd app && npm run dev -- --background` (or `astro dev --background` if already in `app/`), then open `/trivia/quick-subtract` — since this route requires no auth/session (no `game_types`, no login gate unlike `/games/*`), it should render directly. Walk the golden path: pick "Fixed Count" with the default 20, click Start, answer a few calculations correctly and incorrectly via the keypad, confirm the summary screen's correct/incorrect/attempts counts, click "Play Again", then repeat with "Timer" mode and confirm the countdown-driven finish. Stop the dev server (`astro dev stop`) when done.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/trivia/QuickSubtract.astro app/src/pages/trivia/quick-subtract/index.astro
git commit -m "$(cat <<'EOF'
feat(trivia): add Quick Subtract page and interface component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 7: Trivia landing page + top-level nav entry

**Files:**
- Create: `app/src/pages/trivia/index.astro`
- Modify: `app/src/components/layout/BottomNav.astro`

**Interfaces:**
- Consumes: `GameCard.astro` (href/title/caption card), `target.svg` icon (reused — no dedicated "trivia" icon exists in `app/src/icons/`, and the calculation/target theme fits Quick Subtract without adding a new asset).
- Produces: the `/trivia` route and its nav entry — no other task depends on this.

No test: `.astro`-only change, exempt from `scripts/check-test-coverage.sh`.

- [ ] **Step 1: Write the landing page**

```astro
---
// app/src/pages/trivia/index.astro
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import GameCard from "@components/layout/games/GameCard.astro";
---

<AppLayout title="Trivia">
  <div class="p-4 space-y-4">
    <h1 class="text-xl font-semibold text-foreground">Trivia</h1>
    <GameCard
      href="/trivia/quick-subtract"
      title="Quick Subtract"
      caption="Drill checkout mental math against the clock or a target count"
    />
  </div>
</AppLayout>
```

- [ ] **Step 2: Add the nav entry**

Edit `app/src/components/layout/BottomNav.astro`:

```astro
---
// Components
import NavBtn from "@components/layout/NavBtn.astro";

// Icons
import HomeIcon from "@icons/home-circle.svg";
import DartboardIcon from "@icons/dartboard.svg";
import TargetIcon from "@icons/target.svg";
import UserIcon from "@icons/user.svg";
import StatsIcon from "@icons/stats.svg";

// Data
const pages = [
  {
    label: "Home",
    icon: HomeIcon,
    href: "/",
  },
  {
    label: "Games",
    icon: DartboardIcon,
    href: "/games",
  },
  {
    label: "Trivia",
    icon: TargetIcon,
    href: "/trivia",
  },
  {
    label: "Stats",
    icon: StatsIcon,
    href: "/statistics",
  },
  {
    label: "Profile",
    icon: UserIcon,
    href: "/profile",
  },
];
---

<nav
  class="border-t border-border-strong"
  aria-label="Main navigation"
>
  <div class="mx-auto flex max-w-lg justify-around py-1">
    {
      pages.map((page) => (
        <NavBtn
          href={page.href}
          label={page.label}
        >
          <page.icon aria-hidden="true" />
        </NavBtn>
      ))
    }
  </div>
</nav>
```

- [ ] **Step 3: Verify astro conventions gate passes**

Run: `bash scripts/check-astro-conventions.sh`
Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.`

- [ ] **Step 4: Manually verify in the browser**

With the dev server running (`cd app && astro dev --background`), open `/` and confirm the bottom nav now shows five items (Home, Games, Trivia, Stats, Profile) without overflowing on a narrow viewport, then click "Trivia" and confirm it lands on `/trivia` showing the Quick Subtract card, and that card links to `/trivia/quick-subtract`. Stop the dev server (`astro dev stop`) when done.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/trivia/index.astro app/src/components/layout/BottomNav.astro
git commit -m "$(cat <<'EOF'
feat(trivia): add Trivia landing page and top-level nav entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

---

## Task 8: Documentation and context maintenance

**Files:**
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `docs/architecture/07-Frontend/04-Modules-And-OOP.md`
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `docs/architecture/00-Context-Map-History.md`
- Modify: `decisions/frontend/architecture.md`
- Modify: `docs/game-rules/trivia/README.md`
- Modify: `FINDINGS.md`

**Interfaces:**
- Consumes: nothing (documentation only)
- Produces: nothing consumed by another task — this is the final task.

No test: documentation-only, no `.ts` runtime file touched.

- [ ] **Step 1: Add a Context Map pack row**

Edit `docs/architecture/00-Context-Map.md`'s Context Packs table, adding a row after the "New game (full stack)" row:

```markdown
| New non-game client tool (Trivia) | `07-Frontend/04-Modules-And-OOP.md` §Non-Game Client Tools, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `app/CLAUDE.md`, `docs/game-rules/trivia/README.md` | ~10.5k |
```

- [ ] **Step 2: Document the Trivia exception in `04-Modules-And-OOP.md`**

Bump the version line at the top from `0.2.1` to `0.2.2`, appending to the parenthetical history: `; 0.2.2 Non-Game Client Tools exception (Trivia), 2026-09-09`.

Add a new row to the "OOP Boundary" table (after the `modules/game/*.payload.module.ts` row):

```markdown
| `modules/trivia/*.module.ts` | **Yes** | Non-`GameEngine` OOP tool — ephemeral client practice, no persistence, outside the game-wiring pipeline (see "Non-Game Client Tools" below) |
```

Add a new section after "Game Engine vs API Validation" and before "Anti-Patterns":

```markdown
---

# Non-Game Client Tools

Not every client-side tool with state and behavior is a dartboard game. A
tool with no `game_types` row, no persisted session, and no server-side
validator — e.g. Quick Subtract (`docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md`)
— stays out of the `GameEngine` contract and the 26-file game-wiring
pipeline (`09-Adding-A-Game.md`) entirely:

- Its OOP piece still lives under `src/modules/` (the OOP boundary applies
  regardless of game-ness) but is a plain class with its own contract, not
  `GameEngine` — no `record`/`undo`/`wouldComplete`/`facts()`, no
  `rulesetVersionKey`, no `stageOwnership`.
- It is never named `*.engine.module.ts` and never lives under
  `modules/game/` — both are what `scripts/check-game-engines.sh` scans for,
  and neither applies here.
- No `game_types` row, no `services/rulesets/registry.ts` entry, no
  `games-visibility.ts` card.
- If the tool is ever given persistence, an engine-only task's usual proof
  obligation still applies (root `CLAUDE.md` Hard Invariants): name the fact
  shape before writing it, even though V1 defers it.

`docs/game-rules/trivia/README.md` is the source-material entry point for
tools built this way.
```

- [ ] **Step 3: Add decision D261**

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**/*.md decisions/*.md 2>/dev/null | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`
Expected: `260` (confirm the next id is 261 before writing the block; if a newer decision landed since this plan was written, use the actual next id instead of 261 throughout this step).

Append to `decisions/frontend/architecture.md` (after the last existing block, update the file's own `updated:` front-matter line to today's date):

```markdown
### D261 — Trivia tools are plain OOP modules outside the GameEngine contract, not a new game type
Status: Accepted · Date: 2026-09-09
Decision: A non-dartboard practice tool (Quick Subtract, the first tool under `docs/game-rules/trivia/`) lives entirely outside the `game_types` model: no `game_types` row, no `rulesetVersionKey`, no `services/rulesets/registry.ts` validator, no `check-game-engines.sh` obligations. Its OOP piece (`modules/trivia/quick-subtract.module.ts`) stays under `src/modules/` per the OOP boundary (D85) but implements its own contract, not `GameEngine` — `07-Frontend/04-Modules-And-OOP.md`'s OOP Boundary table gains a `modules/trivia/*.module.ts` row and a new "Non-Game Client Tools" section states the exception explicitly. `modules/ui/segment-timer.module.ts` gains an additive `direction: 'countdown' | 'countup'` option (default `'countdown'`) and a `getElapsed()` method so the same timer can measure elapsed time in a fixed-round session — the three existing countdown consumers (Score Training, TUOD, 121) pass no `direction` and are unaffected.
Reason: `docs/game-rules/trivia/README.md` flagged this exact shape as an open engineering-workflow decision ("no existing architecture pipeline covers this yet"). The 26-file game-wiring pipeline (`09-Adding-A-Game.md`) is built for persisted, `game_types`-backed sessions; Quick Subtract is ephemeral, client-only practice with no persisted session, so routing it through that pipeline would invent a `game_types` row, a ruleset version, and a server-side validator for state nothing ever persists.
Consequences: `docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` names the deferred-persistence fact shape a future task would need (one fact per round, no stage/seat concept) so a later persistence task isn't boxed in by this decision. The next trivia tool (`docs/game-rules/trivia/checkouts.md`, unbuilt) follows this same precedent rather than re-deciding it.
```

- [ ] **Step 4: Update the non-canonical trivia README**

Replace the contents of `docs/game-rules/trivia/README.md`:

```markdown
# Trivia

This folder holds descriptions of standalone practice/study tools — these
are **not** dartboard games played under the `game_types` model.

**Quick Subtract** is built. See
`docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` for its
design and `decisions/frontend/architecture.md` (D261) for the architecture
decision — a plain `modules/trivia/` OOP tool outside the `GameEngine`
contract, no `game_types` row, no persistence. A future trivia tool follows
this same precedent rather than re-deciding it.

`checkouts.md` (a target-number → dart-route selection drill) remains
unbuilt; its own spec is still pending.
```

- [ ] **Step 5: Refresh the File Inventory and Context Map History**

Run `bash scripts/check-context-budget.sh` and update `docs/architecture/00-File-Inventory.md`'s `~Tokens` figures for `00-Context-Map.md` and `07-Frontend/04-Modules-And-OOP.md` to whatever it reports (replacing the current `~1.7k`/`~1.9k` entries); also update `07-Frontend/04-Modules-And-OOP.md`'s File-Inventory "Answers" cell to mention the Non-Game Client Tools exception, e.g. append `; Non-Game Client Tools exception for Trivia (2026-09-09)`.

Append a new entry to the top of `docs/architecture/00-Context-Map-History.md`'s "Version History" section (after the `# Version History` heading, before the current top entry), following the exact style of the entries already there — one paragraph naming the version number, date, task slug, every file created/modified, the new decision (D261), the spec path, and the validation commands actually run in Step 7 below. Do not write this entry until Step 7's validation output is in hand, since it must report real numbers (test counts, gate results), not estimates.

- [ ] **Step 6: Log the pre-existing `destroy()` wiring gap as a finding**

`quickSubtractPlay().destroy()` (Task 5) follows the same pattern as `tuodPlay().destroy()`/`scoreTrainingPlay().destroy()`/`oneTwentyOnePlay().destroy()`, but none of the four are ever invoked by any Alpine or Astro lifecycle hook in this codebase — confirmed by grep, no call site exists. This is a pre-existing gap this task's own code perpetuates rather than introduces, so it is logged, not fixed.

Read `FINDINGS.md`'s current `highest-issued:` value (as of this plan's writing, `F73`) and bump it by one in the same edit as adding the block. Append to `FINDINGS.md`:

```markdown
### F74 — `destroy()` methods on play-data Alpine factories are never invoked by any lifecycle hook
Status: Open · Found: 2026-09-09 · Task: claude/checkout-game-architecture-xhb5al
Claim: `07-Frontend/04-Modules-And-OOP.md`'s "Alpine teardown must call `destroy()` to prevent leaks" describes real, wired-up behavior
Evidence: `app/src/lib/game/tuod-play.data.ts:481`, `app/src/lib/game/score-training-play.data.ts:418`, `app/src/lib/game/one-twenty-one-play.data.ts:557`, and `app/src/lib/trivia/quick-subtract-play.data.ts`'s own `destroy()` (added this task) all define the method, but no `.astro` page or Alpine directive anywhere under `app/src` calls it — no `@astro:before-swap`, no `astro:page-load` cleanup, no custom Alpine plugin scanning for a `destroy` convention
Impact: an agent reading the doc's teardown rule as fact would assume `SegmentTimer` intervals are cleared on navigation away from a running session; in practice they run until the interval's own completion condition fires or the page is fully unloaded (which does clear JS timers via browser navigation, so this is not a live memory leak in a single-page-at-a-time SPA-less Astro app today, but the doc's claim about explicit teardown is inaccurate and would mislead future work that layers client-side routing, e.g. view transitions, on top — where an actual interval leak would then occur unless this gap is closed first)
Proposed: either wire a real teardown hook (e.g. an `astro:before-swap` document listener calling the current page's Alpine root's `destroy()` if present) or soften `07-Frontend/04-Modules-And-OOP.md`'s claim to describe the convention as aspirational until that wiring exists
```

- [ ] **Step 7: Run the gates and validation**

Run: `bash scripts/check-type-barrels.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-file-locations.sh && bash scripts/check-test-coverage.sh && bash scripts/check-findings-log.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-decision-ids.sh`
Expected: every script prints its own `OK: ...` line and the combined command exits 0. Fix and re-run before proceeding if any script fails.

Then run: `cd app && npx vitest run && npx astro check --minimumFailingSeverity hint && npm run format:check`
Expected: the full suite passes (report the new total test count), `astro check` reports 0 errors/0 warnings/0 hints, and `format:check` is clean.

Go back to Task 8 Step 5 and finish the `00-Context-Map-History.md` entry with these real results.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture/00-Context-Map.md docs/architecture/07-Frontend/04-Modules-And-OOP.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md decisions/frontend/architecture.md docs/game-rules/trivia/README.md FINDINGS.md
git commit -m "$(cat <<'EOF'
docs(trivia): document Quick Subtract's Non-Game Client Tools exception (D261)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GG7QBQ3nr2oC6Cg6rjBRGv
EOF
)"
```

- [ ] **Step 9: Push**

```bash
git push -u origin claude/checkout-game-architecture-xhb5al
```
