# Shanghai: seat-scoped dart preview (Issue #166, part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix #166's dart-preview bug — Shanghai's `previewSegments()` misclassifies darts in 1v1 sessions (and eventually throws, past round ~11) because it derives the round target from the combined turn count across both seats instead of the throwing seat's own round.

**Architecture:** `previewSegmentsFor` in `shanghai-play.data.ts` computes the throwing seat's own round index by counting only the last turn's own `participantRef` among `turns`, instead of `turns.length - 1`. No engine change, no new files — a one-function fix plus its covering tests.

**Tech Stack:** TypeScript, Vitest, Alpine.js.

## Global Constraints

- Scope: `app/src/lib/game/shanghai-play.data.ts` and its test file only. Do not touch Singles Training (`singles-training-play.data.ts`) or Around the Clock (`around-the-clock-play.data.ts`) — both carry a related-but-distinct latent bug, confirmed out of scope in brainstorming; each gets its own `FINDINGS.md` entry as part of Part 2 of this issue's work (`docs/superpowers/plans/2026-08-27-shanghai-results-stats.md`), not this plan.
- `app/CLAUDE.md`: no `//` or `/* */` comments inside function bodies in `app/src/**/*.ts` (JSDoc above the declaration only); tests mirror `app/src/`'s directory structure under `app/tests/`, never colocated; every source edit needs a covering test edit (`scripts/check-test-coverage.sh`).
- Run `cd app && npm run format` before considering any task done.
- This plan's own final task runs `validate:app` and the applicable `run-all-gates` scripts, but **not** `context-maintenance`'s findings-log step — that is deferred to the companion plan (`2026-08-27-shanghai-results-stats.md`), which lands last and logs both new findings (Singles Training, Around the Clock) in one pass so the high-water mark only moves once.

---

### Task 1: Seat-scope `previewSegmentsFor`'s round index

**Files:**

- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**

- Consumes: nothing new — `TurnFact` (already imported), `targetNumberAt` (already private to this file).
- Produces: no new public API — `previewSegments()`'s existing return type (`ShanghaiPreviewSegment[]`) is unchanged; only the classification it computes changes for multi-seat sessions.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `app/tests/lib/game/shanghai-play.data.test.ts`, immediately after the closing `});` of the existing `describe("previewSegments — reveal-then-clear timer", ...)` block (after line 584 in the current file, right before `describe("completion", ...)`):

```ts
describe("previewSegments — 1v1 seat scoping", () => {
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

  function twoSeatConfig(): Seated<ShanghaiSnapshot> {
    return { seats: TWO_SEATS };
  }

  /** `n` closed rounds (numbers 1..n) for one named seat, each 3 SINGLE
   * hits — mirrors the file's own `priorRoundsThroughNumber`, parameterized
   * by seat so two seats' prior rounds can be interleaved in one `turns`
   * array. `sequence` is offset by `seqOffset` so two seats' turns never
   * collide on the same sequence number. */
  function priorRoundsFor(
    participantRef: string,
    n: number,
    seqOffset: number,
  ): TurnFact[] {
    const turns: TurnFact[] = [];
    for (let number = 1; number <= n; number += 1) {
      const darts: DartFact[] = [1, 2, 3].map((seq) => ({
        sequence: seq,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: number,
        hitZoneKey: "SINGLE",
        score: number,
        locationX: null,
        locationY: null,
      }));
      turns.push({
        clientKey: `${participantRef}-round-${number}`,
        stageClientKey: "block-1",
        participantRef,
        sequence: seqOffset + number,
        completedAt: "2026-08-14T10:00:00.000Z",
        totalScore: darts.reduce((sum, d) => sum + d.score, 0),
        darts,
      });
    }
    return turns;
  }

  /** Both seats' first `n` rounds, interleaved A, B, A, B, ... — the shape
   * a real 1v1 session's turn log actually has (alternating throwers), not
   * every seat's rounds grouped together. */
  function interleavedPriorRounds(n: number): TurnFact[] {
    const a = priorRoundsFor("participant-1", n, 0);
    const b = priorRoundsFor("participant-2", n, n);
    const merged: TurnFact[] = [];
    for (let i = 0; i < n; i += 1) {
      merged.push(a[i], b[i]);
    }
    return merged;
  }

  it("classifies a dart against the throwing seat's own round, not the combined turn count", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Seat A clears round 1 (1 closed turn total so far).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat B clears round 1 too (2 closed turns total, 1 each).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat A's round 2, 1st dart: `recordTap` itself always builds the dart
    // against A's own `targetIndex` from `state()` (target number 2) —
    // independent of the bug under test. Only `previewSegments`'s own
    // separate classification is being verified here. With the pre-fix
    // `turns.length - 1` logic, `turns.length` is 3 at this point (2 closed
    // + 1 open) so it would check dart.hitTargetNumber(2) against
    // targetNumberAt(2) = 3 and wrongly report "miss".
    await play.recordTap.call(play, "SINGLE");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("keeps classifying correctly once both seats pass round 10 — reported: preview stops working past target 11", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: interleavedPriorRounds(10),
    });
    await play.init.call(play);

    // It's seat A's turn for round 11 (0-indexed targetIndex 10, target
    // number 11). Pre-fix, `turns.length - 1` would be 20 at this point (20
    // prior closed turns + this 1 open one, minus 1) — `targetNumberAt(20)`
    // throws, since Shanghai's numbers path only covers indices 0..19
    // before the terminal BULL entry. This reproduces the issue's own
    // "preview stops working past target 11" report as a literal throw.
    await play.recordTap.call(play, "SINGLE");

    expect(() => play.previewSegments.call(play)).not.toThrow();
    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts -t "1v1 seat scoping"`
Expected: FAIL — the first case reports `{ status: "miss" }` instead of `{ status: "hit" }` for the first segment; the second case throws (`Shanghai never reaches the BULL target`).

- [ ] **Step 3: Implement the fix**

In `app/src/lib/game/shanghai-play.data.ts`, replace the existing `previewSegmentsFor` function (currently reading `turns.length - 1` inside its `classify` callback, with the JSDoc above it explaining that reasoning):

```ts
/**
 * The last resolved turn maps 1:1 to the round at its own array index (the
 * engine only ever opens a new turn once the previous one holds 3 darts), so
 * its round's number is always `targetNumberAt(turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(turns.length - 1);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}
```

with:

```ts
/**
 * The last resolved turn maps 1:1 to the round at its own array index within
 * that turn's own seat's history — never `turns.length - 1`, which counts
 * every seat's turns together and is wrong the moment a 1v1 session's turns
 * interleave (issue #166). `seatRoundIndex` is computed once from a count of
 * `turns` filtered to the last turn's own `participantRef`, so a solo
 * session (where every turn already belongs to the one seat) computes the
 * exact same value `turns.length - 1` always gave it — no behavior change
 * there.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(seatRoundIndex);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS, every test in the file green (including the pre-existing solo-session `previewSegments` tests — this change must not alter their outcomes, since a solo session's `seatRoundIndex` reduces to the same `turns.length - 1` value it always computed).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "Seat-scope Shanghai's dart-preview round index in 1v1 (#166)"
```

---

### Task 2: Full validation

**Files:** none new — validation only.

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints. If `db:status`/`db:migrate`/`db:introspect` cannot run in this environment (no `DATABASE_URL`), that is an environment limitation, not a gap in this change — no migration or schema is touched. Note it explicitly rather than skipping silently, and still run every other step in the chain (`npx fallow`, `npm test`, `npm run check`, `npm run format:check`).

- [ ] **Step 2: Run the applicable `run-all-gates` scripts**

Invoke the `run-all-gates` skill. This plan touches only `app/`, so run the "Always run" set plus the "If `app/` changed" set. Do **not** run `context-maintenance`'s findings-log step here — see this plan's Global Constraints; the two new findings land together in the companion plan.

## Self-review notes

- Spec coverage: this plan covers the design spec's Section 1 ("Preview fix — seat-scoped round index") in full, including the "correct for solo play too" claim (verified by the existing solo tests staying green) and the two out-of-scope findings (Singles Training, Around the Clock) being deferred to the companion plan rather than dropped.
- No placeholders: every step shows exact code, exact old/new snippets, and exact commands with expected results.
- Type consistency: `previewSegmentsFor(turns: readonly TurnFact[], hiddenTurnKey: string | null): ShanghaiPreviewSegment[]` keeps its existing signature — no caller (`previewSegments(this: ShanghaiPlayContext)`) needs a change.
