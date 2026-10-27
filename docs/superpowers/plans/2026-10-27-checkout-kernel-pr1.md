# Checkout Kernel PR 1 — Checkout Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Checkout rule kernel and move Checkout Sequence onto it and onto the exercise shell, with no behaviour change.

**Architecture:** `checkout-kernel.module.ts` folds judged visits into a `CheckoutSeat`; `checkout-policies.ts` holds `dartWalkJudge` and `consecutiveTargets`; Checkout Sequence becomes a `DartExerciseSpec` (rules + projection) bound to `dart-exercise-shell.module.ts`. Proof: legacy copy + differential oracle, goldens recorded before the rebind, then legacy deleted.

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md`

## Global Constraints

- No behaviour change: `state()`, `facts()`, thrown messages, `CheckoutSequenceState` shape and `foldCheckoutSequenceState(facts, config, expired)` signature identical.
- Persistence unchanged: `EXERCISE_BLOCK` stage, one `turns` row per visit, one `darts` row per dart; free aim (no intent); no new fact columns.
- Reuse `resolveCheckoutAttempt`; never re-declare bust logic.
- A policy lands only with its first caller (fallow dead-code gate); fallow duplication must not rise.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations only (`app/CLAUDE.md` §Comments).
- Exported types live in `types.ts`/`interfaces.ts`, never inline in implementation files (`check-type-barrels.sh`).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs 14 gates; run commits in the background and poll if slow.
- Branch: `feat/checkout-kernel-cs`, cut from `docs/checkout-kernel-spec` (stack of one, allowed).

## Refinements to the spec (rulings made while planning)

Recorded in the spec §3 as "Refined by the PR 1 plan" in Task 7.

- `rules.target(seat, attemptIndex)` + `onAttemptClose` setting the target become `nextTarget(seat, passed): number | null` (called after `onAttemptClose`; `null` ends the seat as `DONE`) and the first target passed to `initialCheckoutSeat`. One hook covers list, seeded draw and ladder.
- `VisitVerdict` gains `OPEN { remaining, darts }`: the exercise fold walks the open visit too. `FAIL` lands with Random Checkout (PR 2); `WON` with 121 (PR 4).
- `CheckoutSeat` carries `visitStart` (bust carry) and `dartsInVisit` (live overlay); no `participantRef`/`sideKey` until `foldCheckoutSeats` (PR 3).
- `foldCheckoutSeats` lands in PR 3, not here.
- Shell change not foreseen by the spec: `DartExerciseSpec.isVisitOpen(turn, state)` sees the folded state, as the game shell's does — Checkout Sequence closes a visit on a checkout or bust, which needs the remaining score. `NO_INTENT` is exported from `turn-log.module.ts` rather than copied a fifth time.

## Review Focus

1. Undo of the dart that closed an attempt (checkout or bust on the budget's last visit) — previous outshot, `remaining`, `points` restored. Pinned by the oracle (undo rate 0.12), the golden trace, and an engine test added in Task 5 Step 2.
2. A bust on the first visit carries the visit's start, not the post-dart remainder, into visit 2. Pinned by the existing test "bust keeps the visit start" plus a kernel unit test (Task 3).
3. Completing the last outshot (100) then `record` → throws "exercise is complete"; `undo` re-opens it. Pinned by the oracle case `long run to completion` (Task 1) and a kernel `DONE` test (Task 3).
4. Rehydration mid-visit and after expiry (`create(config, prior)`, then `expireTimer`). Pinned by oracle `rehydrateEvery: 19`, `resumeExpired: true`.
5. Existing shell specs whose `isVisitOpen` reads only the turn keep working. Pinned by the full `tests/modules/training/exercises` suite run in Tasks 2 and 5.

---

### Task 1: Freeze — legacy copy, checkout observer, oracle, goldens

**Files:**
- Create: `app/tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts`
- Create: `app/tests/modules/game/support/checkout-observations.ts`
- Create: `app/tests/modules/training/exercises/checkout-sequence.oracle.test.ts`
- Create: `app/tests/modules/training/exercises/checkout-sequence.golden.test.ts` (+ its `__snapshots__` file)

**Interfaces:**
- Produces: `LegacyCheckoutSequenceEngine` (legacy file); `towardCheckout(rate: number): (rand: () => number, engine: OracleEngine) => DartObservation`.

- [ ] **Step 1: Branch**

```bash
cd /home/user/dart-analytics
git fetch origin main
git checkout -b feat/checkout-kernel-cs docs/checkout-kernel-spec
```

- [ ] **Step 2: Copy the engine as legacy**

```bash
cd /home/user/dart-analytics/app
mkdir -p tests/modules/training/exercises/legacy
sed -e 's#from "./interfaces"#from "@modules/training/exercises/interfaces"#' \
    -e 's#from "./solo-participant.module"#from "@modules/training/exercises/solo-participant.module"#' \
    -e 's#from "./types"#from "@modules/training/exercises/types"#' \
    -e 's#class CheckoutSequenceEngine#class LegacyCheckoutSequenceEngine#' \
    -e '/^  DartExerciseEngineFactory,$/d' \
    -e '/dart-engine.registry/d' \
    src/modules/training/exercises/checkout-sequence.engine.module.ts \
  | sed '/^export const checkoutSequenceEngineFactory/,$d' \
  > tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts
tail -5 tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts
grep -c "register\|Factory" tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts
```

Expected: file ends with the class's closing `}`; grep count `0`.

- [ ] **Step 3: Write the checkout observer**

`app/tests/modules/game/support/checkout-observations.ts`:

```ts
import type { DartObservation } from "@modules/types";
import { randomObservation, type OracleEngine } from "./engine-oracle";

const BASE = { locationX: null, locationY: null };

/** The dart that finishes `remaining`, or the set-up shot towards a double. */
function finishingShot(remaining: number): DartObservation {
  if (remaining === 50)
    return { ...BASE, hitTargetNumber: 25, hitZoneKey: "INNER_BULL" };
  if (remaining <= 40 && remaining % 2 === 0)
    return { ...BASE, hitTargetNumber: remaining / 2, hitZoneKey: "DOUBLE" };
  if (remaining > 60)
    return { ...BASE, hitTargetNumber: 20, hitZoneKey: "TREBLE" };
  const single = remaining > 40 ? remaining - 40 : 1;
  return { ...BASE, hitTargetNumber: single, hitZoneKey: "OUTER_SINGLE" };
}

/**
 * With probability `rate`, throws towards a double-out of the engine's
 * current `remaining`; otherwise a random board hit — so checkouts, busts
 * and spent visits all occur.
 */
export function towardCheckout(rate: number) {
  return (rand: () => number, engine: OracleEngine): DartObservation => {
    const remaining =
      (engine.state() as { remaining?: number }).remaining ?? 0;
    if (rand() >= rate || remaining <= 1) return randomObservation(rand);
    return finishingShot(remaining);
  };
}
```

- [ ] **Step 4: Write the oracle test**

`app/tests/modules/training/exercises/checkout-sequence.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { LegacyCheckoutSequenceEngine } from "./legacy/checkout-sequence.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import type { CheckoutSequenceConfigData } from "@lib/types";

const CONFIG: CheckoutSequenceConfigData = {
  firstOutshot: 61,
  lastOutshot: 100,
  dartLimit: 6,
};
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, { steps: number; expireAt?: number; rate: number }][] = [
  ["random play, expired", { steps: 260, expireAt: 200, rate: 0.3 }],
  ["toward checkout, expired", { steps: 260, expireAt: 200, rate: 0.7 }],
  ["long run to completion", { steps: 420, rate: 0.9 }],
];

describe("Checkout Sequence — kernel vs legacy oracle", () => {
  for (const [name, c] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new CheckoutSequenceEngine(CONFIG, prior),
        legacy: (prior) => new LegacyCheckoutSequenceEngine(CONFIG, prior),
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
});
```

- [ ] **Step 5: Run the oracle against the current engine**

Run: `cd app && npx vitest run tests/modules/training/exercises/checkout-sequence.oracle.test.ts`
Expected: 3 passed (both sides are the same code today).

- [ ] **Step 6: Write the golden tests**

`app/tests/modules/training/exercises/checkout-sequence.golden.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { goldenTrace, normalise } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { CheckoutSequenceConfigData } from "@lib/types";

const CONFIG: CheckoutSequenceConfigData = {
  firstOutshot: 61,
  lastOutshot: 100,
  dartLimit: 6,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Checkout Sequence — golden", () => {
  it("seed 42 run to completion is unchanged", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    const rand = seededUniform(42, 0);
    const observe = towardCheckout(0.85);
    while (!engine.isComplete()) {
      if (rand() < 0.08) engine.undo();
      else engine.record(observe(rand, engine));
    }
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Checkout Sequence — golden trace", () => {
  for (const [name, expireAt] of [
    ["expired", 200],
    ["to completion", undefined],
  ] as const) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new CheckoutSequenceEngine(CONFIG, prior),
          seed: 7,
          steps: expireAt ? 260 : 420,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: expireAt !== undefined,
          observe: towardCheckout(0.8),
        }),
      ).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 7: Record the goldens against the current engine**

Run: `cd app && npx vitest run -u tests/modules/training/exercises/checkout-sequence.golden.test.ts`
Expected: 3 passed, 3 snapshots written. Then `grep -c '"COMPLETE"' tests/modules/training/exercises/__snapshots__/checkout-sequence.golden.test.ts.snap` ≥ 2 (the runs reach completion).

- [ ] **Step 8: Commit**

```bash
cd /home/user/dart-analytics
git add app/tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts \
  app/tests/modules/game/support/checkout-observations.ts \
  app/tests/modules/training/exercises/checkout-sequence.oracle.test.ts \
  app/tests/modules/training/exercises/checkout-sequence.golden.test.ts \
  app/tests/modules/training/exercises/__snapshots__/checkout-sequence.golden.test.ts.snap
git commit -m "test(checkout-sequence): freeze legacy engine, checkout observer, oracle, goldens"
```

---

### Task 2: Exercise shell — state-aware visit close; export `NO_INTENT`

**Files:**
- Modify: `app/src/modules/training/exercises/interfaces.ts:75`
- Modify: `app/src/modules/training/exercises/dart-exercise-shell.module.ts:20-60` (doc + `record`)
- Modify: `app/src/modules/game/turn-log.module.ts:94-98`
- Modify: `app/tests/modules/training/exercises/track-exercise-spec.module.test.ts:82-87`
- Test: `app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts`, `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Produces: `DartExerciseSpec.isVisitOpen(turn: TurnFact, state: TState): boolean`; `export const NO_INTENT: DartIntent` from `@modules/game/turn-log.module`.

- [ ] **Step 1: Write the failing tests**

Append to `dart-exercise-shell.module.test.ts`:

```ts
describe("dartExerciseEngineClass — state-aware visit close", () => {
  const pairs: DartExerciseSpec<{ n: number }, Toy> = {
    ...spec,
    isVisitOpen: (_turn, state) => state.darts % 2 === 1,
  };
  const Pairs = dartExerciseEngineClass(pairs);

  it("asks isVisitOpen with the folded state, before and after the dart", () => {
    const e = new Pairs({ n: 1 });
    [T20, T20, T20].forEach((o) => e.record(o));
    const turns = e.facts().turns;
    expect(turns.map((t) => t.darts.length)).toEqual([2, 1]);
    expect(turns[0].completedAt).not.toBeNull();
    expect(turns[1].completedAt).toBeNull();
  });
});
```

Append to `turn-log.module.test.ts` (add `NO_INTENT` to its `@modules/game/turn-log.module` import):

```ts
describe("NO_INTENT", () => {
  it("is the null intent pair appendObservedDart defaults to", () => {
    expect(NO_INTENT).toEqual({
      intendedTargetNumber: null,
      intendedZoneKey: null,
    });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd app && npx vitest run tests/modules/training/exercises/dart-exercise-shell.module.test.ts tests/modules/game/turn-log.module.test.ts`
Expected: FAIL — shell test throws reading `darts` of `undefined` (state not passed); turn-log test fails on `NO_INTENT` undefined (not exported).

- [ ] **Step 3: Implement**

`interfaces.ts` line 75:

```ts
  /** Whether `turn` stays open, read against the state folded over the log (as the game shell's). */
  isVisitOpen(turn: TurnFact, state: TState): boolean;
```

`dart-exercise-shell.module.ts` — `record` becomes:

```ts
    record(observation: DartObservation): TState {
      refuseWhenEnded(this.isComplete(), "exercise is complete");
      const before = this.deriveState();
      const intent = spec.intent(before, this.config);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        SOLO_PARTICIPANT_REF,
        (last) => spec.isVisitOpen(last, before),
      );
      appendObservedDart(turn, observation, intent);
      if (!spec.isVisitOpen(turn, this.deriveState()))
        turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }
```

and its class doc gains: "`isVisitOpen` sees the state folded before the dart (reuse the open turn) and after it (close the turn)."

`turn-log.module.ts`: `const NO_INTENT` → `export const NO_INTENT`.

`track-exercise-spec.module.test.ts` "closes a visit at three darts": pass a state as the second argument —

```ts
    const state = spec.fold(facts([]), { start: 0 }, false);
    expect(spec.isVisitOpen(open, state)).toBe(true);
    expect(spec.isVisitOpen(full, state)).toBe(false);
```

- [ ] **Step 4: Run the exercise and turn-log suites**

Run: `cd app && npx vitest run tests/modules/training/exercises tests/modules/game/turn-log.module.test.ts`
Expected: all pass (including the Task 1 oracle and goldens).

- [ ] **Step 5: Type check**

Run: `cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3`
Expected: `0 errors`, `0 warnings`, `0 hints`.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/exercises/interfaces.ts \
  app/src/modules/training/exercises/dart-exercise-shell.module.ts \
  app/src/modules/game/turn-log.module.ts \
  app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts \
  app/tests/modules/game/turn-log.module.test.ts \
  app/tests/modules/training/exercises/track-exercise-spec.module.test.ts
git commit -m "feat(exercise-shell): isVisitOpen sees the folded state; export NO_INTENT"
```

---

### Task 3: Checkout kernel

**Files:**
- Modify: `app/src/modules/game/types.ts` (append `VisitVerdict`, `CheckoutSeat`)
- Modify: `app/src/modules/game/interfaces.ts` (append `CheckoutRules` after `TrackRules`)
- Create: `app/src/modules/game/checkout-kernel.module.ts`
- Test: `app/tests/modules/game/checkout-kernel.module.test.ts`

**Interfaces:**
- Produces:
  - `type VisitVerdict = { kind: "CHECKOUT"; darts: number } | { kind: "BUST" } | { kind: "SPENT"; remaining: number } | { kind: "OPEN"; remaining: number; darts: number }`
  - `type CheckoutSeat<TExt> = { target; visitStart; remaining; dartsInVisit; visitIndex; attemptIndex; attempts; checkouts: number; status: "IN_PROGRESS" | "DONE"; ext: TExt }`
  - `interface CheckoutRules<TExt> { readonly visitsPerAttempt: number; judge(seat, turn): VisitVerdict; onAttemptClose(seat, passed, verdict): CheckoutSeat<TExt>; nextTarget(seat, passed): number | null }`
  - `initialCheckoutSeat<TExt>(target: number, ext: TExt): CheckoutSeat<TExt>`
  - `applyCheckoutVisit<TExt>(seat, turn: TurnFact, rules): CheckoutSeat<TExt>`
  - `foldCheckoutVisits<TExt>(turns: readonly TurnFact[], initial, rules): CheckoutSeat<TExt>`

- [ ] **Step 1: Add the types**

Append to `app/src/modules/game/types.ts`:

```ts
/**
 * How a Checkout ruleset judged one visit (Pattern 18 §Rule-kernel
 * families): a checkout in `darts` darts, a bust, a closed visit short of
 * zero, or a visit still open.
 */
export type VisitVerdict =
  | { kind: "CHECKOUT"; darts: number }
  | { kind: "BUST" }
  | { kind: "SPENT"; remaining: number }
  | { kind: "OPEN"; remaining: number; darts: number };

/**
 * One seat on the Checkout kernel: the open attempt's `target`, the score
 * its current visit started from (`visitStart`) and the live `remaining`;
 * `ext` is the ruleset's own bookkeeping.
 */
export type CheckoutSeat<TExt> = {
  target: number;
  visitStart: number;
  remaining: number;
  dartsInVisit: number;
  visitIndex: number;
  attemptIndex: number;
  attempts: number;
  checkouts: number;
  status: "IN_PROGRESS" | "DONE";
  ext: TExt;
};
```

Append to `app/src/modules/game/interfaces.ts` (add `CheckoutSeat`, `VisitVerdict` to its `./types` import):

```ts
/**
 * A Checkout ruleset as named policies over `CheckoutSeat`
 * (`checkout-kernel.module.ts`): how a visit is judged, how many visits an
 * attempt allows, what closing an attempt books, and the next target
 * (`null` ends the seat).
 */
export interface CheckoutRules<TExt> {
  readonly visitsPerAttempt: number;
  judge(seat: CheckoutSeat<TExt>, turn: TurnFact): VisitVerdict;
  onAttemptClose(
    seat: CheckoutSeat<TExt>,
    passed: boolean,
    verdict: VisitVerdict,
  ): CheckoutSeat<TExt>;
  nextTarget(seat: CheckoutSeat<TExt>, passed: boolean): number | null;
}
```

- [ ] **Step 2: Write the failing kernel tests**

`app/tests/modules/game/checkout-kernel.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyCheckoutVisit,
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import type { CheckoutRules } from "@modules/interfaces";
import type { CheckoutSeat, TurnFact, VisitVerdict } from "@modules/types";

type Ext = { closed: [boolean, VisitVerdict["kind"]][] };

function rules(
  verdicts: VisitVerdict[],
  visitsPerAttempt = 2,
  last = 62,
): CheckoutRules<Ext> {
  let i = 0;
  return {
    visitsPerAttempt,
    judge: () => verdicts[i++],
    onAttemptClose: (seat, passed, verdict) => ({
      ...seat,
      ext: { closed: [...seat.ext.closed, [passed, verdict.kind]] },
    }),
    nextTarget: (seat) => (seat.target < last ? seat.target + 1 : null),
  };
}

const TURN = { darts: [] } as unknown as TurnFact;
const start = (): CheckoutSeat<Ext> => initialCheckoutSeat(61, { closed: [] });

describe("checkout kernel", () => {
  it("starts on the target with zero counters", () => {
    expect(start()).toEqual({
      target: 61,
      visitStart: 61,
      remaining: 61,
      dartsInVisit: 0,
      visitIndex: 0,
      attemptIndex: 0,
      attempts: 0,
      checkouts: 0,
      status: "IN_PROGRESS",
      ext: { closed: [] },
    });
  });

  it("an open visit shows the live remainder and dart count only", () => {
    const seat = applyCheckoutVisit(
      start(),
      TURN,
      rules([{ kind: "OPEN", remaining: 41, darts: 1 }]),
    );
    expect(seat).toMatchObject({ remaining: 41, dartsInVisit: 1, visitStart: 61, visitIndex: 0 });
  });

  it("a checkout closes the attempt as passed and moves to the next target", () => {
    const seat = applyCheckoutVisit(start(), TURN, rules([{ kind: "CHECKOUT", darts: 2 }]));
    expect(seat).toMatchObject({
      target: 62, visitStart: 62, remaining: 62, visitIndex: 0, dartsInVisit: 0,
      attemptIndex: 1, attempts: 1, checkouts: 1, ext: { closed: [[true, "CHECKOUT"]] },
    });
  });

  it("onAttemptClose sees the visit index of the checking-out visit", () => {
    const seen: number[] = [];
    const r = rules([{ kind: "SPENT", remaining: 21 }, { kind: "CHECKOUT", darts: 1 }]);
    const spy: CheckoutRules<Ext> = {
      ...r,
      onAttemptClose: (seat, passed, verdict) => {
        seen.push(seat.visitIndex);
        return r.onAttemptClose(seat, passed, verdict);
      },
    };
    foldCheckoutVisits([TURN, TURN], start(), spy);
    expect(seen).toEqual([1]);
  });

  it("a spent visit carries its remainder; a bust carries the visit start", () => {
    const spent = applyCheckoutVisit(start(), TURN, rules([{ kind: "SPENT", remaining: 21 }]));
    expect(spent).toMatchObject({ visitIndex: 1, visitStart: 21, remaining: 21, attempts: 0 });
    const bust = applyCheckoutVisit(start(), TURN, rules([{ kind: "BUST" }]));
    expect(bust).toMatchObject({ visitIndex: 1, visitStart: 61, remaining: 61, attempts: 0 });
  });

  it("the budget's last visit without a checkout fails the attempt", () => {
    const seat = foldCheckoutVisits(
      [TURN, TURN],
      start(),
      rules([{ kind: "SPENT", remaining: 21 }, { kind: "BUST" }]),
    );
    expect(seat).toMatchObject({
      target: 62, attempts: 1, checkouts: 0, visitIndex: 0,
      ext: { closed: [[false, "BUST"]] },
    });
  });

  it("a null next target ends the seat as DONE", () => {
    const seat = foldCheckoutVisits(
      [TURN, TURN],
      start(),
      rules([{ kind: "CHECKOUT", darts: 3 }, { kind: "CHECKOUT", darts: 3 }], 2, 62),
    );
    expect(seat).toMatchObject({ status: "DONE", attempts: 2, checkouts: 2, attemptIndex: 2 });
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts`
Expected: FAIL — cannot resolve `@modules/game/checkout-kernel.module`.

- [ ] **Step 4: Implement the kernel**

`app/src/modules/game/checkout-kernel.module.ts`:

```ts
import type { CheckoutRules } from "./interfaces";
import type { CheckoutSeat, TurnFact, VisitVerdict } from "./types";

/** A Checkout seat before its first visit: on `target`, zero counters, `ext` as given. */
export function initialCheckoutSeat<TExt>(
  target: number,
  ext: TExt,
): CheckoutSeat<TExt> {
  return {
    target,
    visitStart: target,
    remaining: target,
    dartsInVisit: 0,
    visitIndex: 0,
    attemptIndex: 0,
    attempts: 0,
    checkouts: 0,
    status: "IN_PROGRESS",
    ext,
  };
}

/**
 * Books a closed attempt, runs `onAttemptClose` on the seat as it stood in
 * the closing visit, then opens `nextTarget` — or ends the seat as `DONE`
 * when it returns `null`.
 */
function closeAttempt<TExt>(
  seat: CheckoutSeat<TExt>,
  passed: boolean,
  verdict: VisitVerdict,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const closed = rules.onAttemptClose(
    {
      ...seat,
      attempts: seat.attempts + 1,
      checkouts: seat.checkouts + (passed ? 1 : 0),
    },
    passed,
    verdict,
  );
  const next = rules.nextTarget(closed, passed);
  const target = next ?? closed.target;
  return {
    ...closed,
    target,
    visitStart: target,
    remaining: target,
    dartsInVisit: 0,
    visitIndex: 0,
    attemptIndex: closed.attemptIndex + 1,
    status: next === null ? "DONE" : closed.status,
  };
}

/**
 * A visit closed without a checkout: the next visit starts from the spent
 * remainder, or from this visit's start after a bust; the budget's last
 * visit fails the attempt.
 */
function carryVisit<TExt>(
  seat: CheckoutSeat<TExt>,
  verdict: Extract<VisitVerdict, { kind: "BUST" | "SPENT" }>,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const visitIndex = seat.visitIndex + 1;
  if (visitIndex >= rules.visitsPerAttempt)
    return closeAttempt(seat, false, verdict, rules);
  const start = verdict.kind === "SPENT" ? verdict.remaining : seat.visitStart;
  return {
    ...seat,
    visitIndex,
    visitStart: start,
    remaining: start,
    dartsInVisit: 0,
  };
}

/**
 * The Checkout kernel's one reducer (Pattern 18 §Rule-kernel families):
 * `judge` the visit, then show it open, pass the attempt, or carry/fail it.
 * Every rule a ruleset makes lives in `rules`.
 */
export function applyCheckoutVisit<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const verdict = rules.judge(seat, turn);
  switch (verdict.kind) {
    case "OPEN":
      return {
        ...seat,
        remaining: verdict.remaining,
        dartsInVisit: verdict.darts,
      };
    case "CHECKOUT":
      return closeAttempt(seat, true, verdict, rules);
    case "BUST":
    case "SPENT":
      return carryVisit(seat, verdict, rules);
  }
}

/** Folds one seat over every turn in write order — the solo exercise's fold. */
export function foldCheckoutVisits<TExt>(
  turns: readonly TurnFact[],
  initial: CheckoutSeat<TExt>,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  return turns.reduce(
    (seat, turn) => applyCheckoutVisit(seat, turn, rules),
    initial,
  );
}
```

- [ ] **Step 5: Run the kernel tests**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/types.ts app/src/modules/game/interfaces.ts \
  app/src/modules/game/checkout-kernel.module.ts \
  app/tests/modules/game/checkout-kernel.module.test.ts
git commit -m "feat(game): checkout kernel — judged visits, attempt budget, next target"
```

---

### Task 4: Checkout policies

**Files:**
- Create: `app/src/modules/game/checkout-policies.ts`
- Test: `app/tests/modules/game/checkout-policies.test.ts`

**Interfaces:**
- Consumes: `CheckoutSeat`, `VisitVerdict` (Task 3); `resolveCheckoutAttempt` (`checkout-bust.module.ts`).
- Produces: `dartWalkJudge<TExt>(seat: CheckoutSeat<TExt>, turn: TurnFact): VisitVerdict`; `consecutiveTargets(last: number): <TExt>(seat: CheckoutSeat<TExt>) => number | null`.

- [ ] **Step 1: Write the failing tests**

`app/tests/modules/game/checkout-policies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  consecutiveTargets,
  dartWalkJudge,
} from "@modules/game/checkout-policies";
import { initialCheckoutSeat } from "@modules/game/checkout-kernel.module";
import type { DartZoneKey, TurnFact } from "@modules/types";

function turn(...darts: [number | null, DartZoneKey, number][]): TurnFact {
  return {
    darts: darts.map(([hitTargetNumber, hitZoneKey, score]) => ({
      hitTargetNumber,
      hitZoneKey,
      score,
    })),
  } as unknown as TurnFact;
}

const at = (start: number) => initialCheckoutSeat(start, null);

describe("dartWalkJudge", () => {
  it("checks out on a double, counting darts used", () => {
    expect(dartWalkJudge(at(61), turn([15, "TREBLE", 45], [8, "DOUBLE", 16]))).toEqual({ kind: "CHECKOUT", darts: 2 });
  });
  it("checks out on the bullseye", () => {
    expect(dartWalkJudge(at(50), turn([25, "INNER_BULL", 50]))).toEqual({ kind: "CHECKOUT", darts: 1 });
  });
  it("busts on an overshoot, on 1 left, and on zero off a single", () => {
    expect(dartWalkJudge(at(40), turn([20, "TREBLE", 60]))).toEqual({ kind: "BUST" });
    expect(dartWalkJudge(at(21), turn([20, "SINGLE", 20]))).toEqual({ kind: "BUST" });
    expect(dartWalkJudge(at(20), turn([20, "SINGLE", 20]))).toEqual({ kind: "BUST" });
  });
  it("walks from the seat's visit start, not its target", () => {
    const seat = { ...at(61), visitStart: 16 };
    expect(dartWalkJudge(seat, turn([8, "DOUBLE", 16]))).toEqual({ kind: "CHECKOUT", darts: 1 });
  });
  it("a third dart short of zero spends the visit; fewer keep it open", () => {
    expect(dartWalkJudge(at(61), turn([null, "MISS", 0], [1, "SINGLE", 1], [null, "MISS", 0]))).toEqual({ kind: "SPENT", remaining: 60 });
    expect(dartWalkJudge(at(61), turn([20, "SINGLE", 20]))).toEqual({ kind: "OPEN", remaining: 41, darts: 1 });
    expect(dartWalkJudge(at(61), turn())).toEqual({ kind: "OPEN", remaining: 61, darts: 0 });
  });
});

describe("consecutiveTargets", () => {
  it("steps one up until the last target has been attempted", () => {
    const next = consecutiveTargets(100);
    expect(next(at(61))).toBe(62);
    expect(next(at(100))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-policies.test.ts`
Expected: FAIL — cannot resolve `@modules/game/checkout-policies`.

- [ ] **Step 3: Implement**

`app/src/modules/game/checkout-policies.ts`:

```ts
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import type { CheckoutSeat, DartFact, TurnFact, VisitVerdict } from "./types";

const DARTS_PER_VISIT = 3;

/** A double-out finishing dart: any double, or the bullseye. */
function isFinishingDart(dart: Pick<DartFact, "hitZoneKey">): boolean {
  return dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
}

/**
 * Judges a visit from its darts alone, walking from the seat's
 * `visitStart` under the double-out rule (`resolveCheckoutAttempt`): a
 * checkout, a bust, a third dart short of zero (`SPENT`), or still open.
 */
export function dartWalkJudge<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
): VisitVerdict {
  let remaining = seat.visitStart;
  for (const [index, dart] of turn.darts.entries()) {
    const outcome = resolveCheckoutAttempt(
      remaining,
      dart.score,
      isFinishingDart(dart),
    );
    if (outcome.checkedOut) return { kind: "CHECKOUT", darts: index + 1 };
    if (outcome.busted) return { kind: "BUST" };
    remaining = outcome.remainingAfter;
  }
  return turn.darts.length === DARTS_PER_VISIT
    ? { kind: "SPENT", remaining }
    : { kind: "OPEN", remaining, darts: turn.darts.length };
}

/** Next target: one above the current, until `last` has been attempted. */
export function consecutiveTargets(last: number) {
  return <TExt>(seat: CheckoutSeat<TExt>): number | null =>
    seat.target < last ? seat.target + 1 : null;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd app && npx vitest run tests/modules/game/checkout-policies.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/checkout-policies.ts app/tests/modules/game/checkout-policies.test.ts
git commit -m "feat(game): checkout policies — dartWalkJudge, consecutiveTargets"
```

---

### Task 5: Rebind Checkout Sequence onto the kernel and the exercise shell

**Files:**
- Modify (rewrite): `app/src/modules/training/exercises/checkout-sequence.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (Checkout Sequence row → `KERNEL_BOUND`)
- Test: existing `checkout-sequence.engine.module.test.ts`, oracle, goldens (unchanged)

**Interfaces:**
- Consumes: Task 2 `isVisitOpen(turn, state)`, `NO_INTENT`; Task 3 kernel; Task 4 policies.
- Produces (unchanged names): `foldCheckoutSequenceState`, `CheckoutSequenceEngine` (class), `checkoutSequenceEngineFactory`.

- [ ] **Step 1: Flip the registry row (the failing gate)**

In `scripts/engine-kernels.txt` replace the `checkout-sequence.engine.module.ts` row with:

```
app/src/modules/training/exercises/checkout-sequence.engine.module.ts | CHECKOUT | KERNEL_BOUND | docs/game-rules/training/exercises/catch-40.md |
```

Run: `bash scripts/check-engine-kernels.sh`
Expected: FAIL — "checkout-sequence.engine.module.ts is KERNEL_BOUND but does not import ./checkout-kernel.module".

- [ ] **Step 2: Pin Review Focus 1 in the engine test (staged with the rebind — `check-test-coverage.sh` needs a test importing the engine in the same commit)**

Append inside `describe("CheckoutSequenceEngine", …)` in `app/tests/modules/training/exercises/checkout-sequence.engine.module.test.ts`:

```ts
  it("undo of an attempt's closing dart restores the outshot and reopens the visit", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    [T15, D8].forEach((o) => engine.record(o));
    expect(engine.state().currentOutshot).toBe(62);
    engine.undo();
    expect(engine.state()).toMatchObject({
      currentOutshot: 61,
      remaining: 16,
      dartsInVisit: 1,
      points: 0,
      checkouts: 0,
    });
    engine.record(D8);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state()).toMatchObject({
      currentOutshot: 62,
      points: 3,
      checkouts: 1,
    });
  });
```

Run: `cd app && npx vitest run tests/modules/training/exercises/checkout-sequence.engine.module.test.ts -t "undo of an attempt"`
Expected: PASS against the legacy-shaped engine (behaviour pin for a refactor; it must stay green after Step 3).

- [ ] **Step 3: Rewrite the engine**

`app/src/modules/training/exercises/checkout-sequence.engine.module.ts` (whole file):

```ts
import type { CheckoutSequenceConfigData } from "@lib/types";
import { CheckoutSequenceV1Config } from "@lib/training/exercises/rulesets/types";
import type { CheckoutSeat, EngineFacts, VisitVerdict } from "@modules/types";
import type { CheckoutRules, DartExerciseSpec } from "@modules/interfaces";
import {
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import {
  consecutiveTargets,
  dartWalkJudge,
} from "@modules/game/checkout-policies";
import { NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { CheckoutSequenceState } from "./types";

const DARTS_PER_VISIT = 3;
/** Outshots no two darts can finish, so three darts earn the top score. */
const THREE_DART_MINIMUM_OUTSHOTS: ReadonlySet<number> = new Set([99]);

type CheckoutSequenceExt = { points: number; lastAttemptPoints: number | null };

/** Points one checked-out attempt earns by darts used. */
function attemptPoints(outshot: number, dartsUsed: number): number {
  if (dartsUsed <= 2) return 3;
  if (dartsUsed === 3) return THREE_DART_MINIMUM_OUTSHOTS.has(outshot) ? 3 : 2;
  return 1;
}

/** Books an attempt's points: by darts used on a checkout, 0 on a fail. */
function bookPoints(
  seat: CheckoutSeat<CheckoutSequenceExt>,
  passed: boolean,
  verdict: VisitVerdict,
): CheckoutSeat<CheckoutSequenceExt> {
  const earned =
    passed && verdict.kind === "CHECKOUT"
      ? attemptPoints(
          seat.target,
          DARTS_PER_VISIT * seat.visitIndex + verdict.darts,
        )
      : 0;
  return {
    ...seat,
    ext: { points: seat.ext.points + earned, lastAttemptPoints: earned },
  };
}

function rules(
  config: CheckoutSequenceConfigData,
): CheckoutRules<CheckoutSequenceExt> {
  return {
    visitsPerAttempt: config.dartLimit / DARTS_PER_VISIT,
    judge: dartWalkJudge,
    onAttemptClose: bookPoints,
    nextTarget: consecutiveTargets(config.lastOutshot),
  };
}

/**
 * Folds the whole fact log into Checkout Sequence state through the
 * Checkout kernel — a pure function of `facts`/`config`/`expired`. A visit
 * closes on a checkout, a bust or its third dart. Complete once the timer
 * expired or the last outshot has been attempted.
 */
function fold(
  facts: EngineFacts,
  config: CheckoutSequenceConfigData,
  expired: boolean,
): CheckoutSequenceState {
  const seat = foldCheckoutVisits(
    facts.turns,
    initialCheckoutSeat(config.firstOutshot, {
      points: 0,
      lastAttemptPoints: null,
    }),
    rules(config),
  );
  const done = seat.status === "DONE";
  return {
    currentOutshot: done ? null : seat.target,
    remaining: done ? 0 : seat.remaining,
    attemptDart: DARTS_PER_VISIT * seat.visitIndex + seat.dartsInVisit,
    points: seat.ext.points,
    checkouts: seat.checkouts,
    attempts: seat.attempts,
    lastAttemptPoints: seat.ext.lastAttemptPoints,
    dartsInVisit: seat.dartsInVisit,
    dartsThrown: facts.turns.reduce((sum, turn) => sum + turn.darts.length, 0),
    status: expired || done ? "COMPLETE" : "IN_PROGRESS",
  };
}

const checkoutSequenceSpec: DartExerciseSpec<
  CheckoutSequenceConfigData,
  CheckoutSequenceState
> = {
  exerciseRulesetVersionKey: "CHECKOUT_SEQUENCE_V1",
  parse: (config) => CheckoutSequenceV1Config.parse(config),
  fold,
  intent: () => NO_INTENT,
  isVisitOpen: (_turn, state) => state.dartsInVisit > 0,
  ends: (state) => state.status === "COMPLETE",
};

export const foldCheckoutSequenceState = checkoutSequenceSpec.fold;

/**
 * Checkout Sequence ("Catch 40"): check out 61, then 62, … up to 100, each
 * within six darts, X01 double-out
 * (`docs/game-rules/training/exercises/catch-40.md`), on the Checkout
 * kernel and the exercise shell. One `TurnFact` is one visit; free aim.
 */
export class CheckoutSequenceEngine extends dartExerciseEngineClass(
  checkoutSequenceSpec,
) {}

export const checkoutSequenceEngineFactory = registerDartExercise(
  checkoutSequenceSpec,
  CheckoutSequenceEngine,
).factory;
```

- [ ] **Step 4: Run gate, oracle, goldens, engine tests and dependants**

```bash
cd /home/user/dart-analytics && bash scripts/check-engine-kernels.sh
mkdir -p .superpowers && cd app && npx vitest run tests/modules/training tests/modules/stats tests/lib/stats tests/lib/training tests/modules/game/checkout-kernel.module.test.ts tests/modules/game/checkout-policies.test.ts > ../.superpowers/cs-task5.log 2>&1; tail -8 ../.superpowers/cs-task5.log
```

Expected: gate `OK: engine kernels`; vitest all passed — oracle 3/3, goldens 3/3 with **no** snapshot written or updated, `checkout-sequence.engine.module.test.ts` unchanged and green.

If the oracle diverges: use superpowers:systematic-debugging; the `where` line names seed and step. Never edit the legacy file or the snapshots to match.

- [ ] **Step 5: Type check**

Run: `cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/exercises/checkout-sequence.engine.module.ts scripts/engine-kernels.txt \
  app/tests/modules/training/exercises/checkout-sequence.engine.module.test.ts
git commit -m "refactor(checkout-sequence): bind to the checkout kernel and the exercise shell"
```

---

### Task 6: Drop the legacy copy

**Files:**
- Delete: `app/tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts`
- Delete: `app/tests/modules/training/exercises/checkout-sequence.oracle.test.ts`

The guarantee is re-pointed at the goldens recorded in Task 1, never dropped (Hard Invariants).

- [ ] **Step 1: Delete and re-run the goldens**

```bash
cd /home/user/dart-analytics
git rm app/tests/modules/training/exercises/legacy/checkout-sequence.legacy.ts \
  app/tests/modules/training/exercises/checkout-sequence.oracle.test.ts
rmdir app/tests/modules/training/exercises/legacy 2>/dev/null || true
cd app && npx vitest run tests/modules/training/exercises/checkout-sequence.golden.test.ts
```

Expected: 3 passed, no snapshot changes.

- [ ] **Step 2: Commit**

```bash
cd /home/user/dart-analytics
git commit -m "test(checkout-sequence): drop legacy copy; goldens hold the guarantee"
```

---

### Task 7: Docs, decision, registry reason

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (version line 10; Checkout row ~line 831)
- Modify: `app/src/modules/game/CLAUDE.md` (append bullet under "Game engines")
- Modify: `app/src/modules/training/CLAUDE.md` (line 12 bullet)
- Modify: `docs/architecture/00-File-Inventory.md` (two rows after line 220)
- Modify: `docs/architecture/00-Context-Map-History.md` (append row)
- Modify: `decisions/game-engine.md` (append D-block)
- Modify: `scripts/engine-kernels.txt` (Bullseye Checkout reason)
- Modify: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` §3 (refinement bullet)

- [ ] **Step 1: Derive the decision id**

Run: `bash scripts/next-decision-id.sh` → use the printed id (D500 at plan time) below as `<ID>`.

- [ ] **Step 2: Apply the edits**

Pattern 18 version line: prepend `1.11.15 (Pattern 18: Checkout kernel built, Checkout Sequence bound through `foldCheckoutVisits` on the exercise shell; an exercise spec's `isVisitOpen` sees the folded state 2026-10-27, <ID>; prior 1.11.14: ` and keep the rest.

Pattern 18 Checkout row:

```
| `CHECKOUT` | finish a target score under bust rules; attempt budget; ladder moves | `modules/game/checkout-kernel.module.ts` (policies: `checkout-policies.ts`) | built — Checkout Sequence bound through `foldCheckoutVisits` (<ID>, 2026-10-27); Random Checkout, Ten Up One Down and 121 pending, in that order |
```

`app/src/modules/game/CLAUDE.md`, append:

```
- A Checkout engine is a `CheckoutRules` record over `checkout-kernel.module.ts` (`applyCheckoutVisit`, `foldCheckoutVisits`) and `checkout-policies.ts`: the ruleset judges each visit (`judge` → `VisitVerdict`), books a closed attempt (`onAttemptClose`) and names the next target (`nextTarget`, `null` ends the seat); a projection keeps its `state()` shape. A policy lands with its first caller. (2026-10-27, <ID>)
```

`app/src/modules/training/CLAUDE.md` line 12, append: ` A spec's `isVisitOpen(turn, state)` also sees the folded state; Checkout Sequence folds through the Checkout kernel's `foldCheckoutVisits` (2026-10-27, <ID>).`

`00-File-Inventory.md`, after the `track-policies.ts` row:

```
| `app/src/modules/game/checkout-kernel.module.ts` | Checkout rule kernel: `initialCheckoutSeat`, `applyCheckoutVisit`, `foldCheckoutVisits` over judged visits (<ID>, 2026-10-27) | canonical |
| `app/src/modules/game/checkout-policies.ts` | Checkout policies: `dartWalkJudge`, `consecutiveTargets` (Checkout Sequence, <ID>, 2026-10-27) | canonical |
```

`00-Context-Map-History.md`, append a row in the same column shape as the last Track rows:

```
| `checkout-kernel.module.ts`, `checkout-policies.ts` (new), `checkout-sequence.engine.module.ts`, `dart-exercise-shell.module.ts`, `training/exercises/interfaces.ts`, `turn-log.module.ts`, `modules/game/{types,interfaces}.ts`, their tests, `checkout-sequence.golden.test.ts`, `support/checkout-observations.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (1.11.15), `modules/{game,training}/CLAUDE.md`, `00-File-Inventory.md`, `decisions/game-engine.md` (<ID>) | Checkout kernel built; Checkout Sequence bound to it and moved onto the exercise shell (goldens recorded pre-rebind, oracle); exercise `isVisitOpen` sees the folded state. Checkout PR 1 (2026-10-27) | historical |
```

`decisions/game-engine.md`, append:

```
### <ID> — The Checkout kernel folds judged visits; its engines migrate simplest first
Status: Accepted · Date: 2026-10-27
Decision: `checkout-kernel.module.ts` folds a `CheckoutSeat` over visits a ruleset has already judged: `CheckoutRules` names `judge` (turn → `VisitVerdict`), `visitsPerAttempt`, `onAttemptClose` and `nextTarget` (`null` ends the seat). The kernel never applies a bust rule itself; record-time rules that settle a turn stay in the engine. The shipped Checkout engines migrate Checkout Sequence → Random Checkout → Ten Up One Down → 121, reversing the umbrella order, because the two exercises fit the existing exercise shell and the two games each need a shell extension (visit-total input; a stage per attempt). Checkout Sequence lands first and moves onto the exercise shell, whose `isVisitOpen` now sees the folded state.
Reason: the four engines share one attempt loop but judge visits from different facts (darts vs a settled `totalScore`), so judging is the ruleset's policy and the loop is the kernel; simplest first keeps each shell change in the PR of the first engine that needs it (D468 method).
Consequences: Checkout Sequence's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Bullseye Checkout stays `PENDING`. Spec: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md`.
Supersedes: none.
```

`scripts/engine-kernels.txt` Bullseye Checkout row reason → `re-checked when its exercise shell is next touched (Checkout spec C6)`.

Spec §3, append after the "Fallow" bullet:

```
- **Refined by the PR 1 plan (2026-10-27):** `target` + target-setting in `onAttemptClose` become `nextTarget(seat, passed) → number | null` (null ⇒ `DONE`), the first target passed to `initialCheckoutSeat`; `VisitVerdict` gains `OPEN { remaining, darts }`, `FAIL` lands in PR 2 and `WON` in PR 4; `CheckoutSeat` carries `visitStart`/`dartsInVisit` and gains seat identity with `foldCheckoutSeats` in PR 3; the exercise shell's `isVisitOpen` sees the folded state; `NO_INTENT` exported from `turn-log.module.ts`.
```

- [ ] **Step 3: Gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-decision-ids.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-rules.sh
```

Expected: all OK.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md app/src/modules/game/CLAUDE.md \
  app/src/modules/training/CLAUDE.md docs/architecture/00-File-Inventory.md \
  docs/architecture/00-Context-Map-History.md decisions/game-engine.md \
  scripts/engine-kernels.txt docs/superpowers/specs/2026-10-27-checkout-kernel-design.md
git commit -m "docs: checkout kernel built; Checkout Sequence bound (<ID>)"
```

---

### Task 8: Full verification and PR

- [ ] **Step 1:** `cd app && npm run format && npm run format:check` — commit any formatting diff.
- [ ] **Step 2:** Run the `run-all-gates` skill (Always + app sets), including `npm run validate:app` (fallow duplication must not rise; dead code clean). Report each script's result.
- [ ] **Step 3:** `bash scripts/next-decision-id.sh` again; if `<ID>` moved, `bash scripts/renumber-decision.sh <old> <new>`.
- [ ] **Step 4:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push, open PR against `main` once `docs/checkout-kernel-spec` has merged (else against it), subscribe to PR activity.
