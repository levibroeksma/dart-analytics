# P2 — Play Context Types & Score-Training/TUOD Duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express the nine `*PlayContext` types in terms of `PlayLifecycleContext` instead of restating its 17 members by hand, then extract the six score-training/TUOD helpers that are duplicated for no reason — and stop before the three that differ behaviourally.

**Architecture:** Two independent halves. Half one is type-level only: an intersection replaces a hand-written object type, proven by `astro check`. Half two moves six module-level helpers into shared files, three byte-identical and three differing only in type annotations, leaving `throwOneDart` / `throwBotDart` / `statsFor` alone because Score Training and TUOD genuinely aim at different targets.

**Tech Stack:** TypeScript (strict), Vitest, fallow (duplication/stale-usage gate).

**Spec:** `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §4

**Issues closed:** #281, #282

## Global Constraints

- **Do not start until P1 has landed on `main`.** This plan rewrites imports in the same files P1 moves.
- Branch off `main`, named `refactor/p2-play-context-dedup`. Never commit to `main`. Do not commit unless the user asks.
- **No observable behaviour change.** Every extraction is a move, not a rewrite. If making two helpers share code requires changing what either one does, stop and report.
- Assertions may be added or strengthened. Never weaken, delete, or re-point an existing assertion at a different input to keep it green (root `CLAUDE.md` test invariant). `check-test-coverage.sh` requires a covering test touched in the same commit, so "no test changes" is not the bar — honest test changes are.
- `npx fallow` is a blocking CI gate (`quality.yml`), not advisory. It must exit zero at every commit.
- Engines (`app/src/modules/game/*.engine.module.ts`) are out of scope. F27's engine-side twin stays untouched.
- `app/src/lib/game/types.ts` is 1355 lines. Do not reformat or reorder it; touch only the nine type declarations named here.

---

## File Structure

| File | Responsibility | Task |
| ---- | -------------- | ---- |
| `app/src/lib/game/types.ts` | nine `*PlayContext` types become `PlayLifecycleContext<…> & { per-game }` | 1–2 |
| `app/src/lib/game/play-bot-seat.ts` (new) | `findBotSeat`, `botDartIndex` — byte-identical in both files today | 4 |
| `app/src/lib/game/play-countdown.ts` (new) | `formatRemaining`, `startCountdown`, `maybeResumeCountdown` — MINUTES countdown mechanics | 4 |
| `app/src/lib/game/play-lifecycle.ts` | gains `resumeGameEngine` — the generic form of both files' `resumeEngine` | 5 |
| `app/tests/lib/game/play-bot-seat.test.ts` (new) | covers the two seat helpers | 4 |
| `app/tests/lib/game/play-countdown.test.ts` (new) | covers the countdown helpers | 4 |
| `app/tests/lib/game/play-lifecycle.test.ts` | gains `resumeGameEngine` cases | 5 |

---

### Task 1: Convert one context type, proving the pattern

**Files:**
- Modify: `app/src/lib/game/types.ts:318` (`ScoreTrainingPlayContext`)

**Interfaces:**
- Consumes: `PlayLifecycleContext<TConfig, TEngine, TResults>` at `app/src/lib/game/types.ts:254`, whose members are `loading`, `error`, `finished`, `hasActiveSession`, `loadingReconciliation`, `reconciliationFailed`, `completionStatus`, `completionError`, `playAgainError`, `playAgainLoading`, `resultsSnapshot`, `hiddenTurnKey`, `hiddenTimer?`, `$store`, `engine`, `init()`, `uploadAndCompleteSession()`.
- Produces: the conversion pattern Task 2 repeats for the remaining eight types.

- [ ] **Step 1: Cut the branch and record the baseline**

```bash
git checkout main
git pull
git checkout -b refactor/p2-play-context-dedup
cd app && npx fallow dupes --format json > /tmp/fallow-before.json
npx fallow dupes | tail -20
```

Write the reported total duplication percentage and the score-training/TUOD group's line count into the PR body later. This is the baseline Task 6 compares against — not the 12.2% quoted in issue #282, which predates P1.

- [ ] **Step 2: Convert `ScoreTrainingPlayContext`**

In `app/src/lib/game/types.ts`, replace the head of the declaration. It currently opens:

```ts
export type ScoreTrainingPlayContext = {
  scoreInput: ScoreInputBuffer;
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
  resultsSnapshot: ScoreTrainingResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<ScoreTrainingSnapshot>;
  engine: ScoreTrainingEngine | null;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  uploadAndCompleteSession(this: ScoreTrainingPlayContext): Promise<void>;
  // … per-game members …
};
```

It becomes:

```ts
export type ScoreTrainingPlayContext = PlayLifecycleContext<
  ScoreTrainingSnapshot,
  ScoreTrainingEngine,
  ScoreTrainingResultsSnapshot
> & {
  scoreInput: ScoreInputBuffer;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  uploadAndCompleteSession(this: ScoreTrainingPlayContext): Promise<void>;
  // … all remaining per-game members, unchanged …
};
```

Delete the 15 data members the shared type now supplies. **Keep** `init` and `uploadAndCompleteSession` in the per-game half: the shared type declares them without a `this` parameter, and the concrete contexts bind `this` so Alpine's directive-driven calls typecheck. An intersection of the two signatures is what every current call site already relies on.

- [ ] **Step 3: Run the type gate**

```bash
cd app && npm run check
```

Expected: 0 errors, 0 warnings, 0 hints. An error on `$store` or `resultsSnapshot` means the generic arguments are wrong — re-read `PlayLifecycleContext`'s parameter order (`TConfig`, `TEngine`, `TResults`) and check that `ScoreTrainingSnapshot` is the type `PlayStoreContext` is instantiated with, not the config type.

- [ ] **Step 4: Run the tests**

```bash
cd app && npm test
```

Expected: all green. Types are erased at runtime, so a failure here means an accidental edit to a member, not a type issue — `git diff` and revert the stray change.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "refactor: define ScoreTrainingPlayContext from PlayLifecycleContext (#281)"
```

---

### Task 2: Convert the remaining eight context types

**Files:**
- Modify: `app/src/lib/game/types.ts` — `TuodPlayContext:396`, `FiveOhOnePlayContext:687`, `OneTwentyOnePlayContext:781`, `Bobs27PlayContext:876`, `SinglesTrainingPlayContext:944`, `DoublesTrainingPlayContext:1096`, `ShanghaiPlayContext:1181`, `AroundTheClockPlayContext:1260` (line numbers pre-edit; they shift as you go)

**Interfaces:**
- Consumes: Task 1's pattern.
- Produces: all nine contexts expressed through `PlayLifecycleContext`.

Each conversion uses these exact generic arguments — they were read off the current declarations, so do not guess:

| Type | `TConfig` | `TEngine` | `TResults` |
| ---- | --------- | --------- | ---------- |
| `TuodPlayContext` | `TuodSnapshot` | `TuodEngine` | `TuodResultsSnapshot` |
| `FiveOhOnePlayContext` | `FiveOhOneSnapshot` | `FiveOhOneEngine` | `FiveOhOneResultsSnapshot` |
| `OneTwentyOnePlayContext` | `OneTwentyOneSnapshot \| OneTwentyOneV2Snapshot` | `OneTwentyOneEngine` | `OneTwentyOneResultsSnapshot` |
| `Bobs27PlayContext` | `Bobs27Snapshot` | `Bobs27Engine` | `Bobs27ResultsSnapshot` |
| `SinglesTrainingPlayContext` | `SinglesSnapshot \| SinglesV2Snapshot` | `SinglesTrainingEngine` | `SinglesTrainingResultsSnapshot` |
| `DoublesTrainingPlayContext` | `DoublesTrainingSnapshot` | `DoublesTrainingEngine` | `DoublesTrainingResultsSnapshot` |
| `ShanghaiPlayContext` | `ShanghaiSnapshot \| ShanghaiV2Snapshot` | `ShanghaiEngine` | `ShanghaiResultsSnapshot` |
| `AroundTheClockPlayContext` | `AroundTheClockSnapshot` | `AroundTheClockEngine` | `AroundTheClockResultsSnapshot` |

- [ ] **Step 1: Convert the three checkout-hint contexts**

`TuodPlayContext`, `FiveOhOnePlayContext` and `OneTwentyOnePlayContext` each declare `$store` as an intersection today:

```ts
  $store: PlayStoreContext<TuodSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
```

Keep that member in the per-game half and let TypeScript intersect it with the shared one:

```ts
export type TuodPlayContext = PlayLifecycleContext<
  TuodSnapshot,
  TuodEngine,
  TuodResultsSnapshot
> & {
  $store: PlayStoreContext<TuodSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
  init(this: TuodPlayContext): Promise<void>;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  // … all remaining per-game members, unchanged …
};
```

`PlayStoreContext<TuodSnapshot> & (PlayStoreContext<TuodSnapshot> & { checkoutHints?: … })` collapses to the narrower type, so every existing `this.$store.checkoutHints` call site keeps typechecking.

- [ ] **Step 2: Convert the five plain contexts**

`Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `AroundTheClockPlayContext` follow Task 1's shape exactly: intersection head with the table's generic arguments, delete the 15 shared data members, keep `init`/`uploadAndCompleteSession` with their `this` parameters and every per-game member.

- [ ] **Step 3: Run the type gate**

```bash
cd app && npm run check
```

Expected: 0/0/0. If one context legitimately diverges — a narrower `completionStatus` union, a required `hiddenTimer` — **do not widen `PlayLifecycleContext` to absorb it.** Leave that context hand-written, and note which one and why in the commit message.

- [ ] **Step 4: Verify nothing was silently dropped**

```bash
cd app && npx tsc --noEmit -p tsconfig.json
grep -c "PlayLifecycleContext<" src/lib/game/types.ts
```

Expected: `tsc` clean; the grep prints `9` (or fewer, matching any documented divergence from Step 3).

- [ ] **Step 5: Run the tests and fallow**

```bash
cd app && npm test && npx fallow
```

Expected: both exit zero.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "refactor: define the remaining eight PlayContexts from PlayLifecycleContext (#281)"
```

---

### Task 3: Characterise the helpers before moving them

**Files:**
- Create: `app/tests/lib/game/play-bot-seat.test.ts`
- Create: `app/tests/lib/game/play-countdown.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the failing tests Task 4 makes pass. Names used later: `findBotSeat(seats)`, `botDartIndex(turns, botRef)`, `formatRemaining(ms)`.

- [ ] **Step 1: Write the failing test for the seat helpers**

Create `app/tests/lib/game/play-bot-seat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { botDartIndex, findBotSeat } from "@lib/game/play-bot-seat";
import type { SeatFact, TurnFact } from "@modules/types";

const humanSeat = {
  participantRef: "p1",
  participantTypeKey: "PLAYER",
  sideKey: "A",
} as unknown as SeatFact;

const botSeat = {
  participantRef: "bot1",
  participantTypeKey: "DARTBOT",
  sideKey: "B",
  dartbot: { level: 8, seed: 42 },
} as unknown as SeatFact;

function turn(participantRef: string, dartCount: number): TurnFact {
  return {
    participantRef,
    darts: Array.from({ length: dartCount }, () => ({})),
  } as unknown as TurnFact;
}

describe("findBotSeat", () => {
  it("returns the DARTBOT seat when one is present", () => {
    expect(findBotSeat([humanSeat, botSeat])?.participantRef).toBe("bot1");
  });

  it("returns undefined for an all-human seat list", () => {
    expect(findBotSeat([humanSeat])).toBeUndefined();
  });
});

describe("botDartIndex", () => {
  it("counts only the bot's own darts", () => {
    const turns = [turn("p1", 3), turn("bot1", 3), turn("bot1", 2)];
    expect(botDartIndex(turns, "bot1")).toBe(5);
  });

  it("returns 0 when the bot has not thrown", () => {
    expect(botDartIndex([turn("p1", 3)], "bot1")).toBe(0);
  });
});
```

- [ ] **Step 2: Write the failing test for `formatRemaining`**

Create `app/tests/lib/game/play-countdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatRemaining } from "@lib/game/play-countdown";

describe("formatRemaining", () => {
  it("formats whole minutes as mm:ss", () => {
    expect(formatRemaining(180000)).toBe("03:00");
  });

  it("floors partial seconds", () => {
    expect(formatRemaining(61999)).toBe("01:01");
  });

  it("clamps a negative remainder to 00:00", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
  });

  it("treats null and undefined as 00:00", () => {
    expect(formatRemaining(null)).toBe("00:00");
    expect(formatRemaining(undefined)).toBe("00:00");
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/play-bot-seat.test.ts tests/lib/game/play-countdown.test.ts
```

Expected: FAIL — `Cannot find module '@lib/game/play-bot-seat'` and `'@lib/game/play-countdown'`. A pass here means the files already exist; re-read the current tree before continuing.

- [ ] **Step 4: Do not commit yet**

These tests are committed with their implementation in Task 4 — a commit with a failing test in it is a broken `main` if it ever lands alone.

---

### Task 4: Extract the identical and countdown helpers

**Files:**
- Create: `app/src/lib/game/play-bot-seat.ts`
- Create: `app/src/lib/game/play-countdown.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts:70-76,84-88,115-121,249-286,288-305` (helper definitions removed, imports added)
- Modify: `app/src/lib/game/tuod-play.data.ts` (same helpers, same removal)
- Test: `app/tests/lib/game/play-bot-seat.test.ts`, `app/tests/lib/game/play-countdown.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`, `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: Task 3's tests.
- Produces:
  - `findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined`
  - `botDartIndex(turns: readonly TurnFact[], botRef: string): number`
  - `type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>`
  - `formatRemaining(ms: number | null | undefined): string`
  - `startCountdown<TGame extends CountdownGame, TEngine extends ExpirableEngine>(game: TGame, durationValue: number, engine: TEngine): SegmentTimer`
  - `maybeResumeCountdown<TGame extends CountdownGame, TEngine extends ExpirableEngine>(game: TGame, config: CountdownConfig, engine: TEngine): SegmentTimer | null`

- [ ] **Step 1: Create `play-bot-seat.ts`**

The two functions are byte-identical in both play-data files today, so this is a move, not a rewrite:

```ts
import type { SeatFact, TurnFact } from "@modules/types";

/** The DARTBOT variant of `SeatFact`, narrowed once so every bot-visit path
 * can take `botSeat.dartbot` without re-narrowing. */
export type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

export function findBotSeat(
  seats: readonly SeatFact[],
): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

export function botDartIndex(
  turns: readonly TurnFact[],
  botRef: string,
): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}
```

- [ ] **Step 2: Create `play-countdown.ts`**

`formatRemaining` is byte-identical in both files. `startCountdown` and `maybeResumeCountdown` differ **only** in their type annotations (`ScoreTrainingEngine` ↔ `TuodEngine`, `ScoreTrainingPlayContext["$store"]["game"]` ↔ `TuodPlayContext["$store"]["game"]`), so generics cover both with no body change. Copy each body verbatim from `score-training-play.data.ts`, including its doc comment:

```ts
import { SegmentTimer } from "@modules/ui/segment-timer.module";

/** The store fields the MINUTES countdown reads and writes. Structural, so
 * any play store carrying these four fields can use these helpers. */
export type CountdownGame = {
  timerRemainingMs: number | null;
  timerStartedAt: string | null;
  timerExpired: boolean;
  timerPaused: boolean;
};

/** The engine surface the countdown drives: expiry is the engine's own
 * completion authority, not the store's. */
export type ExpirableEngine = { expireTimer(): void };

/** The config fields the MINUTES branch reads. */
export type CountdownConfig = {
  durationType: string;
  durationValue: number;
};

export function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * `timerRemainingMs` is set synchronously so the label never renders 00:00
 * while waiting for the timer's first onTick (which fires 1s after start()).
 * Expiry is written to both authorities it governs: the persisted store flag
 * that survives a reload, and the engine, which owns session completion.
 */
export function startCountdown<
  TGame extends CountdownGame,
  TEngine extends ExpirableEngine,
>(game: TGame, durationValue: number, engine: TEngine): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.start();
  return timer;
}

/**
 * `init()`'s own MINUTES branch, extracted so init() reads as one decision
 * (resume, mark already-expired, or do nothing) instead of nested
 * conditionals — mirrors `one-twenty-one-play.data.ts`'s own
 * `maybeResumeCountdown`.
 */
export function maybeResumeCountdown<
  TGame extends CountdownGame,
  TEngine extends ExpirableEngine,
>(game: TGame, config: CountdownConfig, engine: TEngine): SegmentTimer | null {
  if (config.durationType !== "MINUTES") return null;
  if (game.timerExpired) {
    engine.expireTimer();
    return null;
  }
  const timer = startCountdown(game, config.durationValue, engine);
  if (game.timerPaused) {
    timer.stop();
  }
  return timer;
}
```

If `CountdownGame`'s field types do not match the real store's (for example `timerRemainingMs` is `number | undefined` there), fix the structural type to match the store — never loosen it to `any`, and never edit the store.

- [ ] **Step 3: Delete the five local copies and import instead**

In both `score-training-play.data.ts` and `tuod-play.data.ts`, delete the local `DartbotSeat` type alias and the local `findBotSeat`, `botDartIndex`, `formatRemaining`, `startCountdown`, `maybeResumeCountdown` definitions, then add:

```ts
import { botDartIndex, findBotSeat } from "@lib/game/play-bot-seat";
import type { DartbotSeat } from "@lib/game/play-bot-seat";
import {
  formatRemaining,
  maybeResumeCountdown,
  startCountdown,
} from "@lib/game/play-countdown";
```

Leave `throwOneDart`, `throwBotDart` and `statsFor` exactly where they are. They differ behaviourally — Score Training's `chooseTarget()` always fires treble 20, while TUOD aims at the seat's own `currentTarget` and routes stats through `tuodCheckoutVisits`. Merging them would fuse two rulesets that genuinely differ.

- [ ] **Step 4: Run the new tests**

```bash
cd app && npx vitest run tests/lib/game/play-bot-seat.test.ts tests/lib/game/play-countdown.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full suite and type gate**

```bash
cd app && npm run check && npm test
```

Expected: 0/0/0 and all green. The existing `score-training-play.data.test.ts` and `tuod-play.data.test.ts` must pass with no assertion changes — they exercise the same behaviour through the same public factories.

- [ ] **Step 6: Touch the two covering tests honestly**

`check-test-coverage.sh` requires a covering test edit in the same change set as a source edit. Add one real assertion to each play-data test rather than a whitespace change — for example, in `app/tests/lib/game/score-training-play.data.test.ts`, assert the countdown label the extracted helper now formats:

```ts
it("formats the remaining countdown label through the shared helper", () => {
  const context = scoreTrainingPlay();
  context.$store.game.timerRemainingMs = 125000;
  expect(context.remainingLabel()).toBe("02:05");
});
```

Adapt the setup to whatever the existing test file already uses to build a context — do not invent a second construction path.

- [ ] **Step 7: Run fallow and the gates**

```bash
cd app && npx fallow
bash scripts/check-no-inline-comments.sh
TEST_COVERAGE_BASE_REF=origin/main bash scripts/check-test-coverage.sh
```

Expected: all exit zero.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: extract the shared bot-seat and countdown helpers (#282)"
```

---

### Task 5: Generalise `resumeEngine`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (add `resumeGameEngine`)
- Modify: `app/src/lib/game/score-training-play.data.ts:158-170`, `app/src/lib/game/tuod-play.data.ts:159-171`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: `getEngineFactory` from the engine registry, as both local copies already do.
- Produces: `resumeGameEngine<TConfig, TEngine>(game, rulesetVersionKey, isEngine): TEngine | null`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/lib/game/play-lifecycle.test.ts`, following the file's existing import and mock style:

```ts
describe("resumeGameEngine", () => {
  it("returns null when the store holds no config snapshot", () => {
    const game = {
      configSnapshot: null,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      stages: [],
      turns: [],
    } as unknown as Parameters<typeof resumeGameEngine>[0];
    expect(
      resumeGameEngine(game, "SCORE_TRAINING_V1", (c): c is object => true),
    ).toBeNull();
  });

  it("returns null when the stored ruleset key is a different game", () => {
    const game = {
      configSnapshot: {},
      rulesetVersionKey: "TUOD_V1",
      stages: [],
      turns: [],
    } as unknown as Parameters<typeof resumeGameEngine>[0];
    expect(
      resumeGameEngine(game, "SCORE_TRAINING_V1", (c): c is object => true),
    ).toBeNull();
  });

  it("returns null when the guard rejects the built engine", () => {
    const game = {
      configSnapshot: {},
      rulesetVersionKey: "SCORE_TRAINING_V1",
      stages: [],
      turns: [],
    } as unknown as Parameters<typeof resumeGameEngine>[0];
    expect(
      resumeGameEngine(game, "SCORE_TRAINING_V1", (c): c is never => false),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t resumeGameEngine
```

Expected: FAIL — `resumeGameEngine is not exported`.

- [ ] **Step 3: Add the generic function**

In `app/src/lib/game/play-lifecycle.ts`, keeping the file's existing doc-comment style:

```ts
/**
 * The generic form of each play-data file's own `resumeEngine`: rebuild a
 * ruleset's engine from the persisted store, or return null when the store
 * holds nothing resumable. `isEngine` is the caller's own `instanceof` guard —
 * the registry is keyed by ruleset version, so a mismatched factory is a real
 * possibility this must reject rather than cast past.
 */
export function resumeGameEngine<TConfig, TEngine>(
  game: PlayStoreContext<TConfig>["game"],
  rulesetVersionKey: RulesetVersionKey,
  isEngine: (candidate: unknown) => candidate is TEngine,
): TEngine | null {
  const { configSnapshot, rulesetVersionKey: storedKey } = game;
  if (!configSnapshot || storedKey !== rulesetVersionKey) return null;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return isEngine(engine) ? engine : null;
}
```

If `PlayStoreContext<TConfig>["game"]` does not satisfy `factory.create`'s parameter types for both rulesets, **stop and report**: that is a real variance problem, not something to cast away.

- [ ] **Step 4: Point both play-data files at it**

Delete the local `resumeEngine` from each file and replace its call sites. In `score-training-play.data.ts`:

```ts
const engine = resumeGameEngine<ScoreTrainingSnapshot, ScoreTrainingEngine>(
  game,
  RULESET_VERSION_KEY,
  (candidate): candidate is ScoreTrainingEngine =>
    candidate instanceof ScoreTrainingEngine,
);
```

In `tuod-play.data.ts`, the same with `TuodSnapshot` / `TuodEngine` / `TuodEngine`.

- [ ] **Step 5: Run the tests and type gate**

```bash
cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts && npm run check && npm test
```

Expected: the three new cases PASS, `astro check` 0/0/0, full suite green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: share resumeEngine as a generic play-lifecycle helper (#282)"
```

---

### Task 6: Measure, report and open the PR

**Files:** none changed; measurement and reporting only.

- [ ] **Step 1: Re-measure duplication**

```bash
cd app && npx fallow dupes --format json > /tmp/fallow-after.json
npx fallow dupes | tail -20
```

Compare against Task 1 Step 1's baseline. Record three numbers: total duplication percentage before, after, and the score-training/TUOD group's line count after.

- [ ] **Step 2: Decide what #282's outcome actually is**

Three possible honest outcomes. Pick the one the measurement supports, and write it in the PR body:

1. **Total dropped and the group shrank** — the extraction did what it set out to do. Close #282.
2. **Total dropped, group unchanged** — the six helpers were the extractable part; the residual 500-line group is the whole-context structural twin F27 already named. Close #282 with that measurement, stating plainly that the remaining similarity is not extractable without fusing two different rulesets.
3. **Total rose** — the same near-miss effect #282 itself reported. Report the number, keep the extraction (it removed real duplicate lines), and say so. Do not chase the percentage by extracting the behavioural helpers.

Outcome 2 is the expected one. It is a legitimate result, not a failure.

- [ ] **Step 3: Record the decision**

Derive the next free id:

```bash
git fetch origin main
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append to `decisions/frontend/architecture.md` with that id + 1:

```markdown
### D<next> — The score-training/TUOD twin is deduplicated to the line, not to the structure
Status: Accepted · Date: 2026-09-17 · Refines: D232
Decision: the six helpers that were duplicated for no reason — `findBotSeat`, `botDartIndex`, `formatRemaining`, `startCountdown`, `maybeResumeCountdown`, `resumeEngine` — now live in `play-bot-seat.ts`, `play-countdown.ts` and `play-lifecycle.ts`. `throwOneDart`, `throwBotDart` and `statsFor` stay duplicated on purpose. The nine `*PlayContext` types are defined as `PlayLifecycleContext<…> & { per-game }`.
Reason: issue #282 reported the reported duplication percentage rising after an earlier dedup pass, because a near-miss detector bridged a longer span once the divergent bodies between the matches were removed. A function-by-function comparison showed the 531-line group is not one extractable body: three helpers are byte-identical, three differ only in type annotations, and three differ behaviourally — Score Training's bot always fires treble 20, TUOD's aims at the seat's own ladder target. Extracting the last three would fuse two rulesets that genuinely differ, to move a lagging metric.
Consequences: whole-file structural similarity between the two files remains and will still be reported by `fallow`'s near-miss detector. That residue is the same class F27 declined on the engine side, and it is now measured rather than assumed. If the two rulesets' rules ever diverge further, the right response is to let them — not to re-open this extraction.
```

- [ ] **Step 4: Run the full validation chain**

```bash
cd app && npm run check && npm test && npx fallow && npm run format:check
bash scripts/check-decision-ids.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-type-barrels.sh
bash scripts/check-no-inline-comments.sh
TEST_COVERAGE_BASE_REF=origin/main bash scripts/check-test-coverage.sh
```

Record each command's own result. All must exit zero.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin refactor/p2-play-context-dedup
gh pr create --base main --title "refactor: derive the nine PlayContexts from PlayLifecycleContext, share six duplicated helpers (#281, #282)" --body "$(cat <<'EOF'
Nine `*PlayContext` types are now `PlayLifecycleContext<TConfig, TEngine, TResults> & { per-game }` instead of restating its 17 members by hand.

Six helpers duplicated between `score-training-play.data.ts` and `tuod-play.data.ts` moved to shared modules: three were byte-identical, three differed only in type annotations. `throwOneDart`, `throwBotDart` and `statsFor` stay duplicated — they differ behaviourally.

Duplication: <before>% → <after>%; score-training/TUOD group <before> → <after> lines.

Spec: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §4

Closes #281
Closes #282

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace the four `<…>` placeholders with the measured numbers before running the command.
