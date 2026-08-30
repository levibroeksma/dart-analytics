# Result Modal 1v1 Stats Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution order: 2 of 3** (spec: `docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md`, Issue 3). Runs after `01-result-modal-summary-components.md` (which built `SinglePlayerSummary`/`ComparisonSummary` against the 3 games already shaped this way) and before `03-result-modal-title-extraction.md`.

**Goal:** Fix the 6 games whose results modal is still missing real 1v1 opponent stats — Around the Clock, Bob's 27, Doubles Training, 121, Singles Training, Ten Up One Down. Their `resultsSnapshot` types are flat/single-seat and their stat-computation functions filter the fact log down to the owning player's own turns before computing anything, so the opponent's stats are never computed, not merely unrendered. Promote each to the `{ ...; seats: XSeatResult[] }` shape `FiveOhOneResultsSnapshot`/`ScoreTrainingResultsSnapshot`/`ShanghaiResultsSnapshot` already use, then wire each modal onto the `SinglePlayerSummary`/`ComparisonSummary` components `01-result-modal-summary-components.md` built.

**Architecture:** Per game: (1) `types.ts` gains a named `XSeatResult` type (one seat's stats) and promotes the snapshot type to `{ status?; winningSideKey; seats: XSeatResult[] }`; (2) the game's `*-play.data.ts` gains a `statsFor(seat, …)` function computed once per seat in `state.seats` (the `score-training-play.data.ts:71-87` precedent), replacing the owner-only filter; (3) the result modal switches its `STAT_ROWS` to the new per-seat keys and drops its bespoke solo/skeleton markup for `<SinglePlayerSummary>`/`<ComparisonSummary>`.

**Tech Stack:** TypeScript (Vitest), Astro components, Alpine.js.

## Global Constraints

- TDD: write/extend the failing test before the implementation, for every `.ts` change (`app/CLAUDE.md`).
- `scripts/check-test-coverage.sh` fails any changed runtime `.ts` file with no covering test edit — every `types.ts`/`*-play.data.ts` change in this plan has a paired test edit.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- `npm run validate:app` clean (0 errors/warnings/hints) before any task is called done.
- The per-stat math itself (`accuracyDisplay`, `visitScoreBandCounts`, dart/visit counting, `currentTarget`/`totalPoints` reads off state) does not change — only "which participant" scoping changes, from one seat to all of `state.seats`.
- Never store a value the fact log (or already-derived engine state) can re-derive — `statsFor` functions read off `seat.*` engine-state fields or filter `turns`, exactly like the existing owner-only code already does, just once per seat instead of once for the owner.
- `.astro` markup is exempt from unit tests (D101) — the modal-wiring step in each task is verified visually, not with a new test file.

---

### Task 1: Around the Clock

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Modify: `app/tests/lib/game/around-the-clock-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` from `01-result-modal-summary-components.md` (`@components/layout/games/SinglePlayerSummary.astro`, `@components/layout/games/ComparisonSummary.astro`).
- Produces: `AroundTheClockSeatResult`, `AroundTheClockResultsSnapshot` (both exported from `app/src/lib/game/types.ts`) — no other task in this plan consumes them.

- [ ] **Step 1: Extend the failing test**

In `app/tests/lib/game/around-the-clock-play.data.test.ts`, find the existing `describe("session completion — 1v1", ...)` block (currently one test: `"marks status TIE, with winningSideKey null, when both seats finish in the same number of darts"`). Add a `.seats` assertion to that existing test and one new test, so the block reads:

```ts
describe("session completion — 1v1", () => {
  const TWO_SEATS = [
    {
      participantRef: "participant-1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "participant-2",
      displayName: "Opponent",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];

  function twoSeatConfig(): Seated<AroundTheClockSnapshot> {
    return { seats: TWO_SEATS };
  }

  it("marks status TIE, with winningSideKey null, when both seats finish in the same number of darts", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 14, turns: 14, darts: 42 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Both seats hit every target with no misses, so each clears its own
    // circuit in exactly 21 darts (20 numbers + BULL) — a genuine tie, not
    // a solo session, even though winningSideKey is null in both cases.
    for (let i = 0; i < 42; i += 1) {
      await play.recordTap.call(play, "SINGLE");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        turns: 21,
        accuracy: "100.00%",
        totalDarts: 21,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        turns: 21,
        accuracy: "100.00%",
        totalDarts: 21,
      },
    ]);
  });

  it("scopes each seat's own turns/accuracy/totalDarts independently, including the losing seat", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 2, turns: 2, darts: 4 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "block-1",
          participantRef: "participant-1",
          sequence: 1,
          completedAt: "2026-08-01T10:00:00.000Z",
          totalScore: 0,
          darts: [
            {
              sequence: 1,
              intendedTargetNumber: 1,
              intendedZoneKey: "DOUBLE",
              hitTargetNumber: 1,
              hitZoneKey: "SINGLE",
              score: 1,
              locationX: null,
              locationY: null,
            },
          ],
        },
        {
          clientKey: "t2",
          stageClientKey: "block-1",
          participantRef: "participant-2",
          sequence: 1,
          completedAt: "2026-08-01T10:00:01.000Z",
          totalScore: 0,
          darts: [
            {
              sequence: 1,
              intendedTargetNumber: 1,
              intendedZoneKey: "DOUBLE",
              hitTargetNumber: 5,
              hitZoneKey: "SINGLE",
              score: 5,
              locationX: null,
              locationY: null,
            },
          ],
        },
      ],
    });
    await play.init.call(play);
    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        turns: 1,
        accuracy: "100.00%",
        totalDarts: 1,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        turns: 1,
        accuracy: "0.00%",
        totalDarts: 1,
      },
    ]);
  });
});
```

The first dart (participant-1, hit target 1) is a genuine hit on the active target — the seat's `targetIndex` starts at 0 (number 1), so `hitTargetNumber: 1` matches. The second dart (participant-2, hit target 5) misses their own active target (also number 1, since seat 2 starts fresh at its own `targetIndex: 0`), giving 0% accuracy — this is what "including the losing seat" actually exercises: today's code never computes participant-2's stats at all.

Also add the analogous solo-path no-regression check by running the existing (untouched) `"session completion"` describe block's tests — no new test needed there, Step 4 runs them.

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts -t "session completion"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined` (the current type has no `seats` field at all).

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the existing `AroundTheClockResultsSnapshot` (currently flat, documented at its own JSDoc comment) with:

```ts
/** One seat's own results stats, replayed from its own completed turns.
 * `accuracy` is genuine target hits over darts thrown, formatted as a
 * percentage rounded to 2 decimals. */
export type AroundTheClockSeatResult = {
  participantRef: string;
  sideKey: string;
  turns: number;
  accuracy: string;
  totalDarts: number;
};

/** `winningSideKey` is score-compare (fewest darts) resolved by the engine;
 * `null` for a solo session or a TIE. `status` mirrors the engine's own
 * completion state: `COMPLETE` for a solo session or a decided 1v1 match,
 * `TIE` when both seats finished in the same number of darts — the only way
 * callers can tell a genuine tie apart from a solo session, since both leave
 * `winningSideKey` `null`. `seats` has one entry per configured seat (1 for
 * solo, 2 for 1v1), in `$store.game.seats` order. */
export type AroundTheClockResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: AroundTheClockSeatResult[];
};
```

The `AroundTheClockPlayContext.resultsSnapshot` field already reads `AroundTheClockResultsSnapshot | null` — no change needed there, the type it points to is now the seat-shaped one.

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/around-the-clock-play.data.ts`, add a `statsFor` function right after the existing `countDarts` function:

```ts
function statsFor(
  seat: AroundTheClockSeatState,
  turns: readonly TurnFact[],
  config: Seated<AroundTheClockSnapshot> | null,
): AroundTheClockSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    turns: seatTurns.length,
    accuracy: config
      ? accuracyDisplay(countHits(config, seatTurns), countDarts(seatTurns))
      : "0.00%",
    totalDarts: countDarts(seatTurns),
  };
}
```

Add `AroundTheClockSeatResult` to the `import type { ... } from "@lib/types"` block (it currently imports `AroundTheClockSnapshot, RulesetVersionKey, Seated`).

Replace the `uploadAndCompleteSession` method body:

```ts
uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void> {
  const config = this.$store.game.configSnapshot;
  return playUploadAndCompleteSession(this, (finalState) => ({
    winningSideKey: finalState.winningSideKey,
    status: (finalState.status ?? "COMPLETE") as "COMPLETE" | "TIE",
    seats: finalState.seats.map((seat) =>
      statsFor(seat, this.$store.game.turns, config),
    ),
  }));
},
```

This deletes the old `ownerRef`/`ownerTurns` block entirely — every seat is now scoped independently instead of filtering down to one `ownerRef` first.

- [ ] **Step 5: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts
```

Expected: PASS, full file (confirms the solo-path tests in the untouched `"session completion"` block still pass unchanged).

- [ ] **Step 6: Wire the modal onto the shared components**

Replace the full contents of `app/src/components/layout/games/result-modals/AroundTheClockResults.astro` with:

```astro
---
// Components
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

// Data
const STAT_ROWS = [
  { label: "Turns", key: "turns" },
  { label: "Accuracy", key: "accuracy" },
  { label: "Darts thrown", key: "totalDarts" },
] as const;
// TODO: harden the mandatory showSavedMessage on ResultModalShell for consistancy
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'TIE'
        ? 'Tie — same darts!'
        : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — fewest darts!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

This drops the resolved `// TODO: add the Multiplayer logic` comment (this task is that work) but keeps the unrelated `showSavedMessage` TODO, which is out of scope here.

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts
cd app && npx tsc --noEmit
```

Expected: format clean/no unexpected diff, tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/around-the-clock-play.data.ts app/tests/lib/game/around-the-clock-play.data.test.ts app/src/components/layout/games/result-modals/AroundTheClockResults.astro
git commit -m "Around the Clock: compute + render both seats' results stats"
```

---

### Task 2: Bob's 27

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/tests/lib/game/bobs27-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/Bobs27Results.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` (Plan 1).
- Produces: `Bobs27SeatResult`, `Bobs27ResultsSnapshot` — no other task consumes them.

Bob's 27 has no existing `"completion — 1v1"` describe block (unlike the other 5 games in this plan) — this task adds one from scratch, following the same convention.

Also note: today's `computeStats` derives `status: ownerSeat.status === "WON" ? "WON" : "LOST"` from the *owner's own* per-seat `status` field. In a 1v1 match the owner can win by the *opponent* busting first — in that case the engine leaves the owner's own seat `status` at `"IN_PROGRESS"` (it never personally cleared BULL), so today's ternary reports `"LOST"` for the actual winner. This task fixes that latent bug as a side effect of reading the engine's own match-level `state.status` (already correctly resolved by `eliminationWinner()` in `bobs27.engine.module.ts`) instead of any one seat's own status.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/bobs27-play.data.test.ts`, add a new describe block after the existing `describe("completion", ...)` block (after its closing `});`, before `describe("previewSegments", ...)`):

```ts
describe("completion — 1v1", () => {
  const TWO_SEATS = [
    ...SEATS,
    {
      participantRef: "participant-2",
      displayName: "Opponent",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];

  it("computes both seats' own stats independently, including the seat that never threw", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: { ...defaultConfig(), seats: TWO_SEATS },
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "block-1",
          participantRef: "participant-1",
          sequence: 1,
          completedAt: "2026-08-01T10:00:00.000Z",
          totalScore: 6,
          darts: [
            {
              sequence: 1,
              intendedTargetNumber: 1,
              intendedZoneKey: "DOUBLE",
              hitTargetNumber: 1,
              hitZoneKey: "DOUBLE",
              score: 2,
              locationX: null,
              locationY: null,
            },
          ],
        },
      ],
    });
    await play.init.call(play);
    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        score: 29,
        darts: 1,
        doubleHitRate: "100.00%",
        highestNumberReached: "D1",
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        score: 27,
        darts: 0,
        doubleHitRate: "0.00%",
        highestNumberReached: "D1",
      },
    ]);
  });

  it("reports match-level status WON for the seat that survives an opponent's bust, not the seat's own in-progress status", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 4, darts: 6 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        startScore: 27,
        bullHitValue: 50,
        missPenaltyMultiplier: 20,
        seats: TWO_SEATS,
      },
    });
    await play.init.call(play);

    // Seat A (owner) hits once then misses twice — clears the visit without
    // busting and advances. Seat B misses all 3 darts on its own first
    // visit, busting immediately: the match ends with A the winner purely
    // because B failed, not because A ever reached BULL.
    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts -t "completion — 1v1"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined`.

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the inline `resultsSnapshot: { status: "WON" | "LOST"; score: number; ...; } | null;` field inside `Bobs27PlayContext` with a named pair, added just above the `Bobs27PlayContext` type declaration:

```ts
export type Bobs27SeatResult = {
  participantRef: string;
  sideKey: string;
  score: number;
  darts: number;
  doubleHitRate: string;
  highestNumberReached: string;
};

/** `status` mirrors the match-level `Bobs27State.status`, not any one seat's
 * own per-seat status — a seat that wins because its opponent busted first
 * never itself transitions to `"WON"`, so match-level status is the only
 * correct source for this field in a 1v1 session. `seats` has one entry per
 * configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type Bobs27ResultsSnapshot = {
  status: "WON" | "LOST" | "COMPLETE";
  winningSideKey: string | null;
  seats: Bobs27SeatResult[];
};
```

Then change `Bobs27PlayContext`'s `resultsSnapshot` field to:

```ts
resultsSnapshot: Bobs27ResultsSnapshot | null;
```

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/bobs27-play.data.ts`, replace the entire `computeStats` function and the `ownerRef` function with:

```ts
function statsFor(
  seat: Bobs27SeatState,
  turns: readonly TurnFact[],
): Bobs27SeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const darts = seatTurns.reduce((sum, turn) => sum + turn.darts.length, 0);
  const hits = seatTurns.reduce(
    (sum, turn) =>
      sum +
      turn.darts.filter(
        (dart) =>
          dart.hitTargetNumber === dart.intendedTargetNumber &&
          dart.hitZoneKey === dart.intendedZoneKey,
      ).length,
    0,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.score,
    darts,
    doubleHitRate: accuracyDisplay(hits, darts),
    highestNumberReached: doublesPathTargetLabel(
      targetAt(doublesPath(), seat.targetIndex),
    ),
  };
}

function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
): Bobs27ResultsSnapshot {
  return {
    status: state.status as "WON" | "LOST" | "COMPLETE",
    winningSideKey: state.winningSideKey,
    seats: state.seats.map((seat) => statsFor(seat, turns)),
  };
}
```

Remove the now-unused `ownerRef` function entirely (it was only ever called from the old `uploadAndCompleteSession`). Add `Bobs27SeatState` to the `import type { ... } from "@modules/types"` block (currently `Bobs27State, DartObservation, TurnFact`) and add `Bobs27SeatResult`, `Bobs27ResultsSnapshot` to the `import type { Bobs27PlayContext, Bobs27PreviewSegment } from "./types"` block.

Replace the `uploadAndCompleteSession` method body:

```ts
uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
  return playUploadAndCompleteSession(this, (finalState) =>
    computeStats(finalState, this.$store.game.turns),
  );
},
```

Update the `resultsSnapshot: null as { ... } | null,` initializer in the factory's returned object to `resultsSnapshot: null as Bobs27ResultsSnapshot | null,`.

- [ ] **Step 5: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts
```

Expected: PASS, full file. This also re-runs the existing solo `"completion"` tests (`"wins and uploads results when BULL is cleared"`, `"loses when a full-miss visit drops the score to zero or below"`) — both assert the full flat `resultsSnapshot` shape today; since a solo session's `state.seats.length === 1` still yields `state.status` equal to that one seat's own `WON`/`LOST` (per `bobs27.engine.module.ts`'s `deriveState`: `status = seats.length === 1 ? seats[0].status : ...`), their expectations need updating to the new `seats: [...]` shape. Update both:

```ts
expect(play.resultsSnapshot).toEqual({
  status: "WON",
  winningSideKey: null,
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      score: 1437,
      darts: 63,
      doubleHitRate: "100.00%",
      highestNumberReached: "BULL",
    },
  ],
});
```

and

```ts
expect(play.resultsSnapshot).toEqual({
  status: "LOST",
  winningSideKey: null,
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      score: -13,
      darts: 3,
      doubleHitRate: "0.00%",
      highestNumberReached: "D1",
    },
  ],
});
```

Re-run:

```bash
cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts
```

Expected: PASS, full file.

- [ ] **Step 6: Wire the modal onto the shared components**

Replace the full contents of `app/src/components/layout/games/result-modals/Bobs27Results.astro` with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Score", key: "score" },
  { label: "Darts", key: "darts" },
  { label: "Accuracy", key: "doubleHitRate" },
  { label: "Highest target", key: "highestNumberReached" },
] as const;
---

<ResultsModalShell showSavedMessage>
  <div slot="title">
    {/* TODO: extract x-text logic into alpine function */}
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? (resultsSnapshot?.status === 'LOST' ? 'Game over!' : 'Winner!')
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins!')
      "
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
    </h2>
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-show="!(completionStatus === 'succeeded' && resultsSnapshot)"
      x-cloak
    >
      Match Summary
    </h2>
  </div>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

The title's two-`<h2>` pattern is untouched here — `03-result-modal-title-extraction.md` collapses it into one `x-text="resultsTitle()"` line. This task only touches the stat block and drops the resolved `// TODO: add the Multiplayer logic` comment.

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts
cd app && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/bobs27-play.data.ts app/tests/lib/game/bobs27-play.data.test.ts app/src/components/layout/games/result-modals/Bobs27Results.astro
git commit -m "Bob's 27: compute + render both seats' results stats, fix winner-by-opponent-bust status bug"
```

---

### Task 3: 121 (One Twenty One)

121 does **not** use the shared `playUploadAndCompleteSession` helper — its `uploadAndCompleteSession` is a bespoke inline upload path (like TUOD, Task 6), because it also owns the MINUTES-mode timer's expiry bookkeeping. This task wires `computeStats` by hand at the tail of that existing method, the same shape the method already has today.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/tests/lib/game/one-twenty-one-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` (Plan 1).
- Produces: `OneTwentyOneSeatResult`, `OneTwentyOneResultsSnapshot` — no other task consumes them.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/one-twenty-one-play.data.test.ts`, add a new test inside the existing `describe("computeStats target — generalizes off the owner seat's ladder position", ...)` block (find its `TWO_SEATS` constant, already declared near the top of the file at module scope per the earlier grep — reuse it):

```ts
it("computes both seats' own visits/average/target independently in a 1v1 match", async () => {
  vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
  vi.mocked(sessionsApi.completeSession).mockResolvedValue({
    sessionId: "session-1",
    statusKey: "COMPLETED",
    completedAt: "2026-08-14T10:00:00Z",
  });
  store.game.configSnapshot = { seats: TWO_SEATS } as any;
  const play = createPlay();
  play.engine = oneTwentyOneEngineFactory.create(
    store.game.configSnapshot as any,
  ) as any;
  play.engine!.record({ scoreAttempted: 100, finishedOnDouble: false });
  play.engine!.record({ scoreAttempted: 80, finishedOnDouble: false });
  store.game.recordFacts(play.engine!.facts());

  await play.uploadAndCompleteSession();

  expect(play.resultsSnapshot?.seats).toEqual([
    {
      participantRef: "participant-1",
      sideKey: "A",
      target: 121,
      visits: 1,
      average: 100,
    },
    {
      participantRef: "participant-2",
      sideKey: "B",
      target: 121,
      visits: 1,
      average: 80,
    },
  ]);
});
```

This mirrors the file's own existing `"still reports 170 and status WON for a genuine cap checkout"` test's setup style (`play.engine = oneTwentyOneEngineFactory.create(config)`, `play.engine!.record(...)`, `store.game.recordFacts(...)`) — the rota alternates by whole visit under `stageOwnership: "PER_SEAT"`, so the first `record` call belongs to seat A and the second to seat B. Both seats stay at the starting target (`121`) since a plain, non-checkout visit never advances `currentTarget`.

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t "computes both seats"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined`.

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the existing `OneTwentyOneResultsSnapshot`:

```ts
/** `target` is each seat's own current ladder position at completion. */
export type OneTwentyOneSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  visits: number;
  average: number;
};

/** `attempt` is 1-indexed: which attempt at the winning target succeeded —
 * always the attempt whose 3rd-or-earlier visit checked out at 170.
 * `status` is `"WON"` only for a genuine cap-170 checkout; a ROUNDS/MINUTES
 * session that stopped without reaching the cap reports `"COMPLETE"`. `seats`
 * has one entry per configured seat (1 for solo, 2 for 1v1), in
 * `$store.game.seats` order. */
export type OneTwentyOneResultsSnapshot = {
  target: number;
  status: "WON" | "COMPLETE";
  winningSideKey: string | null;
  seats: OneTwentyOneSeatResult[];
};
```

Note `target` stays at the top level too (unused by the components after this task rewires the modal in Step 6, but kept so this type doesn't silently drop a field other call sites might still read — grep confirms none do outside this file and its test, so this is precautionary only). `OneTwentyOnePlayContext.resultsSnapshot` already reads `OneTwentyOneResultsSnapshot | null` — no change needed there.

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/one-twenty-one-play.data.ts`, replace `computeStats` with:

```ts
function statsFor(
  seat: OneTwentyOneSeatState,
  turns: readonly TurnFact[],
): OneTwentyOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const total = seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    visits: seatTurns.length,
    average: seatTurns.length === 0 ? 0 : total / seatTurns.length,
  };
}

function computeStats(
  state: OneTwentyOneState,
  turns: readonly TurnFact[],
): OneTwentyOneResultsSnapshot {
  return {
    target: state.seats[0].currentTarget,
    winningSideKey: state.winningSideKey,
    status: state.status === "WON" ? "WON" : "COMPLETE",
    seats: state.seats.map((seat) => statsFor(seat, turns)),
  };
}
```

Remove the now-unused `owner: string | null` parameter and the file's local `ownerRef(seats)` function entirely (delete both — `ownerRef` was called only from the old `computeStats(finalState, turns, ownerRef(...))` call site being replaced below; add `OneTwentyOneSeatResult` to the `import type { ... } from "@lib/types"` block, remove the now-unused `SeatFact` import if `ownerRef` was its only consumer — confirm with a repo-wide check before removing:

```bash
grep -n "SeatFact" app/src/lib/game/one-twenty-one-play.data.ts
```

If that only shows the `import type` line and the deleted `ownerRef` signature, remove `SeatFact` from the import list too.

Replace the tail of `uploadAndCompleteSession`:

```ts
const finalState = this.state();
if (finalState) {
  this.resultsSnapshot = computeStats(finalState, this.$store.game.turns);
}
this.completionStatus = "succeeded";
```

(This is the same method — only the `computeStats(...)` call arguments change, dropping `ownerRef(this.$store.game.seats)`.)

- [ ] **Step 5: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts
```

Expected: PASS, full file — including the file's existing `"reports the ladder position reached at a ROUNDS completion..."` and `"still reports 170 and status WON..."` tests, which assert `.target`/`.status` at the top level only (still present, unchanged by this task) and don't need updating.

- [ ] **Step 6: Wire the modal onto the shared components**

Replace the full contents of `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro` with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Visits", key: "visits" },
  { label: "Average", key: "average.toFixed(2)" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status !== 'WON'
        ? 'Session complete'
        : (!resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
            ? '170 checked out!'
            : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' checks out 170!'))
    "
  >
  </h2>
  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts
cd app && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-play.data.ts app/tests/lib/game/one-twenty-one-play.data.test.ts app/src/components/layout/games/result-modals/OneTwentyOneResults.astro
git commit -m "121: compute + render both seats' results stats"
```

---

### Task 4: Doubles Training

This task also fixes a pre-existing, unrelated data-binding bug while rewiring the modal: `DoublesTrainingResults.astro`'s `STAT_ROWS` reads a stat row labeled "Hites" off key `"points"`, but the underlying type has never had a `points` field — it's always been `hits`. That row has rendered blank since it was written. Since this task is already rewriting every `STAT_ROWS` key to the new per-seat shape, fixing the key to `"hits"` is bundled in rather than deferred.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Modify: `app/tests/lib/game/doubles-training-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` (Plan 1).
- Produces: `DoublesTrainingSeatResult`, `DoublesTrainingResultsSnapshot` — no other task consumes them.

- [ ] **Step 1: Extend the failing test**

In `app/tests/lib/game/doubles-training-play.data.test.ts`, in the existing `describe("completion — 1v1", ...)` block, update the second test (`"names the most-doubles-hit seat as winner and scopes stats to the owner (PLAYER) seat"`) — replace its final assertions:

```ts
expect(play.finished).toBe(true);
expect(play.completionStatus).toBe("succeeded");
expect(play.resultsSnapshot?.status).toBe("COMPLETE");
expect(play.resultsSnapshot?.winningSideKey).toBe("A");
expect(play.resultsSnapshot?.seats).toEqual([
  {
    participantRef: "participant-1",
    sideKey: "A",
    hits: 21,
    on1st: 21,
    on2nd: 0,
    on3rd: 0,
    accuracy: "100.00%",
    misses: 0,
  },
  {
    participantRef: "participant-2",
    sideKey: "B",
    hits: 0,
    on1st: 0,
    on2nd: 0,
    on3rd: 0,
    accuracy: "0.00%",
    misses: 21,
  },
]);
```

(replacing the old single flat-object `expect(play.resultsSnapshot).toEqual({...})` assertion — the loop plays 21 rounds where seat A hits on the visit's 1st dart every round, seat B fully misses all 3 darts every round, so seat B's `misses` — a count of *visits* with no hit, per `DoublesTrainingSeatResult`'s existing semantics — is 21, one per round.)

Also rename the test to `"names the most-doubles-hit seat as winner, with both seats' own stats present"` since it no longer scopes to the owner only.

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts -t "completion — 1v1"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined`.

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the inline `resultsSnapshot: { hits: number; ...; } | null;` field inside `DoublesTrainingPlayContext` with a named pair, added just above the `DoublesTrainingPlayContext` type declaration:

```ts
export type DoublesTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  hits: number;
  on1st: number;
  on2nd: number;
  on3rd: number;
  accuracy: string;
  misses: number;
};

export type DoublesTrainingResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: DoublesTrainingSeatResult[];
};
```

Change `DoublesTrainingPlayContext`'s `resultsSnapshot` field to `resultsSnapshot: DoublesTrainingResultsSnapshot | null;`.

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/doubles-training-play.data.ts`, add a file-level `statsFor` function (above `export function doublesTrainingPlay()`):

```ts
function statsFor(seat: DoublesTrainingSeatState): DoublesTrainingSeatResult {
  const hitOutcomes = seat.outcomes.filter((outcome) => outcome.hit);
  const dartsThrown = seat.outcomes.reduce(
    (sum, outcome) => sum + (outcome.hitDartNumber ?? 3),
    0,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    hits: hitOutcomes.length,
    on1st: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 1).length,
    on2nd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 2).length,
    on3rd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 3).length,
    accuracy: accuracyDisplay(hitOutcomes.length, dartsThrown),
    misses: seat.outcomes.filter((outcome) => !outcome.hit).length,
  };
}
```

Add `DoublesTrainingSeatState` to the `import type { ... } from "@modules/types"` block (currently `DartObservation, DoublesTrainingState`) and `DoublesTrainingSeatResult`, `DoublesTrainingResultsSnapshot` to the `./types` import block.

Replace the `uploadAndCompleteSession` method body:

```ts
uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void> {
  return playUploadAndCompleteSession(this, (finalState) => ({
    status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
    winningSideKey: finalState.winningSideKey,
    seats: finalState.seats.map((seat) => statsFor(seat)),
  }));
},
```

This deletes the old `ownerRef` lookup and the inline per-owner `hitOutcomes`/`dartsThrown` block entirely.

- [ ] **Step 5: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts
```

Expected: PASS, full file. This also re-runs the existing solo `"completion"` tests (4 of them, asserting the full flat shape) — update each `expect(play.resultsSnapshot).toEqual({...})` to wrap the same fields (renaming `points`→ nothing, these already use `hits`/`on1st`/etc. correctly — confirm by re-reading `app/tests/lib/game/doubles-training-play.data.test.ts:449,483,516,542` before editing) in the new shape, e.g. the first one:

```ts
expect(play.resultsSnapshot).toEqual({
  status: "COMPLETE",
  winningSideKey: null,
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      hits: 21,
      on1st: 21,
      on2nd: 0,
      on3rd: 0,
      accuracy: "100.00%",
      misses: 0,
    },
  ],
});
```

Apply the same `{ status, winningSideKey, seats: [{ participantRef: "participant-1", sideKey: "A", ...oldFlatFields }] }` wrapping to the other 3 (`"splits hits across on1st/on2nd/on3rd..."`, `"counts a full-miss visit's 3 darts..."`, `"shows 0% accuracy..."`), keeping each test's existing numeric expectations unchanged — only the wrapping shape changes. Re-run:

```bash
cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts
```

Expected: PASS, full file.

- [ ] **Step 6: Wire the modal onto the shared components (and fix the `points`→`hits` key bug)**

Replace the full contents of `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro` with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Hits", key: "hits" },
  { label: "On 1st", key: "on1st" },
  { label: "On 2nd", key: "on2nd" },
  { label: "On 3rd", key: "on3rd" },
  { label: "Accuracy", key: "accuracy" },
  { label: "Misses", key: "misses" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'TIE'
        ? 'Tie — same doubles hit!'
        : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — most doubles hit!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

The label also changes from the original typo `"Hites"` to `"Hites"` corrected → `"Hits"` — fixing the copy alongside the key, since both were wrong together.

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts
cd app && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/doubles-training-play.data.ts app/tests/lib/game/doubles-training-play.data.test.ts app/src/components/layout/games/result-modals/DoublesTrainingResults.astro
git commit -m "Doubles Training: compute + render both seats' results stats, fix Hits/points key mismatch"
```

---

### Task 5: Singles Training

Singles Training is the one game in this plan where per-seat *status* (`"COMPLETE" | "TIE" | "WON" | "LOST"`) is genuinely asymmetric — a HARD/EXTREME-difficulty miss eliminates only the seat that missed, so `status` moves from a flat top-level field to a per-seat field on `SinglesTrainingSeatResult` (unlike the other 5 games in this plan, where `status` stays top-level). `resultStatusFor` already computes this correctly for the owner today — this task generalizes it to run once per seat instead of once for the owner.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Modify: `app/tests/lib/game/singles-training-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` (Plan 1).
- Produces: `SinglesTrainingSeatResult`, `SinglesTrainingResultsSnapshot` — no other task consumes them, but `03-result-modal-title-extraction.md`'s `resultsTitle()` for this game reads `resultsSnapshot.seats[...].status` (per-seat), not a top-level field — flag this for whoever runs that plan.

- [ ] **Step 1: Extend the failing tests**

In `app/tests/lib/game/singles-training-play.data.test.ts`, in `describe("completion — 1v1", ...)`, update the second test (`"names the higher-scoring seat as winner and scopes stats to the owner (PLAYER) seat"`) — replace its final assertions:

```ts
expect(play.finished).toBe(true);
expect(play.completionStatus).toBe("succeeded");
expect(play.resultsSnapshot?.winningSideKey).toBe("A");
const ownerResult = play.resultsSnapshot?.seats.find(
  (seat) => seat.participantRef === "participant-1",
);
expect(ownerResult?.status).toBe("COMPLETE");
expect(ownerResult?.points).toBeGreaterThan(0);
expect(ownerResult?.misses).toBe(0);
const opponentResult = play.resultsSnapshot?.seats.find(
  (seat) => seat.participantRef === "participant-2",
);
expect(opponentResult?.status).toBe("COMPLETE");
expect(opponentResult?.points).toBe(0);
```

(This scenario is score-compare, not elimination — neither seat misses under NORMAL difficulty, so both seats' own `status` reads `"COMPLETE"`, matching `finalState.status !== "TIE"` in the generalized `statusFor`.)

In `describe("completion — HARD/EXTREME elimination", ...)`, update the two 1v1 tests:

`"1v1: the surviving seat's owner sees status WON when the opponent fails under HARD"` — replace its final assertions:

```ts
expect(play.finished).toBe(true);
expect(play.resultsSnapshot?.winningSideKey).toBe("A");
expect(
  play.resultsSnapshot?.seats.find((s) => s.participantRef === "participant-1")
    ?.status,
).toBe("WON");
expect(
  play.resultsSnapshot?.seats.find((s) => s.participantRef === "participant-2")
    ?.status,
).toBe("LOST");
```

Rename this test to `"1v1: the surviving seat is WON and the failing seat is LOST, from either seat's own entry"` — the point of Issue 3 is that both seats are now visible in one snapshot, not just the owner's.

`"1v1: the failing seat's own owner sees status LOST"` — replace its final assertions:

```ts
expect(play.finished).toBe(true);
expect(
  play.resultsSnapshot?.seats.find((s) => s.participantRef === "participant-1")
    ?.status,
).toBe("LOST");
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts -t "completion"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined`.

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the inline `resultsSnapshot: { points: number; ...; } | null;` field inside `SinglesTrainingPlayContext` with a named pair, added just above the `SinglesTrainingPlayContext` type declaration:

```ts
/** `status` is this seat's own outcome — asymmetric under HARD/EXTREME
 * elimination, where one seat can read `"LOST"` while the other reads
 * `"WON"` from the same match. `"COMPLETE"`/`"TIE"` are score-compare
 * outcomes and always agree between both seats. */
export type SinglesTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  points: number;
  misses: number;
  singles: number;
  doubles: number;
  trebles: number;
  accuracy: string;
  status: "COMPLETE" | "TIE" | "WON" | "LOST";
};

export type SinglesTrainingResultsSnapshot = {
  winningSideKey: string | null;
  seats: SinglesTrainingSeatResult[];
};
```

Change `SinglesTrainingPlayContext`'s `resultsSnapshot` field to `resultsSnapshot: SinglesTrainingResultsSnapshot | null;`.

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/singles-training-play.data.ts`, rename `resultStatusFor`'s parameter from `ownerSeat` to `seat` (same body, now genuinely generic per seat):

```ts
function statusFor(
  finalState: SinglesTrainingState,
  seat: SinglesTrainingSeatState,
): "COMPLETE" | "TIE" | "WON" | "LOST" {
  if (seat.status === "LOST") return "LOST";
  if (finalState.seats.some((candidate) => candidate.status === "LOST"))
    return "WON";
  return finalState.status === "TIE" ? "TIE" : "COMPLETE";
}
```

Add a `statsFor` function right after it:

```ts
function statsFor(
  seat: SinglesTrainingSeatState,
  finalState: SinglesTrainingState,
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot | null,
): SinglesTrainingSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const { singles, doubles, trebles, misses } = config
    ? targetHitCounts(seatTurns, config)
    : { singles: 0, doubles: 0, trebles: 0, misses: 0 };
  const hits = singles + doubles + trebles;
  const darts = hits + misses;
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    points: seat.totalPoints,
    misses,
    singles,
    doubles,
    trebles,
    accuracy: accuracyDisplay(hits, darts),
    status: statusFor(finalState, seat),
  };
}
```

Add `SinglesTrainingSeatResult`, `SinglesTrainingResultsSnapshot` to the `./types` import block.

Replace the `uploadAndCompleteSession` method body:

```ts
uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void> {
  const config = this.$store.game.configSnapshot;
  return playUploadAndCompleteSession(this, (finalState) => ({
    winningSideKey: finalState.winningSideKey,
    seats: finalState.seats.map((seat) =>
      statsFor(seat, finalState, this.$store.game.turns, config),
    ),
  }));
},
```

This deletes the old `ownerRef` lookup and the inline owner-scoped block entirely.

- [ ] **Step 5: Run the tests, confirm they pass**

```bash
cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts
```

Expected: PASS, full file. This also re-runs the existing solo `"completion"` tests (2 of them, plus the solo HARD/EXTREME test) — update each `expect(play.resultsSnapshot).toEqual({...})` to the new `{ winningSideKey, seats: [{ ...oldFlatFieldsMinusWinningSideKey, status: "COMPLETE" }] }` shape, e.g.:

```ts
expect(play.resultsSnapshot).toEqual({
  winningSideKey: null,
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      points: 62,
      misses: 2,
      singles: 60,
      doubles: 1,
      trebles: 0,
      accuracy: "96.83%",
      status: "COMPLETE",
    },
  ],
});
```

and the "zero-darts" test analogously with all-zero fields and `status: "COMPLETE"`. The solo `"solo: failing a visit under HARD finishes the session with status LOST"` test in the elimination block already reads `play.resultsSnapshot?.status` — update it to read the per-seat field:

```ts
expect(play.finished).toBe(true);
expect(play.resultsSnapshot?.seats[0]?.status).toBe("LOST");
expect(play.resultsSnapshot?.winningSideKey).toBeNull();
```

Re-run:

```bash
cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts
```

Expected: PASS, full file.

- [ ] **Step 6: Wire the modal onto the shared components**

`SinglePlayerSummary`/`ComparisonSummary` read stats off `resultsSnapshot.seats[N]`, which is unaffected by `status` moving per-seat — `STAT_ROWS` never referenced `status` (that's title-only, handled in `03-result-modal-title-extraction.md`). Replace the full contents of `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro` with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Total points", key: "points" },
  { label: "Darts missed", key: "misses" },
  { label: "Singles hit", key: "singles" },
  { label: "Doubles hit", key: "doubles" },
  { label: "Trebles hit", key: "trebles" },
  { label: "Accuracy", key: "accuracy" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'LOST'
        ? (($store.game.seats?.length ?? 1) < 2
            ? 'Game over — missed the target'
            : 'Game over — you missed the target')
        : resultsSnapshot?.status === 'WON'
          ? ($store.game.seats.find((s) => s.sideKey !== resultsSnapshot.winningSideKey)?.displayName + ' missed the target — you win!')
          : resultsSnapshot?.status === 'TIE'
            ? 'Tie — same points!'
            : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
              ? 'Session complete'
              : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest points!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

The title `x-text` still reads `resultsSnapshot?.status` directly — that reference is now stale (the field moved to `resultsSnapshot.seats[...].status`), so this title is temporarily broken (always falls to the `else` branch since `resultsSnapshot?.status` is now `undefined`) until `03-result-modal-title-extraction.md` rewrites it as `resultsTitle()` reading the owner's own seat entry. This is expected and acceptable mid-plan-sequence breakage the spec's rollout order already accounts for (Issue 2 runs after Issue 3 specifically because Issue 3 changes the shapes Issue 2's titles read) — flag it in this task's commit message so it isn't mistaken for a bug.

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts
cd app && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts app/src/components/layout/games/result-modals/SinglesTrainingResults.astro
git commit -m "Singles Training: compute + render both seats' results stats (per-seat status)

Title still reads the now-stale top-level resultsSnapshot.status; fixed in
the title-extraction plan (03-result-modal-title-extraction.md), which reads
the owner's own seat entry instead."
```

---

### Task 6: Ten Up One Down (TUOD)

TUOD does **not** use the shared `playUploadAndCompleteSession` helper — like 121 (Task 3), its `uploadAndCompleteSession` is a bespoke inline upload path. Unlike every other game in this plan, TUOD's per-seat stats (`currentTarget`/`attempts`/`successes`/`failures`) already live directly on engine seat state — no `turns` filtering is needed at all, which simplifies this task to the smallest of the six.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Modify: `app/tests/lib/game/tuod-play.data.test.ts`
- Modify: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary`/`ComparisonSummary` (Plan 1).
- Produces: `TuodSeatResult`, updated `TuodResultsSnapshot` — no other task consumes them.

- [ ] **Step 1: Extend the failing test**

In `app/tests/lib/game/tuod-play.data.test.ts`, find `describe("session completion — 1v1", ...)` (around line 1221). It has two existing tests, both using `twoSeatRounds(1)` (`startingTarget: 41, finishBonus: 10, missPenalty: 1`).

In `"marks status TIE, with winningSideKey null, when both seats land on the same target"` (both seats call `recordAttempt(MISS)` once — `41 - missPenalty(1) = 40` for each), add after the existing `winningSideKey` assertion:

```ts
expect(component.resultsSnapshot?.seats).toEqual([
  {
    participantRef: "participant-1",
    sideKey: "A",
    target: 40,
    attempts: 1,
    successes: 0,
    failures: 1,
  },
  {
    participantRef: "participant-2",
    sideKey: "B",
    target: 40,
    attempts: 1,
    successes: 0,
    failures: 1,
  },
]);
```

In `"marks status COMPLETE, with the owning seat's sideKey, when one seat reaches the higher target"` (participant-1 calls `recordAttempt(CHECKOUT)` — `41 + finishBonus(10) = 51`; participant-2 calls `recordAttempt(MISS)` — `41 - 1 = 40`, per the test's own comment "participant-1 (side A) checks out, climbing to 51; participant-2 (side B) misses, falling to 40"), add after the existing `winningSideKey` assertion:

```ts
expect(component.resultsSnapshot?.seats).toEqual([
  {
    participantRef: "participant-1",
    sideKey: "A",
    target: 51,
    attempts: 1,
    successes: 1,
    failures: 0,
  },
  {
    participantRef: "participant-2",
    sideKey: "B",
    target: 40,
    attempts: 1,
    successes: 0,
    failures: 1,
  },
]);
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "session completion — 1v1"
```

Expected: FAIL — `resultsSnapshot?.seats` is `undefined`.

- [ ] **Step 3: Add the new types**

In `app/src/lib/game/types.ts`, replace the existing `TuodResultsSnapshot`:

```ts
export type TuodSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  attempts: number;
  successes: number;
  failures: number;
};

/** `winningSideKey` is score-compare (highest target) resolved by the
 * engine; `null` for a solo session or a TIE. `status` mirrors the engine's
 * own completion state, collapsed to just the two outcomes a finished
 * session can report: `COMPLETE` for a solo session or a decided 1v1 match,
 * `TIE` when both seats reached the same target — the only way callers can
 * tell a genuine tie apart from a solo session, since both leave
 * `winningSideKey` `null`. `seats` has one entry per configured seat (1 for
 * solo, 2 for 1v1), in `$store.game.seats` order. */
export type TuodResultsSnapshot = {
  winningSideKey: string | null;
  status: "COMPLETE" | "TIE";
  seats: TuodSeatResult[];
};
```

`TuodPlayContext.resultsSnapshot` already reads `TuodResultsSnapshot | null` — no change needed there.

- [ ] **Step 4: Rewrite the stat computation**

In `app/src/lib/game/tuod-play.data.ts`, replace `computeStats`:

```ts
function statsFor(seat: TuodSeatState): TuodSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    attempts: seat.attempts,
    successes: seat.successes,
    failures: seat.failures,
  };
}

function computeStats(state: TuodState): TuodResultsSnapshot {
  return {
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
    seats: state.seats.map((seat) => statsFor(seat)),
  };
}
```

Add `TuodSeatState` to the `import type { ... } from "@modules/types"` block and `TuodSeatResult` to the `./types` import block.

Update the tail of `uploadAndCompleteSession`:

```ts
const finalState = finalTuodState(this);
if (finalState) {
  this.resultsSnapshot = computeStats(finalState);
}
this.completionStatus = "succeeded";
```

This deletes the now-unused `ownerRef` lookup (`this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")?.participantRef ?? null;`) — `computeStats` no longer takes an owner argument.

- [ ] **Step 5: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts
```

Expected: PASS, full file — including the existing solo-path tests at lines 571 and 600, which assert the full flat shape today. Update both to the new `seats: [...]` wrapping (same pattern as every other task's solo-path update).

`"copies target/attempts/successes/failures into resultsSnapshot on success"` (line 557, one seeded turn `turnFact("t1", 1, 41)` against `rounds(20)`'s solo config):

```ts
expect(play.resultsSnapshot).toEqual({
  winningSideKey: null,
  status: "COMPLETE",
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      target: 51,
      attempts: 1,
      successes: 1,
      failures: 0,
    },
  ],
});
```

`"folds a mixed attempt log into the correct final target"` (line 581, three seeded turns: success 41→51, failure 51→50, success 50→60):

```ts
expect(play.resultsSnapshot).toEqual({
  winningSideKey: null,
  status: "COMPLETE",
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      target: 60,
      attempts: 3,
      successes: 2,
      failures: 1,
    },
  ],
});
```

Re-run:

```bash
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts
```

Expected: PASS, full file.

- [ ] **Step 6: Wire the modal onto the shared components**

Replace the full contents of `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro` with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Target reached", key: "target" },
  { label: "Attempts", key: "attempts" },
  { label: "Successes", key: "successes" },
  { label: "Failures", key: "failures" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'TIE'
        ? 'Tie — same target!'
        : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Game Summary'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest target!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

- [ ] **Step 7: Format and validate**

```bash
cd app && npm run format
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts
cd app && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-play.data.ts app/tests/lib/game/tuod-play.data.test.ts app/src/components/layout/games/result-modals/TenUpOneDownResults.astro
git commit -m "Ten Up One Down: compute + render both seats' results stats"
```

---

### Task 7: Visual verification + full validation pass

**Files:** none.

- [ ] **Step 1: Start the dev server**

```bash
cd app && astro dev --background
```

- [ ] **Step 2: Verify each of the 6 games' 1v1 results modal**

For each of Around the Clock, Bob's 27, 121, Doubles Training, Singles Training, Ten Up One Down: start a 1v1 session (add a guest opponent in setup), play it to completion, and confirm the `ComparisonSummary` block renders both seats' names and stat rows with plausible, non-blank values — not just the local player's. For Doubles Training specifically, confirm the "Hits" row (formerly "Hites"/`points`) now shows a real number instead of blank.

- [ ] **Step 3: Verify each game's solo results modal still renders correctly**

For each of the 6 games, play a solo session to completion and confirm `SinglePlayerSummary`'s solo `<dl>` still renders exactly as before — no regression from the type/computation changes.

- [ ] **Step 4: Stop the dev server**

```bash
cd app && astro dev stop
```

- [ ] **Step 5: Run the full validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits zero, including `npx fallow`, `scripts/check-test-coverage.sh` (every touched runtime `.ts` file has a paired test edit from Tasks 1–6), and the type gate reporting 0 errors/0 warnings/0 hints.

- [ ] **Step 6: Confirm format is clean**

```bash
cd app && npm run format:check
```

This plan does not run `context-maintenance` — the spec defers that to once, after all three issues land (see `03-result-modal-title-extraction.md`'s final task).
