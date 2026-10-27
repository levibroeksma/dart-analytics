# Checkout Kernel PR 3 — Ten Up One Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Ten Up One Down (TUOD) onto the Checkout kernel and the game shell (`dart-engine-shell.module.ts`), with no behaviour change, deleting its hand-written class.

**Architecture:** The kernel gains `foldCheckoutSeats` (every seat over its own turns). `checkout-policies.ts` gains `storedTotalJudge` (an open turn is `OPEN`, a closed turn judged by its stored `totalScore`) and `ladderTarget` (the `nextTarget` ladder). The game shell gains additive, optional spec hooks so a per-dart-or-visit-total engine fits: `visitInput`, `totalOnClose`, `complete`, and extra arguments to `isVisitOpen`, `wouldComplete` and `closedVisitTotal`. TUOD becomes a `DartGameSpec`; the record-time rules (last-dart bust, success needs a double, the keypad guards) stay in the engine as spec functions. Proof as PR 1/2: legacy copy + differential oracle (extended to mixed input), goldens recorded before the rebind, then legacy deleted.

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (PR 3 row, §6, §8). Prior plans: `…-checkout-kernel-pr1.md` (#1113), `…-checkout-kernel-pr2.md` (#1115), both merged.

## Global Constraints

- No behaviour change: `state()`, `facts()` (open-turn `totalScore` included), thrown messages, `TuodState`/`TuodSeatState` shape, and the exports `foldTuodState`, `applyTuodAttempt`, `initialTuodState`, `TuodEngine`, `tuodEngineFactory` identical in signature and result.
- `TuodEngine` stays an exported class registered under `TUOD_V1` (`tuod-play.data.ts`, `session-context`, `session-progress`, `replay-fold`, `checkout-visits` name it).
- Persistence unchanged: `EXERCISE_BLOCK` stage `block-1`; one `turns` row per attempt, one `darts` row per dart, none for a keypad total; `QUICK_SCORE` keypad total (`TuodAttemptInput`) or per-dart `DETAILED_DARTS`/`VISUAL_BOARD`; free aim (no intent); no new fact columns.
- Reuse `resolveCheckoutAttempt`, `checkoutDartsRejection`, `activeSeat`, `completedByIndex`, `durationSeatComplete`, `otherSeatsComplete`, `scoreCompareOutcome`, `openVisit`, `appendCompletedTurn`, `undoLastUnit`; never re-declare a walk.
- Shell changes are additive and optional: every bound engine's goldens and oracle (Track, Shanghai, Baseball, exercises) re-run unchanged, no snapshot touched.
- A policy lands only with its first caller (fallow dead-code gate); fallow duplication must not rise.
- `modules/game/**` never imports `modules/training/**`.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations only, no decision history in doc comments.
- Exported types live in `types.ts`/`interfaces.ts`, imported through `@modules/types` / `@modules/interfaces` (`check-type-barrels.sh`, also in pre-commit — the legacy copy too).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs 14 gates; run slow commits in the background and poll.
- Branch: `feat/checkout-kernel-tuod`, cut from `origin/main`. One PR to `main` carrying this plan and the implementation.
- No new decision entry: PR 3 executes D500.

## Refinements to the spec (rulings made while planning)

Recorded in the spec §3/§6 in Task 6.

- **Seat identity stays outside `CheckoutSeat`.** `foldCheckoutSeats(turns, seats, initial, rules)` returns seats positionally aligned with `seats`, as `foldTrackSeats` effectively does; the engine projection adds `participantRef`/`sideKey` from `config.seats[i]`. No field is added to `CheckoutSeat`.
- **`ladderStep` is `ladderTarget(up, down, floor, cap)`, a `nextTarget` policy**, not an `onAttemptClose` one (PR 1 moved target-setting to `nextTarget`). TUOD's `onAttemptClose` is the identity; `successes`/`failures` are `checkouts` and `attempts − checkouts`. 121's `WON` cap lands in PR 4.
- **`storedTotalJudge` for TUOD:** open turn → `OPEN { remaining: visitStart − sum(darts), darts }`; closed with `totalScore > 0` → `CHECKOUT`; closed with `0` → `FAIL` (one visit per attempt, so a bust and an out-of-darts visit both fail the attempt). 121's `finishedOnDouble` and `BUST`/`SPENT` split arrive in PR 4 with its first caller.
- **Shell gaps wider than spec §6.** Beyond `visitInput`: `isVisitOpen(turn, state, config)` (TUOD's dart budget is `config.maxDartsPerTurn`, 1–3); `wouldComplete(state, input, config, open)` (the prior dart count of the open turn is not in state); `closedVisitTotal(opened, closed, ref, turn)` (the settled total needs the turn's darts); `totalOnClose` (legacy keeps an open turn's `totalScore` at 0 until it settles — `facts()` would otherwise differ); `complete(state, config)` (a solo run's `isComplete()` is attempt-count based while `status` stays `IN_PROGRESS`). `undo()` uses `undoLastUnit` when `visitInput` is declared.
- **Quirks preserved, filed in Task 7 as `discovered-work`, never fixed:** (a) an open turn's `totalScore` reads 0 after `record` but the dart sum after an `undo` reopens it; (b) a solo session accepts darts and keypad totals after `isComplete()` is true (only a 1v1 match refuses).

## Review Focus

1. Mixed input in one log: a keypad total while a board visit is open (refused with the legacy message), a board dart straight after a keypad total (opens a new turn), undo across both shapes. Pinned by oracle `tuodInputs` (visit rate 0.25) and golden trace (Task 1, 4).
2. 1v1 ROUNDS: `isMatchDecided` refusal, `wouldComplete` true only on the last seat's last attempt, undo from a decided match. Pinned by oracle 2-seat cases, engine tests, golden.
3. Last-dart bust (`finishableWithOneDart`) with `maxDartsPerTurn` 1, 2 and 3: remainder 2 darts out, odd remainder with one dart left. Pinned by oracle configs with `maxDartsPerTurn` 1/2/3.
4. Ladder clamps: target climbing past 170 and falling below 2. Pinned by oracle config (`startingTarget` 170, `finishBonus` 40; `startingTarget` 2, `missPenalty` 30) and a ladder policy test (Task 3).
5. Solo MINUTES: `expireTimer()` mid-attempt, `resumeExpired` rehydration, `isComplete()` from attempt count. Pinned by oracle `expireAt` + `resumeExpired` and the existing engine tests.
6. Open-turn overlay: `remainingInAttempt = currentTarget − sum(darts)` on the owning seat only, `currentTarget` held. Pinned by oracle `state()` equality after every step and the existing #202 engine test.

---

### Task 1: Branch, plan, freeze — oracle input generics, legacy copy, oracle, goldens

**Files:**
- Create: `docs/superpowers/plans/2026-10-27-checkout-kernel-pr3.md` (this file, committed)
- Modify: `app/tests/modules/game/support/engine-oracle.ts` (input generic)
- Modify: `app/tests/modules/game/support/checkout-observations.ts` (export `finishingShot`; add `tuodInputs`)
- Create: `app/tests/modules/game/legacy/tuod.legacy.ts`
- Create: `app/tests/modules/game/tuod.oracle.test.ts`
- Create: `app/tests/modules/game/tuod.golden.test.ts` (+ its `__snapshots__` file)

**Interfaces:**
- Consumes: existing `runOracle`, `goldenTrace`, `randomObservation`, `normalise`.
- Produces: `OracleEngine<TInput = DartObservation>`, `runOracle<TInput>` / `goldenTrace<TInput>` taking `TInput`-typed `observe` (plus optional `describe` for trace labels); `finishingShot(remaining)`; `tuodInputs(visitRate, towardRate)`; `LegacyTuodEngine`.

- [ ] **Step 1: Branch and commit the plan**

```bash
cd /home/user/dart-analytics
git fetch origin main
git checkout -b feat/checkout-kernel-tuod origin/main
git add docs/superpowers/plans/2026-10-27-checkout-kernel-pr3.md
git commit -m "docs(plan): checkout kernel PR 3 — Ten Up One Down"
```

- [ ] **Step 2: Make the oracle input-generic**

In `app/tests/modules/game/support/engine-oracle.ts` apply these edits (defaults keep every existing caller and snapshot unchanged):

- `export type OracleEngine = {` → `export type OracleEngine<TInput = DartObservation> = {`; its `record(o: DartObservation): unknown;` → `record(o: TInput): unknown;`; its `wouldComplete?(o: DartObservation): boolean;` → `wouldComplete?(o: TInput): boolean;`.
- `type Observe = (rand: () => number, engine: OracleEngine) => DartObservation;` → `type Observe<TInput> = (rand: () => number, engine: OracleEngine<TInput>) => TInput;`.
- `type OracleOptions = {` → `type OracleOptions<TInput> = {`; inside it `build`/`legacy` return `OracleEngine<TInput>`; `observe?: Observe<TInput>;`.
- `type Pair = { next: OracleEngine; old: OracleEngine };` → `type Pair<TInput> = { next: OracleEngine<TInput>; old: OracleEngine<TInput> };`.
- `compare`, `throwDart`, `act`, `rehydrate`, `runOracle` take/return `Pair<TInput>` / `OracleOptions<TInput>` with `TInput` as a function type parameter; `throwDart(pair, o: TInput, where)`.
- In `act` and `traceStep` the default observer is `randomObservation`, which is only valid for the default input: write `(opts.observe ?? (randomObservation as unknown as Observe<TInput>))(rand, pair.old)`.
- `runOracle` → `export function runOracle<TInput = DartObservation>(opts: OracleOptions<TInput>): void`.
- `type TraceOptions = {` → `type TraceOptions<TInput> = {` with `build: (prior?) => OracleEngine<TInput>`, `observe?: Observe<TInput>`, and a new `describe?: (input: TInput) => string;`.
- `traceStep` becomes generic; its label line becomes ``return `record ${(opts.describe ?? describeObservation)(o)} would=${would} -> ${recorded}`;`` with, above it:

```ts
function describeObservation(o: unknown): string {
  const observation = o as DartObservation;
  return `${observation.hitZoneKey}/${observation.hitTargetNumber}`;
}
```

- `goldenTrace` → `export function goldenTrace<TInput = DartObservation>(opts: TraceOptions<TInput>): unknown`.

Run: `cd app && npx vitest run tests/modules/game tests/modules/training` — Expected: all existing oracle/golden tests pass with **no** snapshot change; then `npx astro check --minimumFailingSeverity hint 2>&1 | tail -3` — Expected: 0 / 0 / 0.

- [ ] **Step 3: Add the TUOD input generator**

In `app/tests/modules/game/support/checkout-observations.ts`: change `function finishingShot` to `export function finishingShot`; add imports `import type { DartObservation, TuodAttemptInput, TuodInput, TuodState } from "@modules/types";` (extend the existing type import) and append:

```ts
function randomAttempt(rand: () => number): TuodAttemptInput {
  const count = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  const atDouble = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  return {
    checkedOut: rand() < 0.5,
    dartsUsed: count,
    dartsAtDouble: atDouble,
    finishedOnDouble: rand() < 0.7,
  };
}

/**
 * Mixes the two TUOD input shapes in one log: with probability `visitRate` a
 * keypad total (valid and invalid alike, so every refusal fires), otherwise a
 * board dart — towards the active seat's live remainder with probability
 * `towardRate`, else random.
 */
export function tuodInputs(visitRate: number, towardRate: number) {
  return (rand: () => number, engine: OracleEngine<TuodInput>): TuodInput => {
    if (rand() < visitRate) return randomAttempt(rand);
    const state = engine.state() as TuodState;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    if (rand() >= towardRate || seat.remainingInAttempt <= 1)
      return randomObservation(rand);
    return finishingShot(seat.remainingInAttempt);
  };
}
```

(`OracleEngine` is already imported there; if `DartCount` makes the `1 | 2 | 3` casts a type error, import and use `DartCount` instead.)

- [ ] **Step 4: Copy the engine as legacy**

The header is rewritten so every type import goes through the barrels (pre-commit `check-type-barrels.sh`); the body is copied verbatim from the first `const MIN_FINISHABLE_TARGET` doc comment up to, not including, `export const tuodEngineFactory`, with the factory and registration dropped.

```bash
cd /home/user/dart-analytics/app
mkdir -p tests/modules/game/legacy
SRC=src/modules/game/tuod.engine.module.ts
OUT=tests/modules/game/legacy/tuod.legacy.ts
cat > "$OUT" <<'EOF'
import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { checkoutDartsRejection } from "@modules/game/checkout-darts.module";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import {
  appendCompletedTurn,
  appendResolvedDart,
  cloneTurns,
  isDartObservationInput,
  openOrCreateTurn,
  openVisit,
  resolveObservation,
  sumDartScores,
  turnsBeforeVisit,
  undoLastUnit,
} from "@modules/game/turn-log.module";
import { activeSeat } from "@modules/game/seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "@modules/game/seat-state.module";
import { scoreCompareOutcome } from "@modules/game/match-outcome.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TuodInput,
  TuodSeatState,
  TuodState,
  TurnFact,
} from "@modules/types";

EOF
sed -n '/^\/\*\*$/,$p' "$SRC" \
  | sed -n '/The ladder floor/,$p' \
  | sed '1i /**' \
  | sed '/^export const tuodEngineFactory/,$d' \
  | sed 's#export class TuodEngine#export class LegacyTuodEngine#; s#^export function foldTuodState#function foldLegacyTuodState#; s#foldTuodState(#foldLegacyTuodState(#g; s#^export function applyTuodAttempt#function applyLegacyTuodAttempt#; s#applyTuodAttempt(#applyLegacyTuodAttempt(#g; s#^export function initialTuodState#function initialLegacyTuodState#' >> "$OUT"
npx prettier --write "$OUT" >/dev/null
grep -c "registerEngineFactory\|tuodEngineFactory" "$OUT"; grep -n "^export" "$OUT"
```

Expected: grep count `0`; the only export is `export class LegacyTuodEngine`. Run `npx astro check --minimumFailingSeverity hint 2>&1 | tail -3` — Expected 0/0/0 (an unused legacy helper such as `initialLegacyTuodState` would fail it: delete it from the copy if flagged, it is test-only).

- [ ] **Step 5: Write the oracle test**

`app/tests/modules/game/tuod.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { TuodEngine } from "@modules/game/tuod.engine.module";
import { LegacyTuodEngine } from "./legacy/tuod.legacy";
import { runOracle } from "./support/engine-oracle";
import { tuodInputs } from "./support/checkout-observations";
import type { TuodSnapshot, Seated } from "@lib/types";
import type { TuodInput } from "@modules/types";

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!));

const base = (n: number, over: Partial<TuodSnapshot>): Seated<TuodSnapshot> => ({
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  ...over,
  seats: seats(n),
});

const CASES: Record<
  string,
  { config: Seated<TuodSnapshot>; steps: number; expireAt?: number }
> = {
  "solo rounds": { config: base(1, {}), steps: 260 },
  "duel rounds": { config: base(2, {}), steps: 320 },
  "duel rounds, two darts": {
    config: base(2, { maxDartsPerTurn: 2 }),
    steps: 320,
  },
  "solo rounds, one dart": {
    config: base(1, { maxDartsPerTurn: 1, durationValue: 12 }),
    steps: 260,
  },
  "solo, climbs past the ceiling": {
    config: base(1, { startingTarget: 170, finishBonus: 40, durationValue: 20 }),
    steps: 300,
  },
  "solo, falls past the floor": {
    config: base(1, { startingTarget: 2, missPenalty: 30, durationValue: 20 }),
    steps: 300,
  },
  "solo minutes, expired": {
    config: base(1, { durationType: "MINUTES", durationValue: 10 }),
    steps: 260,
    expireAt: 180,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Ten Up One Down — kernel vs legacy oracle", () => {
  for (const [name, c] of Object.entries(CASES)) {
    for (const [mix, visitRate, towardRate] of [
      ["boards and keypad", 0.25, 0.6],
      ["boards mostly", 0.04, 0.8],
    ] as const) {
      it(`${name}, ${mix}: indistinguishable through every public method`, () => {
        runOracle<TuodInput>({
          build: (prior) => new TuodEngine(c.config, prior),
          legacy: (prior) => new LegacyTuodEngine(c.config, prior),
          seeds: SEEDS,
          steps: c.steps,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: tuodInputs(visitRate, towardRate),
        });
      }, 60_000);
    }
  }
});
```

- [ ] **Step 6: Run the oracle against the current engine**

Run: `cd app && npx vitest run tests/modules/game/tuod.oracle.test.ts`
Expected: 14 passed (both sides are the same code today). Reach of the rare paths is proved by Step 8's greps.

- [ ] **Step 7: Write the golden tests**

`app/tests/modules/game/tuod.golden.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TuodEngine } from "@modules/game/tuod.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { tuodInputs } from "./support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { TuodSnapshot, Seated } from "@lib/types";
import type { TuodInput } from "@modules/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});

const config = (
  n: number,
  over: Partial<TuodSnapshot> = {},
): Seated<TuodSnapshot> => ({
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  ...over,
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const describeInput = (input: TuodInput): string =>
  "hitZoneKey" in input
    ? `dart ${input.hitZoneKey}/${input.hitTargetNumber}`
    : `total ${JSON.stringify(input)}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Ten Up One Down — golden", () => {
  it("duel, 400 mixed steps is unchanged", () => {
    const engine = new TuodEngine(config(2, { durationValue: 25 }));
    const rand = seededUniform(42, 0);
    const observe = tuodInputs(0.25, 0.7);
    for (let step = 0; step < 400; step++) {
      if (rand() < 0.08) engine.undo();
      else {
        try {
          engine.record(observe(rand, engine));
        } catch {
          continue;
        }
      }
    }
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Ten Up One Down — golden trace", () => {
  const CASES: [string, Seated<TuodSnapshot>, number?][] = [
    ["solo rounds", config(1), undefined],
    ["duel rounds", config(2), undefined],
    ["solo minutes", config(1, { durationType: "MINUTES", durationValue: 10 }), 150],
  ];
  for (const [name, cfg, expireAt] of CASES) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace<TuodInput>({
          build: (prior) => new TuodEngine(cfg, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: expireAt !== undefined,
          observe: tuodInputs(0.25, 0.7),
          describe: describeInput,
        }),
      ).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 8: Record the goldens against the current engine**

Run: `cd app && npx vitest run -u tests/modules/game/tuod.golden.test.ts`
Expected: 4 passed, 4 snapshots written. Reach proof (each must be ≥ 1):

```bash
S=tests/modules/game/__snapshots__/tuod.golden.test.ts.snap
for p in 'dart ' 'total ' 'throws Finish the open attempt' 'throws Cannot record an attempt once the session is complete' 'undo true' 'would=true'; do printf '%s: ' "$p"; grep -c "$p" $S; done
```

If one prints `0`, adjust the rates or seeds in Step 7 (not the legacy copy), re-run `-u`, and re-check.

- [ ] **Step 9: Commit**

```bash
cd /home/user/dart-analytics
git add app/tests/modules/game/support app/tests/modules/game/legacy/tuod.legacy.ts \
  app/tests/modules/game/tuod.oracle.test.ts app/tests/modules/game/tuod.golden.test.ts \
  app/tests/modules/game/__snapshots__/tuod.golden.test.ts.snap
git commit -m "test(tuod): freeze legacy engine, oracle with mixed input, goldens"
```

---

### Task 2: Shell — optional hooks for visit-total input and TUOD's close rules

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec`, `ShellGameEngine`, `DartGameEngineClass`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts`
- Modify: `app/tests/modules/game/dart-engine-shell.module.test.ts`

**Interfaces:**
- Consumes: `openVisit`, `appendCompletedTurn`, `undoLastUnit` (`turn-log.module.ts`).
- Produces (all optional on a spec; existing specs compile unchanged):
  - `DartGameSpec<TConfig, TState, TVisit = never>`; `isVisitOpen(turn, state, config)`; `wouldComplete(state, input: DartObservation | TVisit, config, open: TurnFact | null)`; `closedVisitTotal?(opened, closed, participantRef, turn, config)`.
  - `visitInput?: { isVisit(input: DartObservation | TVisit): input is TVisit; refusal(state, input, config, open): string | null; total(state, input): number }`.
  - `totalOnClose?: boolean`; `complete?(state, config): boolean`.
  - `ShellGameEngine<TConfig, TState, TInput = DartObservation>`, `DartGameEngineClass<TConfig, TState, TInput = DartObservation>`; `dartGameEngineClass<TConfig, TState, TVisit = never>` returns a class whose engines take `DartObservation | TVisit`; `dartGameEngineFactory` likewise.

- [ ] **Step 1: Write the failing shell tests**

Append to `app/tests/modules/game/dart-engine-shell.module.test.ts` (reuse its `T20`, imports; add `appendCompletedTurn` is not needed):

```ts
type Keypad = { total: number };

type Pad = Toy & { open: boolean };

const padSpec: DartGameSpec<{ limit: number }, Pad, Keypad> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts, config) => {
    const turns = facts.turns.length;
    return {
      activeParticipantRef: "p1",
      status: turns >= config.limit ? "COMPLETE" : "IN_PROGRESS",
      darts: facts.turns.reduce((n, t) => n + t.darts.length, 0),
      open: facts.turns.at(-1)?.completedAt === null,
    };
  },
  refusal: () => null,
  intent: () => ({ intendedTargetNumber: null, intendedZoneKey: null }),
  isVisitOpen: (turn, _state, config) =>
    turn.completedAt === null && turn.darts.length < config.limit,
  wouldComplete: (state, input, _config, open) =>
    "total" in input
      ? open === null
      : (open?.darts.length ?? 0) + 1 >= 2 && state.darts >= 0,
  visitInput: {
    isVisit: (input): input is Keypad => "total" in input,
    refusal: (_state, _input, _config, open) =>
      open === null ? null : "board visit open",
    total: (_state, input) => input.total,
  },
  totalOnClose: true,
  closedVisitTotal: (_opened, _closed, _ref, turn, config) =>
    turn.darts.length * 100 + config.limit * 0,
  complete: (state) => state.darts >= 4,
};

const Pad = dartGameEngineClass(padSpec);

describe("dartGameEngineClass — visit input hooks", () => {
  it("writes a keypad total as one closed dartless turn", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const engine = new Pad({ limit: 2 });
    engine.record({ total: 41 });
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0]).toMatchObject({
      darts: [],
      totalScore: 41,
      completedAt: "2026-11-01T10:00:00.000Z",
    });
  });

  it("refuses a keypad total while a dart visit is open, with the spec's message", () => {
    const engine = new Pad({ limit: 2 });
    engine.record(T20);
    expect(() => engine.record({ total: 1 })).toThrow("board visit open");
    expect(engine.facts().turns).toHaveLength(1);
  });

  it("keeps an open turn's totalScore at 0 and settles it through closedVisitTotal(…, turn)", () => {
    const engine = new Pad({ limit: 2 });
    engine.record(T20);
    expect(engine.facts().turns[0].totalScore).toBe(0);
    engine.record(T20);
    expect(engine.facts().turns[0]).toMatchObject({
      totalScore: 200,
    });
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("undo pops a whole keypad turn, then a dart", () => {
    const engine = new Pad({ limit: 5 });
    engine.record({ total: 7 });
    engine.record(T20);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.undo()).toBe(false);
  });

  it("answers wouldComplete with the open turn, for both input shapes", () => {
    const engine = new Pad({ limit: 5 });
    expect(engine.wouldComplete({ total: 1 })).toBe(true);
    engine.record(T20);
    expect(engine.wouldComplete({ total: 1 })).toBe(false);
    expect(engine.wouldComplete(T20)).toBe(true);
  });

  it("reads isComplete from the spec's complete hook when declared", () => {
    const engine = new Pad({ limit: 99 });
    engine.record(T20);
    engine.record(T20);
    engine.record(T20);
    engine.record(T20);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.isComplete()).toBe(true);
  });
});

describe("dartGameEngineClass — specs without the hooks", () => {
  it("still sums a dart visit's total while open and undoes with undoLastDart", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    expect(engine.facts().turns[0].totalScore).toBe(60);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);
  });
});
```

(The `Toy` spec's `isVisitOpen: (t) => …` and `wouldComplete: (s, _o, c) => …` already compile against the extra optional-position parameters.)

- [ ] **Step 2: Run to watch them fail**

Run: `cd app && npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`
Expected: FAIL — type errors / `record` of `{ total }` mis-handled, `visitInput` unknown. The "specs without the hooks" test passes already.

- [ ] **Step 3: Extend the interfaces**

In `app/src/modules/game/interfaces.ts`:

```ts
/** Whole-visit input a spec accepts besides darts (a keypad total). */
export interface DartGameVisitInput<TConfig, TState extends ShellState, TVisit> {
  isVisit(input: DartObservation | TVisit): input is TVisit;
  /** Why the visit is refused now, or `null`; `open` is the turn still taking darts. */
  refusal(
    state: TState,
    input: TVisit,
    config: TConfig,
    open: TurnFact | null,
  ): string | null;
  /** The `totalScore` of the one closed, dartless turn the shell writes. */
  total(state: TState, input: TVisit): number;
}

export interface DartGameSpec<
  TConfig,
  TState extends ShellState,
  TVisit = never,
> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly rulesetVersionKeys?: readonly RulesetVersionKey[];
  readonly stageOwnership: StageOwnership;
  fold(facts: EngineFacts, config: TConfig, timerExpired: boolean): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact, state: TState, config: TConfig): boolean;
  wouldComplete(
    state: TState,
    input: DartObservation | TVisit,
    config: TConfig,
    open: TurnFact | null,
  ): boolean;
  closedVisitTotal?(
    opened: TState,
    closed: TState,
    participantRef: string,
    turn: TurnFact,
    config: TConfig,
  ): number;
  /** Visit-total input; also switches `undo()` to pop a whole dartless turn. */
  readonly visitInput?: DartGameVisitInput<TConfig, TState, TVisit>;
  /** An open dart turn keeps `totalScore` 0 until `closedVisitTotal` settles it. */
  readonly totalOnClose?: boolean;
  /** Replaces the default `isComplete()` (any status but `IN_PROGRESS`). */
  complete?(state: TState, config: TConfig): boolean;
}
```

Keep the existing doc comments on the fields (merge, don't drop them). Then generalise the engine types: `ShellGameEngine<TConfig, TState extends ShellState, TInput = DartObservation> extends GameEngine<TInput, TState> { readonly spec: DartGameSpec<TConfig, TState, any>; expireTimer(): void }` — use `never`-safe form: `readonly spec: DartGameSpec<TConfig, TState, Exclude<TInput, DartObservation>>`; `DartGameEngineClass<TConfig, TState extends ShellState, TInput = DartObservation>` constructs `ShellGameEngine<TConfig, TState, TInput>`. Add `TurnFact` to the `./types` import.

- [ ] **Step 4: Implement in the shell**

In `dart-engine-shell.module.ts` (import `appendCompletedTurn`, `openVisit`, `undoLastUnit`, `DartGameEngineClass` types as needed):

- Signature: `dartGameEngineClass<TConfig, TState extends ShellState, TVisit = never>(spec: DartGameSpec<TConfig, TState, TVisit>): DartGameEngineClass<TConfig, TState, DartObservation | TVisit>`; same for `dartGameEngineFactory` (returns `GameEngineFactory<TConfig, DartObservation | TVisit, TState>`).
- Replace `record` with:

```ts
    record(input: DartObservation | TVisit): TState {
      if (spec.visitInput?.isVisit(input)) return this.recordVisit(input);
      return this.recordDart(input as DartObservation);
    }

    private recordVisit(input: TVisit): TState {
      const before = this.deriveState();
      const refusal = spec.visitInput!.refusal(
        before,
        input,
        this.config,
        openVisit(this.turns),
      );
      if (refusal !== null) throw new Error(refusal);
      appendCompletedTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        spec.visitInput!.total(before, input),
      );
      return this.deriveState();
    }

    private recordDart(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        (last) => spec.isVisitOpen(last, before, this.config),
      );
      appendObservedDart(turn, observation, spec.intent(before, this.config));
      if (spec.totalOnClose) turn.totalScore = 0;
      const after = this.deriveState();
      if (spec.isVisitOpen(turn, after, this.config)) return after;
      turn.completedAt = new Date().toISOString();
      if (spec.closedVisitTotal)
        turn.totalScore = spec.closedVisitTotal(
          this.foldTurns(turnsBeforeVisit(this.turns, turn)),
          this.deriveState(),
          turn.participantRef,
          turn,
          this.config,
        );
      return this.deriveState();
    }
```

- `undo()`: `return spec.visitInput ? undoLastUnit(this.turns) : undoLastDart(this.turns);`
- `wouldComplete(input)`: `return spec.wouldComplete(this.deriveState(), input, this.config, openVisit(this.turns));`
- `isComplete()`: `const state = this.deriveState(); return spec.complete ? spec.complete(state, this.config) : state.status !== "IN_PROGRESS";`
- Update the doc comment above `dartGameEngineClass`: add that a spec with `visitInput` writes a keypad total as one closed dartless turn and undoes whole turns; `totalOnClose` keeps an open dart turn's total at 0; `complete` replaces the default `isComplete()`.

Update the existing callers' `isVisitOpen`/`wouldComplete`/`closedVisitTotal` types only if the type check demands (extra trailing parameters are assignable; no edit expected).

- [ ] **Step 5: Run the tests, the dependants and the type check**

```bash
cd /home/user/dart-analytics/app
npx vitest run tests/modules/game tests/modules/training > ../.superpowers-shell.log 2>&1; tail -8 ../.superpowers-shell.log; rm -f ../.superpowers-shell.log
npx astro check --minimumFailingSeverity hint 2>&1 | tail -3
```

Expected: shell tests all pass (new 6 + existing); every Track/Shanghai/Baseball/exercise golden and oracle passes with **no** snapshot change; check 0 / 0 / 0.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/interfaces.ts app/src/modules/game/dart-engine-shell.module.ts \
  app/tests/modules/game/dart-engine-shell.module.test.ts
git commit -m "feat(game): shell hooks — visit-total input, close-settled totals, complete"
```

---

### Task 3: Kernel and policies — `foldCheckoutSeats`, `storedTotalJudge`, `ladderTarget`

**Files:**
- Modify: `app/src/modules/game/checkout-kernel.module.ts`
- Modify: `app/src/modules/game/checkout-policies.ts`
- Modify: `app/tests/modules/game/checkout-kernel.module.test.ts`
- Modify: `app/tests/modules/game/checkout-policies.test.ts`

**Interfaces:**
- Consumes: `applyCheckoutVisit`, `initialCheckoutSeat`, `CheckoutRules`, `CheckoutSeat`, `SeatFact`, `sumDartScores`.
- Produces:
  - `foldCheckoutSeats<TExt>(turns: readonly TurnFact[], seats: readonly SeatFact[], initial: CheckoutSeat<TExt>, rules: CheckoutRules<TExt>): CheckoutSeat<TExt>[]` — positionally aligned with `seats`; each seat folds every turn of its `participantRef` (the open one included) from `initial`.
  - `storedTotalJudge<TExt>(seat, turn): VisitVerdict`.
  - `ladderTarget(up: number, down: number, floor: number, cap: number): <TExt>(seat: CheckoutSeat<TExt>, passed: boolean) => number`.

- [ ] **Step 1: Write failing tests**

In `checkout-policies.test.ts` (extend its imports with the new names; reuse its `seatAt`/turn helpers if present, else define as below):

```ts
const turnOf = (over: Partial<TurnFact>): TurnFact => ({
  clientKey: "t",
  stageClientKey: "s",
  participantRef: "p1",
  sequence: 1,
  completedAt: "2026-11-01T10:00:00Z",
  totalScore: 0,
  darts: [],
  ...over,
});

describe("storedTotalJudge", () => {
  const seat = initialCheckoutSeat(41, null);
  const dart = (score: number) =>
    ({ score, hitZoneKey: "OUTER_SINGLE" }) as TurnFact["darts"][number];

  it("shows an unstamped turn open at the live remainder", () => {
    expect(
      storedTotalJudge(seat, turnOf({ completedAt: null, darts: [dart(20), dart(1)] })),
    ).toEqual({ kind: "OPEN", remaining: 20, darts: 2 });
  });

  it("checks out a closed turn with a positive stored total", () => {
    expect(storedTotalJudge(seat, turnOf({ totalScore: 41, darts: [dart(41)] }))).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
  });

  it("fails a closed turn stored as 0", () => {
    expect(storedTotalJudge(seat, turnOf({ totalScore: 0 }))).toEqual({ kind: "FAIL" });
  });
});

describe("ladderTarget", () => {
  const step = ladderTarget(10, 1, 2, 170);
  const at = (target: number) => ({ ...initialCheckoutSeat(target, null), target });

  it("climbs by `up` on a pass and falls by `down` on a miss", () => {
    expect(step(at(41), true)).toBe(51);
    expect(step(at(41), false)).toBe(40);
  });

  it("clamps at the cap and the floor", () => {
    expect(step(at(165), true)).toBe(170);
    expect(step(at(2), false)).toBe(2);
    expect(ladderTarget(0, 30, 2, 170)(at(10), false)).toBe(2);
  });
});
```

In `checkout-kernel.module.test.ts`:

```ts
describe("foldCheckoutSeats", () => {
  const seats = [
    { participantRef: "p1", sideKey: "A" },
    { participantRef: "p2", sideKey: "B" },
  ] as SeatFact[];
  const rules: CheckoutRules<null> = {
    visitsPerAttempt: 1,
    judge: storedTotalJudge,
    onAttemptClose: (seat) => seat,
    nextTarget: ladderTarget(10, 1, 2, 170),
  };
  const turn = (ref: string, totalScore: number, completedAt: string | null = "x") =>
    ({
      clientKey: `${ref}-${totalScore}`,
      stageClientKey: "s",
      participantRef: ref,
      sequence: 1,
      completedAt,
      totalScore,
      darts: [],
    }) as TurnFact;

  it("folds each seat over its own turns, aligned with `seats`", () => {
    const folded = foldCheckoutSeats(
      [turn("p1", 41), turn("p2", 0), turn("p1", 0), turn("p2", 0)],
      seats,
      initialCheckoutSeat(41, null),
      rules,
    );
    expect(folded.map((s) => [s.target, s.attempts, s.checkouts])).toEqual([
      [50, 2, 1],
      [39, 2, 0],
    ]);
  });

  it("shows the open turn on its own seat only, ladder untouched", () => {
    const folded = foldCheckoutSeats(
      [turn("p1", 41), turn("p2", 0, null)],
      seats,
      initialCheckoutSeat(41, null),
      rules,
    );
    expect(folded[0].target).toBe(51);
    expect(folded[1]).toMatchObject({ target: 41, attempts: 0 });
  });
});
```

(Ladder: p1 passes 41 → 51, then fails 51 → 50; p2 fails twice 41 → 40 → 39. Imports: `SeatFact` from `@lib/types`; `TurnFact`, `CheckoutRules` via the barrels.)

- [ ] **Step 2: Run to watch them fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts tests/modules/game/checkout-policies.test.ts`
Expected: FAIL — `foldCheckoutSeats`, `storedTotalJudge`, `ladderTarget` not exported.

- [ ] **Step 3: Implement**

`checkout-kernel.module.ts`: add `SeatFact` to the `@lib/types` import (type-only) and append:

```ts
/**
 * Folds every seat over its own turns in write order — the open turn
 * included, so its seat shows the live remainder. Positionally aligned with
 * `seats`; every seat starts from `initial`.
 */
export function foldCheckoutSeats<TExt>(
  turns: readonly TurnFact[],
  seats: readonly SeatFact[],
  initial: CheckoutSeat<TExt>,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt>[] {
  return seats.map((seat) =>
    foldCheckoutVisits(
      turns.filter((turn) => turn.participantRef === seat.participantRef),
      initial,
      rules,
    ),
  );
}
```

`checkout-policies.ts`: import `sumDartScores` from `./turn-log.module`, then append:

```ts
/**
 * Judges a visit from what was stored: an unstamped turn is open at the live
 * remainder (a plain subtraction, the visit's start less its darts), a
 * stamped turn with a positive `totalScore` checked out, any other failed
 * the attempt — the one-visit ruleset's settle-at-record-time rule.
 */
export function storedTotalJudge<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
): VisitVerdict {
  if (turn.completedAt === null)
    return {
      kind: "OPEN",
      remaining: seat.visitStart - sumDartScores(turn.darts),
      darts: turn.darts.length,
    };
  return turn.totalScore > 0
    ? { kind: "CHECKOUT", darts: turn.darts.length }
    : { kind: "FAIL" };
}

/** Next target on a ladder: `up` after a pass, `down` after a miss, clamped to `floor`..`cap`. */
export function ladderTarget(
  up: number,
  down: number,
  floor: number,
  cap: number,
): <TExt>(seat: CheckoutSeat<TExt>, passed: boolean) => number {
  return (seat, passed) =>
    passed
      ? Math.min(cap, seat.target + up)
      : Math.max(floor, seat.target - down);
}
```

- [ ] **Step 4: Run, then commit**

Run: `cd app && npx vitest run tests/modules/game/checkout-kernel.module.test.ts tests/modules/game/checkout-policies.test.ts` — Expected: all pass.
Fallow will flag the new exports as unused until Task 4; do not run the dead-code gate here.

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/checkout-kernel.module.ts app/src/modules/game/checkout-policies.ts \
  app/tests/modules/game/checkout-kernel.module.test.ts app/tests/modules/game/checkout-policies.test.ts
git commit -m "feat(game): checkout kernel seat fold; stored-total judge and ladder target"
```

---

### Task 4: Rebind TUOD onto the kernel and the game shell

**Files:**
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (TUOD row → `KERNEL_BOUND`)

**Interfaces:**
- Consumes: Task 2 shell hooks; Task 3 `foldCheckoutSeats`, `storedTotalJudge`, `ladderTarget`.
- Produces: unchanged exports (`foldTuodState`, `applyTuodAttempt`, `initialTuodState`, `TuodEngine`, `tuodEngineFactory`).

- [ ] **Step 1: Flip the registry and see the gate fail**

Edit the TUOD row in `scripts/engine-kernels.txt`: status `PENDING` → `KERNEL_BOUND`, reason → `Checkout kernel`. Run `bash scripts/check-engine-kernels.sh` — Expected: FAIL naming `tuod.engine.module.ts` (no `./checkout-kernel.module` import yet).

- [ ] **Step 2: Rewrite the engine file**

Replace everything in `tuod.engine.module.ts` from the `blockStage` function to the end with the shell-bound form below. Keep, verbatim, the constants `MIN_FINISHABLE_TARGET`, `MAX_FINISHABLE_TARGET`, `MAX_SINGLE_DART_DOUBLE`, `BULL_FINISH` with their doc comments, and `isTuodSuccess`, `finishableWithOneDart`, `visitOutcome` (their doc comments describe the record-time rules). Delete `blockStage`, `initialSeatState`'s old body, the class and its private helpers.

```ts
import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import {
  foldCheckoutSeats,
  initialCheckoutSeat,
} from "./checkout-kernel.module";
import { ladderTarget, storedTotalJudge } from "./checkout-policies";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import {
  isDartObservationInput,
  NO_INTENT,
  resolveObservation,
  sumDartScores,
} from "./turn-log.module";
import { activeSeat } from "./seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { CheckoutRules, DartGameSpec } from "./interfaces";
import type {
  CheckoutSeat,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  TuodAttemptInput,
  TuodSeatState,
  TuodState,
  TurnFact,
} from "./types";

const SESSION_COMPLETE =
  "Cannot record an attempt once the session is complete; undo first to correct it.";

const OPEN_VISIT_REFUSAL =
  "Finish the open attempt on the board before entering a keypad total.";

function initialSeat(config: TuodSnapshot): CheckoutSeat<null> {
  return initialCheckoutSeat(config.startingTarget, null);
}

function seatState(
  seat: CheckoutSeat<null>,
  identity: SeatFact,
): TuodSeatState {
  return {
    participantRef: identity.participantRef,
    sideKey: identity.sideKey,
    currentTarget: seat.target,
    remainingInAttempt: seat.remaining,
    attempts: seat.attempts,
    successes: seat.checkouts,
    failures: seat.attempts - seat.checkouts,
  };
}

function rules(config: TuodSnapshot): CheckoutRules<null> {
  return {
    visitsPerAttempt: 1,
    judge: storedTotalJudge,
    onAttemptClose: (seat) => seat,
    nextTarget: ladderTarget(
      config.finishBonus,
      config.missPenalty,
      MIN_FINISHABLE_TARGET,
      MAX_FINISHABLE_TARGET,
    ),
  };
}

/** The ladder as it stands before any attempt: every seat on the configured start target. */
export function initialTuodState(config: Seated<TuodSnapshot>): TuodState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) => seatState(initialSeat(config), seat)),
  };
}

/**
 * Pure reducer: folds one resolved attempt onto one seat's `TuodSeatState`. A
 * success moves the next target up by `finishBonus`; a failure moves it down
 * by `missPenalty`, floored at the double-out minimum. `remainingInAttempt`
 * resets to the new target: the attempt this closes is over, and the next
 * one starts on the ladder, never on a carried-over remainder.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodSeatState,
  succeeded: boolean,
): TuodSeatState {
  const currentTarget = rules(config).nextTarget(
    { ...initialSeat(config), target: state.currentTarget },
    succeeded,
  )!;
  return {
    ...state,
    currentTarget,
    remainingInAttempt: currentTarget,
    attempts: state.attempts + 1,
    successes: succeeded ? state.successes + 1 : state.successes,
    failures: succeeded ? state.failures : state.failures + 1,
  };
}
```

Then `foldTuodState`, keeping its existing doc comment, with the body:

```ts
export function foldTuodState(
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  timerExpired: boolean,
): TuodState {
  const seats = foldCheckoutSeats(
    facts.turns,
    config.seats,
    initialSeat(config),
    rules(config),
  ).map((seat, index) => seatState(seat, config.seats[index]));

  const completedSeats = seats.map((seat) =>
    durationSeatComplete(config, seat.attempts, timerExpired),
  );
  const outcome = scoreCompareOutcome(
    seats.map((seat, index) => ({
      sideKey: seat.sideKey,
      completed: completedSeats[index],
      metric: seat.currentTarget,
    })),
    "HIGHEST",
    "IN_PROGRESS",
  );

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      completedByIndex(seats, completedSeats),
    ).participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    timerExpired,
    seats,
  };
}
```

Then the spec and class. `activeSeatState` is `seat-state.module`'s `activeSeatState` (add to its import list):

```ts
function ownSeat(state: TuodState, participantRef: string): TuodSeatState {
  return state.seats.find((seat) => seat.participantRef === participantRef)!;
}

function matchDecided(state: TuodState): boolean {
  return state.seats.length > 1 && state.status !== "IN_PROGRESS";
}

/**
 * Whether the dart just thrown closes the visit — a checkout, a bust, or the
 * last dart — against the target the visit started on. Shared by the shell's
 * reuse and close tests, `closedVisitTotal` and `wouldComplete`, so the rule
 * is written once.
 */
function resolveVisit(
  target: number,
  darts: readonly { score: number; hitZoneKey: DartZoneKey }[],
  maxDarts: number,
): { resolved: boolean; scored: boolean } {
  const last = darts.at(-1)!;
  const { checkedOut, busted } = visitOutcome(
    target,
    darts.reduce((sum, dart) => sum + dart.score, 0),
    last.hitZoneKey,
    maxDarts - darts.length,
  );
  return {
    resolved: checkedOut || busted || darts.length === maxDarts,
    scored: checkedOut && !busted,
  };
}

function isTuodVisitOpen(
  turn: TurnFact,
  state: TuodState,
  config: Seated<TuodSnapshot>,
): boolean {
  if (turn.completedAt !== null) return false;
  if (turn.darts.length === 0) return true;
  return !resolveVisit(
    ownSeat(state, turn.participantRef).currentTarget,
    turn.darts,
    config.maxDartsPerTurn,
  ).resolved;
}

function settledTotal(
  opened: TuodState,
  _closed: TuodState,
  participantRef: string,
  turn: TurnFact,
  config: Seated<TuodSnapshot>,
): number {
  const target = ownSeat(opened, participantRef).currentTarget;
  return resolveVisit(target, turn.darts, config.maxDartsPerTurn).scored
    ? sumDartScores(turn.darts)
    : 0;
}
```

`closedVisitTotal: settledTotal` in the spec below takes `config` as its fifth argument (Task 2).

```ts
function wouldCompleteSession(
  state: TuodState,
  input: DartObservation | TuodAttemptInput,
  config: Seated<TuodSnapshot>,
  open: TurnFact | null,
): boolean {
  if (matchDecided(state)) return false;
  const seat = ownSeat(state, state.activeParticipantRef);
  if (isDartObservationInput(input)) {
    const resolved = resolveObservation(input);
    const darts = [
      ...(open?.darts ?? []),
      { score: resolved.score, hitZoneKey: resolved.zoneKey },
    ];
    const target = open
      ? ownSeat(state, open.participantRef).currentTarget
      : seat.currentTarget;
    if (!resolveVisit(target, darts, config.maxDartsPerTurn).resolved)
      return false;
  } else if (tuodVisitRefusal(state, input, config, open) !== null) {
    return false;
  }
  return (
    durationSeatComplete(config, seat.attempts + 1, state.timerExpired) &&
    otherSeatsComplete(state.seats, seat.participantRef, (other) =>
      durationSeatComplete(config, other.attempts, state.timerExpired),
    )
  );
}

function tuodVisitRefusal(
  state: TuodState,
  input: TuodAttemptInput,
  config: Seated<TuodSnapshot>,
  open: TurnFact | null,
): string | null {
  if (matchDecided(state)) return SESSION_COMPLETE;
  if (open !== null) return OPEN_VISIT_REFUSAL;
  if (!isTuodSuccess(input)) return null;
  return checkoutDartsRejection(
    ownSeat(state, state.activeParticipantRef).currentTarget,
    input.dartsUsed,
    input.dartsAtDouble,
    config.maxDartsPerTurn,
  );
}

const tuodSpec: DartGameSpec<
  Seated<TuodSnapshot>,
  TuodState,
  TuodAttemptInput
> = {
  rulesetVersionKey: "TUOD_V1",
  stageOwnership: "PER_SEAT",
  fold: foldTuodState,
  refusal: (state) => (matchDecided(state) ? SESSION_COMPLETE : null),
  intent: () => NO_INTENT,
  isVisitOpen: isTuodVisitOpen,
  wouldComplete: wouldCompleteSession,
  closedVisitTotal: settledTotal,
  visitInput: {
    isVisit: (input): input is TuodAttemptInput =>
      !isDartObservationInput(input),
    refusal: tuodVisitRefusal,
    total: (state, input) =>
      isTuodSuccess(input)
        ? ownSeat(state, state.activeParticipantRef).currentTarget
        : 0,
  },
  totalOnClose: true,
  complete: (state, config) =>
    state.seats.length === 1
      ? durationSeatComplete(config, state.seats[0].attempts, state.timerExpired)
      : state.status !== "IN_PROGRESS",
};

/**
 * Ten Up One Down: a checkout ladder per seat, starting at `startingTarget`,
 * climbing `finishBonus` on a checked-out attempt and falling `missPenalty`
 * on a failed one, played for a ROUNDS duration in 1v1 (MINUTES stays
 * solo-only). Score-compare: both seats play their own full round budget,
 * then whichever reached the higher target wins. On the Checkout kernel and
 * the game shell; a board visit or a keypad total is one attempt.
 */
export class TuodEngine extends dartGameEngineClass(tuodSpec) {}

export const tuodEngineFactory = dartGameEngineFactory(tuodSpec, TuodEngine);

registerEngineFactory(tuodEngineFactory);
```

Notes for the implementer:
- Drop the now-unused imports (`appendCompletedTurn`, `cloneTurns`, `openOrCreateTurn`, `openVisit`, `appendResolvedDart`, `turnsBeforeVisit`, `undoLastUnit`, `GameEngine`, `GameEngineFactory`, `StageFact`, `TuodInput`, `DartZoneKey` only if unused); `astro check` and fallow name each.
- `TuodEngine` must still satisfy `GameEngine<TuodInput, TuodState>` where `TuodInput = TuodAttemptInput | DartObservation` (`tuod-play.data.ts`).
- Keep `visitOutcome`/`finishableWithOneDart` doc comments; they cite the call sites `settleVisit`/`wouldCompleteDart`: reword to "the spec's close and `wouldComplete`" (doc-only).
- First dart of a reused open turn: `isTuodVisitOpen(last, before, …)` reads `ownSeat(before, last.participantRef).currentTarget`, which holds while the attempt is open — equal to the legacy `targetBeforeVisit`.

- [ ] **Step 3: Run gate, oracle, goldens, engine tests and dependants**

```bash
cd /home/user/dart-analytics && bash scripts/check-engine-kernels.sh
cd app && npx vitest run tests/modules tests/lib/game tests/lib/stats tests/lib/training > ../.tuod-task4.log 2>&1; tail -8 ../.tuod-task4.log; rm -f ../.tuod-task4.log
```

Expected: gate `OK`; oracle 14/14; TUOD goldens 4/4 with **no** snapshot written or updated; `tuod.engine.module.test.ts` (1150 lines) passes **unchanged**; `tuod-play.data`, `session-progress`, `session-context`, `replay-games` tests green; every other engine's goldens unchanged.

If the oracle diverges: superpowers:systematic-debugging; the `where` line names seed and step. The likely suspects are the open-turn `totalScore` (Task 2 `totalOnClose`), the solo `complete` hook, and the refusal order. Never edit the legacy file or the snapshots to match.

- [ ] **Step 4: Type check and dead code**

```bash
cd /home/user/dart-analytics/app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3 && npx fallow 2>&1 | tail -15
```

Expected: 0 / 0 / 0; fallow: no unused exports or dead code (Task 3's policies now have a caller), duplication not above `main`'s.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/tuod.engine.module.ts app/src/modules/game/interfaces.ts \
  app/src/modules/game/dart-engine-shell.module.ts app/tests/modules/game/dart-engine-shell.module.test.ts \
  scripts/engine-kernels.txt
git commit -m "refactor(tuod): bind to the checkout kernel and the game shell"
```

---

### Task 5: Drop the legacy copy

**Files:**
- Delete: `app/tests/modules/game/legacy/tuod.legacy.ts`
- Delete: `app/tests/modules/game/tuod.oracle.test.ts`

The guarantee is re-pointed at the goldens recorded in Task 1, never dropped (Hard Invariants). The oracle input generics and `tuodInputs` stay: the goldens and 121's PR 4 oracle use them.

- [ ] **Step 1: Delete and re-run**

```bash
cd /home/user/dart-analytics
git rm app/tests/modules/game/legacy/tuod.legacy.ts app/tests/modules/game/tuod.oracle.test.ts
rmdir app/tests/modules/game/legacy 2>/dev/null || true
cd app && npx vitest run tests/modules/game/tuod.golden.test.ts tests/modules/game/tuod.engine.module.test.ts
```

Expected: all pass, no snapshot changes.

- [ ] **Step 2: Commit**

```bash
cd /home/user/dart-analytics
git commit -m "test(tuod): drop legacy copy; goldens hold the guarantee"
```

---

### Task 6: Docs, spec refinement

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (version line 10; Checkout row)
- Modify: `app/src/modules/game/CLAUDE.md` (shell bullet line 17; Checkout bullet line 21)
- Modify: `docs/architecture/00-File-Inventory.md` (`checkout-policies.ts` row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append row)
- Modify: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (§3, §6 refinement bullets)

No decision entry (D500 covers the migration). Run `bash scripts/next-decision-id.sh` only to confirm nothing is owed.

- [ ] **Step 1: Find every mention to keep in sync**

```bash
cd /home/user/dart-analytics
grep -rn "closedVisitTotal\|foldCheckoutVisits\|Ten Up One Down.*pending\|TUOD.*pending" docs/architecture app/src/modules/*/CLAUDE.md | grep -v "^docs/superpowers" | cut -c1-160
```

Update each hit that describes the shell hooks or the Checkout family's bound set (the Pattern 18 Checkout row, the shell bullet). Leave historical rows alone.

- [ ] **Step 2: Apply the edits**

Pattern 18 version line: prepend `1.11.18 (Pattern 18: Ten Up One Down bound through `foldCheckoutSeats` on the game shell; the shell gains visit-total input, close-settled totals and a `complete` hook 2026-10-27, D500; prior 1.11.17: ` and turn the old `1.11.17 (` opener into `1.11.17: `, matching earlier `prior` entries.

Pattern 18 Checkout row: status → `built — Checkout Sequence, Random Checkout and Ten Up One Down bound (D500, 2026-10-27); 121 pending`.

`app/src/modules/game/CLAUDE.md` shell bullet (line 17): after the `closedVisitTotal(opened, closed, participantRef)` sentence, replace it with: "A spec's optional `closedVisitTotal(opened, closed, participantRef, turn, config)` sets a closing visit's `totalScore` (Shanghai, 2026-10-17); `visitInput` lets a spec take a whole-visit total beside darts — the shell writes it as one closed dartless turn and `undo()` pops whole turns — with `totalOnClose` keeping an open dart turn's total at 0 and `complete(state, config)` replacing the default `isComplete()` (Ten Up One Down, 2026-10-27)." Checkout bullet (line 21): replace "A policy lands with its first caller." sentence's tail by "…; `foldCheckoutSeats` folds every seat of a game over its own turns, `storedTotalJudge` and `ladderTarget` serve Ten Up One Down (2026-10-27)." keeping the surrounding text and the trailing `(2026-10-27, D500)`.

`00-File-Inventory.md` `checkout-policies.ts` row: extend the description with "`storedTotalJudge`, `ladderTarget` (Ten Up One Down, 2026-10-27)"; if `checkout-kernel.module.ts`'s row lists exports, add `foldCheckoutSeats`.

`00-Context-Map-History.md`, append a row in the PR 2 row's column shape:

```
| `checkout-kernel.module.ts`, `checkout-policies.ts`, `tuod.engine.module.ts`, `dart-engine-shell.module.ts`, `interfaces.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (1.11.18), `modules/game/CLAUDE.md`, `00-File-Inventory.md`, oracle support | Ten Up One Down bound to the Checkout kernel and moved onto the game shell (goldens recorded pre-rebind, oracle over mixed per-dart and keypad input); shell gains visit-total input, close-settled totals, a `complete` hook. Checkout PR 3 (2026-10-27) | historical |
```

Spec: append to §3 after the PR 2 refinement bullet:

```
- **Refined by the PR 3 plan (2026-10-27):** seat identity stays outside `CheckoutSeat` — `foldCheckoutSeats(turns, seats, initial, rules)` returns seats aligned with `seats` and the engine projection adds `participantRef`/`sideKey`; `ladderStep` is `ladderTarget(up, down, floor, cap)`, a `nextTarget` policy, with TUOD's `onAttemptClose` the identity (121's `WON` cap lands in PR 4); `storedTotalJudge` returns `OPEN` for an unstamped turn, `CHECKOUT` for a stamped turn with `totalScore > 0`, else `FAIL` — 121's `finishedOnDouble` and `BUST`/`SPENT` split land with it.
```

and to §6 after the table:

```
Refined by the PR 3 plan (2026-10-27): beyond `visitInput`, the shell takes optional `totalOnClose` (an open dart turn keeps `totalScore` 0 until it settles), `complete(state, config)` (replaces `isComplete()`), `isVisitOpen(turn, state, config)`, `wouldComplete(state, input, config, open)` and `closedVisitTotal(opened, closed, participantRef, turn, config)`; `undo()` uses `undoLastUnit` when `visitInput` is declared.
```

- [ ] **Step 3: Gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-decision-ids.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-doc-sync.sh
```

Expected: all OK.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md app/src/modules/game/CLAUDE.md \
  docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md \
  docs/superpowers/specs/2026-10-27-checkout-kernel-design.md
git commit -m "docs: Ten Up One Down bound to the checkout kernel (D500)"
```

---

### Task 7: Discovered work, full verification and PR

- [ ] **Step 1: File the preserved quirks** per the `capturing-discovered-work` skill (`discovered-work` label), after `search_issues` for duplicates. Verify each with a probe test first (run it, do not commit it): (a) after `TuodEngine.record(dart)` on a fresh visit, `facts().turns[0].totalScore` is `0`; after `undo()` of a later dart of that visit it is the sum of the remaining darts. (b) a solo ROUNDS session accepts `record(...)` after `isComplete()` is true. File each with the probe output; do not fix.
- [ ] **Step 2:** `cd app && npm run format && npm run format:check` — commit any formatting diff.
- [ ] **Step 3:** Run the `run-all-gates` skill (Always + app sets). Without `DATABASE_URL`, `validate:app`'s DB steps cannot run: run fallow, `npm test` and `npm run check` directly and say so. Fallow: dead code clean; duplication not above `main`'s (compare on `origin/main` vs the branch). Report each script's result.
- [ ] **Step 4:** Final whole-branch review per the chosen execution skill, with this plan's Review Focus verbatim.
- [ ] **Step 5:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push, open the PR against `main`, subscribe to PR activity. PR body names the two filed issues.
