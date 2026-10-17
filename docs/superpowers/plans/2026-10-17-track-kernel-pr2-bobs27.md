# Track Kernel — PR 2 (Bob's 27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Bob's 27 onto the Track kernel with no change in behaviour, and point `09-Adding-A-Game.md`'s exemplar at the kernel-backed engine.

**Architecture:** Bob's 27 becomes a `TrackRules<Bobs27TrackExt>` record over `applyTrackDart` / `foldTrackSeats`. A projection maps `TrackSeat` back to `Bobs27SeatState` so `applyBobs27Dart`, `foldBobs27State`, `initialBobs27State` and `state()` keep their shape. The kernel gains one optional field, `TrackRules.startScore`, because Bob's 27 starts at 27 and not 0. Three policies land with this first caller: `closeAfter`, `penaltyOnBlank` and `outAtOrBelowZero`. The differential oracle proves the rebind against a frozen legacy copy, then the goldens take over.

**Tech Stack:** TypeScript, Vitest, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§5 Bob's 27 row, §7 method, §8 PR 2, §9.5). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel.md` (PR 0 + PR 1, merged as #982 and #984).

## Global Constraints

- Branch `refactor/track-kernel-bobs27`, from `origin/main` at `5d8834a` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests import them from `@modules/types` / `@modules/interfaces`, never `@modules/game/types` (`check-type-barrels.sh`).
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow: cognitive complexity ≤ 15 per function. Duplication may rise while the legacy copy exists, but must equal `main`'s count after Task 2.4.
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- Run `npm test` from `app/`, never from the repo root.
- This is a refactor. Every existing test in `bobs27.engine.module.test.ts` and `bobs27.golden.test.ts` passes with **no edits** (snapshots included). New tests are appended only.
- Preserve the quirks named in spec §7. Do not fix them:
  - **#983:** a 1v1 where both seats are WON stays `IN_PROGRESS`.
  - `activeSeat` is called without a completion predicate.
- No D-entry. `startScore` is an additive field inside D468's design. The history row records it. Confirm with `bash scripts/next-decision-id.sh` that nothing claimed D469 for this work.

## Spec refinements made by this plan

1. **`TrackRules.startScore?: number` (default 0).** `initialTrackSeat` takes it as an optional third argument, and `foldTrackSeats` passes `rules.startScore`. The other options were rejected:
   - A score offset in the projection would make `outAtOrBelowZero` read a relative score.
   - A separate initial-seat builder would change the Doubles call site.
2. **Policy names fixed:**

   | Spec's indicative name | Name in this plan | Behaviour |
   | --- | --- | --- |
   | `threeDartVisit` | `closeAfter(n)` | open while `dartsThisVisit < n`; mirrors `closeOnHitOrAfter(n)` |
   | `penaltyOnBlank(mult)` | `penaltyOnBlank(penalty)` | takes a `(seat) => number`; the multiplier stays in Bob's 27's ruleset, so the policy knows nothing about target values |
   | `outAtOrBelowZero` | unchanged | score ≤ 0 → `OUT` |

3. **The elimination outcome stays in the fold** (`eliminationWinner`, unchanged). Refinement 3 of the previous plan said `TrackRules.outcome` arrives only when a second engine shares outcome code. Bob's 27 is still the only Track elimination game. Re-check this at PR 3 (Singles: OUT → elimination).
4. **The per-dart hit list lives in `ext`.** Bob's 27's `dartsThisVisit` is a `boolean[]`, so `Bobs27TrackExt = { hits: boolean[] }`. `onDart` appends to it and `onVisitClose` clears it. The kernel's counters equal `hits.length` and the count of `true` by construction.

## Review Focus

1. **A full miss on the BULL visit that takes the score to ≤ 0.** The seat must be `LOST`, not `WON`: OUT is checked before the path end. Pinned in Task 2.3 (boundary test 2).
2. **A hit on only the third dart.** No penalty, and the seat advances. The rehydrated `[false, false]` must project to `hitsThisVisit` 0. Pinned in Task 2.3 (boundary test 1).
3. **`missPenaltyMultiplier` ≠ 1 on the BULL visit.** The penalty is `bullHitValue × mult`, the seat is `WON` if the score stays > 0, and `targetIndex` stays 20. Pinned in Task 2.3 (boundary test 3).
4. **A mid-visit seat rehydrated with hits out of order** (`[false, true]`). The order is kept in the projection after the next dart. Pinned in Task 2.3 (boundary test 4).
5. **A custom `startScore` through the fold.** The derived seat must start at the configured score, not 0. Pinned in Task 2.2 (kernel `startScore` test) and by the oracle's `harsh` config in Task 2.1.

---

### Task 2.1: Freeze the legacy engine plus oracle (commit 1)

**Files:**
- Create: `app/tests/modules/game/legacy/bobs27.legacy.ts`
- Create: `app/tests/modules/game/bobs27.oracle.test.ts`

**Interfaces:**
- Consumes: `runOracle({ build, legacy, seeds, steps, undoRate, rehydrateEvery })` from `app/tests/modules/game/support/engine-oracle.ts`.
- Produces: `LegacyBobs27Engine` (test-only; deleted in Task 2.4).

- [ ] **Step 1: Copy the module.** Run `cp app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/legacy/bobs27.legacy.ts`. In the copy:
  - Rewrite every `./x` import as `@modules/game/x`, and `./types` / `./interfaces` as `@modules/types` / `@modules/interfaces`.
  - Delete `export const bobs27EngineFactory = ...` and the `registerEngineFactory(...)` call, along with the now-unused imports `registerEngineFactory` and `dartGameEngineFactory`.
  - Rename the class to `LegacyBobs27Engine`.
  - Remove `export` from every function except the class.

- [ ] **Step 2: Write the oracle test** `app/tests/modules/game/bobs27.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import { LegacyBobs27Engine } from "./legacy/bobs27.legacy";
import { runOracle } from "./support/engine-oracle";
import type { Bobs27Snapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const config = (
  seats: number,
  rules: Bobs27Snapshot = {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
  },
): Seated<Bobs27Snapshot> => ({
  ...rules,
  seats: Array.from({ length: seats }, (_, i) => seat(i + 1, "ABC"[i]!)),
});
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bob's 27 — kernel vs legacy oracle", () => {
  for (const [name, cfg] of [
    ["solo", config(1)],
    ["duo", config(2)],
    ["trio", config(3)],
    [
      "solo harsh",
      config(1, { startScore: 10, bullHitValue: 25, missPenaltyMultiplier: 2 }),
    ],
    [
      "duo generous",
      config(2, { startScore: 60, bullHitValue: 50, missPenaltyMultiplier: 1 }),
    ],
  ] as const) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new Bobs27Engine(cfg, prior),
          legacy: (prior) => new LegacyBobs27Engine(cfg, prior),
          seeds: SEEDS,
          steps: 260,
          undoRate: 0.12,
          rehydrateEvery: 19,
        });
      },
      60_000,
    );
  }
});
```

  - If `Bobs27Snapshot` carries more required fields, copy them from `CONFIGS` in `bobs27.golden.test.ts`.
  - `duo generous` exists so some runs reach BULL on both seats, which exercises #983's stuck state.
  - The 15 seeds and the 60 s per-test timeout are PR 1's ledgered ruling. 40 seeds timed out.

- [ ] **Step 3: Run it.** Run `cd app && npx vitest run tests/modules/game/bobs27.oracle.test.ts`. Expected: 5 PASS, since the engine and the legacy copy are still the same code.

- [ ] **Step 4: Prove the oracle can fail.** Change `missPenaltyMultiplier` to `missPenaltyMultiplier + 1` in the legacy copy's penalty line and run again. Expected: FAIL in at least `solo`. Revert, re-run, and confirm PASS. Record the result for the PR body.

- [ ] **Step 5: Commit.**

```bash
git add app/tests/modules/game/legacy app/tests/modules/game/bobs27.oracle.test.ts
git commit -m "test(bobs27): freeze legacy engine and add kernel oracle"
```

### Task 2.2: Kernel `startScore` plus Bob's 27 policies

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`TrackRules`)
- Modify: `app/src/modules/game/track-kernel.module.ts` (`initialTrackSeat`, `foldTrackSeats`)
- Modify: `app/src/modules/game/track-policies.ts` (append three policies)
- Test: `app/tests/modules/game/track-kernel.module.test.ts`, `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Consumes: `TrackSeat<TExt>`, `TrackRules<TExt>`, `initialTrackSeat`, `foldTrackSeats` as merged in #984.
- Produces:
  - `TrackRules<TExt>.startScore?: number`
  - `initialTrackSeat<TExt>(seat: SeatFact, ext: TExt, score?: number): TrackSeat<TExt>`
  - `closeAfter<TExt>(darts: number): (seat: TrackSeat<TExt>) => boolean`
  - `penaltyOnBlank<TExt>(penalty: (seat: TrackSeat<TExt>) => number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`
  - `outAtOrBelowZero<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt>`

- [ ] **Step 1: Write the failing kernel tests.** Append inside `describe("track kernel", ...)` in `track-kernel.module.test.ts`:

```ts
  it("initialTrackSeat takes an optional starting score", () => {
    expect(initialTrackSeat(SEAT, { closed: [] }, 27).score).toBe(27);
  });

  it("foldTrackSeats starts each seat at rules.startScore", () => {
    const turn = (participantRef: string, darts: DartObservation[]) =>
      ({ participantRef, darts }) as unknown as TurnFact;
    const [seat] = foldTrackSeats(
      [turn("p1", [hitOn(1), MISS])],
      [SEAT],
      () => ({ closed: [] }),
      { ...toy, startScore: 27 },
    );
    expect(seat.score).toBe(28);
  });
```

- [ ] **Step 2: Write the failing policy tests.** In `track-policies.test.ts`, add `closeAfter, outAtOrBelowZero, penaltyOnBlank` to the import list and append inside `describe("track policies", ...)`:

```ts
  it("closeAfter(3): open until the third dart, hits or not", () => {
    const open = closeAfter(3);
    expect(open(seat({ dartsThisVisit: 2, hitsThisVisit: 2 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 3, hitsThisVisit: 0 }))).toBe(false);
  });

  it("penaltyOnBlank subtracts the penalty only when the visit hit nothing", () => {
    const penalise = penaltyOnBlank<null>((s) => s.targetIndex * 10);
    expect(
      penalise(seat({ score: 50, targetIndex: 2, hitsThisVisit: 0 })).score,
    ).toBe(30);
    expect(
      penalise(seat({ score: 50, targetIndex: 2, hitsThisVisit: 1 })).score,
    ).toBe(50);
  });

  it("outAtOrBelowZero: OUT at 0 or below, untouched above", () => {
    expect(outAtOrBelowZero(seat({ score: 0 })).status).toBe("OUT");
    expect(outAtOrBelowZero(seat({ score: -4 })).status).toBe("OUT");
    expect(outAtOrBelowZero(seat({ score: 1 })).status).toBe("IN_PROGRESS");
  });
```

- [ ] **Step 3: Run them.** Run `cd app && npx vitest run tests/modules/game/track-kernel.module.test.ts tests/modules/game/track-policies.test.ts`. Expected:
  - the policy tests FAIL with "not a function" / missing export;
  - the kernel tests FAIL on `score` (0 ≠ 27, 1 ≠ 28).

- [ ] **Step 4: Implement.**

  In `interfaces.ts`, inside `TrackRules<TExt>` and after `doneMessage`, add:

```ts
  /** Every seat's score before its first dart; 0 when absent. */
  readonly startScore?: number;
```

  In `track-kernel.module.ts`, change `initialTrackSeat` to take `score = 0` and use it. Its JSDoc becomes "A Track seat before its first dart: first target, zero counters, `score` (default 0) and `ext` as given.":

```ts
export function initialTrackSeat<TExt>(
  seat: SeatFact,
  ext: TExt,
  score = 0,
): TrackSeat<TExt> {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    score,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
    ext,
  };
}
```

  In `foldTrackSeats`, change the initial-seat lambda to:

```ts
    (seat) => initialTrackSeat(seat, initialExt(), rules.startScore),
```

  Append to `track-policies.ts`:

```ts
/** Visit policy: open until `darts` darts are thrown, hits or not. */
export function closeAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.dartsThisVisit < darts;
}

/** Visit-close policy: subtract `penalty(seat)` from the score when the visit hit nothing. */
export function penaltyOnBlank<TExt>(
  penalty: (seat: TrackSeat<TExt>) => number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit === 0
      ? { ...seat, score: seat.score - penalty(seat) }
      : seat;
}

/** Visit-close policy: a score at or below zero puts the seat `OUT`. */
export function outAtOrBelowZero<TExt>(
  seat: TrackSeat<TExt>,
): TrackSeat<TExt> {
  return seat.score <= 0 ? { ...seat, status: "OUT" } : seat;
}
```

- [ ] **Step 5: Run the tests.** Run `cd app && npm test`. Expected: all PASS, including the Doubles goldens (Doubles omits `startScore`, so it still starts at 0).

  Fallow's dead-code gate may flag the three new exports until Task 2.3 uses them. Do not commit Task 2.2 alone; it commits together with Task 2.3.

### Task 2.3: Rebind Bob's 27 onto the kernel (commit 2)

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `Bobs27TrackExt`)
- Modify: `app/src/modules/game/bobs27.engine.module.ts`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes: Task 2.2's `startScore`, `closeAfter`, `penaltyOnBlank`, `outAtOrBelowZero`; #984's `pathTarget`, `advanceToEnd`, `applyTrackDart`, `foldTrackSeats`.
- Produces: unchanged exports — `initialBobs27State`, `applyBobs27Dart(config, state, observation)`, `foldBobs27State(facts, config)`, `Bobs27Engine`, `bobs27EngineFactory`.

- [ ] **Step 1: Write the boundary tests.** These characterise the legacy behaviour at the projection's seams. Append them to `bobs27.engine.module.test.ts`, which already imports `applyBobs27Dart` and `Bobs27SeatState`, defines `config` (27 / 50 / ×1), and provides `hitObservationFor(seat)` / `missObservationFor(seat)`:

```ts
describe("Bob's 27 — Track kernel boundaries", () => {
  const at = (over: Partial<Bobs27SeatState>): Bobs27SeatState => ({
    participantRef: "participant-1",
    sideKey: "A",
    targetIndex: 0,
    score: 27,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
    ...over,
  });

  it("a hit on only the third dart: no penalty, advance, visit cleared", () => {
    const seat = at({ score: 29, dartsThisVisit: [false, false] });
    expect(applyBobs27Dart(config, seat, hitObservationFor(seat))).toEqual(
      at({ score: 31, targetIndex: 1, dartsThisVisit: [] }),
    );
  });

  it("a full miss on BULL that reaches 0 loses, not wins", () => {
    const seat = at({ targetIndex: 20, score: 50, dartsThisVisit: [false, false] });
    expect(applyBobs27Dart(config, seat, missObservationFor(seat))).toEqual(
      at({ targetIndex: 20, score: 0, status: "LOST" }),
    );
  });

  it("a full miss on BULL with multiplier 2 subtracts 2 × bull value and still wins above 0", () => {
    const seat = at({ targetIndex: 20, score: 120, dartsThisVisit: [false, false] });
    expect(
      applyBobs27Dart(
        { ...config, missPenaltyMultiplier: 2 },
        seat,
        missObservationFor(seat),
      ),
    ).toEqual(at({ targetIndex: 20, score: 20, status: "WON" }));
  });

  it("keeps a rehydrated visit's hit order across the next dart", () => {
    const seat = at({ dartsThisVisit: [false] });
    expect(applyBobs27Dart(config, seat, hitObservationFor(seat))).toEqual(
      at({ score: 29, dartsThisVisit: [false, true] }),
    );
  });
});
```

  The arithmetic: D1 is worth 2, and BULL is worth `bullHitValue` (50).

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`. Expected: PASS. These are characterisation tests, and they must hold before and after the rebind. If one fails, the test is wrong, not the engine. Fix the test's arithmetic.

- [ ] **Step 3: Add the ext type.** In `modules/game/types.ts`, next to `Bobs27SeatState`:

```ts
/** Bob's 27's Track extras: the open visit's per-dart hits, in throw order. */
export type Bobs27TrackExt = { hits: boolean[] };
```

- [ ] **Step 4: Rebind the engine.** In `bobs27.engine.module.ts`:
  - Imports:
    - add `applyTrackDart, foldTrackSeats` from `./track-kernel.module`;
    - add `advanceToEnd, closeAfter, outAtOrBelowZero, pathTarget, penaltyOnBlank` from `./track-policies`;
    - add `TrackRules` to the `./interfaces` import;
    - add `Bobs27TrackExt` and `TrackSeat` to the `./types` import;
    - drop `foldSeatStates` from the `./seat-state.module` import (keep `activeSeatState`).
  - Move the `MATCH_ENDED` / `GAME_ENDED` constants above `applyBobs27Dart`.
  - Add the code below after `pointValueOf`.
  - Replace `applyBobs27Dart`'s body. Keep its JSDoc first paragraph, change "Pure reducer:" to "Pure reducer, via the Track kernel:", and keep the `@throws`.
  - Replace the `foldSeatStates(...)` call in `foldBobs27State`.

```ts
const PATH = doublesPath();

const TO_TRACK = { IN_PROGRESS: "IN_PROGRESS", WON: "DONE", LOST: "OUT" } as const;
const FROM_TRACK = { IN_PROGRESS: "IN_PROGRESS", DONE: "WON", OUT: "LOST" } as const;

/**
 * Bob's 27 as Track policies: D1 → BULL, a hit scores the target's value, a
 * blank visit costs that value × the miss multiplier; at or below zero is
 * out, before clearing BULL is checked.
 */
function bobs27Rules(config: Bobs27Snapshot): TrackRules<Bobs27TrackExt> {
  const target = pathTarget<Bobs27TrackExt>(PATH);
  const penalise = penaltyOnBlank<Bobs27TrackExt>(
    (seat) => pointValueOf(target(seat), config) * config.missPenaltyMultiplier,
  );
  const advance = advanceToEnd<Bobs27TrackExt>(PATH.length - 1);
  return {
    doneMessage: GAME_ENDED,
    startScore: config.startScore,
    target,
    hit: isHitOn,
    points: (aimed, _observation, hit) => (hit ? pointValueOf(aimed, config) : 0),
    onDart: (seat, dart) => ({
      ...seat,
      ext: { hits: [...seat.ext.hits, dart.hit] },
    }),
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = outAtOrBelowZero(penalise(seat));
      const next = judged.status === "OUT" ? judged : advance(judged);
      return { ...next, ext: { hits: [] } };
    },
  };
}

/** Lifts a Bob's 27 seat into the kernel's shape; the visit counters are read off its hit list. */
function toTrackSeat(state: Bobs27SeatState): TrackSeat<Bobs27TrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.score,
    dartsThisVisit: state.dartsThisVisit.length,
    hitsThisVisit: state.dartsThisVisit.filter(Boolean).length,
    status: TO_TRACK[state.status],
    ext: { hits: state.dartsThisVisit },
  };
}

/** Projects a kernel seat back to Bob's 27's seat state. */
function toBobs27Seat(seat: TrackSeat<Bobs27TrackExt>): Bobs27SeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    score: seat.score,
    dartsThisVisit: seat.ext.hits,
    status: FROM_TRACK[seat.status],
  };
}
```

  New `applyBobs27Dart` body:

```ts
  return toBobs27Seat(
    applyTrackDart(toTrackSeat(state), observation, bobs27Rules(config)),
  );
```

  New seats line in `foldBobs27State`:

```ts
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ hits: [] }),
    bobs27Rules(config),
  ).map(toBobs27Seat);
```

  Leave `initialSeatState`, `initialBobs27State`, the outcome block, `bobs27Spec` and the class untouched. `intent` keeps `targetAt(doublesPath(), ...)`. If `targetAt` is no longer used anywhere else, keep the import anyway, because `intent` still uses it.

- [ ] **Step 5: Run everything.** Run `cd app && npm test`. Expected: all PASS, with:
  - the 5 oracle tests;
  - every pre-existing Bob's 27 test, unedited;
  - the Bob's 27 goldens and golden traces, with no snapshot written (`git status` shows no `__snapshots__` change);
  - the Doubles goldens.

- [ ] **Step 6: Prove the oracle catches a rebind slip.** Temporarily swap the order in `onVisitClose` so `advance` runs before `outAtOrBelowZero`, then run the oracle. Expected: FAIL. Re-run with `advance` restored and the swap undone, and confirm PASS. Record this for the PR body.

- [ ] **Step 7: Gates.**
  - `cd app && npm run check` → 0/0/0.
  - `cd app && npx fallow` → complexity is clean, dead-code is clean, and duplication is recorded (it may sit above `main` until Task 2.4).
  - Repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh`.

- [ ] **Step 8: Commit** (Task 2.2 + 2.3 together).

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor(bobs27): bind to the Track kernel behind a seat projection"
```

### Task 2.4: Delete the legacy copy, docs, registry, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/game/legacy/bobs27.legacy.ts`, `app/tests/modules/game/bobs27.oracle.test.ts`
- Modify: `scripts/engine-kernels.txt` (bobs27 row)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (exemplar paragraph; `updated:`)
- Modify: `docs/architecture/04-Architecture-patterns.md` (Track row; version 1.11.2)
- Modify: `docs/architecture/00-File-Inventory.md` (rows for `track-kernel.module.ts`, `track-policies.ts`, `09-Adding-A-Game.md`)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)

- [ ] **Step 1: Delete the legacy copy and the oracle.** The guarantee stays with `bobs27.golden.test.ts` (goldens plus step traces), which passed unchanged in Task 2.3 Step 5. That is the same guarantee re-pointed, as the Hard Invariant requires. Commit 1 keeps the oracle's proof in history. Remove `app/tests/modules/game/legacy/` too if it is now empty.

- [ ] **Step 2: Flip the registry row** to:

```
app/src/modules/game/bobs27.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/bobs-27.md |
```

  Run `bash scripts/check-engine-kernels.sh`. Expected: PASS, since the engine now imports `./track-kernel.module`.

- [ ] **Step 3: Update the exemplar paragraph** in `09-Adding-A-Game.md`. Replace its last sentence ("Its engine is a `DartGameSpec` bound to the shell in … not a hand-written class.") with:

```markdown
Its engine is a `DartGameSpec` bound to the shell in
`modules/game/dart-engine-shell.module.ts`, and its rules are a `TrackRules`
record over the Track kernel (`modules/game/track-kernel.module.ts`), with a
projection back to its own seat state. A single-stage dart engine copies that
shape, not a hand-written class. A game in another kernel family copies only
the shell half (see §Pick the kernel first).
```

  Set `updated: 2026-10-17` (already today; leave it if unchanged).

- [ ] **Step 4: Update the Pattern 18 Track row and version** in `04-Architecture-patterns.md`:
  - Status cell: `built — Doubles Training, Bob's 27 bound (D468)`.
  - Version line: `1.11.2 (Pattern 18: Bob's 27 bound to the Track kernel 2026-10-17, D468; prior 1.11.1: …`. Keep the rest of the chain as it is.
  - Bump the frontmatter `updated:` to 2026-10-17 if it is older.

- [ ] **Step 5: Update the File Inventory rows.**
  - `track-kernel.module.ts`: "Track rule kernel: `initialTrackSeat`, `applyTrackDart`, `foldTrackSeats`; optional `TrackRules.startScore` (D468, 2026-10-17)".
  - `track-policies.ts`: append `closeAfter`, `penaltyOnBlank`, `outAtOrBelowZero` to the list.
  - `09-Adding-A-Game.md`: append "; exemplar is kernel-backed (2026-10-17)".

- [ ] **Step 6: Add the history row** to `00-Context-Map-History.md`:

```
| `bobs27.engine.module.ts`, `track-kernel.module.ts`, `track-policies.ts`, `modules/game/{types,interfaces}.ts`, their tests, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.2), `09-Adding-A-Game.md`, `00-File-Inventory.md` | Bob's 27 bound to the Track kernel behind a projection (oracle, then goldens); kernel gains optional `startScore`; policies `closeAfter`, `penaltyOnBlank`, `outAtOrBelowZero`. Track PR 2, D468 (2026-10-17) | historical |
```

- [ ] **Step 7: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 2.3's minus the 5 oracle tests;
  - `npx fallow` duplication equals `main`'s;
  - `bash scripts/check-doc-links.sh`, `check-context-budget.sh` (update the token claims if they drift), `check-decision-ids.sh` and `check-engine-kernels.sh` pass;
  - `cd app && npm run format:check` is clean.

- [ ] **Step 8: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/game scripts/engine-kernels.txt docs
git commit -m "test(bobs27): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-bobs27
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle configs, seeds and steps;
  - both mutation-check results (Task 2.1 Step 4, Task 2.3 Step 6);
  - the fallow duplication before and after;
  - #983 named as preserved.

  End the body with the generated line plus the session link. Subscribe to the PR's activity and drive it to green. Merge `origin/main` in (never rebase) if it conflicts.
