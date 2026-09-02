# Preview seat-scoping fixes (Singles Training, Around the Clock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Singles Training's and Around the Clock's per-dart preview strips so a 1v1 session's preview is always scoped to the throwing seat's own turns, not the combined turn count or the store's already-rotated `activeParticipantRef` — closing FINDINGS.md F32 and F33.

**Architecture:** Both bugs are the same shape Shanghai already had and already fixed (`docs/superpowers/plans/2026-08-27-shanghai-preview-seat-scoping.md`): a preview function derives its round index or seat filter from a value that is correct for a solo session but wrong the instant a second seat's turns interleave. Each fix replaces the wrong-scoped derivation with one keyed off the *last turn's own* `participantRef`, mirroring Shanghai's already-shipped `previewSegmentsFor`. No shared code path between the two tasks — they touch different files and can be reviewed/committed independently.

**Tech Stack:** TypeScript, Alpine.js `.data.ts` play controllers, Vitest.

## Global Constraints

- Completed gameplay is immutable; these are pure derivation fixes, no persisted-fact-shape change (root `CLAUDE.md` Hard Invariants).
- `app/src/**/*.ts` — no `//`/`/* */` comments inside function/method bodies; JSDoc above the declaration only (`app/CLAUDE.md`).
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated (`app/CLAUDE.md`).
- `scripts/check-test-coverage.sh` (D224) requires every changed `app/src/**` file to have a touched covering test file in the same change set — both tasks already satisfy this by construction (each modifies exactly one source file and its one covering test file).
- Before every commit that touches `app/`: `cd app && npm run format` must be clean (`app/CLAUDE.md`).
- Every task uses a dedicated branch; commit only when asked; a completed task's branch is integrated into `main` via PR promptly (root `CLAUDE.md`).

---

## Task 1: F32 — Singles Training preview uses global turn count, not the throwing seat's own round

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts:183-199`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts` (new `describe` block inserted at line 588, between the closing `});` of `describe("previewSegments — reveal-then-clear timer", ...)` at line 587 and `describe("missCount / singleCount / doubleCount / trebleCount", ...)` at line 589)

**Interfaces:**
- Consumes: `SinglesConfigSnapshot`, `TurnFact`, `targetAt`, `numbersPath`, `trainingPointsFor`, `playPreviewSegments`, `EMPTY_SEGMENTS` — all already imported/declared in `singles-training-play.data.ts`; no new imports.
- Produces: no change to `previewSegmentsFor`'s signature (`turns`, `config`, `hiddenTurnKey` → `SinglesPreviewSegment[]`) or to `singlesTrainingPlay()`'s public `previewSegments` accessor — only the function body's internal derivation changes, so nothing downstream needs updating.

- [ ] **Step 1: Write the failing test**

Insert this new `describe` block into `app/tests/lib/game/singles-training-play.data.test.ts` at line 588 (immediately after the `});` that closes `describe("previewSegments — reveal-then-clear timer", ...)` on line 587, before `describe("missCount / singleCount / doubleCount / trebleCount", ...)`):

```typescript
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

  function twoSeatConfig(): Seated<SinglesSnapshot> {
    return { ...defaultConfig(), seats: TWO_SEATS };
  }

  /** `n` closed rounds (targets 1..n) for one named seat, each 3 SINGLE
   * hits — mirrors the file's own `priorTurnsThroughNumber`, parameterized
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

    // Seat A clears round 1 (target 1; 1 closed turn total so far).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat B clears round 1 too (2 closed turns total, 1 each).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat A's round 2, 1st dart: `recordTap` always builds the dart
    // against A's own `targetIndex` from `state()` (target 2) —
    // independent of the bug under test. Only `previewSegments`'s own
    // separate classification is being verified here. With the pre-fix
    // `turns.length - 1` logic, `turns.length` is 3 at this point (2
    // closed + 1 open), so it would check the dart's target(2) against
    // `targetAt(numbersPath, 2)` = target 3 and wrongly report "miss".
    await play.recordTap.call(play, "SINGLE");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("keeps classifying correctly once both seats pass round 10", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: interleavedPriorRounds(10),
    });
    await play.init.call(play);

    // It's seat A's turn for round 11 (0-indexed targetIndex 10, target
    // number 11). Pre-fix, `turns.length - 1` would be 20 at this point
    // (20 prior closed turns + this 1 open one, minus 1) — `targetAt`
    // would resolve index 20 (target 25, the array's last entry) instead
    // of index 10 (target 11), so the dart's target(11) is wrongly
    // checked against target 25 and reported "miss".
    await play.recordTap.call(play, "SINGLE");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts -t "previewSegments — 1v1 seat scoping"`
Expected: FAIL — both new `it` blocks report the first segment as `{ status: "miss" }` instead of the expected `{ status: "hit" }`.

- [ ] **Step 3: Write the minimal implementation**

In `app/src/lib/game/singles-training-play.data.ts`, replace lines 183-199 (the JSDoc comment and `previewSegmentsFor` function):

Before:
```typescript
/**
 * Every turn maps 1:1 to the target at its own array index (the engine only
 * ever opens a new turn once the previous one holds 3 darts), so the last
 * turn's target is always `targetAt(numbersPath(), turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  if (!config) return [...EMPTY_SEGMENTS];
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
  });
}
```

After:
```typescript
/**
 * Every turn maps 1:1 to the target at its own array index within the
 * throwing seat's own round (the engine only ever opens a new turn once
 * the previous one holds 3 darts), so the last turn's target is always
 * `targetAt(numbersPath(), seatRoundIndex)` — a count of `turns` filtered
 * to the last turn's own `participantRef`, not the combined `turns.length`
 * across both seats in a 1v1 session. No separate per-dart target
 * bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  if (!config) return [...EMPTY_SEGMENTS];
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), seatRoundIndex);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS — full file, including the pre-existing solo-session `previewSegments` tests (unaffected: `seatRoundIndex` equals `turns.length - 1` whenever every turn shares one `participantRef`).

- [ ] **Step 5: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "fix: scope Singles Training's preview target to the throwing seat's own round (F32)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

## Task 2: F33 — Around the Clock preview reads the wrong seat during the reveal window

**Files:**
- Modify: `app/src/lib/game/around-the-clock-play.data.ts:248-258`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts` (new `describe` block inserted at line 636, between the closing `});` of `describe("previewSegments — reveal-then-clear timer", ...)` at line 635 and `describe("accuracy", ...)` at line 637)

**Interfaces:**
- Consumes: `AroundTheClockPlayContext`, `AroundTheClockPreviewSegment`, `EMPTY_SEGMENTS`, `previewSegmentsFor` — all already declared/imported in `around-the-clock-play.data.ts`; no new imports. `this.engine` already exists on `AroundTheClockPlayContext` (`engine: null as AroundTheClockEngine | null`, line 173) and is already used as a guard elsewhere in the same file (line 273, 310).
- Produces: no change to the public `previewSegments()` accessor's signature or to `previewSegmentsFor(config, turns, hiddenTurnKey)`'s own signature — only which turns get passed in changes.

- [ ] **Step 1: Write the failing test**

Insert this new `describe` block into `app/tests/lib/game/around-the-clock-play.data.test.ts` at line 636 (immediately after the `});` that closes `describe("previewSegments — reveal-then-clear timer", ...)` on line 635, before `describe("accuracy", ...)`):

```typescript
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

  function twoSeatConfig(): Seated<AroundTheClockSnapshot> {
    return { seats: TWO_SEATS };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the just-closed turn's own darts during the 1.5s reveal window, not the newly active seat's empty log", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Seat A's first visit: two hits (targets 1, 2) then a MISS closes the
    // 3-dart turn. `seat-rota.module.ts`'s `activeSeat` rotates
    // `activeParticipantRef` to seat B the instant `completedAt` is set —
    // before the 1.5s reveal timer (`playCommitDart`) even starts. Reading
    // `previewSegments()` right here, with no timers advanced, is exactly
    // that reveal window: the pre-fix filter (`state.activeParticipantRef`,
    // already B) finds no turns for B yet and falls back to all-empty;
    // the fix scopes to the last turn's own `participantRef` (A) instead.
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "hit" },
      { status: "miss" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts -t "previewSegments — 1v1 seat scoping"`
Expected: FAIL — `previewSegments()` returns `[{ status: "empty" }, { status: "empty" }, { status: "empty" }]` instead of the expected hit/hit/miss array.

- [ ] **Step 3: Write the minimal implementation**

In `app/src/lib/game/around-the-clock-play.data.ts`, replace lines 248-258 (the `previewSegments` method):

Before:
```typescript
    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      if (!state || !config) return [...EMPTY_SEGMENTS];
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === state.activeParticipantRef,
      );
      return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
    },
```

After:
```typescript
    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config) return [...EMPTY_SEGMENTS];
      const turns = this.$store.game.turns;
      const lastParticipantRef = turns.at(-1)?.participantRef;
      const seatTurns = turns.filter(
        (turn) => turn.participantRef === lastParticipantRef,
      );
      return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: PASS — full file, including the pre-existing solo-session `previewSegments` tests and the reveal-then-clear timer test (unaffected: with one seat, `lastParticipantRef` always equals that seat's own ref, same as `state.activeParticipantRef` was).

- [ ] **Step 5: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/around-the-clock-play.data.ts app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "fix: scope Around the Clock's preview to the just-closed turn's own seat (F33)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

## Task 3: Validate, close F32/F33, and run context maintenance

**Files:**
- Modify: `FINDINGS.md:126-132` (delete the F32 block), `FINDINGS.md:154-160` (delete the F33 block)

**Interfaces:**
- Consumes: nothing from Tasks 1-2's code; reads their committed state.
- Produces: nothing consumed by a later task — this is the batch's closing step.

- [ ] **Step 1: Run the full validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints; `npx fallow` passes.

- [ ] **Step 2: Delete the F32 block from FINDINGS.md**

Remove `FINDINGS.md:126-132` in full (the `### F32 — ...` heading through its `Proposed:` line and the blank line immediately after it), so `### F34 — ...` (currently line 133) directly follows the entry that preceded F32.

- [ ] **Step 3: Delete the F33 block from FINDINGS.md**

Remove `FINDINGS.md:154-160` in full (the `### F33 — ...` heading through its `Proposed:` line and the blank line immediately after it), so `### F38 — ...` (currently line 161) directly follows the entry that preceded F33.

- [ ] **Step 4: Verify the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: passes — F32 and F33 no longer appear; all remaining ids stay unique and ≤ `highest-issued: F57` (unchanged, since no new finding is added).

- [ ] **Step 5: Commit the findings closure**

```bash
git add FINDINGS.md
git commit -m "docs: close F32, F33 — preview seat-scoping fixes landed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

- [ ] **Step 6: Run context maintenance**

Invoke the `context-maintenance` skill once for this whole batch (Tasks 1-3), not per-task. It covers CLAUDE.md sync, context-map registration, a `decisions/**` entry if warranted, the gate scripts, and the branch/PR check.

## Testing

- Task 1: `app/tests/lib/game/singles-training-play.data.test.ts` — new `describe("previewSegments — 1v1 seat scoping", ...)` block, 2 cases (basic seat-scoping, round-10+ regression).
- Task 2: `app/tests/lib/game/around-the-clock-play.data.test.ts` — new `describe("previewSegments — 1v1 seat scoping", ...)` block, 1 case (reveal-window seat scoping).
- Task 3: `npm run validate:app` (full suite + type gate + fallow) and `scripts/check-findings-log.sh`.

## Non-goals

No change to `shanghai-play.data.ts`'s own `previewSegmentsFor` (already correct — it is the reference implementation both fixes mirror). No change to `seat-rota.module.ts`'s `activeSeat` rotation timing (correct per its own contract; only each ruleset's preview use of it was wrong). No change to any gate script.
