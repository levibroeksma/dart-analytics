# Accuracy Formatting Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #173 — accuracy/hit-rate percentages round to whole numbers (surfacing as multiples-of-10% in Doubles Training) instead of the 2 decimal places the user wants, and the rounding logic is duplicated across 5 files instead of being consistent.

**Architecture:** Extract one shared `accuracyDisplay(hits, darts): string` helper into the existing shared-stats module `app/src/lib/game/play-visit-stats.ts`, point all 5 hit-rate call sites at it, and document the convention as a new Pattern in the architecture-patterns doc plus a decision record. No field renames, no `.astro` changes — result modals already render the field's string value as-is.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- TDD mandatory: red → green → refactor for every code change (`app/CLAUDE.md`).
- A source edit to a runtime `.ts` file under `app/src/` with no accompanying test edit fails `scripts/check-test-coverage.sh` (D224) — every task below touches its own test file in the same commit.
- Minimal diffs; never regenerate docs wholesale (root `CLAUDE.md`).
- Decisions are append-only: never edit an existing block in `decisions/**` (root `CLAUDE.md`).
- Never modify applied migrations — not applicable here (no schema change).
- `npm run format` and `npm run format:check` must be clean before considering any task done (`app/CLAUDE.md`).
- Full validation standard: `npm run validate:app` must exit 0 with 0 errors/0 warnings/0 hints (`app/CLAUDE.md`) — run at the end per the `validate-app` skill.
- Context Maintenance (root `CLAUDE.md`) is mandatory before claiming the overall task done — final task below runs the `context-maintenance` skill.
- Every commit is a real commit on the current branch (`claude/issue-174-brainstorming-ic7ewt`); never amend, never force-push.

---

### Task 1: Add the shared `accuracyDisplay` helper

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts`
- Test: `app/tests/lib/game/play-visit-stats.test.ts`

**Interfaces:**
- Produces: `accuracyDisplay(hits: number, darts: number): string` — hits/darts as a percentage, always formatted to exactly 2 decimal places (`toFixed(2)`), `"0.00%"` when `darts === 0`. Exported from `app/src/lib/game/play-visit-stats.ts`, imported elsewhere as `@lib/game/play-visit-stats`.

- [ ] **Step 1: Write the failing tests**

Add to the end of `app/tests/lib/game/play-visit-stats.test.ts` (after the existing `import` line, add `accuracyDisplay` to the imported names):

```typescript
import {
  previousScoreDisplay,
  dartsThrownCount,
  perVisitAverageDisplay,
  threeDartAverageDisplay,
  accuracyDisplay,
} from "@lib/game/play-visit-stats";
```

Append this new `describe` block at the end of the file:

```typescript
describe("accuracyDisplay", () => {
  it('returns "0.00%" when no darts have been thrown', () => {
    expect(accuracyDisplay(0, 0)).toBe("0.00%");
  });

  it("formats an exact percentage to 2 decimal places", () => {
    expect(accuracyDisplay(1, 2)).toBe("50.00%");
  });

  it("formats a repeating-decimal percentage to 2 decimal places, not rounded to a whole number", () => {
    expect(accuracyDisplay(1, 3)).toBe("33.33%");
  });

  it("formats 100% with 2 decimal places", () => {
    expect(accuracyDisplay(63, 63)).toBe("100.00%");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`
Expected: FAIL — `accuracyDisplay` is not exported from `@lib/game/play-visit-stats`.

- [ ] **Step 3: Implement `accuracyDisplay`**

Append to `app/src/lib/game/play-visit-stats.ts`:

```typescript
/**
 * `hits`/`darts` as a percentage, formatted to exactly 2 decimal places;
 * `"0.00%"` before any dart is thrown. The single shared implementation
 * for every ruleset's hit-rate percentage (Pattern 20,
 * `04-Architecture-patterns.md`) — never reimplement with a local
 * `Math.round`/`toFixed` calculation.
 */
export function accuracyDisplay(hits: number, darts: number): string {
  if (darts === 0) return "0.00%";
  return `${((hits / darts) * 100).toFixed(2)}%`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`
Expected: PASS — all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-visit-stats.ts app/tests/lib/game/play-visit-stats.test.ts
git commit -m "Add shared accuracyDisplay helper for 2-decimal hit-rate formatting"
```

---

### Task 2: Point Around the Clock at the shared helper

**Files:**
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts`

**Interfaces:**
- Consumes: `accuracyDisplay(hits: number, darts: number): string` from Task 1.

Around the Clock already formats to 2 decimals via its own local `accuracyLabel` function, except its two `"0%"` fallback paths (no state yet / no config snapshot yet), which stay at the old 1-digit format. This task removes the duplicate local function and fixes those two fallbacks.

- [ ] **Step 1: Update the test to expect the fixed fallback**

In `app/tests/lib/game/around-the-clock-play.data.test.ts`, line 521:

```typescript
    expect(play.accuracy.call(play)).toBe("0%");
```

becomes:

```typescript
    expect(play.accuracy.call(play)).toBe("0.00%");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts -t "is 0% before any dart is thrown"`
Expected: FAIL — received `"0%"`, expected `"0.00%"`.

- [ ] **Step 3: Replace the local `accuracyLabel` with the shared helper**

In `app/src/lib/game/around-the-clock-play.data.ts`, add the import (alongside the existing `@lib/game/play-lifecycle` import block, around line 18):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Delete the local function (currently lines 118–121):

```typescript
/** `hits`/`darts` as a percentage, rounded to 2 decimals; "0%" before any dart is thrown. */
function accuracyLabel(hits: number, darts: number): string {
  return darts === 0 ? "0%" : `${((hits / darts) * 100).toFixed(2)}%`;
}
```

Replace the two call sites and their `"0%"` fallbacks:

```typescript
    accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot!;
      const turns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return accuracyDisplay(countHits(config, turns), countDarts(turns));
    },

    accuracy(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0.00%";
      return this.accuracyFor(state.activeParticipantRef);
    },
```

and:

```typescript
      return playUploadAndCompleteSession(this, () => ({
        turns: ownerTurns.length,
        accuracy: config
          ? accuracyDisplay(countHits(config, ownerTurns), countDarts(ownerTurns))
          : "0.00%",
        totalDarts: countDarts(ownerTurns),
        winningSideKey: state?.winningSideKey ?? null,
        status: (state?.status ?? "COMPLETE") as "COMPLETE" | "TIE",
      }));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: PASS — all tests in the file green (the `"34.43%"` and `"50.00%"` cases are unaffected since they never hit the fallback path).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/around-the-clock-play.data.ts app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "Around the Clock: use shared accuracyDisplay, fix 0% fallback to 0.00%"
```

---

### Task 3: Fix Bob's 27's `doubleHitRate` rounding

**Files:**
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Test: `app/tests/lib/game/bobs27-play.data.test.ts`

**Interfaces:**
- Consumes: `accuracyDisplay(hits: number, darts: number): string` from Task 1.

- [ ] **Step 1: Update the test assertions**

In `app/tests/lib/game/bobs27-play.data.test.ts`, update the 3 `doubleHitRate` assertions:

```bash
cd app && sed -i \
  -e 's/doubleHitRate: "0%",/doubleHitRate: "0.00%",/' \
  -e 's/doubleHitRate: "100%",/doubleHitRate: "100.00%",/' \
  tests/lib/game/bobs27-play.data.test.ts
```

This touches lines 265, 364, 399 (`"0%"` → `"0.00%"` at 265 and 399; `"100%"` → `"100.00%"` at 364) — confirmed the sole 3 occurrences of `doubleHitRate:` in the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: FAIL — 3 assertions receive the old whole-number strings.

- [ ] **Step 3: Replace the inline calculation**

In `app/src/lib/game/bobs27-play.data.ts`, add the import (alongside the existing `@lib/game/board-input.data` import, around line 7):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Replace line 68:

```typescript
    doubleHitRate: darts === 0 ? "0%" : `${Math.round((hits / darts) * 100)}%`,
```

with:

```typescript
    doubleHitRate: accuracyDisplay(hits, darts),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/bobs27-play.data.ts app/tests/lib/game/bobs27-play.data.test.ts
git commit -m "Bob's 27: use shared accuracyDisplay for doubleHitRate"
```

---

### Task 4: Fix Shanghai's `accuracy` rounding

**Files:**
- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**
- Consumes: `accuracyDisplay(hits: number, darts: number): string` from Task 1.

- [ ] **Step 1: Update the test assertions**

```bash
cd app && sed -i \
  -e 's/accuracy: "0%",/accuracy: "0.00%",/' \
  -e 's/accuracy: "100%",/accuracy: "100.00%",/' \
  -e 's/accuracy: "95%",/accuracy: "95.00%",/' \
  tests/lib/game/shanghai-play.data.test.ts
```

This touches all 9 `accuracy:` occurrences in the file (lines 290, 339, 373, 462, 472, 509, 519, 561, 571) — confirmed the sole values used are `"0%"`, `"95%"`, `"100%"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: FAIL — 9 assertions receive the old whole-number strings.

- [ ] **Step 3: Replace the inline calculation**

In `app/src/lib/game/shanghai-play.data.ts`, add the import (alongside the existing `@lib/game/board-input.data` import, around line 15):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Replace lines 111–114:

```typescript
  const accuracy =
    seatDarts.length === 0
      ? "0%"
      : `${Math.round((hits / seatDarts.length) * 100)}%`;
```

with:

```typescript
  const accuracy = accuracyDisplay(hits, seatDarts.length);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "Shanghai: use shared accuracyDisplay for accuracy"
```

---

### Task 5: Fix Doubles Training's `accuracy` rounding (the reported symptom)

**Files:**
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `accuracyDisplay(hits: number, darts: number): string` from Task 1.

- [ ] **Step 1: Update the test assertions**

```bash
cd app && sed -i \
  -e 's/accuracy: "0%",/accuracy: "0.00%",/' \
  -e 's/accuracy: "100%",/accuracy: "100.00%",/' \
  -e 's/accuracy: "40%",/accuracy: "40.00%",/' \
  -e 's/accuracy: "25%",/accuracy: "25.00%",/' \
  tests/lib/game/doubles-training-play.data.test.ts
```

This touches the 5 `accuracy:` occurrences in the file (lines 454, 488, 521, 547, 632).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: FAIL — 5 assertions receive the old whole-number strings.

- [ ] **Step 3: Replace the inline calculation**

In `app/src/lib/game/doubles-training-play.data.ts`, add the import (alongside the existing `@lib/game/doubles-path-play` import, around line 7):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Replace lines 219–222:

```typescript
          accuracy:
            dartsThrown === 0
              ? "0%"
              : `${Math.round((hitOutcomes.length / dartsThrown) * 100)}%`,
```

with:

```typescript
          accuracy: accuracyDisplay(hitOutcomes.length, dartsThrown),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/doubles-training-play.data.ts app/tests/lib/game/doubles-training-play.data.test.ts
git commit -m "Doubles Training: use shared accuracyDisplay for accuracy"
```

---

### Task 6: Fix Singles Training's `hitPercentage` rounding

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `accuracyDisplay(hits: number, darts: number): string` from Task 1.

- [ ] **Step 1: Update the test assertions**

In `app/tests/lib/game/singles-training-play.data.test.ts`, line 404:

```typescript
      hitPercentage: "98%", // round(62/63 * 100)
```

becomes (62 hits / 63 darts = 98.412698…%, `.toFixed(2)` = `"98.41%"`):

```typescript
      hitPercentage: "98.41%", // (62/63 * 100).toFixed(2)
```

Line 642:

```typescript
      hitPercentage: "0%",
```

becomes:

```typescript
      hitPercentage: "0.00%",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL — both assertions receive the old whole-number strings.

- [ ] **Step 3: Replace the inline calculation**

In `app/src/lib/game/singles-training-play.data.ts`, add the import (alongside the existing `@lib/game/board-input.data` import, around line 7):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Replace lines 393–394:

```typescript
          hitPercentage:
            darts === 0 ? "0%" : `${Math.round((hits / darts) * 100)}%`,
```

with:

```typescript
          hitPercentage: accuracyDisplay(hits, darts),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "Singles Training: use shared accuracyDisplay for hitPercentage"
```

---

### Task 7: Document Pattern 20 and record the decision

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `decisions/game-engine.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Bump the front-matter date and version header**

In `docs/architecture/04-Architecture-patterns.md`, line 5:

```
updated: 2026-08-26
```

becomes:

```
updated: 2026-08-27
```

Line 10:

```
> **Version:** 1.6.1 (Pattern 19: `armHiddenTimer`/`clearHiddenTimer` primitive extracted, all 9 board-input games covered 2026-08-26; prior 1.6.0 Pattern 19: shared reveal-then-clear preview 2026-08-26; 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
```

becomes:

```
> **Version:** 1.7.0 (Pattern 20: shared accuracy/hit-rate formatting via `accuracyDisplay()` 2026-08-27; prior 1.6.1 Pattern 19: `armHiddenTimer`/`clearHiddenTimer` primitive extracted, all 9 board-input games covered 2026-08-26; 1.6.0 Pattern 19: shared reveal-then-clear preview 2026-08-26; 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
```

- [ ] **Step 2: Insert Pattern 20**

In the same file, find this exact block (the end of Pattern 19, immediately before the "Pattern Adoption Process" section):

```
## Rule

Detail lives in `app/src/lib/game/play-lifecycle.ts` and
`07-Frontend/04-Modules-And-OOP.md`.

---

# Pattern Adoption Process
```

Replace it with:

```
## Rule

Detail lives in `app/src/lib/game/play-lifecycle.ts` and
`07-Frontend/04-Modules-And-OOP.md`.

---

# Pattern 20 — Shared Accuracy/Hit-Rate Formatting

## Principle

A hits/darts percentage is computed once, not reimplemented per ruleset.

## Pattern

```
hits, darts
    ↓
accuracyDisplay(hits, darts) (play-visit-stats.ts) — hits/darts * 100,
always 2 decimal places, "0.00%" when darts is 0
    ↓
resultsSnapshot.accuracy / .hitPercentage / .doubleHitRate
    ↓
result-modal .astro (renders the string directly)
```

## Application

- Every game whose result reports a hit-rate percentage — Around the
  Clock, Bob's 27, Doubles Training, Shanghai, Singles Training — calls
  `accuracyDisplay(hits, darts)` rather than its own `Math.round`/
  `toFixed` arithmetic. The field name a game exposes (`accuracy`,
  `hitPercentage`, `doubleHitRate`) is the game's own choice; the
  formatting behind it is not.
- Always exactly 2 decimal places, including the zero-darts case
  (`"0.00%"`) — never a bare `"0%"` fallback written separately from the
  helper.
- Result-modal `.astro` components render the field's string value
  directly; they never reformat or re-round it.

## Rule

Detail lives in `app/src/lib/game/play-visit-stats.ts`.

---

# Pattern Adoption Process
```

- [ ] **Step 3: Append the decision record**

Derive the next id (should print `237`):

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**/*.md decisions/*.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`
Expected: `236`

Append to the end of `decisions/game-engine.md` (after D236's block, which currently ends the file):

```markdown

### D237 — One shared `accuracyDisplay()` helper replaces 5 duplicated hit-rate rounding implementations
Status: Accepted · Date: 2026-08-27
Decision: `app/src/lib/game/play-visit-stats.ts` gains `accuracyDisplay(hits, darts): string`, formatting a hits/darts percentage to exactly 2 decimal places (`"0.00%"` when `darts === 0`). Around The Clock's, Bob's 27's, Shanghai's, Doubles Training's and Singles Training's `*-play.data.ts` result-computation code all call it instead of their own inline `Math.round`/`toFixed` arithmetic. Documented as Pattern 20 in `04-Architecture-patterns.md`.
Reason: Issue #173 reported Doubles Training's accuracy rounding to multiples of 10% — a symptom of `Math.round((hits/darts)*100)` against a small denominator, not a miscalculation. Four of the five hit-rate call sites used that whole-number rounding; only Around the Clock already formatted to 2 decimals, via its own locally-scoped `accuracyLabel`. Fixing Doubles Training alone would have left 4 near-identical, independently-drifting implementations in place — the same shape of duplication D232 already found and consolidated once for engine turn-log/seat-derivation mechanics.
Consequences: All 5 games now render exactly 2 decimal places for their hit-rate percentage, including the zero-darts fallback (previously an inconsistent bare `"0%"` in 3 of the 5 call sites, now `"0.00%"` everywhere). No field was renamed and no `.astro` template changed — every result modal already rendered its field's string value as-is. `app/tests/lib/game/play-visit-stats.test.ts` gained direct coverage for `accuracyDisplay`; the five call sites' own tests were updated to the new 2-decimal string values, not re-pointed at different inputs.
```

- [ ] **Step 4: Run the structural doc gates to verify**

Run: `bash scripts/check-decision-ids.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh`
Expected: all three exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md decisions/game-engine.md
git commit -m "Document Pattern 20 (shared accuracy formatting) and record D237"
```

---

### Task 8: Full validation and context maintenance

**Files:** none (verification only).

- [ ] **Step 1: Run the full app validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run format check**

Run: `cd app && npm run format`
Expected: no diff (or stage any formatting fixes it makes).

If Step 2 produced changes:

```bash
git add -A
git commit -m "Apply formatting"
```

- [ ] **Step 3: Run the context-maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-before-done rule. It covers anything Task 7 didn't already handle (e.g. `00-File-Inventory.md`/`00-Context-Map-History.md` entries, `scripts/check-context-budget.sh` drift for `04-Architecture-patterns.md`'s new Pattern 20 content).

- [ ] **Step 4: Run the full test suite one more time**

Run: `cd app && npx vitest run`
Expected: all tests pass (baseline was 2763 passed per PR #174's own verification; expect the same count plus the 4 new `accuracyDisplay` tests).

- [ ] **Step 5: Final commit if context-maintenance made changes**

```bash
git add -A
git commit -m "Context maintenance for accuracy formatting change"
```

---

## Self-Review Notes

- **Spec coverage:** shared helper (Task 1) ✓; all 5 call sites (Tasks 2–6) ✓; Pattern 20 doc (Task 7) ✓; decision record (Task 7) ✓; tests for helper + all 5 call sites (Tasks 1–6) ✓; out-of-scope `average` fields explicitly untouched ✓.
- **Type consistency:** `accuracyDisplay(hits: number, darts: number): string` is the same signature at its Task 1 definition and every Task 2–6 call site.
- **No placeholders:** every step shows the literal before/after code or an exact runnable command.
