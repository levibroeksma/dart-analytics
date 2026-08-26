# Doubles Training Summary Modal Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add On 1st / On 2nd / On 3rd hit-breakdown and Accuracy stats to the single-player Doubles Training results modal (GitHub issue #133).

**Architecture:** The engine already records, per resolved visit, whether it was a hit and which dart of the visit hit it (`DoublesVisitOutcome.hitDartNumber: 1 | 2 | 3 | null`). No engine/schema change is needed — this is a two-file change: extend the `resultsSnapshot` computation in `doubles-training-play.data.ts` (derive the four new fields from `ownerSeat.outcomes`, same spot that already derives `hits`/`misses`), then render four new rows in `DoublesTrainingResults.astro`.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Scope: Doubles Training single-player results modal only. Bob's 27, Singles Training, and multiplayer win/tie logic are untouched.
- No engine, schema, or migration change — `DoublesVisitOutcome.hitDartNumber` already exists (`app/src/modules/game/types.ts:80-84`).
- `app/src/**/*.ts`: no inline comments inside function bodies (JSDoc above the declaration only).
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated with source.
- Every changed `.ts` source file must be covered by a touched test (`scripts/check-test-coverage.sh`).
- Accuracy formatting matches existing precedent (`bobs27-play.data.ts`'s `doubleHitRate`, `singles-training-play.data.ts`'s `hitPercentage`): `"0%"` when the denominator is 0, else `` `${Math.round((hits / darts) * 100)}%` ``.
- `.astro` markup logic is not unit-tested (D101) — no test file for `DoublesTrainingResults.astro`.
- Run `cd app && npm run format` before considering any task done; `npm run format:check` must be clean.

Source design doc: `docs/superpowers/specs/2026-08-26-doubles-training-summary-stats-design.md`.

---

### Task 1: Extend `resultsSnapshot` with hit-breakdown and accuracy

**Files:**
- Modify: `app/src/lib/game/doubles-training-play.data.ts:72-77` (type), `:193-209` (`uploadAndCompleteSession`)
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts:420-440` (update), `:515-520` (update), plus new cases in the `describe("completion", ...)` block (after line 440)

**Interfaces:**
- Consumes: `DoublesTrainingState.seats[].outcomes: DoublesVisitOutcome[]` where `DoublesVisitOutcome = { targetIndex: number; hit: boolean; hitDartNumber: 1 | 2 | 3 | null }` (`app/src/modules/game/types.ts:80-91`, imported transitively — no new import needed).
- Produces: `DoublesTrainingPlayContext["resultsSnapshot"]` gains `on1st: number`, `on2nd: number`, `on3rd: number`, `accuracy: string`, read by Task 2's modal markup as `resultsSnapshot?.on1st` / `?.on2nd` / `?.on3rd` / `?.accuracy`.

- [ ] **Step 1: Update the two existing `resultsSnapshot` assertions to fail against the current (unextended) shape**

  In `app/tests/lib/game/doubles-training-play.data.test.ts`, replace the assertion in the `"captures the final hits/misses split in resultsSnapshot"` test (currently at line 434):

  ```ts
    expect(play.resultsSnapshot).toEqual({
      hits: 21,
      on1st: 21,
      on2nd: 0,
      on3rd: 0,
      accuracy: "100%",
      misses: 0,
      winningSideKey: null,
      status: "COMPLETE",
    });
  ```

  And replace the assertion in the `"names the most-doubles-hit seat as winner and scopes stats to the owner (PLAYER) seat"` test (currently at line 515):

  ```ts
    expect(play.resultsSnapshot).toEqual({
      hits: 21,
      on1st: 21,
      on2nd: 0,
      on3rd: 0,
      accuracy: "100%",
      misses: 0,
      winningSideKey: "A",
      status: "COMPLETE",
    });
  ```

  Both fixtures hit every one of the 21 visits on the 1st dart (`priorHitTurnsThroughDouble` injects one-dart hit turns; the 1v1 test's PLAYER seat calls `recordTap(true)` first every round), so `on1st: 21, on2nd: 0, on3rd: 0` and `accuracy: "100%"` (21 hits / 21 darts thrown) are the correct values once Task 1's implementation lands.

- [ ] **Step 2: Add three new test cases to the `describe("completion", ...)` block**

  Insert immediately after the (now-updated) `"captures the final hits/misses split in resultsSnapshot"` test, still inside `describe("completion", ...)`:

  ```ts
  it("splits hits across on1st/on2nd/on3rd and divides accuracy by darts actually thrown", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 5 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay();
    await play.init.call(play);

    // Visit 1 (D1): miss, hit — hitDartNumber 2, 2 darts thrown.
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);
    // Visit 2 (D2): miss, miss, hit — hitDartNumber 3, 3 darts thrown.
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({
      hits: 2,
      on1st: 0,
      on2nd: 1,
      on3rd: 1,
      accuracy: "40%",
      misses: 0,
      winningSideKey: null,
      status: "COMPLETE",
    });
  });

  it("counts a full-miss visit's 3 darts in accuracy's denominator", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 4 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay();
    await play.init.call(play);

    // Visit 1 (D1): miss, miss, miss — 3 darts thrown, 1 miss outcome.
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    // Visit 2 (D2): hit — hitDartNumber 1, 1 dart thrown.
    await play.recordTap.call(play, true);

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({
      hits: 1,
      on1st: 1,
      on2nd: 0,
      on3rd: 0,
      accuracy: "25%",
      misses: 1,
      winningSideKey: null,
      status: "COMPLETE",
    });
  });

  it("shows 0% accuracy, not NaN%, when no darts have been thrown", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 0, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({
      hits: 0,
      on1st: 0,
      on2nd: 0,
      on3rd: 0,
      accuracy: "0%",
      misses: 0,
      winningSideKey: null,
      status: "COMPLETE",
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  ```bash
  cd app && npm test -- doubles-training-play.data.test.ts
  ```

  Expected: FAIL — the 5 updated/new assertions report `on1st`/`on2nd`/`on3rd`/`accuracy` as `undefined` in the actual object (the current `resultsSnapshot` only has `hits`/`misses`/`winningSideKey`/`status`).

- [ ] **Step 4: Implement the extended `resultsSnapshot` type**

  In `app/src/lib/game/doubles-training-play.data.ts`, replace the `resultsSnapshot` type declaration (lines 72-77):

  ```ts
    resultsSnapshot: {
      hits: number;
      on1st: number;
      on2nd: number;
      on3rd: number;
      accuracy: string;
      misses: number;
      winningSideKey: string | null;
      status: "COMPLETE" | "TIE";
    } | null,
  ```

- [ ] **Step 5: Implement the extended computation**

  In the same file, replace the `uploadAndCompleteSession` method (lines 193-209):

  ```ts
    uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ??
          finalState.seats[0];
        const hitOutcomes = ownerSeat.outcomes.filter(
          (outcome) => outcome.hit,
        );
        const dartsThrown = ownerSeat.outcomes.reduce(
          (sum, outcome) => sum + (outcome.hitDartNumber ?? 3),
          0,
        );
        return {
          hits: hitOutcomes.length,
          on1st: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 1)
            .length,
          on2nd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 2)
            .length,
          on3rd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 3)
            .length,
          accuracy:
            dartsThrown === 0
              ? "0%"
              : `${Math.round((hitOutcomes.length / dartsThrown) * 100)}%`,
          misses: ownerSeat.outcomes.filter((outcome) => !outcome.hit).length,
          winningSideKey: finalState.winningSideKey,
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
        };
      });
    },
  ```

  (`outcome.hitDartNumber ?? 3` covers both cases in one expression: a hit outcome's `hitDartNumber` is always `1 | 2 | 3`, so `?? 3` never fires for it; a miss outcome's `hitDartNumber` is always `null`, so it falls back to `3` — matching the design doc's "a miss visit always threw all 3 darts" rule without a non-null assertion.)

- [ ] **Step 6: Run the tests to verify they pass**

  ```bash
  cd app && npm test -- doubles-training-play.data.test.ts
  ```

  Expected: PASS — all tests in the file green, including the 2 updated and 3 new `resultsSnapshot` assertions.

- [ ] **Step 7: Commit**

  ```bash
  cd app && npm run format
  git add app/src/lib/game/doubles-training-play.data.ts app/tests/lib/game/doubles-training-play.data.test.ts
  git commit -m "Add hit-breakdown and accuracy to Doubles Training resultsSnapshot"
  ```

---

### Task 2: Render the new stats in the results modal

**Files:**
- Modify: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro:32-41`

**Interfaces:**
- Consumes: `resultsSnapshot.on1st` / `.on2nd` / `.on3rd` / `.accuracy` (produced by Task 1), plus the pre-existing `.hits` / `.misses`.
- Produces: nothing consumed by a later task — this is the final rendering step.

- [ ] **Step 1: Add the four new `StatRow` entries**

  In `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`, replace the stats `<dl>` block (lines 32-41):

  ```astro
    {/* Stats: shown once the final hit/miss split is known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Hits"
        value="resultsSnapshot?.hits"
      />
      <StatRow
        label="On 1st"
        value="resultsSnapshot?.on1st"
      />
      <StatRow
        label="On 2nd"
        value="resultsSnapshot?.on2nd"
      />
      <StatRow
        label="On 3rd"
        value="resultsSnapshot?.on3rd"
      />
      <StatRow
        label="Accuracy"
        value="resultsSnapshot?.accuracy"
      />
      <StatRow
        label="Misses"
        value="resultsSnapshot?.misses"
      />
    </dl>
  ```

- [ ] **Step 2: Run the Astro conventions check**

  ```bash
  cd app && bash ../scripts/check-astro-conventions.sh
  ```

  Expected: PASS (no `x-init`, `x-show` paired with `x-cloak`, no `<!-- -->` template comments — all already satisfied by the pattern above).

- [ ] **Step 3: Format**

  ```bash
  cd app && npm run format
  ```

  Expected: exits 0; if it rewrites the file, re-check the diff still matches the intended markup.

- [ ] **Step 4: Commit**

  ```bash
  git add app/src/components/layout/games/result-modals/DoublesTrainingResults.astro
  git commit -m "Show On 1st/2nd/3rd and Accuracy in the Doubles Training results modal"
  ```

---

### Task 3: Full validation and manual smoke check

**Files:** none created or modified — verification only.

**Interfaces:**
- Consumes: the completed changes from Task 1 and Task 2.
- Produces: nothing — this is the plan's final gate.

- [ ] **Step 1: Run the full validation chain**

  ```bash
  cd app && npm run validate:app
  ```

  Expected: every step exits 0, including `npx fallow` and the type-check gate at `--minimumFailingSeverity hint` (0 errors, 0 warnings, 0 hints).

- [ ] **Step 2: Run the full test suite**

  ```bash
  cd app && npm test
  ```

  Expected: all suites pass, not just `doubles-training-play.data.test.ts` (full-suite-always-runs policy, `docs/architecture/07-Frontend/06-Test-Strategy.md`).

- [ ] **Step 3: Manual smoke check in the browser**

  Start the dev server in the background, play one full single-player Doubles Training session, and confirm the modal shows all six rows with sane values:

  ```bash
  cd app && astro dev --background
  ```

  Navigate to `/games/doubles-training/setup`, start a session, and record a mix of 1st-dart hits, 2nd/3rd-dart hits, and full-miss visits through to the bull. On the results modal, confirm: `Hits`, `On 1st`, `On 2nd`, `On 3rd`, `Accuracy`, `Misses` all render with values consistent with what was thrown (e.g. `On 1st + On 2nd + On 3rd === Hits`). Stop the server after:

  ```bash
  astro dev stop
  ```

- [ ] **Step 4: Run the context-maintenance skill**

  Invoke the `context-maintenance` skill per the root `CLAUDE.md` mandatory-every-task rule. This change touches no docs/schema/decisions (design doc already committed in the brainstorming step, no new decision needed — the design doc's own "Considered and rejected" section covers the only judgment calls made), so expect it to confirm there is nothing further to update and pass the findings/gate checks cleanly.

- [ ] **Step 5: Confirm branch state**

  ```bash
  git status
  git log --oneline origin/main..HEAD
  ```

  Expected: working tree clean, and the branch shows the design-doc commit plus Task 1's and Task 2's commits, all on `claude/findings-grouping-specs-aekw5m`.

---

## Self-Review Notes

- **Spec coverage:** design doc's `resultsSnapshot` shape (Task 1), modal row order Hits/On 1st/On 2nd/On 3rd/Accuracy/Misses (Task 2), accuracy formula and formatting precedent (Task 1 Step 5), TDD test list — 2nd/3rd-dart hit, full-miss denominator, zero-darts edge case (Task 1 Steps 1-2) — all covered. "Considered and rejected" alternatives require no task (they're explicitly not built).
- **Placeholder scan:** none — every step has literal file content, exact commands, and expected output.
- **Type consistency:** `on1st`/`on2nd`/`on3rd`/`accuracy` field names match exactly between Task 1's type declaration, Task 1's computation, Task 1's tests, and Task 2's `resultsSnapshot?.on1st` etc. bindings.
