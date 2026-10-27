# Checkout Kernel PR 2 — Random Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Random Checkout onto the Checkout kernel and the exercise shell, with no behaviour change, deleting its hand-written class and its second copy of `walkVisit`.

**Architecture:** The kernel gains the `FAIL` verdict (attempt dead now, whatever the visit budget). `checkout-policies.ts` gains `unreachableFails` (wraps `dartWalkJudge`: an open visit whose remainder the darts left cannot finish fails), `seededPoolDraw` and `seededDrawTarget`. Random Checkout becomes a `DartExerciseSpec` — one visit per attempt, next target the seeded draw for the next attempt index — bound to `dart-exercise-shell.module.ts`. Proof as PR 1: legacy copy + differential oracle, goldens recorded before the rebind, then legacy deleted.

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (PR 2 row, §8). Prior plan: `docs/superpowers/plans/2026-10-27-checkout-kernel-pr1.md` (merged, PR #1113).

## Global Constraints

- No behaviour change: `state()`, `facts()`, thrown messages, `RandomCheckoutState` shape, `foldRandomCheckoutState(facts, config, expired)`, `drawStartScore(config, attemptIndex)` and `RANDOM_CHECKOUT_POOL` identical. Seed 42 still draws 155, 141, 160, 64, 140 (D424 freeze).
- `RandomCheckoutEngine` stays an exported class (routine adapter `engineClass`, `routine-play.data.ts` and `routines/types.ts` name it).
- Persistence unchanged: `EXERCISE_BLOCK` stage, one `turns` row per attempt, one `darts` row per dart; free aim (no intent); no new fact columns.
- Reuse `resolveCheckoutAttempt`, `isCheckoutReachable`, `seededUniform`, `dartWalkJudge`; never re-declare a walk.
- A policy lands only with its first caller (fallow dead-code gate); fallow duplication must **fall** (spec §7: the second `walkVisit` goes).
- `modules/game/**` never imports `modules/training/**`: the draw lives in the policy file, `drawStartScore` wraps it.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations only.
- Exported types live in `types.ts`/`interfaces.ts`, imported through `@modules/types` / `@modules/interfaces` (`check-type-barrels.sh`, also in pre-commit — the legacy copy too).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs 14 gates; run slow commits in the background and poll.
- Branch: `feat/checkout-kernel-rc`, cut from `origin/main`. One PR to `main` carrying this plan and the implementation.
- No new decision entry: PR 2 executes D500 (Track precedent: one D-entry, cited per PR).

## Refinements to the spec (rulings made while planning)

Recorded in the spec §3 in Task 6.

- `seededDrawTarget(drawSeed, pool)` does not wrap `drawStartScore`: `modules/game` cannot import a training module. Both wrap a new `seededPoolDraw(drawSeed, pool, index)` in `checkout-policies.ts`; `drawStartScore(config, i)` becomes `seededPoolDraw(config.drawSeed, RANDOM_CHECKOUT_POOL, i)`.
- `unreachableFails` judges from `dartWalkJudge`'s verdict, not a second walk: an `OPEN` visit with at least one dart whose remainder `isCheckoutReachable` rejects for the darts left is `FAIL`; every other verdict passes through (a third-dart `SPENT` or a `BUST` fails the attempt through the kernel's one-visit budget). Exact against legacy: once a remainder is unreachable no later dart in the visit can check out, and the shell closes the turn on the failing dart.
- `FAIL` closes the attempt as failed on any visit, before the budget's last.

## Review Focus

1. Undo of the dart that failed an attempt by unreachability — the previous draw, `remaining`, `dartsInVisit`, `attempts` and `lastAttempt` restored, the next dart reusing the same turn. Pinned by an engine test in Task 4 Step 2, the oracle (undo rate 0.12) and the golden trace.
2. The draw follows the attempt index across undo and rehydration (attempt *n* is turn *n*): pinned by the oracle (`rehydrateEvery: 19`, two draw seeds) and the existing "restores the earlier start score" test.
3. An attempt open at expiry is not judged but its darts count; `undo` first un-expires. Pinned by oracle `resumeExpired: true` and existing engine tests.
4. An empty visit on an unreachable start (none in the pool, but `unreachableFails` is general) stays `OPEN`, matching the legacy walk. Pinned by a policy test (Task 3).
5. Checkout Sequence is untouched by the `FAIL` arm: its goldens re-run in Tasks 2 and 4 with no snapshot change.

---

### Task 1: Branch, plan, freeze — legacy copy, oracle, goldens

**Files:**
- Create: `docs/superpowers/plans/2026-10-27-checkout-kernel-pr2.md` (this file, committed)
- Create: `app/tests/modules/training/exercises/legacy/random-checkout.legacy.ts`
- Create: `app/tests/modules/training/exercises/random-checkout.oracle.test.ts`
- Create: `app/tests/modules/training/exercises/random-checkout.golden.test.ts` (+ its `__snapshots__` file)

**Interfaces:**
- Consumes: `runOracle`, `goldenTrace`, `normalise` (`tests/modules/game/support/engine-oracle.ts`); `towardCheckout(rate)` (`tests/modules/game/support/checkout-observations.ts`, reads `state().remaining`).
- Produces: `LegacyRandomCheckoutEngine` (legacy file).

- [ ] **Step 1: Branch and commit the plan**

```bash
cd /home/user/dart-analytics
git fetch origin main
git checkout -b feat/checkout-kernel-rc origin/main
git add docs/superpowers/plans/2026-10-27-checkout-kernel-pr2.md
git commit -m "docs(plan): checkout kernel PR 2 — Random Checkout"
```

- [ ] **Step 2: Copy the engine as legacy**

The header is rewritten so every type import goes through the barrels (pre-commit `check-type-barrels.sh`); the body is copied verbatim from `const EXERCISE_RULESET_VERSION_KEY` up to, not including, the factory.

```bash
cd /home/user/dart-analytics/app
mkdir -p tests/modules/training/exercises/legacy
SRC=src/modules/training/exercises/random-checkout.engine.module.ts
OUT=tests/modules/training/exercises/legacy/random-checkout.legacy.ts
cat > "$OUT" <<'EOF'
import type { RandomCheckoutConfigData } from "@lib/types";
import { RandomCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  RandomCheckoutState,
  TurnFact,
} from "@modules/types";
import type { DartExerciseEngine } from "@modules/interfaces";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import { isCheckoutReachable } from "@modules/game/checkout-reachability.module";
import { seededUniform } from "@modules/game/seeded-rng.module";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  refuseWhenEnded,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { SOLO_PARTICIPANT_REF } from "@modules/training/exercises/solo-participant.module";

EOF
sed -n '/^const EXERCISE_RULESET_VERSION_KEY/,/^export const randomCheckoutEngineFactory/p' "$SRC" \
  | sed '$d' \
  | sed 's#class RandomCheckoutEngine#class LegacyRandomCheckoutEngine#' >> "$OUT"
tail -4 "$OUT"; grep -c "register\|Factory" "$OUT"
npx prettier --write "$OUT" >/dev/null
```

Expected: file ends with the class's closing `}` (plus a blank line); grep count `0`.

- [ ] **Step 3: Write the oracle test**

`app/tests/modules/training/exercises/random-checkout.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { LegacyRandomCheckoutEngine } from "./legacy/random-checkout.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import type { RandomCheckoutConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, { steps: number; expireAt?: number; rate: number }][] = [
  ["random play, expired", { steps: 260, expireAt: 200, rate: 0.3 }],
  ["toward checkout, expired", { steps: 260, expireAt: 200, rate: 0.7 }],
  ["toward checkout, never expired", { steps: 300, rate: 0.85 }],
];

describe("Random Checkout — kernel vs legacy oracle", () => {
  for (const drawSeed of [774, 42]) {
    const config: RandomCheckoutConfigData = {
      minStart: 40,
      maxStart: 170,
      drawSeed,
    };
    for (const [name, c] of CASES) {
      it(`draw seed ${drawSeed}, ${name}: indistinguishable through every public method`, () => {
        runOracle({
          build: (prior) => new RandomCheckoutEngine(config, prior),
          legacy: (prior) => new LegacyRandomCheckoutEngine(config, prior),
          seeds: SEEDS,
          steps: c.steps,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: towardCheckout(c.rate),
        });
      }, 60_000);
    }
  }
});
```

- [ ] **Step 4: Run the oracle against the current engine**

Run: `cd app && npx vitest run tests/modules/training/exercises/random-checkout.oracle.test.ts`
Expected: 6 passed (both sides are the same code today).

- [ ] **Step 5: Write the golden tests**

`app/tests/modules/training/exercises/random-checkout.golden.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { goldenTrace, normalise } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { RandomCheckoutConfigData } from "@lib/types";

const config = (drawSeed: number): RandomCheckoutConfigData => ({
  minStart: 40,
  maxStart: 170,
  drawSeed,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Random Checkout — golden", () => {
  it("draw seed 42, 300 steps then expiry is unchanged", () => {
    const engine = new RandomCheckoutEngine(config(42));
    const rand = seededUniform(42, 0);
    const observe = towardCheckout(0.75);
    for (let step = 0; step < 300; step++) {
      if (rand() < 0.08) engine.undo();
      else engine.record(observe(rand, engine));
    }
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Random Checkout — golden trace", () => {
  for (const drawSeed of [774, 42]) {
    it(`draw seed ${drawSeed}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new RandomCheckoutEngine(config(drawSeed), prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired: true,
          observe: towardCheckout(0.75),
        }),
      ).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 6: Record the goldens against the current engine**

Run: `cd app && npx vitest run -u tests/modules/training/exercises/random-checkout.golden.test.ts`
Expected: 3 passed, 3 snapshots written. Then
`grep -c '"CHECKOUT"' tests/modules/training/exercises/__snapshots__/random-checkout.golden.test.ts.snap` ≥ 1 and
`grep -c '"FAILED"' tests/modules/training/exercises/__snapshots__/random-checkout.golden.test.ts.snap` ≥ 1 (both outcomes recorded).

- [ ] **Step 7: Commit**

```bash
cd /home/user/dart-analytics
git add app/tests/modules/training/exercises/legacy/random-checkout.legacy.ts \
  app/tests/modules/training/exercises/random-checkout.oracle.test.ts \
  app/tests/modules/training/exercises/random-checkout.golden.test.ts \
  app/tests/modules/training/exercises/__snapshots__/random-checkout.golden.test.ts.snap
git commit -m "test(random-checkout): freeze legacy engine, oracle, goldens"
```

---

### Task 2: Kernel — `FAIL` verdict

**Files:**
- Modify: `app/src/modules/game/types.ts` (`VisitVerdict`, ~line 895)
- Modify: `app/src/modules/game/checkout-kernel.module.ts` (`applyCheckoutVisit` switch)
- Test: `app/tests/modules/game/checkout-kernel.module.test.ts`

**Interfaces:**
- Produces: `VisitVerdict` member `{ kind: "FAIL" }`; `applyCheckoutVisit` closes the attempt as failed on it.

- [ ] **Step 1: Write the failing test**

Append inside `describe("checkout kernel", …)`:

```ts
  it("a FAIL verdict closes the attempt as failed before the budget's last visit", () => {
    const seat = applyCheckoutVisit(start(), TURN, rules([{ kind: "FAIL" }]));
    expect(seat).toMatchObject({
      target: 62,
      visitStart: 62,
      remaining: 62,
      visitIndex: 0,
      attemptIndex: 1,
      attempts: 1,
      checkouts: 0,
      status: "IN_PROGRESS",
      ext: { closed: [[false, "FAIL"]] },
    });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts -t "FAIL verdict"`
Expected: FAIL — `applyCheckoutVisit` returns `undefined` (no `FAIL` arm).

- [ ] **Step 3: Implement**

`types.ts`, `VisitVerdict` becomes:

```ts
export type VisitVerdict =
  | { kind: "CHECKOUT"; darts: number }
  | { kind: "BUST" }
  | { kind: "SPENT"; remaining: number }
  | { kind: "OPEN"; remaining: number; darts: number }
  | { kind: "FAIL" };
```

Update its JSDoc (directly above) to name `FAIL`: "…or `FAIL`, the attempt dead now whatever visits remain (an unreachable remainder)." Keep the rest.

`checkout-kernel.module.ts`, in `applyCheckoutVisit`'s switch after the `CHECKOUT` arm:

```ts
    case "FAIL":
      return closeAttempt(seat, false, verdict, rules);
```

Reducer JSDoc: "…then show it open, pass or fail the attempt, or carry/fail it." → "…then show it open, pass the attempt, fail it now, or carry the visit (failing it on the budget's last)."

- [ ] **Step 4: Run kernel, policies and Checkout Sequence tests**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts tests/modules/game/checkout-policies.test.ts tests/modules/training/exercises/checkout-sequence`
Expected: all pass; Checkout Sequence goldens with no snapshot written.

- [ ] **Step 5: Type check**

Run: `cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3`
Expected: 0 errors, 0 warnings, 0 hints (`bookPoints` already reads only `CHECKOUT`).

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/types.ts app/src/modules/game/checkout-kernel.module.ts \
  app/tests/modules/game/checkout-kernel.module.test.ts
git commit -m "feat(checkout-kernel): FAIL verdict closes the attempt now"
```

---

### Task 3: Policies — `unreachableFails`, `seededPoolDraw`, `seededDrawTarget`

**Files:**
- Modify: `app/src/modules/game/checkout-policies.ts`
- Test: `app/tests/modules/game/checkout-policies.test.ts`

**Interfaces:**
- Consumes: Task 2 `VisitVerdict` `FAIL`.
- Produces:
  - `unreachableFails<TExt>(seat: CheckoutSeat<TExt>, turn: TurnFact): VisitVerdict`
  - `seededPoolDraw(drawSeed: number, pool: readonly number[], index: number): number`
  - `seededDrawTarget(drawSeed: number, pool: readonly number[]): <TExt>(seat: CheckoutSeat<TExt>) => number` — the draw at `seat.attemptIndex + 1`.

These land without a production caller until Task 4; fallow runs in Task 7, after the caller exists.

- [ ] **Step 1: Write the failing tests**

Change the import to:

```ts
import {
  consecutiveTargets,
  dartWalkJudge,
  seededDrawTarget,
  seededPoolDraw,
  unreachableFails,
} from "@modules/game/checkout-policies";
```

Append:

```ts
describe("unreachableFails", () => {
  it("fails an open visit whose remainder the darts left cannot finish", () => {
    expect(unreachableFails(at(155), turn([1, "SINGLE", 1]))).toEqual({
      kind: "FAIL",
    });
    expect(
      unreachableFails(at(40), turn([19, "SINGLE", 19], [2, "SINGLE", 2])),
    ).toEqual({ kind: "FAIL" });
  });
  it("keeps an open visit open while a finish stays reachable", () => {
    expect(
      unreachableFails(at(40), turn([null, "MISS", 0], [null, "MISS", 0])),
    ).toEqual({ kind: "OPEN", remaining: 40, darts: 2 });
  });
  it("keeps an empty visit open, even on an unreachable start", () => {
    expect(unreachableFails(at(169), turn())).toEqual({
      kind: "OPEN",
      remaining: 169,
      darts: 0,
    });
  });
  it("passes a checkout, a bust and a spent visit through", () => {
    expect(unreachableFails(at(40), turn([20, "DOUBLE", 40]))).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
    expect(unreachableFails(at(40), turn([20, "TREBLE", 60]))).toEqual({
      kind: "BUST",
    });
    expect(
      unreachableFails(
        at(40),
        turn([null, "MISS", 0], [null, "MISS", 0], [null, "MISS", 0]),
      ),
    ).toEqual({ kind: "SPENT", remaining: 40 });
  });
});

describe("seeded draws", () => {
  const POOL = [10, 20, 30, 40, 50];
  it("draws from the pool, stable per seed and index", () => {
    for (let index = 0; index < 20; index++) {
      const drawn = seededPoolDraw(42, POOL, index);
      expect(POOL).toContain(drawn);
      expect(seededPoolDraw(42, POOL, index)).toBe(drawn);
    }
  });
  it("the next target is the draw for the next attempt index", () => {
    const seat = { ...at(10), attemptIndex: 3 };
    expect(seededDrawTarget(42, POOL)(seat)).toBe(seededPoolDraw(42, POOL, 4));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-policies.test.ts`
Expected: FAIL — the three names are not exported (`is not a function`).

- [ ] **Step 3: Implement**

`checkout-policies.ts` — imports become:

```ts
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { isCheckoutReachable } from "./checkout-reachability.module";
import { seededUniform } from "./seeded-rng.module";
import type { CheckoutSeat, DartFact, TurnFact, VisitVerdict } from "./types";
```

Append:

```ts
/**
 * `dartWalkJudge`, except an open visit fails the moment its remainder can
 * no longer be finished with the darts it has left (#1064). No later dart
 * of such a visit can check out, so judging the walk's verdict is exact.
 */
export function unreachableFails<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
): VisitVerdict {
  const verdict = dartWalkJudge(seat, turn);
  if (verdict.kind !== "OPEN" || verdict.darts === 0) return verdict;
  return isCheckoutReachable(verdict.remaining, DARTS_PER_VISIT - verdict.darts)
    ? verdict
    : { kind: "FAIL" };
}

/**
 * A uniform pick from `pool` keyed by `(drawSeed, index)` alone, never by
 * earlier darts, so undo and replay redraw it exactly.
 */
export function seededPoolDraw(
  drawSeed: number,
  pool: readonly number[],
  index: number,
): number {
  const uniform = seededUniform(drawSeed, index)();
  return pool[Math.floor(uniform * pool.length)];
}

/** Next target: the seeded draw for the attempt after the one closing. */
export function seededDrawTarget(
  drawSeed: number,
  pool: readonly number[],
): <TExt>(seat: CheckoutSeat<TExt>) => number {
  return (seat) => seededPoolDraw(drawSeed, pool, seat.attemptIndex + 1);
}
```

(`closeAttempt` calls `nextTarget` before bumping `attemptIndex`, so `attemptIndex + 1` is the attempt about to open.)

- [ ] **Step 4: Run the policy tests**

Run: `cd app && npx vitest run tests/modules/game/checkout-policies.test.ts`
Expected: all pass.

- [ ] **Step 5: Type check**

Run: `cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3`
Expected: 0 / 0 / 0.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/checkout-policies.ts app/tests/modules/game/checkout-policies.test.ts
git commit -m "feat(checkout-policies): unreachableFails, seeded draw target"
```

---

### Task 4: Rebind Random Checkout onto the kernel and the exercise shell

**Files:**
- Modify (rewrite): `app/src/modules/training/exercises/random-checkout.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (Random Checkout row → `KERNEL_BOUND`)
- Test: `app/tests/modules/training/exercises/random-checkout.engine.module.test.ts` (one test added), oracle, goldens (unchanged)

**Interfaces:**
- Consumes: Task 2 `FAIL`; Task 3 `unreachableFails`, `seededPoolDraw`, `seededDrawTarget`; PR 1 `foldCheckoutVisits`, `initialCheckoutSeat`, `NO_INTENT`, `dartExerciseEngineClass`, `registerDartExercise`.
- Produces (unchanged names): `RANDOM_CHECKOUT_POOL`, `drawStartScore`, `foldRandomCheckoutState`, `RandomCheckoutEngine` (class), `randomCheckoutEngineFactory`.

- [ ] **Step 1: Flip the registry row (the failing gate)**

In `scripts/engine-kernels.txt` replace the `random-checkout.engine.module.ts` row with:

```
app/src/modules/training/exercises/random-checkout.engine.module.ts | CHECKOUT | KERNEL_BOUND | docs/game-rules/training/exercises/random-checkout.md |
```

Run: `bash scripts/check-engine-kernels.sh`
Expected: FAIL — random-checkout is `KERNEL_BOUND` but does not import the checkout kernel.

- [ ] **Step 2: Pin Review Focus 1 in the engine test**

Staged with the rebind (`check-test-coverage.sh` needs a test importing the engine in the same commit). Append inside `describe("RandomCheckoutEngine", …)`:

```ts
  it("undo of an unreachable-fail dart restores the draw and reopens the visit", () => {
    const engine = new RandomCheckoutEngine({ ...CONFIG, drawSeed: 42 });
    play(engine, [dart(1, "SINGLE")]);
    expect(engine.state()).toMatchObject({ startScore: 141, attempts: 1 });

    engine.undo();
    expect(engine.state()).toMatchObject({
      startScore: 155,
      remaining: 155,
      dartsInVisit: 0,
      attempts: 0,
      lastAttempt: null,
    });

    play(engine, [T20]);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state()).toMatchObject({
      startScore: 155,
      remaining: 95,
      dartsInVisit: 1,
      attempts: 0,
    });
  });
```

Run: `cd app && npx vitest run tests/modules/training/exercises/random-checkout.engine.module.test.ts -t "undo of an unreachable"`
Expected: PASS against the legacy-shaped engine (behaviour pin; must stay green after Step 3).

- [ ] **Step 3: Rewrite the engine**

`app/src/modules/training/exercises/random-checkout.engine.module.ts` (whole file):

```ts
import type { RandomCheckoutConfigData } from "@lib/types";
import { RandomCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type { CheckoutSeat, EngineFacts } from "@modules/types";
import type { CheckoutRules, DartExerciseSpec } from "@modules/interfaces";
import {
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import {
  seededDrawTarget,
  seededPoolDraw,
  unreachableFails,
} from "@modules/game/checkout-policies";
import { NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { RandomCheckoutState } from "./types";

const MIN_START = 40;
const MAX_START = 170;
const UNFINISHABLE_STARTS: ReadonlySet<number> = new Set([
  159, 162, 163, 165, 166, 168, 169,
]);

/**
 * The scores a three-dart double-out can finish, 40-170 ascending. Frozen
 * for `RANDOM_CHECKOUT_V1`: a stored draw seed must replay to the same scores
 * forever, so a change here is a new ruleset version (D424).
 */
export const RANDOM_CHECKOUT_POOL: readonly number[] = Array.from(
  { length: MAX_START - MIN_START + 1 },
  (_, offset) => MIN_START + offset,
).filter((score) => !UNFINISHABLE_STARTS.has(score));

/**
 * The start score of attempt `attemptIndex` (0-based): a uniform pick from
 * the pool keyed by `(drawSeed, attemptIndex)` alone, never by earlier darts,
 * so undo and replay reproduce it exactly.
 */
export function drawStartScore(
  config: RandomCheckoutConfigData,
  attemptIndex: number,
): number {
  return seededPoolDraw(config.drawSeed, RANDOM_CHECKOUT_POOL, attemptIndex);
}

type RandomCheckoutExt = { lastAttempt: RandomCheckoutState["lastAttempt"] };

/** Notes how the closing attempt ended. */
function noteLastAttempt(
  seat: CheckoutSeat<RandomCheckoutExt>,
  passed: boolean,
): CheckoutSeat<RandomCheckoutExt> {
  return { ...seat, ext: { lastAttempt: passed ? "CHECKOUT" : "FAILED" } };
}

function rules(
  config: RandomCheckoutConfigData,
): CheckoutRules<RandomCheckoutExt> {
  return {
    visitsPerAttempt: 1,
    judge: unreachableFails,
    onAttemptClose: noteLastAttempt,
    nextTarget: seededDrawTarget(config.drawSeed, RANDOM_CHECKOUT_POOL),
  };
}

/**
 * Folds the whole fact log into Random Checkout state through the Checkout
 * kernel — a pure function of `facts`/`config`/`expired`. Attempt *n* is
 * turn *n*, started from `drawStartScore(config, n)`; it closes on a
 * checkout, a bust, an unreachable remainder or its third dart. The run is
 * complete once the timer expired; an attempt open then is never judged.
 */
function fold(
  facts: EngineFacts,
  config: RandomCheckoutConfigData,
  expired: boolean,
): RandomCheckoutState {
  const seat = foldCheckoutVisits(
    facts.turns,
    initialCheckoutSeat(drawStartScore(config, 0), { lastAttempt: null }),
    rules(config),
  );
  return {
    startScore: seat.target,
    remaining: seat.remaining,
    dartsInVisit: seat.dartsInVisit,
    checkouts: seat.checkouts,
    attempts: seat.attempts,
    lastAttempt: seat.ext.lastAttempt,
    dartsThrown: facts.turns.reduce((sum, turn) => sum + turn.darts.length, 0),
    status: expired ? "COMPLETE" : "IN_PROGRESS",
  };
}

const randomCheckoutSpec: DartExerciseSpec<
  RandomCheckoutConfigData,
  RandomCheckoutState
> = {
  exerciseRulesetVersionKey: "RANDOM_CHECKOUT_V1",
  parse: (config) => RandomCheckoutV1Config.parse(config),
  fold,
  intent: () => NO_INTENT,
  isVisitOpen: (_turn, state) => state.dartsInVisit > 0,
};

export const foldRandomCheckoutState = randomCheckoutSpec.fold;

/**
 * Random Checkout: one-visit checkout attempts from a seed-drawn start score,
 * X01 double-out (`docs/game-rules/training/exercises/random-checkout.md`),
 * on the Checkout kernel and the exercise shell. One `TurnFact` is one
 * attempt; free aim. The run ends only through `expireTimer()` (D264).
 */
export class RandomCheckoutEngine extends dartExerciseEngineClass(
  randomCheckoutSpec,
) {}

export const randomCheckoutEngineFactory = registerDartExercise(
  randomCheckoutSpec,
  RandomCheckoutEngine,
).factory;
```

- [ ] **Step 4: Run gate, oracle, goldens, engine tests and dependants**

```bash
cd /home/user/dart-analytics && bash scripts/check-engine-kernels.sh
mkdir -p .superpowers && cd app && npx vitest run tests/modules/training tests/modules/stats tests/lib/stats tests/lib/training tests/modules/game/checkout-kernel.module.test.ts tests/modules/game/checkout-policies.test.ts > ../.superpowers/rc-task4.log 2>&1; tail -8 ../.superpowers/rc-task4.log
```

Expected: gate `OK: engine kernels`; vitest all passed — oracle 6/6, Random Checkout goldens 3/3 and Checkout Sequence goldens 3/3 with **no** snapshot written or updated; `random-checkout.engine.module.test.ts` green (incl. seed 42 → 155, 141, 160, 64, 140).

If the oracle diverges: superpowers:systematic-debugging; the `where` line names seed and step. Never edit the legacy file or the snapshots to match.

- [ ] **Step 5: Type check**

Run: `cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3`
Expected: 0 / 0 / 0 (routine adapter and `routines/types.ts` still type against the class).

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/exercises/random-checkout.engine.module.ts scripts/engine-kernels.txt \
  app/tests/modules/training/exercises/random-checkout.engine.module.test.ts
git commit -m "refactor(random-checkout): bind to the checkout kernel and the exercise shell"
```

---

### Task 5: Drop the legacy copy

**Files:**
- Delete: `app/tests/modules/training/exercises/legacy/random-checkout.legacy.ts`
- Delete: `app/tests/modules/training/exercises/random-checkout.oracle.test.ts`

The guarantee is re-pointed at the goldens recorded in Task 1, never dropped (Hard Invariants).

- [ ] **Step 1: Delete and re-run the goldens**

```bash
cd /home/user/dart-analytics
git rm app/tests/modules/training/exercises/legacy/random-checkout.legacy.ts \
  app/tests/modules/training/exercises/random-checkout.oracle.test.ts
rmdir app/tests/modules/training/exercises/legacy 2>/dev/null || true
cd app && npx vitest run tests/modules/training/exercises/random-checkout.golden.test.ts
```

Expected: 3 passed, no snapshot changes.

- [ ] **Step 2: Commit**

```bash
cd /home/user/dart-analytics
git commit -m "test(random-checkout): drop legacy copy; goldens hold the guarantee"
```

---

### Task 6: Docs, spec refinement

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (version line 10; Checkout row line 831)
- Modify: `app/src/modules/game/CLAUDE.md` (Checkout bullet, line 21)
- Modify: `app/src/modules/training/CLAUDE.md` (line 12 bullet)
- Modify: `docs/architecture/00-File-Inventory.md` (`checkout-policies.ts` row, line 222)
- Modify: `docs/architecture/00-Context-Map-History.md` (append row)
- Modify: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` §3 (refinement bullet)

No decision entry (D500 covers the migration). Run `bash scripts/next-decision-id.sh` only to confirm nothing is owed.

- [ ] **Step 1: Apply the edits**

Pattern 18 version line: prepend `1.11.16 (Pattern 18: Random Checkout bound through `foldCheckoutVisits` on the exercise shell; the Checkout kernel's `FAIL` verdict 2026-10-27, D500; prior 1.11.15: ` and keep the rest (the old `1.11.15 (` opener becomes `1.11.15: `, matching earlier `prior` entries).

Pattern 18 Checkout row:

```
| `CHECKOUT` | finish a target score under bust rules; attempt budget; ladder moves | `modules/game/checkout-kernel.module.ts` (policies: `checkout-policies.ts`) | built — Checkout Sequence and Random Checkout bound through `foldCheckoutVisits` (D500, 2026-10-27); Ten Up One Down and 121 pending, in that order |
```

`app/src/modules/game/CLAUDE.md` Checkout bullet: after "…books a closed attempt (`onAttemptClose`)" insert "— a `FAIL` verdict closes it at once, before the visit budget runs out —"; append before the closing date: " Random Checkout draws its next target with `seededDrawTarget` (2026-10-27)."

`app/src/modules/training/CLAUDE.md` line 12, replace "Checkout Sequence folds through the Checkout kernel's `foldCheckoutVisits` (2026-10-27, D500)." with "Checkout Sequence and Random Checkout fold through the Checkout kernel's `foldCheckoutVisits` (2026-10-27, D500)."

`00-File-Inventory.md` `checkout-policies.ts` row:

```
| `app/src/modules/game/checkout-policies.ts` | Checkout policies: `dartWalkJudge`, `consecutiveTargets` (Checkout Sequence, D500, 2026-10-27); `unreachableFails`, `seededPoolDraw`, `seededDrawTarget` (Random Checkout, 2026-10-27) | canonical |
```

`00-Context-Map-History.md`, append a row in the same column shape as the PR 1 row:

```
| `checkout-kernel.module.ts`, `checkout-policies.ts`, `random-checkout.engine.module.ts`, `modules/game/types.ts`, their tests, `random-checkout.golden.test.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (1.11.16), `modules/{game,training}/CLAUDE.md`, `00-File-Inventory.md` | Random Checkout bound to the Checkout kernel and moved onto the exercise shell (goldens recorded pre-rebind, oracle); kernel `FAIL` verdict; second `walkVisit` deleted. Checkout PR 2 (2026-10-27) | historical |
```

Spec §3, append after the PR 1 refinement bullet:

```
- **Refined by the PR 2 plan (2026-10-27):** `seededDrawTarget(drawSeed, pool)` and `drawStartScore` both wrap `seededPoolDraw(drawSeed, pool, index)` in `checkout-policies.ts` (a game module cannot import a training one); `unreachableFails` judges from `dartWalkJudge`'s verdict — an `OPEN` visit with a dart thrown and an unreachable remainder is `FAIL` — rather than walking again; `FAIL` closes the attempt on any visit.
```

- [ ] **Step 2: Gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-decision-ids.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-doc-sync.sh
```

Expected: all OK.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md app/src/modules/game/CLAUDE.md \
  app/src/modules/training/CLAUDE.md docs/architecture/00-File-Inventory.md \
  docs/architecture/00-Context-Map-History.md docs/superpowers/specs/2026-10-27-checkout-kernel-design.md
git commit -m "docs: Random Checkout bound to the checkout kernel (D500)"
```

---

### Task 7: Full verification and PR

- [ ] **Step 1:** `cd app && npm run format && npm run format:check` — commit any formatting diff.
- [ ] **Step 2:** Run the `run-all-gates` skill (Always + app sets). Without `DATABASE_URL`, `validate:app`'s DB steps cannot run: run fallow, `npm test` and `npm run check` directly and say so. Fallow: dead code clean; duplication **below** `main`'s (compare `npx fallow` duplication count on `origin/main` vs the branch). Report each script's result.
- [ ] **Step 3:** Final whole-branch review per the chosen execution skill.
- [ ] **Step 4:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push, open the PR against `main`, subscribe to PR activity.
