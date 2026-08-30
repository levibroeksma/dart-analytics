# Result Modal Summary Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution order: 1 of 3** (spec: `docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md`, Issue 1). Runs before the data-layer fix (`02-result-modal-1v1-stats-data-layer.md`) and the title extraction (`03-result-modal-title-extraction.md`).

**Goal:** Replace the hand-rolled `STAT_ROWS.map()` + `<dl>` markup duplicated across all 9 result modals with two reusable components — `SinglePlayerSummary.astro` and a new `ComparisonSummary.astro` — and wire them into the 3 modals whose `resultsSnapshot` already carries `seats: XSeatResult[]` (Five Oh One, Score Training, Shanghai).

**Architecture:** Both components read `completionStatus`/`resultsSnapshot` off the Alpine scope they're rendered inside (same convention every result modal already uses — no props carry that state). Each takes only `statRows: readonly { label; key; fallback? }[]` (plus `seatIndex` for the solo component); they build the `resultsSnapshot?.seats?.[N]?.key` Alpine expression string internally, exactly like the `seatValueExpr()` helper `FiveOhOneResults.astro` already duplicates today.

**Tech Stack:** Astro components, Alpine.js `x-show`/`x-text`/`x-cloak` directives, Tailwind v4 utilities via semantic tokens.

## Global Constraints

- Semantic tokens only (`text-accent`, `text-muted-foreground`, …) — never raw palette utilities (`app/CLAUDE.md`).
- No `.ts` file created by this plan — pure `.astro` markup is exempt from unit tests per `app/CLAUDE.md` (D101); verify visually instead.
- `npm run format` clean and `npm run validate:app` passing before any task in this plan is called done.
- Reuse `StatRow.astro` / `StatRowComparison.astro` / `StatRowSkeleton.astro` unchanged — they are already correctly scoped, single-purpose leaf components (spec Issue 1).
- Do not touch the `x-text` title ternary in any modal touched here — that is Issue 2's plan (`03-result-modal-title-extraction.md`), executed after this one. Leave the `{/* TODO: extract x-text logic into alpine function */}` comments in place.
- Do not touch Around the Clock, Bob's 27, Doubles Training, 121, Singles Training, or Ten Up One Down's result modals in this plan — their `resultsSnapshot` is still flat (no `seats[]`) until `02-result-modal-1v1-stats-data-layer.md` lands; wiring them onto these components happens in that plan, not this one.

---

### Task 1: `SinglePlayerSummary.astro` — complete the stub

**Files:**
- Modify: `app/src/components/layout/games/SinglePlayerSummary.astro`

**Interfaces:**
- Consumes: nothing from other tasks (leaf component).
- Produces: `SinglePlayerSummary` component, `Props = { statRows: readonly { label: string; key: string; fallback?: string }[]; seatIndex?: number }`. Task 3 imports this by path `@components/layout/games/SinglePlayerSummary.astro`.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `app/src/components/layout/games/SinglePlayerSummary.astro` with:

```astro
---
import StatRow from "@components/layout/games/StatRow.astro";
import StatRowSkeleton from "@components/layout/games/StatRowSkeleton.astro";

interface Props {
  statRows: readonly { label: string; key: string; fallback?: string }[];
  seatIndex?: number;
}

const { statRows, seatIndex = 0 }: Props = Astro.props;

function seatValueExpr(row: (typeof statRows)[number]): string {
  const base = `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}`;
  return "fallback" in row && row.fallback !== undefined
    ? `${base} ?? ${row.fallback}`
    : base;
}
---

{/* Succeeded: one column of StatRow entries for this seat */}
<dl
  class="mt-4 space-y-1 text-sm text-muted-foreground flex flex-col"
  x-show="completionStatus === 'succeeded' && resultsSnapshot?.seats?.length === 1"
  x-cloak
>
  {statRows.map((row) => <StatRow label={row.label} value={seatValueExpr(row)} />)}
</dl>

{/* Loading: one column of StatRowSkeleton entries */}
<dl
  class="mt-4 space-y-1 text-sm text-muted-foreground flex flex-col"
  x-show="completionStatus === 'pending' || completionStatus === 'saving'"
  x-cloak
>
  {statRows.map((row) => <StatRowSkeleton label={row.label} />)}
</dl>
```

This replaces the stub's untyped `interface Props { statRows: [] }` with the real, spec'd shape (`readonly { label; key; fallback? }[]`, `seatIndex` default 0), and replaces the stub's caller-supplied `x-show`/hardcoded `seats?.[0]` with internally-gated logic keyed off `seatIndex` — matching `FiveOhOneResults.astro`'s existing `seatValueExpr()` exactly, generalized with a `seatIndex` parameter so `ComparisonSummary` (Task 2) can reuse the same fallback-handling rule for both seat columns.

Note the deliberate spacing choice: the succeeded `<dl>` now uses `space-y-1` (previously `space-y-2` in `FiveOhOneResults.astro` only — `ScoreTrainingResults.astro`/`ShanghaiResults.astro` already used `space-y-1`). This converges the 3 games' spacing to match their own loading skeleton (`space-y-1` in `StatRowSkeleton`'s wrapping `<dl>` today), which is the same value the majority of modals already use. This is a visual consolidation, not a functional change, and it's exactly the kind of duplicated-markup drift this component is meant to remove.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/layout/games/SinglePlayerSummary.astro
git commit -m "Complete SinglePlayerSummary.astro: typed props, internal seat-index gating"
```

---

### Task 2: `ComparisonSummary.astro` — new component

**Files:**
- Create: `app/src/components/layout/games/ComparisonSummary.astro`

**Interfaces:**
- Consumes: nothing from other tasks (leaf component).
- Produces: `ComparisonSummary` component, `Props = { statRows: readonly { label: string; key: string; fallback?: string }[] }`. Task 3 imports this by path `@components/layout/games/ComparisonSummary.astro`.

- [ ] **Step 1: Write the component**

```astro
---
import StatRowComparison from "@components/layout/games/StatRowComparison.astro";

interface Props {
  statRows: readonly { label: string; key: string; fallback?: string }[];
}

const { statRows }: Props = Astro.props;

function seatValueExpr(
  seatIndex: 0 | 1,
  row: (typeof statRows)[number],
): string {
  const base = `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}`;
  return "fallback" in row && row.fallback !== undefined
    ? `${base} ?? ${row.fallback}`
    : base;
}
---

{/* 1v1: comparison rows — stat label centered, values on either side */}
<div
  class="mt-4 space-y-2 text-sm"
  x-show="completionStatus === 'succeeded' && resultsSnapshot?.seats?.length === 2"
  x-cloak
>
  <div class="flex justify-between font-semibold text-accent">
    <span
      x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName"
    ></span>
    <span
      x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName"
    ></span>
  </div>
  <dl class="space-y-2">
    {
      statRows.map((row) => (
        <StatRowComparison
          label={row.label}
          leftValue={seatValueExpr(0, row)}
          rightValue={seatValueExpr(1, row)}
        />
      ))
    }
  </dl>
</div>
```

The name-header row and gating condition are copied verbatim from `FiveOhOneResults.astro`'s existing 1v1 block (spec Issue 1). The header class is `font-semibold text-accent` — `FiveOhOneResults.astro`'s already-applied style-pass value, not `ScoreTrainingResults.astro`/`ShanghaiResults.astro`'s older `text-xs font-semibold text-foreground`. This intentionally standardizes all 3 games onto the more recent styling rather than dropping the user's uncommitted style edit to `FiveOhOneResults.astro` — Task 3 relies on this.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/layout/games/ComparisonSummary.astro
git commit -m "Add ComparisonSummary.astro: shared 1v1 stat-comparison block"
```

---

### Task 3: Wire Five Oh One, Score Training, Shanghai onto the two components

**Files:**
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`
- Modify: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`
- Modify: `app/src/components/layout/games/result-modals/ShanghaiResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerSummary` (Task 1), `ComparisonSummary` (Task 2).
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Rewrite `FiveOhOneResults.astro`**

Replace the full contents with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Legs won", key: "legsWon" },
  { label: "3 dart avg", key: "threeDartAverage" },
  { label: "Checkout %", key: "checkoutPercentage", fallback: "'—'" },
  { label: "60+", key: "sixtyPlus" },
  { label: "100+", key: "hundredPlus" },
  { label: "120+", key: "oneTwentyPlus" },
  { label: "140+", key: "oneFortyPlus" },
  { label: "180s", key: "oneEighties" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
        ? 'Match Summary'
        : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins the match!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

This deletes the file's own `seatValueExpr()` helper and the `StatRow`/`StatRowComparison`/`StatRowSkeleton` imports (now internal to the two shared components), and deletes the 3 hand-rolled `<dl>`/`<div>` blocks in favor of the 2-line component usage. The title `<h2>` is untouched — Issue 2's plan handles it.

- [ ] **Step 2: Rewrite `ScoreTrainingResults.astro`**

Replace the full contents with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Total", key: "total" },
  { label: "3 dart avg.", key: "threeDartAverage" },
  { label: "First 9 avg.", key: "firstNineAverage" },
  { label: "Highest score", key: "highestScore" },
  { label: "100+", key: "hundredPlus" },
  { label: "120+", key: "oneTwentyPlus" },
  { label: "140+", key: "oneFortyPlus" },
  { label: "180s", key: "oneEighties" },
] as const;
---

<ResultsModalShell showSavedMessage>
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'TIE'
        ? 'Tie — same total!'
        : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Game Summary'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest total!')
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

- [ ] **Step 3: Rewrite `ShanghaiResults.astro`**

Replace the full contents with:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import ComparisonSummary from "@components/layout/games/ComparisonSummary.astro";

const STAT_ROWS = [
  { label: "Score", key: "score" },
  { label: "Round", key: "round" },
  { label: "Accuracy", key: "accuracy" },
  { label: "Trebles", key: "trebles" },
  { label: "Doubles", key: "doubles" },
  { label: "Singles", key: "singles" },
] as const;
---

<ResultsModalShell showSavedMessage>
  {/* TODO: extract x-text logic into alpine function */}
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      !(completionStatus === 'succeeded' && resultsSnapshot)
        ? 'Session complete'
        : resultsSnapshot?.status === 'TIE'
          ? 'Tie — same score!'
          : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
            ? (resultsSnapshot?.status === 'SHANGHAI' ? 'Shanghai!' : 'Session complete')
            : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + (resultsSnapshot.status === 'SHANGHAI' ? ' hits a Shanghai!' : ' wins!'))
    "
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS} />
  <ComparisonSummary statRows={STAT_ROWS} />
</ResultsModalShell>
```

- [ ] **Step 4: Format**

```bash
cd app && npm run format
```

Expected: no unstaged diff beyond what Steps 1–3 already wrote (these 3 files already match Prettier's `singleAttributePerLine` convention as written above); if `format` does rewrite anything, that's fine — stage it in the commit below.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/games/result-modals/FiveOhOneResults.astro app/src/components/layout/games/result-modals/ScoreTrainingResults.astro app/src/components/layout/games/result-modals/ShanghaiResults.astro
git commit -m "Wire FiveOhOne/ScoreTraining/Shanghai results modals onto SinglePlayerSummary + ComparisonSummary"
```

---

### Task 4: Visual verification (`.astro` markup has no unit-test runner — D101)

**Files:** none (manual QA against the running dev server).

- [ ] **Step 1: Start the dev server**

```bash
cd app && astro dev --background
```

- [ ] **Step 2: Verify a solo game's results modal**

In the browser, start and play a solo Score Training session (`/games/score-training/setup` → play a few visits → let the session finish, or use "Finish session" if the ruleset offers an early-finish action) through to its results modal. Confirm:
- While `completionStatus` is `pending`/`saving` (briefly, right after the last visit), the loading skeleton renders — one `StatRowSkeleton` row per `STAT_ROWS` entry, no layout shift once real values arrive.
- Once succeeded, the solo `<dl>` renders exactly the 8 `STAT_ROWS` rows with real values, one column, `space-y-1` spacing.
- No 1v1 comparison block appears (it stays `x-cloak`'d / hidden — `resultsSnapshot.seats.length === 1`).

- [ ] **Step 3: Verify a 1v1 game's results modal**

Start a 1v1 Five Oh One session (add a guest opponent in setup) and play it to completion. Confirm:
- The solo `<dl>` never appears.
- The comparison block renders: the two seats' display names as a header row, then one `StatRowComparison` row per `STAT_ROWS` entry with left/right values, `text-accent` header styling.
- The `Checkout %` row's `fallback: "'—'"` still renders `—` for a seat that never had a checkout dart, not a blank/`undefined`.

- [ ] **Step 4: Repeat Steps 2–3 for Shanghai** (the other already-`seats[]`-shaped game) to confirm the same components render correctly against a different `STAT_ROWS` shape (6 rows, no `fallback`).

- [ ] **Step 5: Stop the dev server**

```bash
cd app && astro dev stop
```

---

### Task 5: Full validation pass

**Files:** none.

- [ ] **Step 1: Run the validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits zero, including `npx fallow`, with the type gate reporting 0 errors/0 warnings/0 hints. `scripts/check-test-coverage.sh` should report no violation for this plan's changes — no runtime `.ts` file was created or modified (`SinglePlayerSummary.astro`/`ComparisonSummary.astro` are markup, exempt per D101; the 3 result-modal files are markup too).

- [ ] **Step 2: Confirm format is clean**

```bash
cd app && npm run format:check
```

Expected: clean (Task 3 Step 4 already ran `format` and committed any rewrites).

This plan does not run `context-maintenance` — the spec defers that to once, after all three issues land (see `03-result-modal-title-extraction.md`'s final task).
