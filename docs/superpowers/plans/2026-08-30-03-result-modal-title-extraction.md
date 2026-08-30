# Result Modal Title Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution order: 3 of 3** (spec: `docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md`, Issue 2). Runs after `01-result-modal-summary-components.md` and `02-result-modal-1v1-stats-data-layer.md` — this plan's Singles Training task specifically depends on `02-result-modal-1v1-stats-data-layer.md`'s Task 5 having already moved `SinglesTrainingResultsSnapshot`'s `status` field from top-level to per-seat.

**Goal:** Replace each of the 9 result modals' unreadable, inline `x-text` title ternary with a one-line `x-text="resultsTitle()"` call into a real TypeScript method, and factor the `$store.game.seats.find((s) => s.sideKey === winningSideKey)?.displayName` lookup every modal repeats into one shared helper. Also complete the final spec-mandated pass: docs, an append-only decision entry, the `context-maintenance` skill, and one last full `validate:app` run, now that all three issues (`01`, `02`, this plan) have landed.

**Architecture:** A new pure module, `app/src/lib/game/match-result-text.ts`, exports `matchWinnerName(seats, winningSideKey)` — returns the winning seat's `displayName`, or `undefined` for a solo session or no decided winner (folding the `!winningSideKey || seats.length < 2` gate every modal repeats into the helper itself, so callers just check truthiness). Each `*PlayContext` type gains a `resultsTitle(this: XPlayContext): string` method; each `*-play.data.ts` factory implements it, composing `matchWinnerName()` with that game's own phrasing, copied verbatim from the current ternary — same wording, just a named method body instead of a nested Alpine expression string.

**Tech Stack:** TypeScript (Vitest), Astro components, Alpine.js.

## Global Constraints

- TDD for the one new file this plan adds (`match-result-text.ts`) — write the failing test first.
- `resultsTitle()` methods themselves get no new test files — they are thin composition over state already covered by each game's own play-data test suite (spec Testing section); `matchWinnerName()` is the one piece worth a dedicated unit test, small and pure, same spirit as `match-outcome.module.test.ts`.
- `scripts/check-test-coverage.sh` fails any changed runtime `.ts` file with no covering test edit — `match-result-text.ts` gets a test; each `*-play.data.ts`'s existing test suite already imports and exercises the file being changed, satisfying the gate without a new assertion.
- No modal's title wording changes — every `resultsTitle()` body reproduces its current ternary's exact strings, branches, and conditions. The one deliberate exception (spec-approved, stated below in Task 3) is Bob's 27's two-`<h2>`/`x-show` pattern collapsing into one `x-text`.
- `npm run validate:app` clean (0 errors/warnings/hints) before Task 11 is called done.

---

### Task 1: `match-result-text.ts` — shared winner-name helper

**Files:**
- Create: `app/src/lib/game/match-result-text.ts`
- Test: `app/tests/lib/game/match-result-text.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `matchWinnerName(seats, winningSideKey): string | undefined`, imported by every task in this plan as `import { matchWinnerName } from "@lib/game/match-result-text";`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { matchWinnerName } from "@lib/game/match-result-text";

const SEATS = [
  { participantRef: "p1", sideKey: "A", displayName: "Levi" },
  { participantRef: "p2", sideKey: "B", displayName: "Opponent" },
];

describe("matchWinnerName", () => {
  it("returns the winning seat's display name", () => {
    expect(matchWinnerName(SEATS, "B")).toBe("Opponent");
  });

  it("returns undefined when winningSideKey is null", () => {
    expect(matchWinnerName(SEATS, null)).toBeUndefined();
  });

  it("returns undefined for a solo session even with a winningSideKey set", () => {
    expect(matchWinnerName([SEATS[0]], "A")).toBeUndefined();
  });

  it("returns undefined when no seat matches the winning sideKey", () => {
    expect(matchWinnerName(SEATS, "C")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/match-result-text.test.ts
```

Expected: FAIL — `Cannot find module '@lib/game/match-result-text'`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * The winning seat's own display name, or `undefined` when there is nothing
 * to name — a solo session (fewer than 2 seats) or no decided winner
 * (`winningSideKey` null, e.g. a TIE). Factors out the
 * `$store.game.seats.find((s) => s.sideKey === winningSideKey)?.displayName`
 * lookup every result modal's title ternary repeats.
 */
export function matchWinnerName(
  seats: readonly { participantRef: string; sideKey: string; displayName: string }[],
  winningSideKey: string | null,
): string | undefined {
  if (!winningSideKey || seats.length < 2) return undefined;
  return seats.find((seat) => seat.sideKey === winningSideKey)?.displayName;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/match-result-text.test.ts
```

Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/match-result-text.ts app/tests/lib/game/match-result-text.test.ts
git commit -m "Add match-result-text.ts: shared matchWinnerName() helper"
```

---

### Task 2: Five Oh One

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `FiveOhOnePlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `FiveOhOnePlayContext`, add `resultsTitle(this: FiveOhOnePlayContext): string;` alongside the other method signatures (near `uploadAndCompleteSession`).

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/five-oh-one-play.data.ts`, add `matchWinnerName` to the imports (`import { matchWinnerName } from "@lib/game/match-result-text";`) and add the method to the returned factory object, near `uploadAndCompleteSession`:

```ts
resultsTitle(this: FiveOhOnePlayContext): string {
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins the match!` : "Match Summary";
},
```

This reproduces `!resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2 ? 'Match Summary' : (name + ' wins the match!')` exactly — `matchWinnerName` already folds in both the null-`winningSideKey` and solo-session gates.

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`, replace the title block:

```astro
<h2
  slot="title"
  class="font-display text-lg font-semibold text-foreground"
  x-text="resultsTitle()"
>
</h2>
```

(Remove the `{/* TODO: extract x-text logic into alpine function */}` comment above it — this task resolves that TODO.)

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-play.data.ts app/src/components/layout/games/result-modals/FiveOhOneResults.astro
git commit -m "Five Oh One: extract results title into resultsTitle()"
```

---

### Task 3: Bob's 27

Collapses the modal's current two-sibling-`<h2>`/`x-show` pattern (one `<h2>` for the succeeded state, one static "Match Summary" `<h2>` for everything before it) into a single `x-text`, per the approved spec. This is the one modal in this plan whose pre-completion default text changes: today it shows the static "Match Summary" until `completionStatus === 'succeeded'`; after this task, the same `resultsTitle()` ternary evaluates with `resultsSnapshot` null before completion, which (since Bob's 27 has no tie/no-winner "session complete" branch — it only ever ends `WON` or `LOST`) falls through to `"Winner!"`. This is the explicit, user-approved design in the committed spec (`docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md`, Issue 2 table) — do not "fix" it back to a separate pre-completion state.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/Bobs27Results.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `Bobs27PlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `Bobs27PlayContext`, add `resultsTitle(this: Bobs27PlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/bobs27-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: Bobs27PlayContext): string {
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  if (winner) return `${winner} wins!`;
  return this.resultsSnapshot?.status === "LOST" ? "Game over!" : "Winner!";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/Bobs27Results.astro`, replace the whole `<div slot="title">...</div>` block (both `<h2>`s) with:

```astro
<h2
  slot="title"
  class="font-display text-lg font-semibold text-foreground"
  x-text="resultsTitle()"
>
</h2>
```

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/bobs27-play.data.ts app/src/components/layout/games/result-modals/Bobs27Results.astro
git commit -m "Bob's 27: extract results title into resultsTitle(), collapse two-h2 pattern into one x-text"
```

---

### Task 4: 121 (One Twenty One)

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `OneTwentyOnePlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `OneTwentyOnePlayContext`, add `resultsTitle(this: OneTwentyOnePlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/one-twenty-one-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: OneTwentyOnePlayContext): string {
  if (this.resultsSnapshot?.status !== "WON") return "Session complete";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} checks out 170!` : "170 checked out!";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`, replace the title block with `x-text="resultsTitle()"` (same pattern as Task 2 Step 3).

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/components/layout/games/result-modals/OneTwentyOneResults.astro
git commit -m "121: extract results title into resultsTitle()"
```

---

### Task 5: Score Training

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `ScoreTrainingPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `ScoreTrainingPlayContext`, add `resultsTitle(this: ScoreTrainingPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/score-training-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: ScoreTrainingPlayContext): string {
  if (this.resultsSnapshot?.status === "TIE") return "Tie — same total!";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — highest total!` : "Game Summary";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-play.data.ts app/src/components/layout/games/result-modals/ScoreTrainingResults.astro
git commit -m "Score Training: extract results title into resultsTitle()"
```

---

### Task 6: Shanghai

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/ShanghaiResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `ShanghaiPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `ShanghaiPlayContext`, add `resultsTitle(this: ShanghaiPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/shanghai-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: ShanghaiPlayContext): string {
  if (!(this.completionStatus === "succeeded" && this.resultsSnapshot)) {
    return "Session complete";
  }
  if (this.resultsSnapshot.status === "TIE") return "Tie — same score!";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot.winningSideKey,
  );
  const isShanghai = this.resultsSnapshot.status === "SHANGHAI";
  if (!winner) return isShanghai ? "Shanghai!" : "Session complete";
  return isShanghai ? `${winner} hits a Shanghai!` : `${winner} wins!`;
},
```

This reproduces the modal's nested ternary exactly: `!(succeeded && resultsSnapshot) → 'Session complete'`; `status === 'TIE' → 'Tie — same score!'`; no decided winner (solo or `winningSideKey` null) → `'Shanghai!'`/`'Session complete'` depending on `status === 'SHANGHAI'`; decided winner → `{name} hits a Shanghai!`/`{name} wins!`.

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/ShanghaiResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/shanghai-play.data.ts app/src/components/layout/games/result-modals/ShanghaiResults.astro
git commit -m "Shanghai: extract results title into resultsTitle()"
```

---

### Task 7: Around the Clock

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `AroundTheClockPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `AroundTheClockPlayContext`, add `resultsTitle(this: AroundTheClockPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/around-the-clock-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: AroundTheClockPlayContext): string {
  if (this.resultsSnapshot?.status === "TIE") return "Tie — same darts!";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — fewest darts!` : "Session complete";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/around-the-clock-play.data.ts app/src/components/layout/games/result-modals/AroundTheClockResults.astro
git commit -m "Around the Clock: extract results title into resultsTitle()"
```

---

### Task 8: Doubles Training

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `DoublesTrainingPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `DoublesTrainingPlayContext`, add `resultsTitle(this: DoublesTrainingPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/doubles-training-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: DoublesTrainingPlayContext): string {
  if (this.resultsSnapshot?.status === "TIE") return "Tie — same doubles hit!";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — most doubles hit!` : "Session complete";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/doubles-training-play.data.ts app/src/components/layout/games/result-modals/DoublesTrainingResults.astro
git commit -m "Doubles Training: extract results title into resultsTitle()"
```

---

### Task 9: Singles Training

This is the one game whose `resultsTitle()` cannot read a top-level `resultsSnapshot.status` — `02-result-modal-1v1-stats-data-layer.md`'s Task 5 moved `status` onto each seat (`resultsSnapshot.seats[N].status`), since Singles Training's HARD/EXTREME elimination is genuinely asymmetric between seats. `resultsTitle()` resolves the *owner's own* seat entry first (the PLAYER-type seat — the person actually looking at this device), matching what the pre-refactor flat field always meant: the owner's own outcome.

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1); `SinglesTrainingSeatResult.status` (per-seat field from `02-result-modal-1v1-stats-data-layer.md` Task 5).
- Produces: `resultsTitle()` on `SinglesTrainingPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `SinglesTrainingPlayContext`, add `resultsTitle(this: SinglesTrainingPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/singles-training-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: SinglesTrainingPlayContext): string {
  const ownerRef = this.$store.game.seats.find(
    (seat) => seat.participantTypeKey === "PLAYER",
  )?.participantRef;
  const ownerResult = this.resultsSnapshot?.seats.find(
    (seat) => seat.participantRef === ownerRef,
  );

  if (ownerResult?.status === "LOST") {
    return this.$store.game.seats.length < 2
      ? "Game over — missed the target"
      : "Game over — you missed the target";
  }
  if (ownerResult?.status === "WON") {
    const loser = this.$store.game.seats.find(
      (seat) => seat.sideKey !== this.resultsSnapshot?.winningSideKey,
    );
    return `${loser?.displayName} missed the target — you win!`;
  }
  if (ownerResult?.status === "TIE") return "Tie — same points!";

  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — highest points!` : "Session complete";
},
```

This is a direct, behavior-preserving translation of the modal's current nested ternary — only the source of `status` changes (owner's own `seats[]` entry instead of a flat top-level field), matching exactly how `02-result-modal-1v1-stats-data-layer.md` Task 5 already generalized `resultStatusFor`/`statusFor` for the data layer.

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/singles-training-play.data.ts app/src/components/layout/games/result-modals/SinglesTrainingResults.astro
git commit -m "Singles Training: extract results title into resultsTitle(), read owner's own per-seat status"
```

---

### Task 10: Ten Up One Down (TUOD)

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`

**Interfaces:**
- Consumes: `matchWinnerName` (Task 1).
- Produces: `resultsTitle()` on `TuodPlayContext` — no other task depends on it.

- [ ] **Step 1: Add the method to the type**

In `app/src/lib/game/types.ts`, in `TuodPlayContext`, add `resultsTitle(this: TuodPlayContext): string;`.

- [ ] **Step 2: Implement the method**

In `app/src/lib/game/tuod-play.data.ts`, add the `matchWinnerName` import and this method:

```ts
resultsTitle(this: TuodPlayContext): string {
  if (this.resultsSnapshot?.status === "TIE") return "Tie — same target!";
  const winner = matchWinnerName(
    this.$store.game.seats,
    this.resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — highest target!` : "Game Summary";
},
```

- [ ] **Step 3: Simplify the modal**

In `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`, replace the title block with `x-text="resultsTitle()"`.

- [ ] **Step 4: Type-check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-play.data.ts app/src/components/layout/games/result-modals/TenUpOneDownResults.astro
git commit -m "Ten Up One Down: extract results title into resultsTitle()"
```

---

### Task 11: Visual verification across all 9 modals

**Files:** none.

- [ ] **Step 1: Start the dev server**

```bash
cd app && astro dev --background
```

- [ ] **Step 2: Verify each game's title text, solo and 1v1**

For each of the 9 games, play one solo session and one 1v1 session (win, and where the ruleset supports it, a tie) to completion. Confirm the title `<h2>` text matches exactly what it showed before this plan (same wording, same winner name resolution) for every status branch: TIE, solo completion, 1v1 win. For Bob's 27 specifically, confirm the title shows correctly both before completion (now "Winner!" instead of the old static "Match Summary" — the approved, intentional change) and after (WON/LOST/1v1-win text). For Singles Training specifically, confirm the HARD/EXTREME elimination titles ("Game over — you missed the target", "{opponent} missed the target — you win!") still resolve correctly now that they read the owner's own per-seat `status`.

- [ ] **Step 3: Stop the dev server**

```bash
cd app && astro dev stop
```

---

### Task 12: Documentation, decision record, context maintenance, final validation

This is the spec's rollout-order Step 4 — "Docs/decisions update, `context-maintenance` skill, full `validate:app` pass" — run once now that all three issues (`01`, `02`, this plan) have landed, not per-plan.

**Files:**
- Modify: `docs/architecture/07-Frontend/00-Overview.md` (or the specific handbook chapter `00-File-Inventory.md` identifies as canonical for results-modal/summary-component patterns — check that file first per the `docs/CLAUDE.md` editing workflow: identify the canonical target doc before editing)
- Modify: `docs/architecture/04-Architecture-patterns.md` (Pattern 18 area)
- Create: one append-only block in the decision file `DECISIONS.md`'s frontend/game-engine routing table points to, under `decisions/**`

- [ ] **Step 1: Identify the canonical frontend doc**

```bash
grep -n "STAT_ROWS\|result-modal\|ResultsModalShell\|StatRow" docs/architecture/00-File-Inventory.md docs/architecture/07-Frontend/*.md
```

Use whichever file `00-File-Inventory.md` names as canonical for result-modal/summary-component patterns (per `docs/CLAUDE.md`'s "Frontend: `07-Frontend/00-Overview.md` for integration; handbook `07-Frontend/01`–`05` + `10-Frontend-Agent-Guide.md`" routing). If no existing section covers this pattern, add one to `07-Frontend/00-Overview.md`.

- [ ] **Step 2: Document the summary-component pattern**

Add a short section (a few sentences, matching the doc's existing terseness) stating:
- `SinglePlayerSummary.astro`/`ComparisonSummary.astro` (`app/src/components/layout/games/`) are the canonical results-summary pattern for every game's results modal — supersedes the old per-modal hand-rolled `STAT_ROWS.map()` + `<dl>` + `seatValueExpr()` duplication.
- `resultsTitle()` (one per `*PlayContext`, implemented in each `*-play.data.ts`) plus the shared `matchWinnerName()` helper (`app/src/lib/game/match-result-text.ts`) are the canonical results-title pattern — supersedes the old per-modal inline `x-text` ternary.
- A new game's results modal should use both from the start, not hand-roll either.

- [ ] **Step 3: Update the architecture-patterns doc**

In `docs/architecture/04-Architecture-patterns.md`, near Pattern 18 (the `GameEngine` contract / `MultiSeatState` pattern), add a note: all 9 rulesets' results snapshots now uniformly carry `seats: XSeatResult[]` (Score Training and Shanghai already did; Five Oh One already did; the other 6 — Around the Clock, Bob's 27, Doubles Training, 121, Singles Training, Ten Up One Down — were promoted by `02-result-modal-1v1-stats-data-layer.md`). This closes the gap the `2026-08-22-single-opponent-seat-remaining-engines-design.md` design left open: that design's touch list named the 7 results-modal files for "show `winningSideKey`" but didn't specify the snapshot-shape change these 6 games actually needed at the data layer.

- [ ] **Step 4: Append the decision record**

Per `DECISIONS.md`'s routing table, find the domain file under `decisions/**` that frontend/game-engine-data-layer decisions route to:

```bash
grep -n "frontend\|game-engine\|results\|snapshot" DECISIONS.md
```

Append a new, dated block to that file (never edit or delete an existing block — append only) recording:
- What: 6 games' `resultsSnapshot` types were promoted from flat/single-seat to `{ ...; seats: XSeatResult[] }`, matching the shape Score Training/Shanghai/Five Oh One already used.
- Why: the `2026-08-22-single-opponent-seat-remaining-engines-design.md` design wired 1v1 support into every engine, but its own scope/touch-list never named the snapshot-shape change — so 6 games' results modals kept computing stats for the owning player only, silently dropping the opponent's data at the data layer (not just failing to render it).
- Supersedes: note this as a correction to the `2026-08-22-single-opponent-seat-remaining-engines-design.md` design's scope (cite it by filename), per the routing table's own convention for a reversal/correction citing what it supersedes.

- [ ] **Step 5: Format the doc/decision edits**

```bash
cd app && npm run format
```

(Formatting scope is `app/` per `app/CLAUDE.md`; `docs/`/`decisions/**` edits are plain Markdown with no formatter gate — just keep them consistent with the surrounding file's existing style.)

- [ ] **Step 6: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill now (per the root `CLAUDE.md`: "Before claiming any task done, run the `context-maintenance` skill... A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works"). Follow its procedure (`.claude/skills/context-maintenance/SKILL.md`) — this covers anything Steps 1–4 above didn't already catch (context map registration, knowledge-graph refresh expectations, ISO-date conventions) across all three plans' combined changes, not just this one.

- [ ] **Step 7: Commit the docs/decisions changes**

```bash
git add docs/architecture/07-Frontend/ docs/architecture/04-Architecture-patterns.md decisions/ DECISIONS.md
git commit -m "Document SinglePlayerSummary/ComparisonSummary + resultsTitle()/matchWinnerName() as canonical patterns; record the 1v1-snapshot-shape fix as a decision"
```

(Adjust the `git add` paths to whatever files Steps 1–4 actually touched.)

- [ ] **Step 8: Final full validation pass**

```bash
cd app && npm run validate:app
```

Expected: every step exits zero, including `npx fallow`, `scripts/check-test-coverage.sh`, and the type gate reporting 0 errors/0 warnings/0 hints — across the combined diff of all three plans (`01`, `02`, this plan) on `style/ui-polish`.

- [ ] **Step 9: Confirm format is clean**

```bash
cd app && npm run format:check
```

- [ ] **Step 10: Confirm no uncommitted changes remain**

```bash
git status
```

Expected: clean working tree on `style/ui-polish` (or only pre-existing, unrelated in-progress work the user was doing before this brainstorming session started — do not stage or commit anything outside the scope of these three plans).

This is the last task of the last plan in the sequence. Once it's done, all three of `01-result-modal-summary-components.md`, `02-result-modal-1v1-stats-data-layer.md`, and this plan are complete, and the spec's three issues are fully resolved on `style/ui-polish`.
