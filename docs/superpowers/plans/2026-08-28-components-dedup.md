# Components Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dedupe the recurring `alert alert-error` markup and the result-modal outer chrome across `app/src/components/`, inside the existing one-file-per-game boundary D215 established.

**Architecture:** Two new shared `.astro` components — `ErrorAlert.astro` (`components/ui/`) and `ResultsModalShell.astro` (`components/layout/games/`) — plus one existing shell (`SetupShell.astro`) absorbing markup its 9 children currently repeat. Every per-game file keeps its own file and its own game-specific expressions; only the byte-identical chrome moves.

**Tech Stack:** Astro components, Alpine.js expression-string props, Tailwind v4 via `cn()`/`tailwind-merge`.

## Global Constraints

- Semantic tokens only; reuse `app/src/styles/global.css` primitives (root `CLAUDE.md` / `app/CLAUDE.md` Style non-negotiables).
- Class composition via `cn()` only, never `class:list`.
- Forward leftover props as `{...props}`, never `{...rest}`.
- No `.ts` file directly under `components/`.
- `.astro` markup is not unit-tested (D101) — verification is `npm run check` (Astro type/hint check) per task, `npm run validate:app` at the end.
- Behavior-preserving: every existing Alpine expression, class string, and conditional (including the 4-of-9 "Saved!" message and the 1-of-9 `loadingExpr` on the play-again button) must be reproduced exactly as it exists today, except where a task explicitly says otherwise.
- Prettier formatting (`singleAttributePerLine: true`) — run `cd app && npm run format` before the final commit.
- `git checkout -b claude/components-refactor-duplication-pgs03b` already exists and is checked out; continue on it (no new branch).

---

### Task 1: `ErrorAlert.astro`

**Files:**
- Create: `app/src/components/ui/ErrorAlert.astro`

**Interfaces:**
- Produces: `ErrorAlert` component, props `{ class?: string; showExpr?: string; textExpr?: string; alwaysVisible?: boolean; [key: string]: unknown }`. `showExpr`/`textExpr` default to `"error"`. `alwaysVisible` (default `false`) omits `x-show`/`x-cloak` entirely, for a caller whose ancestor already gates visibility.

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Alert-styled error message. Base classes are fixed; layout overrides
 * (spacing, size) merge in via `class`. `showExpr`/`textExpr` default to
 * the `error` expression the majority of call sites already bind to.
 * `alwaysVisible` drops `x-show`/`x-cloak` for a caller whose ancestor
 * already gates visibility (e.g. a `completionStatus === 'failed'` wrapper).
 * @param {string} [class] Extra classes merged over the base
 * @param {string} [showExpr] Alpine expression bound to x-show; ignored when alwaysVisible
 * @param {string} [textExpr] Alpine expression bound to x-text
 * @param {boolean} [alwaysVisible] Omit x-show/x-cloak
 */
interface Props {
  class?: string;
  showExpr?: string;
  textExpr?: string;
  alwaysVisible?: boolean;
  [key: string]: unknown;
}

// Props
const {
  class: classNameProp,
  showExpr = "error",
  textExpr = "error",
  alwaysVisible = false,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground",
  classNameProp,
);
---

<p
  class={className}
  role="alert"
  x-show={alwaysVisible ? undefined : showExpr}
  x-text={textExpr}
  x-cloak={alwaysVisible ? undefined : true}
  {...props}
>
</p>
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints (the file isn't imported anywhere yet, so this only confirms the component itself is well-formed).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/ErrorAlert.astro
git commit -m "Add ErrorAlert component"
```

---

### Task 2: Fold the setup-form error alert into `SetupShell.astro`

**Files:**
- Modify: `app/src/components/layout/games/setup/SetupShell.astro`
- Modify: `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/Bobs27SetupForm.astro`
- Modify: `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro`

**Interfaces:**
- Consumes: `ErrorAlert` from Task 1 (`@components/ui/ErrorAlert.astro`).

- [ ] **Step 1: Add the import and the error alert to `SetupShell.astro`**

In `app/src/components/layout/games/setup/SetupShell.astro`, add the import next to the existing `Button` import:

```astro
// Components
import Button from "@components/forms/Button.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
```

Then insert `<ErrorAlert class="mt-2" />` between `<slot />` and the submit `Button`, so the form block reads:

```astro
  <form
    class="mt-3 flex flex-col gap-3 max-w-sm"
    @submit.prevent="start()"
  >
    <slot />

    <ErrorAlert class="mt-2" />

    <Button
      type="submit"
      class="rounded-full w-full bg-accent text-white border-tab-border"
      variant="primary"
      title="Start Game"
      :disabled="loading || loadingReconciliation"
    />
  </form>
```

- [ ] **Step 2: Remove the now-duplicate error block from all 9 setup forms**

Each of the 9 files listed above contains this exact block (verified byte-identical across all 9), immediately before their closing `</SetupShell>` tag:

```astro
  <p
    class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
```

Delete this block (and the blank line above it) from each of the 9 files, leaving `</SetupShell>` as the last line. Do not touch anything else in these files.

- [ ] **Step 3: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/setup/
git commit -m "Fold setup-form error alert into SetupShell"
```

---

### Task 3: Swap the raw error block for `ErrorAlert` in `interfaces/`

**Files:**
- Modify: `app/src/components/layout/games/interfaces/AroundTheClock.astro`
- Modify: `app/src/components/layout/games/interfaces/Bobs27.astro`
- Modify: `app/src/components/layout/games/interfaces/DoublesTraining.astro`
- Modify: `app/src/components/layout/games/interfaces/FiveOhOne.astro`
- Modify: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro`
- Modify: `app/src/components/layout/games/interfaces/Shanghai.astro`
- Modify: `app/src/components/layout/games/interfaces/SinglesTraining.astro`
- Modify: `app/src/components/layout/games/interfaces/TenUpOneDown.astro`

**Interfaces:**
- Consumes: `ErrorAlert` from Task 1.

- [ ] **Step 1: Replace the block in each of the 9 files**

Each file contains this exact block (verified byte-identical across all 9):

```astro
  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
```

Replace it with:

```astro
  <ErrorAlert class="mx-3 mt-2 text-xs" />
```

And add the import to each file's frontmatter (alongside the other `@components/layout/games/*` imports already there):

```astro
import ErrorAlert from "@components/ui/ErrorAlert.astro";
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/interfaces/
git commit -m "Swap ErrorAlert into interfaces/"
```

---

### Task 4: Swap `ErrorAlert` into `AppModeForm.astro` and `PlayerSettingsCard.astro`

**Files:**
- Modify: `app/src/components/forms/AppModeForm.astro`
- Modify: `app/src/components/forms/PlayerSettingsCard.astro`

**Interfaces:**
- Consumes: `ErrorAlert` from Task 1.

- [ ] **Step 1: `AppModeForm.astro`**

Add the import next to the existing `Icons` import group:

```astro
// Components
import ErrorAlert from "@components/ui/ErrorAlert.astro";

// Icons
import CheckIcon from "@icons/check.svg";
```

Replace:

```astro
  <p
    class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.settings.error"
    x-text="$store.settings.error"
    x-cloak
  >
  </p>
```

with:

```astro
  <ErrorAlert
    showExpr="$store.settings.error"
    textExpr="$store.settings.error"
  />
```

- [ ] **Step 2: `PlayerSettingsCard.astro`**

Add to the `// Components` import group:

```astro
// Components
import SettingRow from "@components/forms/SettingRow.astro";
import HandednessForm from "@components/forms/HandednessForm.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
```

Replace:

```astro
  <p
    class="alert alert-error mt-3 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.profile.error"
    x-text="$store.profile.error"
    x-cloak
  >
  </p>
```

with:

```astro
  <ErrorAlert
    class="mt-3"
    showExpr="$store.profile.error"
    textExpr="$store.profile.error"
  />
```

- [ ] **Step 3: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/forms/AppModeForm.astro app/src/components/forms/PlayerSettingsCard.astro
git commit -m "Swap ErrorAlert into AppModeForm and PlayerSettingsCard"
```

---

### Task 5: `ResultsModalShell.astro`

**Files:**
- Create: `app/src/components/layout/games/ResultsModalShell.astro`

**Interfaces:**
- Consumes: `ErrorAlert` from Task 1; `Button` (`@components/forms/Button.astro`); `IsLoading` (`@components/ui/IsLoading.astro`).
- Produces: `ResultsModalShell` component, props `{ showSavedMessage?: boolean }` (default `false`). Named slot `title` (the game's own `<h2>` markup — one or more elements). Default slot (the game's stat markup — a `<dl>` or more).

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Shared chrome for every game's results modal: overlay, glass card,
 * save-status region (loading / failed+retry / optional "Saved!"),
 * play-again error, and the back/play-again button row. Each game supplies
 * its own `<h2>` title (`title` slot — win/tie/loss phrasing differs per
 * game) and its own stat rows (default slot).
 * @param {boolean} [showSavedMessage] Show "Saved!" once completionStatus succeeds
 */
interface Props {
  showSavedMessage?: boolean;
}

// Props
const { showSavedMessage = false }: Props = Astro.props;

// Components
import Button from "@components/forms/Button.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<div
  class="fixed inset-0 flex items-center justify-center bg-black/50 z-50 w-full"
  x-show="finished"
  x-cloak
>
  <div class="glass rounded-lg border border-border bg-surface-raised p-6 shadow-lg max-w-sm">
    <slot name="title" />

    <slot />

    {/* Completion status */}
    <div class="mt-4">
      <IsLoading
        title="Saving..."
        x-show="completionStatus === 'pending' || completionStatus === 'saving'"
        x-cloak
      />
      <div
        x-show="completionStatus === 'failed'"
        x-cloak
      >
        <ErrorAlert
          textExpr="completionError"
          alwaysVisible
        />
        <Button
          class="mt-2"
          @click="uploadAndCompleteSession()"
          title="Retry"
        />
      </div>
      {
        showSavedMessage && (
          <p
            class="text-sm text-success"
            x-show="completionStatus === 'succeeded'"
            x-cloak
          >
            Saved!
          </p>
        )
      }
    </div>

    {
      /* Play-again failure: separate from completion status, buttons stay enabled */
    }
    <ErrorAlert
      showExpr="playAgainError"
      textExpr="playAgainError"
      class="mt-2"
    />

    {/* Action buttons: enabled only when completionStatus === 'succeeded' */}
    <div class="mt-6 flex justify-end gap-3">
      <Button
        variant="secondary"
        @click="back()"
        :disabled="completionStatus !== 'succeeded'"
        title="Back to games"
      />
      <Button
        @click="playAgain()"
        :disabled="completionStatus !== 'succeeded' || playAgainLoading"
        loadingExpr="playAgainLoading"
        title="Play again"
      />
    </div>
  </div>
</div>
```

Note: `loadingExpr="playAgainLoading"` is now always present — this deliberately fixes the drift where only `AroundTheClockResults.astro` had it (the other 8 result modals never showed the play-again spinner during a retry).

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/ResultsModalShell.astro
git commit -m "Add ResultsModalShell component"
```

---

### Task 6: Migrate `AroundTheClockResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5.

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell>
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

  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot"
    x-cloak
  >
    <StatRow
      label="Turns"
      value="resultsSnapshot?.turns"
    />
    <StatRow
      label="Accuracy"
      value="resultsSnapshot?.accuracy"
    />
    <StatRow
      label="Darts thrown"
      value="resultsSnapshot?.totalDarts"
    />
  </dl>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/AroundTheClockResults.astro
git commit -m "Migrate AroundTheClockResults to ResultsModalShell"
```

---

### Task 7: Migrate `Bobs27Results.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/Bobs27Results.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5.

- [ ] **Step 1: Replace the file contents**

This file's title is two conditionally-shown `<h2>` elements (not a single ternary) — pass both inside a `Fragment` carrying the `title` slot:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell>
  <Fragment slot="title">
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
  </Fragment>

  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot"
    x-cloak
  >
    <StatRow
      label="Score"
      value="resultsSnapshot?.score"
    />
    <StatRow
      label="Darts"
      value="resultsSnapshot?.darts"
    />
    <StatRow
      label="Double hit rate"
      value="resultsSnapshot?.doubleHitRate"
    />
    <StatRow
      label="Highest number reached"
      value="resultsSnapshot?.highestNumberReached"
    />
  </dl>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/Bobs27Results.astro
git commit -m "Migrate Bobs27Results to ResultsModalShell"
```

---

### Task 8: Migrate `DoublesTrainingResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5.

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell>
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
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/DoublesTrainingResults.astro
git commit -m "Migrate DoublesTrainingResults to ResultsModalShell"
```

---

### Task 9: Migrate `FiveOhOneResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5 (`showSavedMessage` — this game shows "Saved!").

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import StatRowComparison from "@components/layout/games/StatRowComparison.astro";

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

function seatValueExpr(
  seatIndex: number,
  row: (typeof STAT_ROWS)[number],
): string {
  const base = `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}`;
  return "fallback" in row ? `${base} ?? ${row.fallback}` : base;
}
---

<ResultsModalShell showSavedMessage>
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

  {/* Solo: one column of StatRow entries */}
  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 1"
    x-cloak
  >
    {
      STAT_ROWS.map((row) => (
        <StatRow
          label={row.label}
          value={seatValueExpr(0, row)}
        />
      ))
    }
  </dl>

  {/* 1v1: comparison rows — stat label centered, values on either side */}
  <div
    class="mt-4 space-y-2 text-sm"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 2"
    x-cloak
  >
    <div class="flex justify-between text-xs font-semibold text-foreground">
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName"
      ></span>
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName"
      ></span>
    </div>
    <dl class="space-y-2">
      {
        STAT_ROWS.map((row) => (
          <StatRowComparison
            label={row.label}
            leftValue={seatValueExpr(0, row)}
            rightValue={seatValueExpr(1, row)}
          />
        ))
      }
    </dl>
  </div>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/FiveOhOneResults.astro
git commit -m "Migrate FiveOhOneResults to ResultsModalShell"
```

---

### Task 10: Migrate `OneTwentyOneResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5 (`showSavedMessage` — this game shows "Saved!").

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell showSavedMessage>
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

  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot"
    x-cloak
  >
    <StatRow
      label="Visits"
      value="resultsSnapshot?.visits"
    />
    <StatRow
      label="Average"
      value="resultsSnapshot?.average.toFixed(1)"
    />
  </dl>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/OneTwentyOneResults.astro
git commit -m "Migrate OneTwentyOneResults to ResultsModalShell"
```

---

### Task 11: Migrate `ScoreTrainingResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5 (`showSavedMessage` — this game shows "Saved!").

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import StatRowComparison from "@components/layout/games/StatRowComparison.astro";

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

  {/* Solo: one column of StatRow entries */}
  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 1"
    x-cloak
  >
    {
      STAT_ROWS.map((row) => (
        <StatRow
          label={row.label}
          value={`resultsSnapshot?.seats?.[0]?.${row.key}`}
        />
      ))
    }
  </dl>

  {/* 1v1: comparison rows — stat label centered, values on either side */}
  <div
    class="mt-4 space-y-2 text-sm"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 2"
    x-cloak
  >
    <div class="flex justify-between text-xs font-semibold text-foreground">
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName"
      ></span>
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName"
      ></span>
    </div>
    <dl class="space-y-2">
      {
        STAT_ROWS.map((row) => (
          <StatRowComparison
            label={row.label}
            leftValue={`resultsSnapshot?.seats?.[0]?.${row.key}`}
            rightValue={`resultsSnapshot?.seats?.[1]?.${row.key}`}
          />
        ))
      }
    </dl>
  </div>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/ScoreTrainingResults.astro
git commit -m "Migrate ScoreTrainingResults to ResultsModalShell"
```

---

### Task 12: Migrate `ShanghaiResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/ShanghaiResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5.

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import StatRowComparison from "@components/layout/games/StatRowComparison.astro";

const STAT_ROWS = [
  { label: "Score", key: "score" },
  { label: "Round", key: "round" },
  { label: "Accuracy", key: "accuracy" },
  { label: "Trebles", key: "trebles" },
  { label: "Doubles", key: "doubles" },
  { label: "Singles", key: "singles" },
] as const;
---

<ResultsModalShell>
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

  {/* Solo: one column of StatRow entries, same shape as before, more rows */}
  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 1"
    x-cloak
  >
    {
      STAT_ROWS.map((row) => (
        <StatRow
          label={row.label}
          value={`resultsSnapshot?.seats?.[0]?.${row.key}`}
        />
      ))
    }
  </dl>

  {/* 1v1: comparison rows — stat label centered, values on either side */}
  <div
    class="mt-4 space-y-2 text-sm"
    x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 2"
    x-cloak
  >
    <div class="flex justify-between text-xs font-semibold text-foreground">
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName"
      ></span>
      <span
        x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName"
      ></span>
    </div>
    <dl class="space-y-2">
      {
        STAT_ROWS.map((row) => (
          <StatRowComparison
            label={row.label}
            leftValue={`resultsSnapshot?.seats?.[0]?.${row.key}`}
            rightValue={`resultsSnapshot?.seats?.[1]?.${row.key}`}
          />
        ))
      }
    </dl>
  </div>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/ShanghaiResults.astro
git commit -m "Migrate ShanghaiResults to ResultsModalShell"
```

---

### Task 13: Migrate `SinglesTrainingResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5.

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell>
  <h2
    slot="title"
    class="font-display text-lg font-semibold text-foreground"
    x-text="
      resultsSnapshot?.status === 'TIE'
        ? 'Tie — same points!'
        : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest points!')
    "
  >
  </h2>

  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot"
    x-cloak
  >
    <StatRow
      label="Total points"
      value="resultsSnapshot?.points"
    />
    <StatRow
      label="Darts missed"
      value="resultsSnapshot?.misses"
    />
    <StatRow
      label="Singles hit"
      value="resultsSnapshot?.singles"
    />
    <StatRow
      label="Doubles hit"
      value="resultsSnapshot?.doubles"
    />
    <StatRow
      label="Trebles hit"
      value="resultsSnapshot?.trebles"
    />
    <StatRow
      label="Hit percentage"
      value="resultsSnapshot?.hitPercentage"
    />
  </dl>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/SinglesTrainingResults.astro
git commit -m "Migrate SinglesTrainingResults to ResultsModalShell"
```

---

### Task 14: Migrate `TenUpOneDownResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`

**Interfaces:**
- Consumes: `ResultsModalShell` from Task 5 (`showSavedMessage` — this game shows "Saved!").

- [ ] **Step 1: Replace the file contents**

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<ResultsModalShell showSavedMessage>
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

  {/* Stats: live from store while saving, snapshot once succeeded */}
  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus !== 'succeeded'"
    x-cloak
  >
    <StatRow
      label="Target reached"
      value="currentTargetLabel()"
    />
    <StatRow
      label="Attempts"
      value="$store.game.turns.length"
    />
    <StatRow
      label="Successes"
      value="$store.game.turns.filter((t) => t.totalScore > 0).length"
    />
    <StatRow
      label="Failures"
      value="$store.game.turns.filter((t) => t.totalScore === 0).length"
    />
  </dl>
  <dl
    class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
    x-show="completionStatus === 'succeeded' && resultsSnapshot"
    x-cloak
  >
    <StatRow
      label="Target reached"
      value="resultsSnapshot?.target"
    />
    <StatRow
      label="Attempts"
      value="resultsSnapshot?.attempts"
    />
    <StatRow
      label="Successes"
      value="resultsSnapshot?.successes"
    />
    <StatRow
      label="Failures"
      value="resultsSnapshot?.failures"
    />
  </dl>
</ResultsModalShell>
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run check`
Expected: exits 0, 0 errors/warnings/hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/TenUpOneDownResults.astro
git commit -m "Migrate TenUpOneDownResults to ResultsModalShell"
```

---

### Task 15: Update `08-Component-Inventory.md`

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add `ErrorAlert.astro` to the `components/ui/` table**

Insert a new row, alphabetically after `DartBoard.astro`:

```markdown
| `ErrorAlert.astro` | Alert-styled error message; `alwaysVisible` drops `x-show`/`x-cloak` for a caller whose ancestor already gates visibility | `class`, `showExpr`, `textExpr`, `alwaysVisible` |
```

- [ ] **Step 2: Add `ResultsModalShell.astro` to the `components/layout/games/` table**

Insert a new row, alphabetically after `ReconciliationBlocked.astro`:

```markdown
| `ResultsModalShell.astro` | Shared results-modal chrome: overlay, glass card, save-status region, play-again error, back/play-again buttons; named `title` slot plus a default slot for stat rows | `showSavedMessage` |
```

- [ ] **Step 3: Update the `SetupShell.astro` row**

Change:

```markdown
| `SetupShell.astro` | Page shell for every game setup screen | `title` |
```

to:

```markdown
| `SetupShell.astro` | Page shell for every game setup screen; owns the form's error alert | `title` |
```

- [ ] **Step 4: Update the front matter `updated` date**

Change the `updated: 2026-08-28` line if it is not already today's date (it already is — leave it).

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/07-Frontend/08-Component-Inventory.md
git commit -m "Document ErrorAlert and ResultsModalShell in Component Inventory"
```

---

### Task 16: Full validation and formatting

**Files:**
- None created; this task only runs checks and, if needed, commits formatting fixes.

- [ ] **Step 1: Format**

Run: `cd app && npm run format`
Expected: exits 0. If it rewrites any files, they are formatting-only diffs (the content above already follows `singleAttributePerLine`, so this should be a no-op, but confirm).

- [ ] **Step 2: If Step 1 changed files, commit them**

```bash
git status --short
```

If any `app/src/components/**` files show as modified, stage and commit them:

```bash
git add app/src/components/
git commit -m "Format after components dedup"
```

If nothing changed, skip this step.

- [ ] **Step 3: Full validation**

Run: `cd app && npm run validate:app`
Expected: exits 0 (db:status, db:migrate, db:introspect, fallow, full test suite, `npm run check`, graph refresh all pass).

- [ ] **Step 4: Confirm the full test suite is unaffected**

The command above already runs `npm test` as part of `validate:app`. Per D101, no test files were touched or need to be — this step is a sanity read of the `validate:app` output confirming the pre-existing suite is still green, not a new test run.

- [ ] **Step 5: Manual check in the browser** (optional but recommended before finishing)

Use the `run` skill or `astro dev --background` to start the dev server, open a couple of game setup screens (to see the folded error alert still triggers on a bad input) and finish a couple of different games (e.g. Bob's 27 and Score Training — one without and one with the "Saved!" message) to visually confirm the results modal renders identically to before, including the play-again spinner now showing on Bob's 27.

---

## After This Plan

Per root `CLAUDE.md`'s mandatory Context Maintenance step, run the `context-maintenance` skill before calling this done — this plan doesn't include those steps since they are a fixed, separate procedure, not implementation work.
