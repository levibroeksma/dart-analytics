# Modal Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every modal in `app/` renders as the Claude Design "Modals" bottom glass sheet, built only from D428 tokens.

**Architecture:** `ui/Modal.astro` becomes the one sheet shell (scrim, `glass-sheet`, grabber, centred header, actions). Two new Button variants and a `SheetActions` row give the muted-left / raised-right action pair. Every overlay — confirm, setup, results, routine summary, trivia, expanding forms — renders through Modal; a gate in `scripts/check-style-tokens.sh` makes `fixed inset-0` / `role="dialog"` legal only in `ui/Modal.astro`, with a shrinking allow-list as files migrate.

**Tech Stack:** Astro 5, Alpine.js, Tailwind v4 (`app/src/styles/global.css`, no config file), Vitest, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-08-modal-sheets-design.md`

## Global Constraints

- Tokens only. No new colour tokens. Off-token greys snap: 72/75 % → `text-muted-foreground`, 80 % → `text-soft-foreground`, 60/62 % → `text-muted`.
- Title: `text-balance font-display text-xl text-foreground`. Description: `text-pretty text-sm text-muted-foreground`. Overline: `font-mono text-eyebrow-lg font-semibold uppercase text-accent-bright`. Eyebrow labels: `font-mono text-eyebrow font-semibold uppercase text-muted`.
- `.astro` markup is not unit-tested (app/tests/CLAUDE.md, D101). Markup guarantees are pinned by the gate in Task 2; CSS by `app/tests/lib/ui/brand-tokens.test.ts`; visuals by Task 9's screenshots.
- No `{...rest}` (use `{...props}`), no important modifier, no inline `//` comments in function bodies, no template HTML comments, every `x-show` paired with `x-cloak` (existing gates).
- Copy (labels, titles) stays as today — the design's copy differences ("Rematch", "Start new", "Keep playing") are not adopted.
- Commands run from `app/` unless shown with a repo-root path. Test: `npm test`. Gate: `bash ../scripts/check-style-tokens.sh`.
- Commit only with the user's go-ahead for this execution (root CLAUDE.md); messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Plan-time amendments to the spec

- RoutineSummaryModal and QuickSubtract do **not** move onto ResultsModalShell — the shell is bound to `finished` / `completionStatus` / `back()` / `playAgain()`, which neither has (RoutineSummaryModal's doc comment records that choice). Both go onto Modal directly and share the new `StatTile`.
- Source-reading vitest tests for `.astro` are replaced by a gate rule (D101).
- ConfirmDialog `context` slot, `InlayRow.astro`, and the 1v1 legs bars are **deferred**: no call site has that data wired, and an unused component fails the fallow gate. Captured as an issue in Task 9.

## Review Focus

1. Tall content (schedule editor, long routine summary) on a 390×667 viewport — sheet scrolls inside `max-h`, action row stays reachable. Pinned: Task 3 panel classes; checked in Task 9 step 3.
2. iPhone home-indicator inset — sheet bottom clears `env(safe-area-inset-bottom)`. Pinned: Task 3 backdrop padding; Task 9 step 3.
3. Non-dismissible sheets (results, continue session, blocked step, open routine, checkout confirm) ignore Escape and backdrop clicks. Pinned: Task 3 keeps the `dismissible` contract; Task 9 step 4.
4. `prefers-reduced-motion: reduce` — no slide-in. Pinned: Task 1 test + Task 3 `motion-safe:` prefix.
5. Detached ExpandingModal (ScheduleFormModal) opens from its page control with no corner toggle, and closes via Escape / backdrop / Cancel with `resetForm()`-style cleanup still running. Pinned: Task 8 step 4.

---

### Task 1: Sheet entrance animation token

**Files:**
- Modify: `app/src/styles/global.css` (`@theme inline` block, line ~65)
- Test: `app/tests/lib/ui/brand-tokens.test.ts`

**Interfaces:**
- Produces: utility `animate-sheet-in` (used as `motion-safe:animate-sheet-in` in Task 3).

- [ ] **Step 1: Write the failing test** — append to `brand-tokens.test.ts`:

```ts
describe("sheet motion", () => {
  it("defines the sheet entrance animation on the ease-out curve", () => {
    expect(decl("animate-sheet-in")).toBe("sheet-in 200ms var(--ease-out)");
  });

  it("slides the sheet up from a faded, offset start", () => {
    expect(css).toMatch(
      /@keyframes sheet-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(1\.5rem\);\s*\}\s*\}/,
    );
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- brand-tokens` → both new cases fail (`undefined`, no match).

- [ ] **Step 3: Implement** — inside `@theme inline { … }`, after the `--text-*` block:

```css
  --animate-sheet-in: sheet-in 200ms var(--ease-out);

  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateY(1.5rem);
    }
  }
```

- [ ] **Step 4: Run, expect PASS** — `npm test -- brand-tokens`.
- [ ] **Step 5: Commit** — `git add src/styles/global.css tests/lib/ui/brand-tokens.test.ts && git commit -m "feat(tokens): sheet-in animation"`

---

### Task 2: Overlay gate with migration allow-list

**Files:**
- Modify: `scripts/check-style-tokens.sh` (append before the final exit block)

**Interfaces:**
- Produces: shell array `OVERLAY_PENDING` — each later task deletes its file's line from it.

- [ ] **Step 1: Add the rule with an empty pending list** (red run):

```bash
# Overlay gate (D429): full-viewport overlays and dialog roles live only in
# ui/Modal.astro — every modal renders through the sheet shell.
# OVERLAY_PENDING is the migration ratchet; it must end empty.
OVERLAY_ALLOW="app/src/components/ui/Modal.astro"
OVERLAY_PENDING=(
)
OVERLAY_FILES=$(grep -rlE 'fixed inset-0|role="dialog"' app/src --include="*.astro" | sort)
OVERLAY_BAD=""
for f in $OVERLAY_FILES; do
  [ "$f" = "$OVERLAY_ALLOW" ] && continue
  skip=0
  for p in "${OVERLAY_PENDING[@]+"${OVERLAY_PENDING[@]}"}"; do
    [ "$f" = "$p" ] && skip=1
  done
  [ "$skip" -eq 0 ] && OVERLAY_BAD="$OVERLAY_BAD$f"$'\n'
done
if [ -n "$OVERLAY_BAD" ]; then
  echo "FAIL: overlay outside ui/Modal.astro — render it through Modal (sheet shell):" >&2
  printf '%s' "$OVERLAY_BAD" >&2
  FAIL=1
fi
```

- [ ] **Step 2: Run, expect FAIL** — `bash scripts/check-style-tokens.sh` (repo root) lists exactly:
  `app/src/components/layout/games/ResultsModalShell.astro`, `app/src/components/layout/training/routines/RoutineSummaryModal.astro`, `app/src/components/layout/training/trivia/QuickSubtract.astro`, `app/src/components/ui/ExpandingModal.astro`. Any other file listed → stop and report.

- [ ] **Step 3: Fill the pending list** with those four paths (one quoted path per line inside `OVERLAY_PENDING=( … )`).
- [ ] **Step 4: Run, expect PASS** — `bash scripts/check-style-tokens.sh` exits 0.
- [ ] **Step 5: Commit** — `git commit -am "chore(gates): overlay-only-in-Modal gate"`

---

### Task 3: Sheet shell — Modal, Button variants, SheetActions

**Files:**
- Modify: `app/src/components/ui/Modal.astro` (whole file)
- Modify: `app/src/components/forms/Button.astro:4,16,55-61`
- Create: `app/src/components/ui/SheetActions.astro`

**Interfaces:**
- Consumes: `motion-safe:animate-sheet-in` (Task 1).
- Produces:
  - `Modal` props `{ titleId: string; descriptionId?: string; dismissible?: boolean; onDismiss?: string; overline?: string; class?: string }`; slots `header` (title/description, centred), default (body, full width), `footer`.
  - `Button` `variant` adds `"sheet-muted" | "sheet-raised"`.
  - `SheetActions` — `class?`, forwards other attributes (`x-show`, `slot`); default slot holds 1–2 `Button grow`.

- [ ] **Step 1: Rewrite Modal.astro**:

```astro
---
/**
 * Bottom glass sheet — the one dialog shell. Parent owns visibility
 * (`x-show` / `x-if` + `x-cloak` on a wrapper).
 * @param {string} titleId `aria-labelledby` target id (caller's heading)
 * @param {string} [descriptionId] `aria-describedby` when body has a matching id
 * @param {boolean} [dismissible=true] Escape + backdrop click invoke `onDismiss`
 * @param {string} [onDismiss] Alpine expression; required when `dismissible`
 * @param {string} [overline] Eyebrow above the title
 * @param {string} [class] Extra panel classes
 * @slot header Title and description, centred
 * @slot default Body, full width
 * @slot footer Action row (`SheetActions`)
 */
interface Props {
  titleId: string;
  descriptionId?: string;
  dismissible?: boolean;
  onDismiss?: string;
  overline?: string;
  class?: string;
}

// Props
const {
  titleId,
  descriptionId,
  dismissible = true,
  onDismiss,
  overline,
  class: classNameProp,
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

if (dismissible && !onDismiss) {
  throw new Error("Modal: onDismiss is required when dismissible is true");
}

// Slots
const hasHeader = Boolean(overline) || Astro.slots.has("header");
const hasBody = Astro.slots.has("default");

// Styles
const panelClass = cn(
  "glass-sheet mb-3 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col items-center gap-5 overflow-y-auto px-5 pt-3 pb-5 motion-safe:animate-sheet-in",
  classNameProp,
);

const dismissAttrs = dismissible
  ? {
      "x-on:keydown.escape.window": onDismiss,
      "x-on:click.self": onDismiss,
    }
  : {};
---

<div
  class="fixed inset-0 z-50 flex flex-col items-center justify-end bg-scrim px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  {...dismissAttrs}
>
  <div class={panelClass}>
    <span
      class="h-[5px] w-10 shrink-0 rounded-full bg-white/25"
      aria-hidden="true"
    ></span>
    {
      hasHeader && (
        <div class="flex w-full flex-col items-center gap-2 text-center">
          {overline && (
            <span class="font-mono text-eyebrow-lg font-semibold uppercase text-accent-bright">
              {overline}
            </span>
          )}
          <slot name="header" />
        </div>
      )
    }
    {
      hasBody && (
        <div class="flex w-full flex-col gap-4">
          <slot />
        </div>
      )
    }
    <slot name="footer" />
  </div>
</div>
```

- [ ] **Step 2: Button variants** — in `Button.astro` add `"sheet-muted" | "sheet-raised"` to the JSDoc `@param` union and the `variant` type, and to `variantClasses`:

```ts
  "sheet-muted": "h-13 rounded-2xl border-0 text-button inset-well-muted text-muted-foreground",
  "sheet-raised": "h-13 rounded-2xl text-button glass-button text-foreground",
```

- [ ] **Step 3: Create SheetActions.astro**:

```astro
---
/**
 * Sheet action row — muted action left, raised action right.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp, ...props }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";
---

<div
  class={cn("flex w-full gap-2.5", classNameProp)}
  {...props}
>
  <slot />
</div>
```

- [ ] **Step 4: Type gate** — `npx astro check --minimumFailingSeverity hint` → 0/0/0. (Modal's existing consumers still compile: no prop removed.)
- [ ] **Step 5: Commit** — `git add src/components/ui/Modal.astro src/components/ui/SheetActions.astro src/components/forms/Button.astro && git commit -m "feat(ui): bottom glass sheet shell"`

---

### Task 4: ConfirmDialog + call sites

**Files:**
- Modify: `app/src/components/ui/ConfirmDialog.astro`
- Modify: `app/src/components/layout/training/routines/RoutineDetail.astro:94` (drop `confirmVariant="primary"`)
- Unchanged (verify render only): `games/ExitModal.astro`, `pages/games/{501,121,tuod,score-training}/play/index.astro`, `pages/training/routines/play/index.astro`

**Interfaces:**
- Consumes: Modal `header`/`footer` slots, `SheetActions`, Button `sheet-muted`/`sheet-raised` (Task 3).
- Produces: ConfirmDialog props unchanged **minus** `confirmVariant`.

- [ ] **Step 1: Remove `confirmVariant`** from the JSDoc, `Props`, and destructuring.
- [ ] **Step 2: Replace the markup** after the frontmatter (add `import SheetActions from "@components/ui/SheetActions.astro";`):

```astro
<Modal
  titleId={titleId}
  descriptionId={descriptionId}
  dismissible={dismissible}
  onDismiss={dismissible ? onCancel : undefined}
  class={classNameProp}
>
  <h2
    slot="header"
    id={titleId}
    class="text-balance font-display text-xl text-foreground"
  >
    {title}
  </h2>
  <p
    slot="header"
    id={descriptionId}
    class="text-pretty text-sm text-muted-foreground"
  >
    {description}
  </p>
  <SheetActions slot="footer">
    <Button
      variant="sheet-muted"
      title={cancelLabel}
      x-on:click={onCancel}
      grow
    />
    <Button
      variant="sheet-raised"
      title={confirmLabel}
      x-on:click={onConfirm}
      loadingExpr={loadingExpr}
      grow
    />
  </SheetActions>
</Modal>
```

- [ ] **Step 3: Drop the prop at the call site** — delete line `confirmVariant="primary"` in `RoutineDetail.astro`. Then `grep -rn confirmVariant src` → no output.
- [ ] **Step 4: Gates** — `npx astro check --minimumFailingSeverity hint` → 0/0/0; `npm test` → green.
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): confirm dialogs as sheets"`

---

### Task 5: Session & setup modals

**Files (all under `app/src/components/layout/`):**
- `games/ContinueSessionModal.astro`, `games/CheckoutConfirm.astro`, `games/setup/GuestNameModal.astro`, `games/setup/OpponentChooserModal.astro`, `training/exercises/BlockedStepModal.astro`, `training/routines/OpenRoutineModal.astro`

**Interfaces:**
- Consumes: Task 3 shell, variants, `SheetActions`.

Apply the same four mechanical rules to every file, then the per-file specifics.

**Rules:**
- R1 — title `<h2>`: add `slot="header"`, class → `text-balance font-display text-xl text-foreground` (drop `text-lg font-semibold`).
- R2 — description `<p>` with the `*-desc` id: add `slot="header"`, class → `text-pretty text-sm text-muted-foreground`.
- R3 — error `<p … text-error>`: class → `text-center text-sm text-error` (drop `mt-3`).
- R4 — footer `<div slot="footer" class="mt-6 flex …">` → `<SheetActions slot="footer">` (keep any `x-show` / `x-cloak` attributes on it); the secondary/ghost button → `variant="sheet-muted" grow`; the primary button → `variant="sheet-raised" grow`; drop `class="flex-1"` / `class="w-1/3"`. Import `SheetActions from "@components/ui/SheetActions.astro"`.

- [ ] **Step 1: ContinueSessionModal** — R1, R2, R3, R4.
- [ ] **Step 2: GuestNameModal** — R1, R4; Input gets `class="inset-well h-13 rounded-2xl border-0"` (drop `mt-4`).
- [ ] **Step 3: BlockedStepModal** — R1, R2, R3, R4.
- [ ] **Step 4: OpenRoutineModal** — R1, R2, R3. Footer keeps its three actions stacked: `<SheetActions slot="footer" class="flex-col">` with Resume `sheet-raised`, Abandon & start new `sheet-muted`, Leave `variant="ghost"`; all three `grow`.
- [ ] **Step 5: CheckoutConfirm** — R1, R2, R4 (Cancel `sheet-muted`, Confirm `sheet-raised`). Group label `<p>` class → `text-center font-mono text-eyebrow font-semibold uppercase text-muted`; group wrapper `mt-5` → none (body gap handles spacing); radiogroup `mt-2 flex gap-3` → `mt-2 flex gap-2`. Replace the `optionClass` constant's value with
  `"flex h-13 flex-1 cursor-pointer items-center justify-center rounded-2xl font-mono text-button tabular-nums transition-[color,box-shadow] duration-150"`
  and the `:class` expression with
  ``${group.model} === count ? 'glass-button text-foreground' : 'inset-well text-muted-foreground'``.
- [ ] **Step 6: OpponentChooserModal** —
  - Header row `<div class="flex items-center justify-between gap-3">` → add `slot="header"`, class → `flex flex-col items-center gap-2`; h2 per R1 (keep `x-text`); Badge unchanged.
  - Stat band track `bg-surface-overlay` → `bg-white/15`, height `h-2` → `h-1`; labels `text-sm` rows: label span → `text-soft-foreground`, value span → `font-mono tabular-nums text-foreground`.
  - Level panel wrapper `mt-6` → none; add `inset-well rounded-2xl p-4` to the `mb-4 flex flex-col gap-3` bands div.
  - Both footers: R4 (Guest / Cancel `sheet-muted`; DartBot / Add DartBot `sheet-raised`), each keeping its `x-show` + `x-cloak`.
- [ ] **Step 7: Gates** — `npx astro check --minimumFailingSeverity hint` → 0/0/0; `bash ../scripts/check-style-tokens.sh`; `bash ../scripts/check-astro-conventions.sh` → OK.
- [ ] **Step 8: Commit** — `git commit -am "feat(ui): session and setup modals as sheets"`

---

### Task 6: Results — shell on Modal, tiles + ledger

**Files:**
- Modify: `app/src/components/layout/games/ResultsModalShell.astro`
- Create: `app/src/components/layout/games/StatTile.astro`
- Modify: `app/src/components/layout/games/SinglePlayerSummary.astro`, `ComparisonSummary.astro`, `StatRowComparison.astro`, `StatRowComparisonSkeleton.astro`
- Modify: all 11 `app/src/components/layout/games/result-modals/*Results.astro`
- Delete if unused afterwards: `app/src/components/layout/games/StatRowSkeleton.astro`
- Modify: `scripts/check-style-tokens.sh` (remove `ResultsModalShell.astro` from `OVERLAY_PENDING`)

**Interfaces:**
- Consumes: Task 3.
- Produces: `StatTile` props `{ labelExpr: string; valueExpr?: string }` — Alpine expressions; no `valueExpr` renders a pulse skeleton. Stat row type gains `hero?: boolean`. ResultsModalShell gains `overline?: string`; the `title` slot's `<h2>` must carry `id="results-title"`.

- [ ] **Step 1: Ratchet first (red)** — remove the `ResultsModalShell.astro` line from `OVERLAY_PENDING`; `bash ../scripts/check-style-tokens.sh` → FAIL naming it.
- [ ] **Step 2: Create StatTile.astro**:

```astro
---
/**
 * Inlay stat tile — value over eyebrow label. Without `valueExpr` it renders
 * a pulse placeholder (results still saving).
 * @param {string} labelExpr Alpine expression for the label
 * @param {string} [valueExpr] Alpine expression for the value
 */
interface Props {
  labelExpr: string;
  valueExpr?: string;
}

// Props
const { labelExpr, valueExpr }: Props = Astro.props;
---

<div
  class="inset-well flex h-16 flex-col-reverse items-center justify-center gap-1.5 rounded-2xl"
>
  <dt
    class="font-mono text-eyebrow font-semibold uppercase text-muted"
    x-text={labelExpr}
  >
  </dt>
  {
    valueExpr ? (
      <dd
        class="font-display text-lg leading-none tabular-nums text-foreground"
        x-text={valueExpr}
      />
    ) : (
      <dd class="h-4 w-8 animate-pulse rounded bg-muted-foreground/80" />
    )
  }
</div>
```

- [ ] **Step 3: SinglePlayerSummary** — row type `{ label: string; key: string; fallback?: string; hero?: boolean }`; in frontmatter:

```ts
const heroRow = statRows.find((row) => "hero" in row && row.hero);
const tileRows = statRows.filter((row) => row !== heroRow);
```

Replace both `<dl>` blocks (keep their `x-show` expressions and `x-cloak`) with:

```astro
<div
  class="flex w-full flex-col gap-4"
  x-show="completionStatus === 'succeeded' && resultsSnapshot?.seats?.length === 1"
  x-cloak
>
  {
    heroRow && (
      <div class="flex flex-col items-center gap-2">
        <span
          class="font-display text-[3.25rem] leading-none tabular-nums text-foreground text-shadow-hero"
          x-text={seatValueExpr(heroRow)}
        />
        <span class="font-mono text-eyebrow font-semibold uppercase text-muted">
          {heroRow.label}
        </span>
      </div>
    )
  }
  <dl class="grid w-full grid-cols-2 gap-2">
    {tileRows.map((row) => (
      <StatTile labelExpr={`'${row.label}'`} valueExpr={seatValueExpr(row)} />
    ))}
  </dl>
</div>

<dl
  class="grid w-full grid-cols-2 gap-2"
  x-show="(completionStatus === 'pending' || completionStatus === 'saving') && $store.game.seats.length === 1"
  x-cloak
>
  {statRows.map((row) => <StatTile labelExpr={`'${row.label}'`} />)}
</dl>
```

Imports: replace `StatRow` / `StatRowSkeleton` with `StatTile from "@components/layout/games/StatTile.astro"`.

- [ ] **Step 4: ComparisonSummary** — outer div class → `flex w-full flex-col gap-3`; names row → `grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center`, children: left `font-display text-sm text-foreground`, a new middle `<span class="font-mono text-eyebrow font-semibold text-muted">VS</span>`, right `text-right font-display text-sm text-accent-bright`; both `<dl class="space-y-2">` → `class="inset-well rounded-2xl px-4 pt-1 pb-1"`.
- [ ] **Step 5: StatRowComparison / Skeleton** — wrapper → `grid h-10 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-border first:border-t-0`; left value → `text-left font-mono text-button tabular-nums text-foreground`; label → `text-center font-mono text-eyebrow font-semibold uppercase text-muted`; right value → `text-right font-mono text-button tabular-nums text-accent-bright`. Skeleton: same wrapper and label class.
- [ ] **Step 6: ResultsModalShell** — replace the two outer divs with:

```astro
<div
  x-show="finished"
  x-cloak
>
  <Modal
    titleId="results-title"
    dismissible={false}
    overline={overline}
  >
    <slot
      name="title"
      slot="header"
    />
    <slot />
    …completion-status block and play-again ErrorAlert unchanged, minus their mt-* classes…
    <SheetActions slot="footer">
      <Button variant="sheet-muted" @click="back()" :disabled="completionStatus !== 'succeeded'" title="Back to games" grow />
      <Button variant="sheet-raised" @click="playAgain()" :disabled="completionStatus !== 'succeeded' || playAgainLoading" loadingExpr="playAgainLoading" title="Play again" grow />
    </SheetActions>
  </Modal>
</div>
```

  Add prop `overline?: string` (JSDoc `@param {string} [overline] Eyebrow above the title`); Retry button → `variant="sheet-raised" class="mt-2 w-full"`; `Saved!` → add `text-center`. Imports: `Modal`, `SheetActions`. Update the doc comment's first line to "Shared chrome for every game's results sheet".

- [ ] **Step 7: 11 result files** — in each `result-modals/*Results.astro`:
  - `<h2 slot="title" …>` → add `id="results-title"`, class → `text-balance font-display text-xl text-foreground`.
  - Pass `overline` on `<ResultsModalShell>`: AroundTheClock "Around the Clock", Bobs27 "Bob's 27", Cricket "Cricket", DoublesTraining "Doubles training", FiveOhOne "501", OneTwentyOne "121", ScoreTraining "Score training", Shanghai "Shanghai", SinglesTraining "Singles training", Tactics "Tactics", TenUpOneDown "Ten Up One Down".
  - Mark one hero row with `hero: true` — the headline stat: 501 `threeDartAverage`; for the others pick the row whose label is the game's primary score/average (first row if none stands out) and list the choice in the task report.
- [ ] **Step 8: Dead file** — `grep -rn "StatRowSkeleton\b" src` ; if only its own file matches, `git rm src/components/layout/games/StatRowSkeleton.astro`. Same check for `StatRow.astro` (QuickSubtract's in-game panel still uses it — keep).
- [ ] **Step 9: Gates (green)** — `bash ../scripts/check-style-tokens.sh` OK; `npx astro check --minimumFailingSeverity hint` 0/0/0; `npm test` green; `bash ../scripts/fallow-gate.sh` OK.
- [ ] **Step 10: Commit** — `git add -A src ../scripts/check-style-tokens.sh && git commit -m "feat(ui): results as sheets with inlay tiles"`

---

### Task 7: RoutineSummaryModal + QuickSubtract onto Modal

**Files:**
- Modify: `app/src/components/layout/training/routines/RoutineSummaryModal.astro`
- Modify: `app/src/components/layout/training/trivia/QuickSubtract.astro:120-165`
- Modify: `scripts/check-style-tokens.sh` (remove both from `OVERLAY_PENDING`)

**Interfaces:**
- Consumes: Modal, SheetActions, Button variants (Task 3); `StatTile` (Task 6).

- [ ] **Step 1: Ratchet (red)** — remove both lines from `OVERLAY_PENDING`; gate FAILs naming both.
- [ ] **Step 2: RoutineSummaryModal** — outer two divs →

```astro
<div x-show="routineFinished" x-cloak>
  <Modal titleId="routine-summary-title" dismissible={false} overline="Training">
    <h2 slot="header" id="routine-summary-title" class="text-balance font-display text-xl text-foreground">Training complete</h2>
    <p slot="header" class="font-mono text-sm tabular-nums text-muted-foreground" x-text="$store.trainingSession.headerLabel"></p>
    …step template…
    …empty-state p (drop mt-4, add text-center)…
    …failed block (drop mt-4; Retry → variant="sheet-raised" class="mt-2 w-full")…
    <SheetActions slot="footer">
      <Button variant="sheet-raised" @click="dismissSummary()" :disabled="completionStatus !== 'succeeded'" loadingExpr="completionStatus === 'saving'" title="Done" grow />
    </SheetActions>
  </Modal>
</div>
```

  Step template body: `<section class="flex flex-col gap-2">`; h3 → `font-display text-sm text-foreground`; `<dl class="grid grid-cols-2 gap-2">` with `<template x-for="row in step.rows" :key="row.label"><StatTile labelExpr="row.label" valueExpr="row.value" /></template>`. Update doc comment: "`ResultsModalShell` is deliberately not reused…" stays; "`StatRow.astro`… cannot render them" → "`StatTile` takes Alpine expressions, so runtime rows render through it."
- [ ] **Step 3: QuickSubtract finished overlay** — replace the `fixed inset-0` block with:

```astro
<div x-show="status === 'finished'" x-cloak>
  <Modal titleId="quick-subtract-results-title" dismissible={false} overline="Trivia">
    <h2 slot="header" id="quick-subtract-results-title" class="text-balance font-display text-xl text-foreground">Session complete</h2>
    <dl class="grid w-full grid-cols-2 gap-2">
      <StatTile labelExpr="'Correct'" valueExpr="correctAnswers" />
      <StatTile labelExpr="'Incorrect'" valueExpr="incorrectAnswers" />
      <StatTile labelExpr="'Attempts'" valueExpr="attempts" />
      <StatTile labelExpr="'Time'" valueExpr="formattedElapsed()" />
    </dl>
    <SheetActions slot="footer">
      <Button type="button" variant="sheet-muted" title="Back to Trivia" @click="exit()" grow />
      <Button type="button" variant="sheet-raised" title="Play again" @click="reset()" grow />
    </SheetActions>
  </Modal>
</div>
```

  Imports: `Modal`, `SheetActions`, `StatTile`.
- [ ] **Step 4: Gates (green)** — style-tokens gate OK; `npx astro check --minimumFailingSeverity hint` 0/0/0; `npm test` green.
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): routine summary and trivia results as sheets"`

---

### Task 8: ExpandingModal → toggle + sheet; form contents

**Files:**
- Modify: `app/src/components/ui/ExpandingModal.astro` (whole file)
- Modify: `app/src/components/layout/training/routines/RoutineFormModal.astro` (pass `overline="Training"`)
- Modify: `app/src/components/layout/training/routines/RoutineBuilder.astro:45,53`
- Modify: `app/src/components/layout/training/schedules/ScheduleFormModal.astro:72,93-94`
- Modify: `scripts/check-style-tokens.sh` (remove `ExpandingModal.astro` from `OVERLAY_PENDING`; the array is now empty)

**Interfaces:**
- Consumes: Modal, Button `sheet-raised` (Task 3).
- Produces: ExpandingModal props unchanged plus `overline?: string`. `class` now applies to the sheet panel.

- [ ] **Step 1: Ratchet (red)** — remove the last line from `OVERLAY_PENDING`; gate FAILs naming `ui/ExpandingModal.astro`.
- [ ] **Step 2: Rewrite ExpandingModal.astro** (props block as today plus `overline?: string` and its JSDoc line; replace the top doc paragraphs with "Corner toggle that opens a bottom glass sheet (`Modal`). Visibility is owned by the caller — `openExpr` is read, never written."):

```astro
---
…props…

// Components
import Button from "@components/forms/Button.astro";
import Modal from "@components/ui/Modal.astro";

// Icons
import PlusIcon from "@icons/nav/plus-white.svg";

// Data
const bodyId = `${titleId}-body`;
---

{
  !detached && (
    <div class="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto flex max-w-lg justify-end p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <Button
        variant="sheet-raised"
        icon
        class="pointer-events-auto size-11 rounded-full p-0"
        loadingExpr="false"
        ariaLabel={toggleLabelClosed}
        aria-controls={bodyId}
        @click={onToggle}
        :aria-expanded={openExpr}
        :aria-label={`${openExpr} ? '${toggleLabelOpen}' : '${toggleLabelClosed}'`}
      >
        <PlusIcon
          slot="iconBefore"
          class="size-4 transition-transform duration-200"
          :class={`${openExpr} ? 'rotate-45' : ''`}
        />
      </Button>
    </div>
  )
}

<div
  x-show={openExpr}
  x-cloak
>
  <Modal
    titleId={titleId}
    onDismiss={onClose}
    overline={overline}
    class={classNameProp}
  >
    <h2
      slot="header"
      id={titleId}
      class="text-balance font-display text-xl text-foreground"
    >
      {title}
    </h2>
    <div
      id={bodyId}
      class="w-full space-y-4"
    >
      <slot />
    </div>
  </Modal>
</div>
```

  Remove the now-unused `cn` import and `collapsedClass`/`panelClass`. If `PlusIcon` does not accept `:class` (SVG component attribute passthrough), wrap it in `<span slot="iconBefore" class="transition-transform duration-200" :class=…>`.
- [ ] **Step 3: Form contents** —
  - `RoutineBuilder.astro:45,53`: `class="glass placeholder:text-muted-foreground"` → `class="inset-well h-13 rounded-2xl border-0 placeholder:text-placeholder"`.
  - `ScheduleFormModal.astro:72`: section heading `text-sm font-semibold text-foreground` → `font-display text-sm text-foreground`.
  - `ScheduleFormModal.astro:93`: `glass … rounded-2xl border p-3.5 …` → replace `glass` with `inset-well` and keep the rest; line 94 selected state `'border-accent' : 'border-transparent'` unchanged.
  - `RoutineFormModal.astro`: add `overline="Training"` to `<ExpandingModal>`; `ScheduleFormModal.astro`: add `overline="Training"`.
- [ ] **Step 4: Behaviour check (Review Focus 5)** — in `npm run dev`, on `/training`: corner toggle opens "New routine"; Escape, backdrop tap, and Cancel each close it and the reopened form is empty. "My schedule" (detached) shows no corner toggle, opens from the card's edit button, and closes the same three ways.
- [ ] **Step 5: Gates (green)** — style-tokens gate OK with `OVERLAY_PENDING=( )` empty; `npx astro check --minimumFailingSeverity hint` 0/0/0; `npm test` green.
- [ ] **Step 6: Commit** — `git commit -am "feat(ui): expanding modal opens a sheet"`

---

### Task 9: Verify, docs, decision, follow-ups

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (≈ l.63, 70, 108, 161, 170–180, 195)
- Modify: decision file chosen via `DECISIONS.md` routing table (frontend/style) — append D429
- Modify: `docs/superpowers/specs/2026-10-08-modal-sheets-design.md` — status note pointing at this plan's amendments

- [ ] **Step 1: Full validation** — `npm run validate:app` (all steps exit 0; type gate 0/0/0). Then the `run-all-gates` skill.
- [ ] **Step 2: Screenshots** — `run` skill, 390×844, capture each frame from the spec's list (Confirm ×5, Session & setup ×7, Results solo + 1v1, Training complete, Expanding collapsed + New routine + My schedule, plus Trivia complete). Compare to `Modals.dc.html`; fix token-level gaps in the owning file.
- [ ] **Step 3: Review Focus 1–2** — at 390×667: My schedule and a 4-step Training complete scroll inside the sheet and the action row is reachable; the sheet bottom sits above the safe-area inset (iOS simulator or devtools `env()` override).
- [ ] **Step 4: Review Focus 3–4** — Escape and backdrop click do nothing on results, Continue session, Blocked step, Open routine, Checkout confirm; with devtools "prefers-reduced-motion: reduce" the sheet appears without sliding.
- [ ] **Step 5: Style guide** — targeted edits only:
  - Radius rows: "modals" moves from `rounded-lg` to `rounded-sheet` (`glass-sheet`).
  - l.108 dialog rule: "Dialogs render through `Modal.astro` — a bottom `glass-sheet` over `bg-scrim` with grabber, centred `font-display` title, optional overline; actions in `SheetActions` with `sheet-muted` left / `sheet-raised` right. ConfirmDialog has no `confirmVariant`."
  - l.161 ConfirmDialog action-row rule: match the line above.
  - Surface table: centred-panel row removed; bottom-sheet row cites `Modal.astro`; add `inset-well` "fields, tiles, segments inside a sheet" and `inset-well-muted` "sheet secondary action".
  - Motion l.195: "sheet: `motion-safe:animate-sheet-in` (200 ms fade + 1.5 rem rise, `--ease-out`)".
  - Note the gate: overlays only in `ui/Modal.astro` (`check-style-tokens.sh`).
- [ ] **Step 6: Decision D429** — confirm id with `bash scripts/next-decision-id.sh`; append to the frontend/style domain file: *All modals are bottom glass sheets via `Modal.astro` (Claude Design `Modals.dc.html`); off-token greys snap to nearest token; ConfirmDialog `confirmVariant` removed (destructive confirms use the raised button, per design); overlays outside `ui/Modal.astro` are gated.* Run `bash scripts/check-decision-ids.sh`.
- [ ] **Step 7: Follow-up issue** — per `capturing-discovered-work`: one issue, label `discovered-work`, "Modal sheets: deferred design parts" — ConfirmDialog/ContinueSession context inlay rows (needs per-site session data), 1v1 legs bars, design copy ("Rematch", "Start new", "Keep playing"), accent-tinted hero glow (token is black).
- [ ] **Step 8: Context maintenance** — run the `context-maintenance` skill (File Inventory rows for `SheetActions.astro`, `StatTile.astro`, removal of `StatRowSkeleton.astro` if deleted; context-map budgets).
- [ ] **Step 9: Commit + finish** — `git commit -am "docs(style): D429 modal sheets"`; then `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR).
