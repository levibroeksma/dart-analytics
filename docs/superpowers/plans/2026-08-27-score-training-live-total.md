# Score Training: live total score during an open visit (#168) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix #168 — in Score Training's ANALYTICS + VISUAL_BOARD (per-dart) mode, a seat's displayed total score doesn't move until the 3rd dart closes the visit, and undoing a closing dart drops the total back to what it'd show without that visit at all.

**Architecture:** `foldScoreTrainingState` (`app/src/modules/game/score-training.engine.module.ts`) currently sums a seat's `totalScore` from only its **closed** turns. Widen that sum to every one of the seat's turns, open or closed — `turn.totalScore` is already kept live by `recordDart` on every dart. `turnCount` (which gates round-budget completion) stays closed-turns-only. One function change, its own doc comment, and `ScoreTrainingSeatState`'s JSDoc in `types.ts`.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- Scope: `app/src/modules/game/score-training.engine.module.ts`, `app/src/modules/game/types.ts`, and `app/tests/modules/game/score-training.engine.module.test.ts`. Do not touch any other ruleset's engine or fold function.
- `app/CLAUDE.md`: no `//` or `/* */` comments inside function bodies in `app/src/**/*.ts`; tests mirror `app/src/`'s directory structure under `app/tests/`, never colocated; every source edit needs a covering test edit (`scripts/check-test-coverage.sh`) — type-only edits are exempt (D224).
- No change to `turnCount` semantics, `durationSeatComplete`, `wouldComplete`, `isMatchDecided`, or `scoreCompareOutcome` — these gate on `completed` (turnCount-based), never on `totalScore`.
- No change to quick-score (keypad) behavior, persistence, the API, or any other engine.
- Run `cd app && npm run format` before considering any task done.
- Branch: `claude/issue-168-score-training-live-total`.

---

### Task 1: Sum `totalScore` across a seat's open and closed turns

**Files:**

- Modify: `app/src/modules/game/score-training.engine.module.ts:49-102`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`

**Interfaces:**

- Produces: `foldScoreTrainingState(facts, config, timerExpired): ScoreTrainingState` — same signature, same callers (`ScoreTrainingEngine.deriveState`, `score-training-play.data.ts`'s `finalScoreTrainingState`), only the `totalScore` value per seat changes. No task depends on new exports.

- [ ] **Step 1: Write the failing tests**

Open `app/tests/modules/game/score-training.engine.module.test.ts`. Find the end of the `describe("visual board capture", ...)` block — it closes at the `});` right before `describe("ScoreTrainingEngine.record — keypad input under VISUAL_BOARD (shape-based dispatch)", ...)` (currently line 491, immediately after the nested `wouldComplete` describe's closing braces). Insert two new top-level `describe` blocks there, between the two:

```ts
describe("ScoreTrainingEngine.state — open visit contributes to totalScore (#168)", () => {
  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  const visualConfig = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: SEATS,
  } as never;

  it("counts darts toward totalScore as they're thrown, before the visit closes", () => {
    const engine = scoreTrainingEngineFactory.create(
      visualConfig,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    expect(
      (engine.state() as ScoreTrainingState).seats[0].totalScore,
    ).toBe(60);

    engine.record(trebleTwenty);
    expect(
      (engine.state() as ScoreTrainingState).seats[0].totalScore,
    ).toBe(120);

    engine.record(trebleTwenty);
    expect(
      (engine.state() as ScoreTrainingState).seats[0].totalScore,
    ).toBe(180);
  });

  it("keeps a reopened visit's partial total after undo, instead of dropping it to 0", () => {
    const engine = scoreTrainingEngineFactory.create(
      visualConfig,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(
      (engine.state() as ScoreTrainingState).seats[0].totalScore,
    ).toBe(180);

    expect(engine.undo()).toBe(true);

    expect(
      (engine.state() as ScoreTrainingState).seats[0].totalScore,
    ).toBe(120);
    expect(engine.facts().turns[0]!.completedAt).toBeNull();
  });

  it("does not count a still-open visit toward turnCount", () => {
    const engine = scoreTrainingEngineFactory.create(
      visualConfig,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect((engine.state() as ScoreTrainingState).seats[0].turnCount).toBe(0);

    engine.record(trebleTwenty);
    expect((engine.state() as ScoreTrainingState).seats[0].turnCount).toBe(1);
  });
});

describe("ScoreTrainingEngine — 1v1 open visit isolation (#168)", () => {
  const twoSeats = [
    {
      participantRef: "p1",
      displayName: "A",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "B",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const twoSeatVisualConfig = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: twoSeats,
  } as never;

  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  it("an open visit's partial darts count only toward the throwing seat, and status stays IN_PROGRESS", () => {
    const engine = scoreTrainingEngineFactory.create(
      twoSeatVisualConfig,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);

    const state = engine.state() as ScoreTrainingState;
    expect(
      state.seats.find((s) => s.participantRef === "p1")!.totalScore,
    ).toBe(60);
    expect(
      state.seats.find((s) => s.participantRef === "p2")!.totalScore,
    ).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts -t "#168"`
Expected: FAIL — the first two new tests report `totalScore: 0` (or `60` where `120`/`180` is expected) because `foldScoreTrainingState` currently excludes the open turn from the sum. The `turnCount` test and the 1v1 test pass already (unaffected by the bug) — that's fine, they lock in behavior the fix must not change.

- [ ] **Step 3: Widen the fold to sum all of a seat's turns**

In `app/src/modules/game/score-training.engine.module.ts`, replace the function doc comment and body (lines 49-102):

```ts
/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldTuodState`. Score-compare, highest total wins: both seats always play
 * out their own full ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`). `activeSeat` IS passed a real completion
 * predicate here (the 4-argument form), and it is structurally a no-op for
 * the same reason `foldTuodState`'s is: a uniform per-seat budget under
 * lockstep alternation.
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const closed = facts.turns.filter(
      (turn) =>
        turn.participantRef === seat.participantRef &&
        turn.completedAt !== null,
    );
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: closed.length,
      totalScore: closed.reduce((sum, turn) => sum + turn.totalScore, 0),
    };
  });
```

with:

```ts
/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldTuodState`. `totalScore` sums every one of a seat's turns, open or
 * closed — a dart-captured visit's `totalScore` is kept live by
 * `recordDart` on every dart, before the visit closes, so a still-open
 * visit's darts already count toward the seat's total (#168); `turnCount`
 * counts only closed turns, so an open visit is never treated as a played
 * round. Score-compare, highest total wins: both seats always play out
 * their own full ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`). `activeSeat` IS passed a real completion
 * predicate here (the 4-argument form), and it is structurally a no-op for
 * the same reason `foldTuodState`'s is: a uniform per-seat budget under
 * lockstep alternation.
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    const closedCount = seatTurns.filter(
      (turn) => turn.completedAt !== null,
    ).length;
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: closedCount,
      totalScore: seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0),
    };
  });
```

Everything below this (the `completedSeats`/`outcome`/`return` block) is unchanged — it already reads `seats` by field name, not by how those fields were computed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: PASS, every test in the file green (all pre-existing tests plus the four new ones).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/score-training.engine.module.ts app/tests/modules/game/score-training.engine.module.test.ts
git commit -m "Count an open visit's darts toward Score Training's live totalScore (#168)"
```

---

### Task 2: Correct `ScoreTrainingSeatState`'s JSDoc

**Files:**

- Modify: `app/src/modules/game/types.ts:1-11`

Type-only change — `scripts/check-test-coverage.sh` exempts type-only edits (D224), so this task has no test step. The comment currently documents the closed-only behavior Task 1 just fixed as intentional; it must not keep asserting the old (buggy) semantics.

- [ ] **Step 1: Replace the doc comment**

In `app/src/modules/game/types.ts`, replace:

```ts
/**
 * One seat's Score Training progress: how many visits it has closed and the
 * running total of their counted scores, both folded from the fact log —
 * never accumulated.
 */
export type ScoreTrainingSeatState = SeatState & {
  turnCount: number;
  totalScore: number;
};
```

with:

```ts
/**
 * One seat's Score Training progress, folded from the fact log — never
 * accumulated. `turnCount` is how many visits it has closed; `totalScore` is
 * the running total across every one of its turns, including a still-open
 * visit's darts so far (#168) — it does not wait for a visit to close.
 */
export type ScoreTrainingSeatState = SeatState & {
  turnCount: number;
  totalScore: number;
};
```

- [ ] **Step 2: Confirm it's type-only**

Run: `cd app && git diff --stat src/modules/game/types.ts`
Expected: only `app/src/modules/game/types.ts` changed; no runtime `.ts` file in this diff, so no paired test edit is required per D224.

- [ ] **Step 3: Commit**

```bash
git add app/src/modules/game/types.ts
git commit -m "Correct ScoreTrainingSeatState's totalScore doc comment (#168)"
```

---

### Task 3: Full validation and context maintenance

**Files:**

- Modify: `FINDINGS.md` if the `context-maintenance` skill's run surfaces anything (none expected — no new pattern, no new decision, no doc drift from this change)

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints. If `db:status`/`db:migrate`/`db:introspect` cannot run (no `DATABASE_URL` in this environment), note that explicitly — no migration or schema is touched by this plan — and still run `npx fallow`, `npm test`, `npm run check`, `npm run format:check`.

- [ ] **Step 2: Manual UI check, if a dev server is reachable**

Per root `CLAUDE.md`: for a UI-visible fix, start the dev server and exercise the feature in a browser before claiming done — start a Score Training 1v1 session in ANALYTICS + VISUAL_BOARD mode, throw one dart, and confirm the total updates immediately (not only on the 3rd dart), then confirm undo after a closed visit keeps that visit's partial total instead of dropping to 0. If Neon/database credentials are unavailable in this execution environment, state that limitation explicitly in the completion report rather than claiming a browser check that did not happen.

- [ ] **Step 3: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill for this change. Expected: no `CLAUDE.md`/context-map/decision-ledger update is needed — this is a bug fix within an existing, already-documented mechanism (the fold function and its seat-state type), not a new pattern or a reversed decision. Confirm `scripts/check-findings-log.sh` still passes (no new finding logged unless the skill's own review surfaces one — if it does, log it per the skill's procedure rather than fixing it in this pass). Confirm branch/PR state and report it (branch `claude/issue-168-score-training-live-total`; no PR yet unless already opened).

- [ ] **Step 4: Run the `run-all-gates` skill**

Invoke `run-all-gates` for the full change set. Run the "Always run" set plus the "If `app/` changed" set, and confirm every applicable script passes.

## Self-review notes

- Spec coverage: Task 1 implements the design spec's "Fix" section (widen `totalScore` to all turns, keep `turnCount` closed-only) and its "Testing" section's three bullets (mid-visit dart updates, undo keeps the reopened visit's partial total, 1v1 isolation without early outcome flip). Task 2 covers the spec's "Scope" note that `ScoreTrainingSeatState`'s JSDoc states the old behavior as intentional and must be corrected, not just the code. Task 3 covers the spec's non-goals verification (no change to `wouldComplete`/`isMatchDecided`/`scoreCompareOutcome`/quick-score) via the full test suite passing unchanged, plus the mandatory validation/context-maintenance close-out.
- No placeholders: every step shows exact before/after code; no "add tests for the above" or "TBD".
- Type consistency: `foldScoreTrainingState`'s signature is untouched (Task 1); `ScoreTrainingSeatState`'s field names (`turnCount`, `totalScore`) are unchanged by Task 2, only its doc comment. The new tests cast `engine.state()` to `ScoreTrainingState` exactly as every other test in the file already does, and use `scoreTrainingEngineFactory.create(config, undefined) as ScoreTrainingEngine`, matching the existing "visual board capture" describe block's own pattern.
