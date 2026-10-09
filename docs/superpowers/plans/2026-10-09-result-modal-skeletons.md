# Result Modal Skeletons + Cricket/Tactics Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Cricket/Tactics result modals, and every result modal shows a shift-free skeleton + `SAVING…` status while the game saves.

**Architecture:** One DOM per modal. Every dynamic value renders through a new `ResultValue` primitive that holds its final font/line box and shows either the value or a one-line pulse bar. Labels, grids, tiles and titles are static, so the swap can't shift layout. Cricket/Tactics seat results become structured (`dartsToClose` array + `trebles`/`bulls`), derived from tallies folded into the shared marks seat state.

**Tech Stack:** Astro, Alpine.js v3, Tailwind v4, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-result-modal-skeletons-design.md`

## Global Constraints

- All commands run from the worktree `app/` dir: `/Users/levi.broeksma/Dev/dart-analytics/.worktrees/feat-result-modal-skeletons/app`.
- TDD for every `.ts` change (`app/CLAUDE.md` §TDD): failing test first, `npm test`.
- `.astro` has no test runner (D101): verify with `npx astro check` + visual check.
- Semantic tokens only; `cn()` for class composition, never `class:list`; every `x-show` has `x-cloak`; no HTML comments in templates; no `//` comments inside function bodies.
- Ready condition everywhere: `completionStatus === 'succeeded'`.
- Saving status: `pending`/`saving` → pulsing `bg-error` dot + `SAVING…` in `text-error`; `succeeded` → `bg-success` dot + `SAVED` in `text-success`; `failed` → ErrorAlert + Retry.
- Play-again button label: `Rematch`.
- Cricket `trebles` = treble darts on 15–20, counted even after that target closed. Tactics `bulls` = outer or inner bull darts, counted even after close.
- No schema, migration, API change. Nothing new persisted.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Before Alpine boots / while `x-cloak` hides both value and bar, a `ResultValue` must keep its line height (no 0-height collapse) — the wrapper carries `min-h-[1lh]`.
2. `completionStatus === 'failed'` → values stay as bars (snapshot is null), status row is replaced by error + Retry; buttons stay disabled.
3. Cricket target never closed (game can't complete without it, but resumed/odd states) → `dartsToClose` entry `null` renders `–`, not `null`.
4. Treble on an already-closed Cricket number still counts in `trebles`; bull dart on closed Tactics bull still counts in `bulls` (tests in Task 1/2).
5. 2-seat games (501 etc.) still render the comparison ledger, and the solo block stays hidden — `SinglePlayerSummary` gates on `$store.game.seats.length === 1`, not on the snapshot.

---

### Task 1: Hit tallies in the shared marks seat state

**Files:**
- Modify: `app/src/modules/game/types.ts` (`MarksSeatState`, ~line 57)
- Modify: `app/src/modules/game/marks-close.module.ts`
- Test: `app/tests/modules/game/marks-close.module.test.ts`

**Interfaces:**
- Produces: `MarksSeatState.objectiveHits: readonly number[]` (darts whose hit mapped to each objective, incl. after close), `MarksSeatState.trebleHits: number` (darts whose hit added 3 marks).

- [ ] **Step 1: Write failing tests** — append to `marks-close.module.test.ts` (reuse the file's existing `seat` fixture):

```ts
describe("hit tallies", () => {
  it("start at zero", () => {
    const state = initialMarksSeat(seat, 3);
    expect(state.objectiveHits).toEqual([0, 0, 0]);
    expect(state.trebleHits).toBe(0);
  });

  it("count every hit per objective, even after it closed", () => {
    let state = initialMarksSeat(seat, 2);
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 1 });
    state = applyMarksDart(state, null);
    expect(state.objectiveHits).toEqual([2, 0]);
  });

  it("count 3-mark hits as trebles, even after the target closed", () => {
    let state = initialMarksSeat(seat, 2);
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 0, marks: 3 });
    state = applyMarksDart(state, { objectiveIndex: 1, marks: 2 });
    expect(state.trebleHits).toBe(2);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/game/marks-close.module.test.ts` — expect FAIL (`objectiveHits` undefined).

- [ ] **Step 3: Implement.** In `types.ts` `MarksSeatState` add:

```ts
  objectiveHits: readonly number[];
  trebleHits: number;
```

In `initialMarksSeat` return add:

```ts
    objectiveHits: Array.from({ length: objectiveCount }, () => 0),
    trebleHits: 0,
```

In `applyMarksDart`, after `const closedAtDart = …`:

```ts
  const objectiveHits = [...state.objectiveHits];
  if (hit) objectiveHits[hit.objectiveIndex] += 1;
```

and in the returned object add `objectiveHits,` and `trebleHits: state.trebleHits + (hit?.marks === 3 ? 1 : 0),`. Update `applyMarksDart`'s JSDoc: "Hits are tallied per objective and as trebles (3-mark hits), uncapped."

- [ ] **Step 4: Run** `npm test` — all pass. If any Cricket/Tactics test compares a whole seat with `toEqual`, add `objectiveHits`/`trebleHits` to its expected literal (same guarantee, new fields).

- [ ] **Step 5: Commit** `feat(cricket): tally objective and treble hits in marks seat state`.

---

### Task 2: Structured Cricket/Tactics seat results

**Files:**
- Modify: `app/src/lib/game/types.ts` (`CricketSeatResult` ~line 926, `TacticsSeatResult` ~line 987)
- Modify: `app/src/lib/game/cricket-play.data.ts` (`cricketSeatResult`, ~line 80)
- Modify: `app/src/lib/game/tactics-play.data.ts` (`tacticsSeatResult`, ~line 93)
- Test: `app/tests/lib/game/cricket-play.data.test.ts` (~line 175), `app/tests/lib/game/tactics-play.data.test.ts` (~line 239)

**Interfaces:**
- Consumes: Task 1 `objectiveHits`, `trebleHits`.
- Produces: `CricketSeatResult = { participantRef; sideKey; darts: number; marksPerRound: string; trebles: number; dartsToClose: (number | null)[] }`; `TacticsSeatResult = { …same but bulls: number instead of trebles }`. `dartsToClose` is in `CRICKET_OBJECTIVES` / `TACTICS_OBJECTIVES` order.

- [ ] **Step 1: Update failing tests.** In `cricket-play.data.test.ts` replace the `toMatchObject` of "builds results with darts, MPR to 2 dp and darts to close" with:

```ts
    expect(cricketSeatResult(seat)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      darts: 8,
      marksPerRound: "7.88",
      trebles: 6,
      dartsToClose: [2, 3, 4, 5, 6, 1, 8],
    });
```

and add:

```ts
  it("counts trebles on closed numbers and leaves unclosed targets null", () => {
    const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
      hitTargetNumber,
      hitZoneKey,
      locationX: null,
      locationY: null,
    });
    const seat = [obs(20, "TREBLE"), obs(20, "TREBLE"), obs(5, "TREBLE")].reduce(
      applyCricketDart,
      initialCricketState({ seats: SEATS }).seats[0],
    );
    const result = cricketSeatResult(seat);
    expect(result.trebles).toBe(2);
    expect(result.dartsToClose).toEqual([1, null, null, null, null, null, null]);
  });
```

In `tactics-play.data.test.ts` replace the matching `toMatchObject` with:

```ts
    expect(tacticsSeatResult(seat)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      darts: 14,
      marksPerRound: "5.79",
      bulls: 2,
      dartsToClose: [2, 3, 4, 5, 6, 1, 8, 11, 14],
    });
```

and add:

```ts
  it("counts bull darts after the bull closed", () => {
    const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
      hitTargetNumber,
      hitZoneKey,
      locationX: null,
      locationY: null,
    });
    const seat = [
      obs(25, "INNER_BULL"),
      obs(25, "OUTER_BULL"),
      obs(25, "OUTER_BULL"),
    ].reduce(applyTacticsDart, initialTacticsState({ seats: SEATS }).seats[0]);
    expect(tacticsSeatResult(seat).bulls).toBe(3);
  });
```

- [ ] **Step 2: Run** `npm test -- tests/lib/game/cricket-play.data.test.ts tests/lib/game/tactics-play.data.test.ts` — expect FAIL (string `dartsToClose`, missing `trebles`/`bulls`).

- [ ] **Step 3: Implement.** `lib/game/types.ts`:

```ts
export type CricketSeatResult = {
  participantRef: string;
  sideKey: string;
  darts: number;
  marksPerRound: string;
  trebles: number;
  dartsToClose: (number | null)[];
};
```

`TacticsSeatResult` identical but `bulls: number` in place of `trebles`.

`cricket-play.data.ts`:

```ts
/** One seat's results row: darts, MPR to 2 dp, treble hits, the dart each objective closed on. */
export function cricketSeatResult(seat: CricketSeatState): CricketSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    marksPerRound: marksPerRound(seat).toFixed(2),
    trebles: seat.trebleHits,
    dartsToClose: [...seat.closedAtDart],
  };
}
```

`tactics-play.data.ts`:

```ts
/** One seat's results row: darts, MPR to 2 dp, bull hits, the dart each objective closed on. */
export function tacticsSeatResult(seat: TacticsSeatState): TacticsSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    marksPerRound: marksPerRound(seat).toFixed(2),
    bulls: seat.objectiveHits[TACTICS_OBJECTIVES.indexOf(BULL_TARGET_NUMBER)],
    dartsToClose: [...seat.closedAtDart],
  };
}
```

Import `BULL_TARGET_NUMBER` from where `tactics-play.data.ts`'s `objectiveLabel` already gets it. If `objectiveLabel` becomes unused in either file, delete it (fallow gate flags dead code).

- [ ] **Step 4: Run** `npm test` — all pass.

- [ ] **Step 5: Commit** `feat(cricket,tactics): structured darts-to-close and treble/bull counts in results`.

---

### Task 3: `ResultValue` + `SaveStatus` primitives; shell and routine summary

**Files:**
- Create: `app/src/components/layout/games/ResultValue.astro`
- Create: `app/src/components/layout/games/SaveStatus.astro`
- Modify: `app/src/components/layout/games/ResultsModalShell.astro`
- Modify: `app/src/components/layout/training/routines/RoutineSummaryModal.astro`
- Modify: every `result-modals/*.astro` (drop `showSavedMessage`)

**Interfaces:**
- Produces: `<ResultValue valueExpr skeletonWidth readyExpr? class? />`; `<SaveStatus statusExpr? />` (default `completionStatus`).

- [ ] **Step 1: Create `ResultValue.astro`:**

```astro
---
/**
 * One results value in its final line box: the value once `readyExpr`
 * holds, else a one-line pulse bar, so the swap never shifts layout.
 * @param {string} valueExpr Alpine expression for the value
 * @param {string} skeletonWidth Width class for the pulse bar
 * @param {string} [readyExpr] Alpine expression; default `completionStatus === 'succeeded'`
 * @param {string} [class] Font and colour classes for the line box
 */
interface Props {
  valueExpr: string;
  skeletonWidth: string;
  readyExpr?: string;
  class?: string;
}

// Props
const {
  valueExpr,
  skeletonWidth,
  readyExpr = "completionStatus === 'succeeded'",
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";
---

<span
  class={cn("inline-block min-h-[1lh]", classNameProp)}
  {...props}
>
  <span
    x-show={readyExpr}
    x-cloak
    x-text={valueExpr}
  ></span>
  <span
    class={cn(
      "inline-block h-[1lh] animate-pulse rounded-md bg-white/12 align-top",
      skeletonWidth,
    )}
    x-show={`!(${readyExpr})`}
    x-cloak
  ></span>
</span>
```

- [ ] **Step 2: Create `SaveStatus.astro`:**

```astro
---
/**
 * Fixed-height save status for result sheets: `SAVING…` with a pulsing dot
 * until the save succeeds, then `SAVED`. Hidden when the save failed (the
 * caller shows its error + retry there).
 * @param {string} [statusExpr] Alpine expression for the completion status
 */
interface Props {
  statusExpr?: string;
}

// Props
const { statusExpr = "completionStatus" }: Props = Astro.props;
---

<span
  class="inline-flex h-5 items-center gap-2 self-center font-mono text-eyebrow-lg font-semibold uppercase"
  x-show={`${statusExpr} !== 'failed'`}
  x-cloak
>
  <span
    class="inline-flex items-center gap-2 text-error"
    x-show={`${statusExpr} !== 'succeeded'`}
    x-cloak
  >
    <span class="size-1.5 animate-pulse rounded-full bg-error"></span>
    Saving…
  </span>
  <span
    class="inline-flex items-center gap-2 text-success"
    x-show={`${statusExpr} === 'succeeded'`}
    x-cloak
  >
    <span class="size-1.5 rounded-full bg-success"></span>
    Saved
  </span>
</span>
```

- [ ] **Step 3: Shell.** In `ResultsModalShell.astro`: remove the `showSavedMessage` prop (interface, destructure, JSDoc line) and the `{showSavedMessage && (…)}` block; import `SaveStatus` and render `<SaveStatus />` directly after the failed block; change the play-again `title="Play again"` to `title="Rematch"`. Update the header JSDoc: "save-status region (SAVING…/SAVED, failed + retry)".

- [ ] **Step 4: Callers.** Remove the `showSavedMessage` attribute from all 12 `result-modals/*.astro`; delete the `// TODO: harden the mandatory showSavedMessage…` line in `AroundTheClockResults.astro`. Verify: `grep -rn showSavedMessage src` → no hits.

- [ ] **Step 5: Routine summary.** In `RoutineSummaryModal.astro`: replace the `Saved` `<span>` block with `<SaveStatus />`; replace the row `<dd … x-text="row.value">` with

```astro
              <ResultValue
                class="font-mono text-button tabular-nums text-foreground"
                valueExpr="row.value"
                skeletonWidth="w-9"
              />
```

(add imports). Keep the `dd` semantics by wrapping: `<dd><ResultValue … /></dd>`.

- [ ] **Step 6: Verify** `npx astro check` → 0 errors/warnings/hints; `bash ../scripts/check-astro-conventions.sh && bash ../scripts/check-style-tokens.sh && bash ../scripts/check-astro-class-composition.sh` pass.

- [ ] **Step 7: Commit** `feat(results): ResultValue + SaveStatus primitives, Rematch label`.

---

### Task 4: `StatTile` + `SinglePlayerSummary` rebuild

**Files:**
- Modify: `app/src/components/layout/games/StatTile.astro`
- Modify: `app/src/components/layout/games/SinglePlayerSummary.astro`

**Interfaces:**
- Consumes: `ResultValue`.
- Produces: `StatTile` props `labelExpr`, `valueExpr` (required), `skeletonWidth?` — when set, value renders through `ResultValue`; otherwise plain `x-text` (QuickSubtract/OpponentChooser unchanged).
- Produces: `SinglePlayerSummary` props `statRows: readonly { label; key; fallback?; hero?; side?; skeletonWidth: string }[]`, `heroSize?: "lg" | "sm"` (default `lg`), `tileCols?: 2 | 3 | 4` (default `2`), `seatIndex?`, and a default slot rendered after the tiles (for `TargetGrid`).

- [ ] **Step 1: `StatTile.astro`** — make `valueExpr` required, add `skeletonWidth?: string`, drop the no-value pulse branch:

```astro
  {
    skeletonWidth ? (
      <dd>
        <ResultValue
          class="font-display text-lg leading-none tabular-nums text-foreground"
          valueExpr={valueExpr}
          skeletonWidth={skeletonWidth}
        />
      </dd>
    ) : (
      <dd
        class="font-display text-lg leading-none tabular-nums text-foreground"
        x-text={valueExpr}
      />
    )
  }
```

Update JSDoc: "With `skeletonWidth` the value pulses until results are saved."

- [ ] **Step 2: `SinglePlayerSummary.astro`** — single block, no loading duplicate:

```astro
---
/**
 * Solo results stat block: hero value with side stats, an optional tile
 * grid, then the default slot. Values pulse until results are saved; the
 * layout is identical in both states.
 */
import ResultValue from "@components/layout/games/ResultValue.astro";
import StatTile from "@components/layout/games/StatTile.astro";
import { cn } from "@client/cn";

interface Props {
  statRows: readonly {
    label: string;
    key: string;
    skeletonWidth: string;
    fallback?: string;
    hero?: boolean;
    side?: boolean;
  }[];
  heroSize?: "lg" | "sm";
  tileCols?: 2 | 3 | 4;
  seatIndex?: number;
}

const { statRows, heroSize = "lg", tileCols = 2, seatIndex = 0 }: Props =
  Astro.props;

const TILE_COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
const HERO_SIZE = { lg: "text-[3.25rem]", sm: "text-[2.5rem]" };

function seatValueExpr(row: (typeof statRows)[number]): string {
  const base = `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}`;
  return row.fallback !== undefined ? `${base} ?? ${row.fallback}` : base;
}

const heroRow = statRows.find((row) => row.hero);
const sideRows = statRows.filter((row) => row.side);
const tileRows = statRows.filter(
  (row) => row !== heroRow && !sideRows.includes(row),
);
---

<div
  class="flex w-full flex-col gap-4"
  x-show="$store.game.seats.length === 1"
  x-cloak
>
  {
    heroRow && (
      <div class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4">
        <div class="flex flex-col gap-2">
          <ResultValue
            class={cn(
              "font-display leading-none tabular-nums text-foreground text-shadow-glow",
              HERO_SIZE[heroSize],
            )}
            valueExpr={seatValueExpr(heroRow)}
            skeletonWidth={heroRow.skeletonWidth}
          />
          <span class="font-mono text-eyebrow font-semibold uppercase text-muted">
            {heroRow.label}
          </span>
        </div>
        {sideRows.length > 0 && (
          <dl class="flex flex-col gap-2 border-l border-border pl-4">
            {sideRows.map((row) => (
              <div class="flex flex-col-reverse gap-1">
                <dt class="font-mono text-eyebrow font-semibold uppercase text-muted">
                  {row.label}
                </dt>
                <dd>
                  <ResultValue
                    class="font-display text-xl leading-none tabular-nums text-foreground"
                    valueExpr={seatValueExpr(row)}
                    skeletonWidth={row.skeletonWidth}
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    )
  }
  {
    tileRows.length > 0 && (
      <dl class={cn("grid w-full gap-2", TILE_COLS[tileCols])}>
        {tileRows.map((row) => (
          <StatTile
            labelExpr={`'${row.label}'`}
            valueExpr={seatValueExpr(row)}
            skeletonWidth={row.skeletonWidth}
          />
        ))}
      </dl>
    )
  }
  <slot />
</div>
```

Keep the file's existing import-grouping comment style (`// Components`, `// Lib`) if the surrounding files use it.

- [ ] **Step 3: Add `skeletonWidth` to every `STAT_ROWS` entry** in the 10 non-Cricket/Tactics modals, temporarily `"w-6"`, so `astro check` passes (Task 7 sets real values). Also, in `ComparisonSummary`'s `statRows` prop type, add an optional `skeletonWidth?: string` so the shared arrays type-check.

- [ ] **Step 4: Verify** `npx astro check` → 0/0/0; the gate scripts from Task 3 Step 6 pass.

- [ ] **Step 5: Commit** `feat(results): single-DOM solo summary with value skeletons`.

---

### Task 5: `ComparisonSummary` + `StatRowComparison` rebuild

**Files:**
- Modify: `app/src/components/layout/games/ComparisonSummary.astro`
- Modify: `app/src/components/layout/games/StatRowComparison.astro`
- Delete: `app/src/components/layout/games/StatRowComparisonSkeleton.astro`

**Interfaces:**
- Consumes: `ResultValue`.
- Produces: `StatRowComparison` unchanged props; values pulse (`w-9`) until saved.

- [ ] **Step 1: `StatRowComparison.astro`** — wrap each value:

```astro
  <dd
    class="justify-self-start font-mono text-button tabular-nums"
    {...{ ":class": tint(0) }}
  >
    <ResultValue
      valueExpr={leftValue}
      skeletonWidth="w-9"
    />
  </dd>
```

and the mirror for the right with `justify-self-end` and `tint(1)`. Drop the old `x-text` attrs objects.

- [ ] **Step 2: `ComparisonSummary.astro`**:
  - Delete the "Loading" `<dl>` and the `StatRowComparisonSkeleton` import; remove the `x-show="completionStatus === 'succeeded'"` + `x-cloak` from the real `<dl>`.
  - Seat names: replace each name `<span … x-text>` with `ResultValue` (`class="text-sm font-semibold"`, `valueExpr` = the existing name expr, `skeletonWidth="w-12"`), keeping the winner `:class` on a wrapping `<span>`.
  - Legs score: replace the `text-[2.5rem]` span's three children with one `<ResultValue class="font-display text-[2.5rem] leading-none tabular-nums text-foreground" valueExpr={`${legsWon(0)} + ' – ' + ${legsWon(1)}`} skeletonWidth="w-26" />`.
  - The no-`legsBars` name row: same `ResultValue` swap for both names (`w-12`).
- [ ] **Step 3: Delete** `StatRowComparisonSkeleton.astro`; `grep -rn StatRowComparisonSkeleton src` → none.
- [ ] **Step 4: Verify** `npx astro check` → 0/0/0; gates pass.
- [ ] **Step 5: Commit** `feat(results): comparison ledger pulses values in place`.

---

### Task 6: `TargetGrid` + Cricket/Tactics modals

**Files:**
- Create: `app/src/components/layout/games/TargetGrid.astro`
- Modify: `app/src/components/layout/games/result-modals/CricketResults.astro`
- Modify: `app/src/components/layout/games/result-modals/TacticsResults.astro`

**Interfaces:**
- Consumes: `ResultValue`, `SinglePlayerSummary` (default slot), Task 2 result shape.
- Produces: `<TargetGrid labels valuesExpr cols />`.

- [ ] **Step 1: Create `TargetGrid.astro`:**

```astro
---
/**
 * "Darts to close" grid: one inset tile per objective, the dart it closed on
 * over its static label. Values pulse until results are saved; `–` when the
 * objective never closed.
 * @param {readonly string[]} labels Objective labels in display order
 * @param {string} valuesExpr Alpine expression for the per-objective array
 * @param {3 | 4} cols Grid columns
 */
interface Props {
  labels: readonly string[];
  valuesExpr: string;
  cols: 3 | 4;
}

// Props
const { labels, valuesExpr, cols }: Props = Astro.props;

// Components
import ResultValue from "@components/layout/games/ResultValue.astro";

// Lib
import { cn } from "@client/cn";

const COLS = { 3: "grid-cols-3", 4: "grid-cols-4" };
---

<div class="flex w-full flex-col gap-2">
  <span class="self-start font-mono text-eyebrow font-semibold uppercase text-muted">
    Darts to close
  </span>
  <dl class={cn("grid w-full gap-2", COLS[cols])}>
    {
      labels.map((label, i) => (
        <div class="inset-well flex h-14 flex-col-reverse items-center justify-center gap-1 rounded-2xl">
          <dt class="font-mono text-eyebrow font-semibold uppercase text-muted">
            {label}
          </dt>
          <dd>
            <ResultValue
              class="font-mono text-lg leading-none tabular-nums text-foreground"
              valueExpr={`${valuesExpr}?.[${i}] ?? '–'`}
              skeletonWidth="w-5"
            />
          </dd>
        </div>
      ))
    }
  </dl>
</div>
```

- [ ] **Step 2: `CricketResults.astro`:**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import TargetGrid from "@components/layout/games/TargetGrid.astro";

const STAT_ROWS = [
  { label: "Darts used", key: "darts", hero: true, skeletonWidth: "w-30" },
  { label: "Marks / round", key: "marksPerRound", side: true, skeletonWidth: "w-14" },
  { label: "Trebles", key: "trebles", side: true, skeletonWidth: "w-6" },
] as const;

const TARGET_LABELS = ["20", "19", "18", "17", "16", "15", "Bull"] as const;
---

<ResultsModalShell overline="Cricket · Solo summary">
  <h2
    slot="title"
    id="results-title"
    class="text-balance font-display text-xl text-foreground"
    x-text="resultsTitle()"
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS}>
    <TargetGrid
      labels={TARGET_LABELS}
      valuesExpr="resultsSnapshot?.seats?.[0]?.dartsToClose"
      cols={4}
    />
  </SinglePlayerSummary>
</ResultsModalShell>
```

- [ ] **Step 3: `TacticsResults.astro`** — same as Step 2 with: overline `"Tactics · Solo summary"`; side row `{ label: "Bulls", key: "bulls", side: true, skeletonWidth: "w-6" }` in place of Trebles; `TARGET_LABELS = ["20","19","18","17","16","15","Bull","Doubles","Triples"]`; `cols={3}`.
- [ ] **Step 4: Verify** `npx astro check` → 0/0/0; gates pass.
- [ ] **Step 5: Commit** `feat(cricket,tactics): result modals per design`.

---

### Task 7: Design parity for the other 10 modals

**Files:** Modify every remaining `app/src/components/layout/games/result-modals/*.astro`.

- [ ] **Step 1: Apply the table.** Rows in order; `H` hero, `S` side, `T` tile; widths are `skeletonWidth`. Keys stay as they are today.

| File | overline | heroSize | tileCols | Rows (label · key · role · width) |
| --- | --- | --- | --- | --- |
| FiveOhOne | `501 · Match summary` | lg | 2 | 3-dart average · threeDartAverage · H · w-30; Legs won · legsWon · S · w-6; Checkout · checkoutPercentage (fallback `'—'`) · S · w-18; Best leg · bestLeg · T · w-6.5; 60+ · sixtyPlus · T · w-6.5; 100+ · hundredPlus · T · w-6; 140+ · oneFortyPlus · T · w-6 |
| OneTwentyOne | `121 · Summary` | sm | — | Average · average.toFixed(2) · H · w-28; Visits · visits · S · w-7; Checkout · checkoutPercentage (`'—'`) · S · w-18 |
| AroundTheClock | `Around the Clock · Summary` | lg | 2 | Turns · turns · H · w-30; Accuracy · accuracy · S · w-11; Darts thrown · totalDarts · S · w-7; timed only: Laps · laps · T · w-6; Reached · targetAtEnd · T · w-6 |
| Bobs27 | `Bob's 27 · Summary` | lg | — | Score · score · H · w-30; Darts · darts · S · w-7; Accuracy · doubleHitRate · S · w-11; Highest target · highestNumberReached · S · w-11 |
| DoublesTraining | `Doubles training · Summary` | lg | 3 | Hits · hits · H · w-30; Accuracy · accuracy · S · w-11; Misses · misses · S · w-7; On 1st · on1st · T · w-6; On 2nd · on2nd · T · w-6; On 3rd · on3rd · T · w-6 |
| ScoreTraining | `Score training · Summary` | sm | 4 | Total · total · H · w-28; 3-dart avg · threeDartAverage · S · w-18; First 9 avg · firstNineAverage · S · w-18; Highest · highestScore · S · w-11; 100+ · hundredPlus · T · w-6; 120+ · oneTwentyPlus · T · w-6; 140+ · oneFortyPlus · T · w-6; 180s · oneEighties · T · w-6 |
| Shanghai | `Shanghai · Summary` | lg | 3 | Score · score · H · w-30; Round · round · S · w-6; Accuracy · accuracy · S · w-11; Trebles · trebles · T · w-6; Doubles · doubles · T · w-6; Singles · singles · T · w-6.5 |
| SinglesTraining | `Singles training · Summary` | lg | 3 | Total points · points · H · w-30; Accuracy · accuracy · S · w-11; Darts missed · misses · S · w-7; Singles · singles · T · w-6.5; Doubles · doubles · T · w-6; Trebles · trebles · T · w-6 |
| TenUpOneDown | `Ten Up One Down · Summary` | lg | — | Target reached · target · H · w-30; Checkout · checkoutPercentage (`'—'`) · S · w-11 |

`FiveOhOne`'s `COMPARISON_STAT_ROWS` stays unchanged. Other modals keep passing the same `STAT_ROWS` to `ComparisonSummary` (it ignores `hero`/`side`/`skeletonWidth`). Pass `heroSize="sm"` / `tileCols={n}` only where the table differs from the defaults.

- [ ] **Step 2: Verify** `npx astro check` → 0/0/0; gates pass; `npm test` green.
- [ ] **Step 3: Commit** `feat(results): design parity for all result modals`.

---

### Task 8: Visual check, docs, gates

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (rows ~78–106)
- Modify: `docs/architecture/00-File-Inventory.md` (rows for added/deleted components, if listed)
- Modify: `decisions/frontend/style.md` (new decision block)

- [ ] **Step 1: Visual check.** `npm run dev` (background: `astro dev --background`). Play a short solo Cricket, Tactics, 501 and one 1v1 501 game to the end; with devtools network throttled ("Slow 3G"), screenshot the modal while `SAVING…` and after `SAVED`. Confirm modal height and all label positions are identical. Also force a failure (offline) → error + Retry shown, bars remain. Run a routine to completion; same check.
- [ ] **Step 2: Component Inventory.** Update rows: `ResultsModalShell` (props: `overline` only; mandatory `SaveStatus`; `Rematch`), `SinglePlayerSummary` (new props `heroSize`, `tileCols`, `skeletonWidth` per row, default slot), `StatTile` (`skeletonWidth`), `StatRowComparison` (values pulse in place). Delete the `StatRowComparisonSkeleton` row. Add rows for `ResultValue`, `SaveStatus`, `TargetGrid`. Mirror in `00-File-Inventory.md` where components are listed (`grep -n "StatRowComparisonSkeleton\|SinglePlayerSummary" docs/architecture/00-File-Inventory.md`).
- [ ] **Step 3: Decision.** Next id: `grep -rhoE "\bD[0-9]{3}\b" decisions | sort -u | tail -1` → +1. Append to `decisions/frontend/style.md` per `DECISIONS.md`'s block format: "Result modals render one DOM; values swap via `ResultValue` (pulse bar in the value's own line box) and a mandatory `SaveStatus` row, so saving → saved never shifts layout. Supersedes the parallel loaded/skeleton blocks." Cite the spec.
- [ ] **Step 4: Gates.** Run the `run-all-gates` and `validate-app` skills (`npm run validate:app`: 0 errors/warnings/hints); `npm run format` then `npm run format:check` clean.
- [ ] **Step 5: Commit** `docs(results): inventory + decision for result modal skeletons`.
- [ ] **Step 6:** `context-maintenance` skill, then `finishing-a-dart-branch` (push + PR).
