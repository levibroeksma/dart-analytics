# Board-Dart Bull-As-Double Checkout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 501 and 121's board-dart (VISUAL_BOARD) checkout logic recognize a closing dart on the inner bull as a double, matching the fix TUOD already shipped for issue #207.

**Architecture:** Both games share `checkout-bust.module.ts`'s `resolveCheckoutAttempt`, which takes an `endedOnDouble: boolean` the caller computes. Each game has two call sites computing that boolean from a dart's `hitZoneKey`/`zoneKey`, and both currently test only `=== "DOUBLE"`. Add `|| ... === "INNER_BULL"` to all four call sites (two per game) — no change to `resolveCheckoutAttempt` itself.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- No change to `checkout-bust.module.ts`'s `resolveCheckoutAttempt` — it already takes the double-flag as a boolean parameter.
- No change to QUICK_SCORE capture (checkout is confirmed by an explicit user-supplied double flag there, not derived from a zone key — unaffected either way).
- No change to TUOD's already-fixed `visitOutcome` (reference pattern only).
- Closes `FINDINGS.md` F44 once both tasks land.

---

### Task 1: 501 board-dart bull-as-double fix

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts:453` (`settleVisit`), `:511` (`dartChecksOutFinalLeg`)
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt(remaining: number, thrown: number, endedOnDouble: boolean)` from `checkout-bust.module.ts` (unchanged signature).
- Produces: nothing new — both call sites keep their existing return shapes (`settleVisit(visit, hitZoneKey): boolean`, `dartChecksOutFinalLeg(observation, before): boolean`).

- [ ] **Step 1: Write the failing test for `settleVisit`'s bull-checkout**

In `app/tests/modules/game/five-oh-one.engine.module.test.ts`, inside the `describe("visual board capture", ...)` block (starts at line 761, which already defines a local `config` object with `startingScore: 501` and a local `dartAt` helper), add this test after the existing `it("deducts each dart from the remaining score as it lands", ...)` test:

```ts
  it("checks out on a single dart landing on the inner bull, treating it as the double for its own remainder", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 50 } as never,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(dartAt(0, 0, "INNER_BULL", 25));

    expect(engine.isComplete()).toBe(true);
    const turn = engine.facts().turns.at(-1)!;
    expect(turn.darts).toHaveLength(1);
    expect(turn.totalScore).toBe(50);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts -t "inner bull, treating it as the double for its own remainder"`
Expected: FAIL — `engine.isComplete()` is `false` (the visit busts instead of checking out, since `settleVisit` still tests `hitZoneKey === "DOUBLE"` alone).

- [ ] **Step 3: Write the failing test for `dartChecksOutFinalLeg`'s bull-checkout prediction**

In the same test file, inside the `describe("FiveOhOneEngine.wouldComplete — visual board", ...)` block (starts at line 862, local `config` has `startingScore: 40`, local `dartAt` helper), add this test after `it("is true for a first-dart checkout on the final leg", ...)`:

```ts
  it("is true for a first-dart checkout on the inner bull on the final leg", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 50 } as never,
      undefined,
    ) as FiveOhOneEngine;

    expect(engine.wouldComplete(dartAt(0, 0, "INNER_BULL", 25))).toBe(true);
  });
```

- [ ] **Step 4: Run both tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts -t "inner bull"`
Expected: both FAIL — `wouldComplete` returns `false` (the same missing `INNER_BULL` branch).

- [ ] **Step 5: Fix `settleVisit`**

In `app/src/modules/game/five-oh-one.engine.module.ts`, line 453:

```ts
      hitZoneKey === "DOUBLE" || hitZoneKey === "INNER_BULL",
```

(replaces `hitZoneKey === "DOUBLE",`)

- [ ] **Step 6: Fix `dartChecksOutFinalLeg`**

In `app/src/modules/game/five-oh-one.engine.module.ts`, line 511:

```ts
      resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
```

(replaces `resolved.zoneKey === "DOUBLE",`)

- [ ] **Step 7: Run both tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts -t "inner bull"`
Expected: PASS (both).

- [ ] **Step 8: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add app/src/modules/game/five-oh-one.engine.module.ts app/tests/modules/game/five-oh-one.engine.module.test.ts
git commit -m "fix(501): recognize inner-bull board dart as a checkout double"
```

---

### Task 2: 121 board-dart bull-as-double fix

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts:501` (`settleVisit`), `:640` (`wouldCompleteDart`, which calls `dartChecksOutFinalLeg`-equivalent logic inline — see Note below)
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt(remaining: number, thrown: number, endedOnDouble: boolean)` from `checkout-bust.module.ts` (unchanged signature).
- Produces: nothing new — `settleVisit(visit: TurnFact): boolean` and `wouldCompleteDart(observation: DartObservation): boolean` keep their existing signatures.

**Note:** the source spec (`docs/superpowers/specs/2026-09-02-board-dart-bull-double-checkout-design.md`) names the second call site's containing method as `dartChecksOutFinalLeg`, mirroring 501's naming. Verified against the current file: 121 has no method by that name — the `resolved.zoneKey === "DOUBLE"` check at line 640 lives directly inside `wouldCompleteDart` (the checkout-prediction method `wouldComplete` delegates to for a dart-shaped input). Same call site, same fix, correct method name below.

- [ ] **Step 1: Write the failing test for `settleVisit`'s bull-checkout**

In `app/tests/modules/game/one-twenty-one.engine.module.test.ts`, inside the `describe("visual board capture", ...)` block (starts at line 483, local `dartAt` helper already defined, `config()` returns `{ seats: SEATS }` — a `121_V1` config whose seat starts at `remainingInAttempt: 121`), add this test after the existing `it("deducts each dart from the remaining live total as it lands", ...)` test:

```ts
  it("checks out on a single dart landing on the inner bull, treating it as the double for its own remainder", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    engine.record({ scoreAttempted: 71 });
    expect(engine.state().seats[0].remainingInAttempt).toBe(50);

    const state = engine.record(dartAt(0, 0, "INNER_BULL", 25));

    expect(state.seats[0].attemptsCompleted).toBe(1);
    const turn = engine.facts().turns.at(-1)!;
    expect(turn.totalScore).toBe(50);
    expect(turn.completedAt).not.toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "inner bull, treating it as the double for its own remainder"`
Expected: FAIL — the visit busts (`turn.totalScore` is `0`, `attemptsCompleted` stays `0`) instead of checking out, since `settleVisit` still tests `lastDart.hitZoneKey === "DOUBLE"` alone.

- [ ] **Step 3: Write the failing test for `wouldCompleteDart`'s bull-checkout prediction**

In the same test file, inside the `describe("oneTwentyOneV2EngineFactory", ...)` block's nested `describe("ROUNDS", ...)` block (starts at line 1248, whose enclosing `describe` defines a local `v2Config(durationType, durationValue?)` helper), add this test after `it("completes early via a checkout that reaches the round budget, and wouldComplete predicts it", ...)`:

```ts
    it("recognizes an inner-bull checkout dart the same as a double, completing the round early (F44)", () => {
      const dartAt = (
        x: number,
        y: number,
        hitZoneKey: DartZoneKey,
        hitTargetNumber: number | null,
      ): DartObservation => ({
        hitTargetNumber,
        hitZoneKey,
        locationX: x,
        locationY: y,
      });
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 1));
      engine.record({ scoreAttempted: 71 });

      expect(engine.wouldComplete(dartAt(0, 0, "INNER_BULL", 25))).toBe(true);

      const after = engine.record(dartAt(0, 0, "INNER_BULL", 25));
      expect(engine.isComplete()).toBe(true);
      expect(after.seats[0].attemptsCompleted).toBe(1);
    });
```

- [ ] **Step 4: Run both tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "inner bull"`
Expected: both FAIL — same missing `INNER_BULL` branch, this time in `wouldCompleteDart`.

- [ ] **Step 5: Fix `settleVisit`**

In `app/src/modules/game/one-twenty-one.engine.module.ts`, line 501:

```ts
      lastDart.hitZoneKey === "DOUBLE" || lastDart.hitZoneKey === "INNER_BULL",
```

(replaces `lastDart.hitZoneKey === "DOUBLE",`)

- [ ] **Step 6: Fix `wouldCompleteDart`**

In `app/src/modules/game/one-twenty-one.engine.module.ts`, line 640:

```ts
      resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
```

(replaces `resolved.zoneKey === "DOUBLE",`)

- [ ] **Step 7: Run both tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "inner bull"`
Expected: PASS (both).

- [ ] **Step 8: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add app/src/modules/game/one-twenty-one.engine.module.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "fix(121): recognize inner-bull board dart as a checkout double"
```

---

### Task 3: Close FINDINGS.md F44 and run the full gate suite

**Files:**
- Modify: `FINDINGS.md`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 beyond their being complete and committed.
- Produces: nothing — terminal task.

- [ ] **Step 1: Delete the F44 block**

In `FINDINGS.md`, delete this entire block (currently lines 161-166, immediately after F27's block and before F43's):

```markdown
### F44 — 501 and 121 have the same board-dart bull-as-double bust bug fixed in TUOD by issue #207
Status: Open · Found: 2026-08-30 · Task: claude/issue-207-wphu7l
Claim: issue #207 reported that TUOD's board-dart (VISUAL_BOARD) checkout logic never recognized a closing dart on the inner bull as a double — `visitOutcome`'s `endedOnDouble` check tested `lastZoneKey === "DOUBLE"` only, so a bull-out finish busted instead of checking out; fixed on this branch by also accepting `"INNER_BULL"`. `five-oh-one.engine.module.ts` and `one-twenty-one.engine.module.ts` share `checkout-bust.module.ts`'s `resolveCheckoutAttempt` for the identical rule and compute the same `endedOnDouble` boolean the same way
Evidence: `app/src/modules/game/five-oh-one.engine.module.ts:453` (`hitZoneKey === "DOUBLE"` in `settleVisit`) and `:511` (`resolved.zoneKey === "DOUBLE"` in `dartChecksOutFinalLeg`); `app/src/modules/game/one-twenty-one.engine.module.ts:501` and `:640`, same pattern — neither ORs in `"INNER_BULL"`. No test in either engine's test suite exercises a board-dart checkout landing on the inner bull (`app/tests/modules/game/five-oh-one.engine.module.test.ts`'s only `INNER_BULL` case is a plain-dart classification test, not a checkout)
Impact: in VISUAL_BOARD capture, a 501 or 121 player finishing a leg/visit with their last dart on the bullseye (remainder exactly 50) is scored as a bust instead of a checkout — the same player-facing defect issue #207 reported for TUOD, unreported for these two games so far. QUICK_SCORE keypad capture is unaffected in both (checkout is confirmed by an explicit user-supplied double flag, not derived from a zone key)
Proposed: apply the identical `lastZoneKey === "DOUBLE" || lastZoneKey === "INNER_BULL"` (or equivalent for `dartChecksOutFinalLeg`'s `resolved.zoneKey`) fix to both call sites in each file, with a regression test mirroring the two added to `app/tests/modules/game/tuod.engine.module.test.ts` on this branch — small, mechanical, but two more engines and their own test files, so a separate task
```

Leave the blank line separating F27's and F43's blocks intact (do not create a double blank line or remove the single one).

- [ ] **Step 2: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0 (F44 no longer cited, `highest-issued` unchanged — deletions never bump it).

- [ ] **Step 3: Run the full `run-all-gates` suite**

Invoke the `run-all-gates` skill's "Always run" set plus the "If `app/` changed" set (this task touched `app/src/` and `app/tests/`). State each script's result explicitly in the completion report — do not summarize as "gates pass" without having run every applicable script.

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format && npm run format:check
cd ..
git add FINDINGS.md
git commit -m "docs: close F44 — board-dart bull-as-double checkout fixed for 501 and 121"
```

## Testing

Covered inline per task: Task 1 adds two Vitest cases to `five-oh-one.engine.module.test.ts` (one per fixed call site), Task 2 adds two to `one-twenty-one.engine.module.test.ts` (one per fixed call site), each proven red-then-green against the exact line it fixes. Task 3 is doc-only (`FINDINGS.md` entry deletion), verified by the findings gate script, not a test file.

## Non-goals

No change to `checkout-bust.module.ts`'s `resolveCheckoutAttempt`. No change to QUICK_SCORE capture. No change to TUOD's `visitOutcome` (already fixed, reference pattern only). No change to `checkout-bust.module.ts`'s callers beyond the four lines named above.
