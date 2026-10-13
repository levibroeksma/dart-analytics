# Play-Screen Shells Implementation Plan (#915)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the copy-pasted shells of 9 exercise panels and 9 game play interfaces with two shared components, with byte-identical rendered HTML.

**Architecture:** Part A adds `ExercisePanelShell.astro`; each panel becomes a `score` + `rows` call. Part B adds a pure TS call helper (`play-screen-expr.ts`) that expands one tile definition into its solo (`fn()`) and per-seat (`fnFor(<seat ref>)`) Alpine expressions, a private `PlayStatTileList.astro`, and `SeatedPlayScreen.astro`; each interface becomes data plus its input stack in the default slot. File names and paths of panels/interfaces do not change, so no page changes.

**Tech Stack:** Astro 7 (prerendered play routes), Alpine.js expressions as strings, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-play-screen-shells-design.md`

## Global Constraints

- No visible or behavioural change: the built HTML of every touched route is byte-identical before/after (`diff -r` empty).
- Part A branch `refactor/915-exercise-panel-shell` (carries this spec + plan); Part B branch `refactor/915-seated-play-screen` from `origin/main` after Part A merges. Each lands by its own PR.
- Out of scope: Cricket, Tactics, `WarmUpPanel`, `BlockedStepModal`, `ExerciseBoardInputPanel`, #916.
- Tests under `app/tests/` mirroring `app/src/`; `.astro` gets no unit test (D101).
- Commands run from `app/`. Commit only at the steps below. Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_019GJ65JMMfqbXBrhBH3rnCP`.
- `SCRATCH=/tmp/claude-0/-home-user-dart-analytics/ed9a45d5-0fea-59ac-99b5-ea32f4ea22d6/scratchpad`.

## Review Focus

1. **Score Training solo big value** is `$store.game.turns.reduce(…)`, not `totalScore()` — must survive verbatim (via `c.solo`). Pinned by the build diff on `games/score-training/play`.
2. **Shanghai idle stat** is Target, not its first tile (Round) — `idle` override. Pinned by the build diff on `games/shanghai/play`.
3. **Conditional tiles/rows** (`showWhen`): ATC "This visit" (`<template x-if>`), exercise "Last"/"To beat" (`div[x-show][x-cloak]`) — wrapper element must match. Pinned by the build diffs; `showWhen` expansion unit-tested in Task B1.
4. **Seat ref string** must be exactly `state()?.seats[i]?.participantRef` — any drift breaks every seat silently in the browser. Pinned in Task B1 tests and the build diffs.
5. **Empty tile list** has no idle stat — rejected at type level (`tiles: [Tile, ...Tile[]]`), checked by `npm run check`.

---

## Part A — `ExercisePanelShell`

### Task A1: Baseline build snapshot

**Files:** none (scratchpad only)

- [ ] **Step 1: Branch and install**

```bash
cd /home/user/dart-analytics
git fetch origin main
git checkout -b refactor/915-exercise-panel-shell origin/main   # or reuse if it exists (spec commit lives here)
cd app && npm ci
```

- [ ] **Step 2: Build and snapshot play routes**

```bash
cd /home/user/dart-analytics/app
npm run build
mkdir -p "$SCRATCH/parity-a/before"
find dist -path '*play/index.html' | while read f; do mkdir -p "$SCRATCH/parity-a/before/$(dirname "$f")"; cp "$f" "$SCRATCH/parity-a/before/$f"; done
find "$SCRATCH/parity-a/before" -name index.html | wc -l
```

Expected: count ≥ 12 (11 game play routes + `training/routines/play`). If `npm run build` fails for missing env, read `app/CLAUDE.md` / `.env.example` for the build-time vars and set dummy values; do not change source.

- [ ] **Step 3: Record fallow baseline**

```bash
npx fallow dupes --mode weak 2>&1 | tail -5 > "$SCRATCH/fallow-before.txt"; cat "$SCRATCH/fallow-before.txt"
```

### Task A2: `ExercisePanelShell` + 9 panels

**Files:**
- Create: `app/src/components/layout/training/exercises/ExercisePanelShell.astro`
- Modify (full rewrite): `BullUpPanel.astro`, `BullseyeCheckoutPanel.astro`, `CheckoutSequencePanel.astro`, `DoublePatternPanel.astro`, `RandomCheckoutPanel.astro`, `ScoreThresholdPanel.astro`, `SwitchingPanel.astro`, `SwitchingTargetScoringPanel.astro`, `TargetScoringPanel.astro` (all in `app/src/components/layout/training/exercises/`)

**Interfaces:**
- Produces: `<ExercisePanelShell score: string rows: { label: string; value: string; showWhen?: string }[] />`

- [ ] **Step 1: Create the shell**

```astro
---
/**
 * Play surface shared by the scored exercise panels (#915): a
 * `SinglePlayerDisplay` with the step's big value and a `dl` of `StatRow`s
 * that always ends with the step clock, then `VisitPreview` and
 * `ExerciseBoardInputPanel`. Reads the routine play page scope.
 * @param {string} score Alpine expression for the big value
 * @param {object[]} rows `{ label, value, showWhen? }` — `value` and
 *   `showWhen` are Alpine expressions; a row with `showWhen` is hidden while
 *   it is false. The `Time` row is appended here, not passed.
 */
interface ExerciseRow {
  label: string;
  value: string;
  showWhen?: string;
}

interface Props {
  score: string;
  rows: ExerciseRow[];
}

// Props
const { score, rows }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";

// Data
const allRows: ExerciseRow[] = [
  ...rows,
  { label: "Time", value: "formattedStepRemaining()" },
];
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <SinglePlayerDisplay
    isTarget={false}
    score={score}
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        {
          allRows.map((row) =>
            row.showWhen ? (
              <div
                x-show={row.showWhen}
                x-cloak
              >
                <StatRow
                  label={row.label}
                  value={row.value}
                />
              </div>
            ) : (
              <StatRow
                label={row.label}
                value={row.value}
              />
            ),
          )
        }
      </dl>
    </div>
  </SinglePlayerDisplay>

  <VisitPreview />

  <ExerciseBoardInputPanel />
</div>
```

- [ ] **Step 2: Rewrite the 9 panels**

Every panel file becomes exactly this shape (frontmatter import + one call). Contents:

`BullUpPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="bullUpBullseyes()"
  rows={[
    { label: "Last", value: "bullUpLastResult()" },
    { label: "Throws", value: "bullUpThrows()" },
    { label: "Bulls", value: "bullUpBulls()" },
    { label: "Bullseye rate", value: "bullUpBullseyeRate()" },
    { label: "Bull rate", value: "bullUpBullRate()" },
  ]}
/>
```

`BullseyeCheckoutPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="bullseyeCheckoutCheckouts()"
  rows={[
    { label: "Left", value: "bullseyeCheckoutLeft()" },
    { label: "Last", value: "bullseyeCheckoutLastResult()" },
    { label: "Visits", value: "bullseyeCheckoutVisits()" },
    { label: "Rate", value: "bullseyeCheckoutRate()" },
  ]}
/>
```

`CheckoutSequencePanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="checkoutSequencePoints()"
  rows={[
    { label: "Outshot", value: "checkoutSequenceOutshot()" },
    { label: "Left", value: "checkoutSequenceLeft()" },
    { label: "Dart", value: "`${checkoutSequenceAttemptDart()} / 6`" },
    { label: "Last", value: "checkoutSequenceLastResult()" },
    { label: "Checkouts", value: "checkoutSequenceCheckouts()" },
  ]}
/>
```

`DoublePatternPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="doublePatternPoints()"
  rows={[
    { label: "Double", value: "doublePatternLabel()" },
    { label: "Darts", value: "dartsThrown()" },
  ]}
/>
```

`RandomCheckoutPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="randomCheckoutCheckouts()"
  rows={[
    { label: "Start", value: "randomCheckoutStart()" },
    { label: "Left", value: "randomCheckoutLeft()" },
    { label: "Dart", value: "`${randomCheckoutAttemptDart()} / 3`" },
    { label: "Last", value: "randomCheckoutLastResult()" },
    { label: "Rate", value: "randomCheckoutRate()" },
  ]}
/>
```

`ScoreThresholdPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="scoreThresholdBeats()"
  rows={[
    { label: "This visit", value: "scoreThresholdVisitTotal()" },
    {
      label: "Last",
      value: "scoreThresholdLastVisitTotal()",
      showWhen: "scoreThresholdLastVisitTotal() !== null",
    },
    { label: "Visits", value: "scoreThresholdVisits()" },
    { label: "Rate", value: "scoreThresholdBeatRate()" },
  ]}
/>
```

`SwitchingPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="switchingPoints()"
  rows={[
    { label: "Target", value: "switchingTargetLabel()" },
    { label: "Darts", value: "dartsThrown()" },
  ]}
/>
```

`SwitchingTargetScoringPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="switchingTargetScoringChain()"
  rows={[
    { label: "Target", value: "switchingTargetScoringTargetLabel()" },
    {
      label: "To beat",
      value: "switchingTargetScoringMarkToBeat()",
      showWhen: "switchingTargetScoringMarkToBeat() !== null",
    },
    { label: "Best", value: "switchingTargetScoringBestChain()" },
  ]}
/>
```

`TargetScoringPanel.astro`
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="targetScoringChain()"
  rows={[
    { label: "Target", value: "targetScoringTargetLabel()" },
    {
      label: "To beat",
      value: "targetScoringMarkToBeat()",
      showWhen: "targetScoringMarkToBeat() !== null",
    },
    { label: "Best", value: "targetScoringBestChain()" },
  ]}
/>
```

Before overwriting each file, `git show origin/main:<path>` and confirm the labels/expressions above match it; the original is the authority.

- [ ] **Step 3: Rebuild and diff**

```bash
cd /home/user/dart-analytics/app
npm run build
rm -rf "$SCRATCH/parity-a/after"; mkdir -p "$SCRATCH/parity-a/after"
find dist -path '*play/index.html' | while read f; do mkdir -p "$SCRATCH/parity-a/after/$(dirname "$f")"; cp "$f" "$SCRATCH/parity-a/after/$f"; done
diff -r "$SCRATCH/parity-a/before" "$SCRATCH/parity-a/after" && echo PARITY-OK
```

Expected: `PARITY-OK`. On any diff: fix the shell/panel, never the baseline. If the only diff is an Astro-generated hash (e.g. asset filename) unrelated to these components, show it and confirm it also changes on a no-op rebuild before accepting.

- [ ] **Step 4: Type check**

Run: `npm run check` — Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/training/exercises/
git commit -m "refactor: extract ExercisePanelShell (#915 task A)" -m "<trailers>"
```

### Task A3: Docs, gates, PR

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (training exercises table, rows ~154–164)
- Modify: `decisions/frontend/astro.md` (append)

- [ ] **Step 1: Inventory** — add a row above `WarmUpPanel.astro`:

```
| `ExercisePanelShell.astro` | Shared scored-exercise play surface: `SinglePlayerDisplay` with the step's big value, a `dl` of `StatRow`s ending in `Time` (`formattedStepRemaining()`), `VisitPreview`, and `ExerciseBoardInputPanel` (#915, 2026-10-13) | `score`, `rows` (`{ label, value, showWhen? }[]`; `showWhen` wraps the row in `x-show` + `x-cloak`) |
```

and append ` — a call to `ExercisePanelShell`` to the description cell of each of the 9 panel rows (Switching, DoublePattern, BullUp, CheckoutSequence, RandomCheckout, BullseyeCheckout, ScoreThreshold, SwitchingTargetScoring, TargetScoring). No other change to those rows.

- [ ] **Step 2: Decision** — `grep -rhoE '^### D[0-9]+' decisions | sort -t D -k2 -n | tail -1`; append the next number (expected D452) to `decisions/frontend/astro.md`:

```
### D452 — `ExercisePanelShell` owns the scored exercise play surface
Status: Accepted · Date: 2026-10-13
Decision: `components/layout/training/exercises/ExercisePanelShell.astro` renders the wrapper, `SinglePlayerDisplay` (`isTarget={false}`), the `dl` of `StatRow`s with the `Time` row appended, `VisitPreview` and `ExerciseBoardInputPanel`. Its `rows` prop is `{ label, value, showWhen? }[]`; `showWhen` wraps a row in `div[x-show][x-cloak]`. The 9 scored panels keep their names and paths and reduce to one call.
Reason: the panels repeated the same ~40 lines and differed only in the big-value expression and the row list (#915), so a layout change had to land nine times.
Consequences: a new scored exercise panel is a `score` and a row list. `WarmUpPanel` (no scoreboard) is unchanged. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built `training/routines/play` HTML before and after.
Supersedes: none.
```

- [ ] **Step 3: Gates** — invoke the `run-all-gates` skill and the `validate-app` skill; run every step they name. If `DATABASE_URL` is unset, the `db:*` steps cannot run: report that, and run `bash ../scripts/fallow-gate.sh`, `npm test`, `npm run check` individually. Record `npx fallow dupes --mode weak 2>&1 | tail -5` and compare with `$SCRATCH/fallow-before.txt`.

- [ ] **Step 4: Context maintenance** — invoke the `context-maintenance` skill; apply what it requires (e.g. File Inventory row if it lists components).

- [ ] **Step 5: Commit** (docs + decision), then finish via `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push, PR). PR body: summary, the `PARITY-OK` diff output, fallow before/after, gate results, `Refs #915` (not `Closes` — Part B remains).

---

## Part B — `SeatedPlayScreen`

### Task B1: `play-screen-expr.ts` (TDD)

**Files:**
- Create: `app/src/lib/game/play-screen-expr.ts`
- Test: `app/tests/lib/game/play-screen-expr.test.ts`

**Interfaces:**
- Produces:
  - `interface Call { (fn: string): string; readonly solo: boolean }`
  - `type Expr = (c: Call) => string`
  - `interface Tile { label: string; value: Expr; showWhen?: Expr }`
  - `soloCall(): Call`, `seatCall(index: 0 | 1): Call`, `seatRef(index: 0 | 1): string`

- [ ] **Step 0: Branch + baseline** — repeat Task A1 Steps 1–3 on `refactor/915-seated-play-screen` from `origin/main`, snapshotting to `$SCRATCH/parity-b/before` and `$SCRATCH/fallow-before-b.txt`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  seatCall,
  seatRef,
  soloCall,
  type Tile,
} from "@lib/game/play-screen-expr";

describe("play-screen-expr", () => {
  it("seatRef points at the seat's participantRef", () => {
    expect(seatRef(0)).toBe("state()?.seats[0]?.participantRef");
    expect(seatRef(1)).toBe("state()?.seats[1]?.participantRef");
  });

  it("soloCall expands fn to a bare call", () => {
    const c = soloCall();
    expect(c("average")).toBe("average()");
    expect(c.solo).toBe(true);
  });

  it("seatCall expands fn to its For variant on the seat ref", () => {
    const c = seatCall(1);
    expect(c("average")).toBe(
      "averageFor(state()?.seats[1]?.participantRef)",
    );
    expect(c.solo).toBe(false);
  });

  it("one tile expands to matching solo and seat expressions", () => {
    const tile: Tile = {
      label: "Visit",
      value: (c) => `(${c("visitsThisAttempt")} + 1) + ' / 3'`,
      showWhen: (c) => c("hitsToGo"),
    };
    expect(tile.value(soloCall())).toBe("(visitsThisAttempt() + 1) + ' / 3'");
    expect(tile.value(seatCall(0))).toBe(
      "(visitsThisAttemptFor(state()?.seats[0]?.participantRef) + 1) + ' / 3'",
    );
    expect(tile.showWhen?.(seatCall(0))).toBe(
      "hitsToGoFor(state()?.seats[0]?.participantRef)",
    );
  });

  it("c.solo lets a tile keep a non-conforming solo expression", () => {
    const value = (c: ReturnType<typeof soloCall>) =>
      c.solo ? "custom()" : c("total");
    expect(value(soloCall())).toBe("custom()");
    expect(value(seatCall(0))).toBe(
      "totalFor(state()?.seats[0]?.participantRef)",
    );
  });
});
```

- [ ] **Step 2: Run to fail** — `npx vitest run tests/lib/game/play-screen-expr.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/**
 * Alpine expression builders for `SeatedPlayScreen` (#915). A game writes
 * each play-screen value once as an `Expr`; the shell calls it with the solo
 * call (`fn()`) and with each seat's call
 * (`fnFor(state()?.seats[i]?.participantRef)`), matching the play factories'
 * `x()` / `xFor(ref)` accessor pairs.
 */
export interface Call {
  (fn: string): string;
  /** True for the solo scoreboard; for an expr with no `xFor` twin. */
  readonly solo: boolean;
}

export type Expr = (c: Call) => string;

export interface Tile {
  label: string;
  value: Expr;
  /** Rendered inside `<template x-if>` when set. */
  showWhen?: Expr;
}

export function seatRef(index: 0 | 1): string {
  return `state()?.seats[${index}]?.participantRef`;
}

export function soloCall(): Call {
  return Object.assign((fn: string) => `${fn}()`, { solo: true });
}

export function seatCall(index: 0 | 1): Call {
  return Object.assign((fn: string) => `${fn}For(${seatRef(index)})`, {
    solo: false,
  });
}
```

- [ ] **Step 4: Run to pass** — same command → PASS; then `npm test` → all pass.

- [ ] **Step 5: Commit** — `feat(game): play-screen expression builders (#915 task B)`.

### Task B2: `PlayStatTileList` + `SeatedPlayScreen`, first interface (OneTwentyOne)

**Files:**
- Create: `app/src/components/layout/games/PlayStatTileList.astro`
- Create: `app/src/components/layout/games/SeatedPlayScreen.astro`
- Modify (rewrite): `app/src/components/layout/games/interfaces/OneTwentyOne.astro`

**Interfaces:**
- Consumes: Task B1 exports.
- Produces: `<SeatedPlayScreen big tiles idle? route? legs? countdownDisabled? {...rest}>` with slots `between`, default.

- [ ] **Step 1: `PlayStatTileList.astro`**

```astro
---
/**
 * `SeatedPlayScreen`'s tile list for one scoreboard: each `Tile` expanded
 * with `call` (solo or one seat) into a `PlayStatTile`, inside
 * `<template x-if>` when it has `showWhen`.
 * @param {Tile[]} tiles Tile definitions
 * @param {Call} call `soloCall()` or `seatCall(i)`
 * @param {boolean} [compact] Seat-card row layout
 */
import type { Call, Tile } from "@lib/game/play-screen-expr";

interface Props {
  tiles: Tile[];
  call: Call;
  compact?: boolean;
}

// Props
const { tiles, call, compact = false }: Props = Astro.props;

// Components
import PlayStatTile from "./PlayStatTile.astro";
---

{
  tiles.map((tile) =>
    tile.showWhen ? (
      <template x-if={tile.showWhen(call)}>
        <PlayStatTile
          compact={compact}
          label={tile.label}
          valueExpr={tile.value(call)}
        />
      </template>
    ) : (
      <PlayStatTile
        compact={compact}
        label={tile.label}
        valueExpr={tile.value(call)}
      />
    ),
  )
}
```

- [ ] **Step 2: `SeatedPlayScreen.astro`**

```astro
---
/**
 * Play-screen shell for a game with a solo and a two-seat layout (#915).
 * Each value is an `Expr` written once; the shell expands it for the solo
 * `SinglePlayerDisplay` and both `SplitScoreboard` seats. It owns the
 * wrapper, both `x-if` layouts, `ErrorAlert`, `BoardInputPanel` and the
 * optional `CountdownResumePrompt`.
 * @param {object} big `{ isTarget, value }` — the big value (solo
 *   `target`/`score`, seat `scoreExpr`)
 * @param {Tile[]} tiles Stat tiles, solo and compact per seat (non-empty)
 * @param {Tile} [idle] The waiting seat's stat; default `tiles[0]`
 * @param {Expr} [route] Checkout route (solo `RouteChips`, seat `checkoutExpr`)
 * @param {object} [legs] `{ won, toWin }` — seat `legsExpr`, `legsToWinExpr`
 * @param {string} [countdownDisabled] Set → renders `CountdownResumePrompt`
 * @slot between Between the solo and two-seat layouts
 * @slot default The game's input stack (keypad or recreational input)
 */
import type { Expr, Tile } from "@lib/game/play-screen-expr";

interface Props {
  big: { isTarget: boolean; value: Expr };
  tiles: [Tile, ...Tile[]];
  idle?: Tile;
  route?: Expr;
  legs?: { won: Expr; toWin: string };
  countdownDisabled?: string;
  [key: string]: unknown;
}

// Props
const {
  big,
  tiles,
  idle = tiles[0],
  route,
  legs,
  countdownDisabled,
  ...props
}: Props = Astro.props;

// Components
import SinglePlayerDisplay from "./SinglePlayerDisplay.astro";
import SplitScoreboard from "./SplitScoreboard.astro";
import PlayStatTileList from "./PlayStatTileList.astro";
import RouteChips from "./RouteChips.astro";
import BoardInputPanel from "./BoardInputPanel.astro";
import CountdownResumePrompt from "./CountdownResumePrompt.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";

// Lib
import { seatCall, seatRef, soloCall, type Call } from "@lib/game/play-screen-expr";

// Data
const solo = soloCall();
const bigSolo = big.value(solo);
const seatA = seatCall(0);
const seatB = seatCall(1);
const seatDisplay = (index: 0 | 1, c: Call) => ({
  nameExpr: `$store.game.seats[${index}]?.displayName`,
  activeExpr: `state()?.activeParticipantRef === ${seatRef(index)}`,
  scoreExpr: big.value(c),
  idleStatExpr: idle.value(c),
  legsExpr: legs?.won(c),
  checkoutExpr: route?.(c),
});
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={big.isTarget}
      target={bigSolo}
      score={bigSolo}
    >
      {
        route && (
          <RouteChips
            slot="route"
            routeExpr={route(solo)}
          />
        )
      }
      <PlayStatTileList
        tiles={tiles}
        call={solo}
      />
    </SinglePlayerDisplay>
  </template>

  <slot name="between" />

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={seatDisplay(0, seatA)}
      seatB={seatDisplay(1, seatB)}
      idleStatLabel={idle.label}
      legsToWinExpr={legs?.toWin}
    >
      <PlayStatTileList
        slot="progressA"
        tiles={tiles}
        call={seatA}
        compact
      />
      <PlayStatTileList
        slot="progressB"
        tiles={tiles}
        call={seatB}
        compact
      />
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <slot />
  {
    /* Visual board — shown instead of the input above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
  {countdownDisabled && <CountdownResumePrompt disabledExpr={countdownDisabled} />}
</div>
```

Notes: if `npm run check` rejects `legsExpr: undefined` / `checkoutExpr: undefined` or `legsToWinExpr={undefined}`, switch to conditional spreads (`...(legs && { legsExpr: legs.won(c) })`) — rendering is the same. If the build diff shows the `route` slot or tile markup differs, try `<Fragment slot="route">` or `<Fragment slot="progressA">` wrappers; the diff is the judge.

- [ ] **Step 3: Rewrite `OneTwentyOne.astro`**

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SeatedPlayScreen from "@components/layout/games/SeatedPlayScreen.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
---

<SeatedPlayScreen
  big={{ isTarget: true, value: (c) => c("remainingInAttempt") }}
  route={(c) => c("checkoutHint")}
  tiles={[
    { label: "Target", value: (c) => c("currentTargetLabel") },
    {
      label: "Visit",
      value: (c) => `(${c("visitsThisAttempt")} + 1) + ' / 3'`,
    },
    { label: "Darts", value: (c) => c("dartsThisAttempt") },
  ]}
  countdownDisabled="finished || showDoubleConfirm || showSessionFinishConfirm"
  {...props}
>
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 4: Build + diff** — as Task A2 Step 3, into `$SCRATCH/parity-b/after`, diff against `$SCRATCH/parity-b/before`. Expected `PARITY-OK` (only 121 and routines routes are affected so far). Fix the shell until identical.

- [ ] **Step 5: `npm run check`** → 0/0/0. **Commit** — `refactor: extract SeatedPlayScreen; port 121 (#915 task B)`.

### Task B3: Port the other 8 interfaces

**Files (rewrite, all in `app/src/components/layout/games/interfaces/`):** `TenUpOneDown`, `FiveOhOne`, `ScoreTraining`, `SinglesTraining`, `Shanghai`, `DoublesTraining`, `AroundTheClock`, `Bobs27`.

Each file keeps the `Props` / `const { ...props }` frontmatter header from OneTwentyOne, imports `SeatedPlayScreen` plus only the input components its slot uses, and passes `{...props}` last. Before each rewrite, `git show origin/main:<path>` and check every expression below against it.

- [ ] **Step 1: `TenUpOneDown.astro`** — imports `SeatedPlayScreen`, `ScoreInput`.

```astro
<SeatedPlayScreen
  big={{ isTarget: true, value: (c) => c("remainingInAttempt") }}
  route={(c) => c("checkoutHint")}
  tiles={[
    { label: "Target", value: (c) => c("currentTargetLabel") },
    { label: "Attempts", value: (c) => c("attempts") },
    { label: "Successes · Failures", value: (c) => c("successFailure") },
  ]}
  countdownDisabled="finished || showDoubleConfirm || showFinishConfirm"
  {...props}
>
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 2: `FiveOhOne.astro`** — imports `SeatedPlayScreen`, `ScoreInput`. No countdown.

```astro
<SeatedPlayScreen
  big={{ isTarget: true, value: (c) => c("remainingScore") }}
  route={(c) => c("checkoutHint")}
  legs={{ won: (c) => c("legsWon"), toWin: "legsToWin()" }}
  tiles={[
    { label: "Avg", value: (c) => c("average") },
    { label: "Prev", value: (c) => c("previousScore") },
    { label: "Darts", value: (c) => c("dartsThrownThisLeg") },
  ]}
  {...props}
>
  <template
    slot="between"
    x-if="setsTally()"
  >
    <p
      class="text-center font-mono text-eyebrow-sm font-semibold uppercase text-muted"
      x-text="`Sets ${setsTally()}`"
    >
    </p>
  </template>

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showMatchFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showMatchFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showMatchFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

If `slot` on a `<template>` element leaks a `slot="between"` attribute into the HTML diff, wrap it: `<Fragment slot="between"><template x-if="setsTally()">…</template></Fragment>`.

- [ ] **Step 3: `ScoreTraining.astro`** — imports `SeatedPlayScreen`, `ScoreInput`.

```astro
<SeatedPlayScreen
  big={{
    isTarget: false,
    value: (c) =>
      c.solo
        ? "$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0).toLocaleString('en-US')"
        : `${c("totalScore")}.toLocaleString('en-US')`,
  }}
  tiles={[
    { label: "Avg", value: (c) => c("threeDartAverage") },
    { label: "Darts", value: (c) => c("dartsThrownThisLeg") },
    { label: "Prev", value: (c) => c("previousScoreThisLeg") },
  ]}
  countdownDisabled="finished || showFinishConfirm"
  {...props}
>
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 4: `SinglesTraining.astro`** — imports `SeatedPlayScreen`, `VisitPreview`, `SinglesRecreationalInput`.

```astro
<SeatedPlayScreen
  big={{ isTarget: false, value: (c) => c("currentPoints") }}
  tiles={[
    { label: "Target", value: (c) => c("currentTargetLabel") },
    { label: "Misses", value: (c) => c("missCount") },
    {
      label: "S · D · T",
      value: (c) =>
        `${c("singleCount")} + ' · ' + ${c("doubleCount")} + ' · ' + ${c("trebleCount")}`,
    },
  ]}
  {...props}
>
  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 5: `Shanghai.astro`** — imports `SeatedPlayScreen`, `VisitPreview`, `SinglesRecreationalInput`. Idle override.

```astro
<SeatedPlayScreen
  big={{ isTarget: false, value: (c) => c("currentScore") }}
  tiles={[
    { label: "Round", value: (c) => c("roundLabel") },
    { label: "Target", value: (c) => c("currentTargetLabel") },
  ]}
  idle={{ label: "Target", value: (c) => c("currentTargetLabel") }}
  {...props}
>
  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 6: `DoublesTraining.astro`** — imports `SeatedPlayScreen`, `VisitPreview`, `DoublesPathRecreationalInput`.

```astro
<SeatedPlayScreen
  big={{ isTarget: true, value: (c) => c("currentTargetLabel") }}
  tiles={[
    { label: "Hits", value: (c) => c("hitCount") },
    { label: "Misses", value: (c) => c("missCount") },
  ]}
  {...props}
>
  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 7: `AroundTheClock.astro`** — imports `SeatedPlayScreen`, `VisitPreview`, `SinglesRecreationalInput`.

```astro
<SeatedPlayScreen
  big={{ isTarget: true, value: (c) => c("currentTargetLabel") }}
  tiles={[
    { label: "Turns", value: (c) => c("turnsSoFar") },
    { label: "Accuracy", value: (c) => c("accuracy") },
    {
      label: "This visit",
      value: (c) => c("hitsToGo"),
      showWhen: (c) => c("hitsToGo"),
    },
  ]}
  countdownDisabled="finished"
  {...props}
>
  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 8: `Bobs27.astro`** — imports `SeatedPlayScreen`, `VisitPreview`, `DoublesPathRecreationalInput`.

```astro
<SeatedPlayScreen
  big={{ isTarget: false, value: (c) => c("currentScore") }}
  tiles={[{ label: "Target", value: (c) => c("currentTargetLabel") }]}
  {...props}
>
  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

- [ ] **Step 9: Build + diff** (as B2 Step 4) → `PARITY-OK` across all routes. `npm run check` → 0/0/0. `npm test` → pass.

- [ ] **Step 10: Commit** — `refactor: port 8 interfaces to SeatedPlayScreen (#915 task B)`.

### Task B4: Docs, gates, PR

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (games layout table, near `SplitScoreboard` row ~106)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md:75`
- Modify: `decisions/frontend/astro.md` (append)

- [ ] **Step 1: Inventory rows** (alphabetical within the games table):

```
| `SeatedPlayScreen.astro` | Play-screen shell for a game with solo and two-seat layouts: wrapper, solo `SinglePlayerDisplay`, two-seat `SplitScoreboard`, `ErrorAlert`, slotted input, `BoardInputPanel`, optional `CountdownResumePrompt`. Each value is an `Expr` from `play-screen-expr.ts`, written once and expanded to `fn()` solo and `fnFor(<seat ref>)` per seat (#915, 2026-10-13) | `big` (`{ isTarget, value }`), `tiles` (`{ label, value, showWhen? }[]`, non-empty), `idle?` (default `tiles[0]`), `route?`, `legs?` (`{ won, toWin }`), `countdownDisabled?`, rest → wrapper; slots `between`, default (input stack) |
| `PlayStatTileList.astro` | Private to `SeatedPlayScreen`: one tile list expanded with a solo or seat `Call` into `PlayStatTile`s, `showWhen` → `<template x-if>` (#915, 2026-10-13) | `tiles`, `call`, `compact?` |
```

- [ ] **Step 2: Adding-a-game** — line 75 becomes:

```
| `interfaces/<Game>.astro` | The play-screen interface: a `SeatedPlayScreen` call (tiles as `Expr`s; input stack in the default slot) unless the game is solo-only (Cricket, Tactics). *Engine-only skips.* |
```

and add `SeatedPlayScreen` to the line-78 list of components to check before hand-rolling markup.

- [ ] **Step 3: Decision** — next number (expected D453):

```
### D453 — `SeatedPlayScreen` owns the solo/two-seat play-screen shell; tiles are written once as `Expr`s
Status: Accepted · Date: 2026-10-13
Decision: `components/layout/games/SeatedPlayScreen.astro` renders the wrapper, both `x-if` layouts (`SinglePlayerDisplay` / `SplitScoreboard`), `ErrorAlert`, the slotted input stack, `BoardInputPanel` and an optional `CountdownResumePrompt`. Values are `Expr`s (`src/lib/game/play-screen-expr.ts`): functions of a `Call` that yields `fn()` solo and `fnFor(state()?.seats[i]?.participantRef)` per seat, so each tile is written once. `c.solo` covers a solo expression with no `xFor` twin (Score Training's total). `idle` overrides the waiting seat's stat (Shanghai). Nine interfaces use it; Cricket and Tactics (solo-only, `MarkRows`) do not.
Reason: every tile was written three times per game and the shell was copied into nine files (#915), so layout changes had to land nine times and seat expressions drifted unseen.
Consequences: a new two-seat game's interface is a tile list and its input. The helper module is shared by ten files, so it is not a D101 test-only extraction; it is unit-tested. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built HTML of every game play route and `training/routines/play` before and after.
Supersedes: none.
```

- [ ] **Step 4: Gates + context maintenance** — as Task A3 Steps 3–4 (fallow before/after from `$SCRATCH/fallow-before-b.txt`).

- [ ] **Step 5: Commit, finish, PR** — as Task A3 Step 5; PR body `Closes #915` if Part A has merged, else `Refs #915` and close #915 when the second PR merges.
