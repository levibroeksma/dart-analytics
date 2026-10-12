# Tailwind Arbitrary Values → Tokens, Utilities, Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Tailwind arbitrary value in `app/src` with a stock v4 class, a `global.css` token or a named `@utility`, then make `scripts/check-style-tokens.sh` reject new ones.

**Architecture:**
1. Tokens and utilities land first in `app/src/styles/global.css`, pinned by `brand-tokens.test.ts`. The `cn()` merge list learns the new text tokens.
2. Markup migrates category by category. Each task ends with a grep that must print nothing.
3. The gate comes last, once the tree is clean. Every commit runs the pre-commit hook, which runs `check-style-tokens.sh` under `set -e`, so a red gate can never be committed.
4. Docs and decision D451 close the work.

**Tech Stack:** Astro, Tailwind CSS 4.3.2, `tailwind-merge` 3 (`app/src/lib/client/cn.ts`), Vitest, Bash (BSD and GNU grep).

**Spec:** `docs/superpowers/specs/2026-10-12-tailwind-arbitrary-values-design.md`. Source audit: `docs/superpowers/handoffs/2026-10-12-tailwind-arbitrary-values-audit.md` (untracked; it goes into the Task 1 commit).

## Global Constraints

- Work in `/Users/levi.broeksma/Dev/dart-analytics/.worktrees/tailwind-arbitrary-values` on branch `refactor/tailwind-arbitrary-values`. App commands run from `app/`; gate scripts run from the repo root.
- Tests: `cd app && npm test -- <path>` (Vitest). Full suite: `cd app && npm test`.
- New font tokens are role-named `--text-*` bundles with size, `--line-height` and `--letter-spacing`. Line-heights are explicit and unitless: 1.3 for sans text, 1.2 for mono/caps, 1 for numerals. Never `normal`.
- No `--tracking-*`, `--leading-*` or new `--radius-*` tokens.
- `text-button` is renamed to `text-control` (15px / 1.3 / 0). No alias remains.
- Allowlist rows are `path|exact-match`, where the match is the exact substring the gate regex extracts. Each row is preceded by a `# reason` comment.
- Do not commit unless the task says so. The hook runs Prettier plus 14 gates; a failing hook means fix the cause, never `--no-verify`.
- Discovered work (anything the plan does not name) → GitHub issue via the `capturing-discovered-work` skill. Never fix it in this pass.
- Edits are minimal: change only the class substrings named, never reflow surrounding markup.

## Review Focus

1. **`cn()` dropping a new text token.** `tailwind-merge` treats an unknown `text-<name>` as a colour, so `cn("text-control", "text-muted")` would silently drop the size. Covered by the `cn.test.ts` cases in Task 1.
2. **`cn()` treating a new `@utility` as a conflict.** `border-medium` must survive next to `border-white/20`, and `pt-safe` next to `px-4`. Covered by the `cn.test.ts` cases in Task 1.
3. **Gate false positives in `.ts` code** (regex literals, index access) must not block real work, and must not be silenced by a pattern. Task 6 Step 4 sweeps them and pins each one as an exact allowlist row.
4. **Gate portability.** It must run under macOS BSD grep (local hook) and GNU grep (CI `ubuntu`). Task 6 runs locally; Task 8 confirms the CI `quality` job.
5. **Line-height-sensitive layouts** (`min-h-lh`, `truncate`, fixed-height rows) must not clip after tokens replace `/[normal]`. They are listed for the device check in Task 8.

---

### Task 1: Tokens, utilities, `text-control` rename, `cn()` merge list

**Files:**
- Modify: `app/src/styles/global.css`: `:root` (L7+), `@theme inline` type scale (L121-147), the utilities after `@utility start-bar-fade`
- Modify: `app/src/lib/client/cn.ts`
- Modify (rename `text-button` → `text-control`):
  - `app/src/components/forms/Button.astro:69,70`
  - `app/src/components/layout/training/schedules/ScheduleFormModal.astro:78`
  - `app/src/components/layout/training/routines/RoutineSummaryModal.astro:72`
  - `app/src/components/layout/training/routines/RoutineBuilder.astro:60`
  - `app/src/components/layout/training/routines/ExercisePicker.astro:27`
  - `app/src/components/layout/games/StatRowComparison.astro:26,40`
  - `app/src/components/layout/games/CheckoutConfirm.astro:44`
  - `app/src/components/layout/games/setup/OpponentChooserModal.astro:73`
- Test: `app/tests/lib/ui/brand-tokens.test.ts`, `app/tests/lib/client/cn.test.ts`
- Also add: `docs/superpowers/handoffs/2026-10-12-tailwind-arbitrary-values-audit.md` (already in the tree, untracked)

**Interfaces:**
- Produces:
  - Classes: `text-control`, `text-body-sm`, `text-caption`, `text-micro`, `text-key`, `text-key-label`, `text-stat`, `text-summary`, `text-summary-lg`, `text-numeral-1` … `text-numeral-6`, `grid-cols-mirror`, `grid-cols-scoreboard`, `stack-slab-1`, `stack-slab-2`, `border-medium`, `pt-safe`, `pb-safe`, `bottom-nav`, `bottom-above-nav`, `pb-nav`, `input-number-plain`
  - CSS vars: `--nav-bottom`, `--nav-clearance`

- [ ] **Step 1: Write the failing token tests**

In `app/tests/lib/ui/brand-tokens.test.ts`, replace the `describe("brand type scale", …)` table row `["button", "0.9375rem", "1.3", "0"],` with these rows:

```ts
    ["control", "0.9375rem", "1.3", "0"],
    ["body-sm", "0.8125rem", "1.3", "0"],
    ["caption", "0.6875rem", "1.2", "0"],
    ["micro", "0.625rem", "1.2", "0"],
    ["key", "1.625rem", "1", "0"],
    ["key-label", "1.375rem", "1.2", "0.08em"],
    ["stat", "1.0625rem", "1", "0"],
    ["summary", "2.5rem", "1", "0"],
    ["summary-lg", "3.25rem", "1", "0"],
    ["numeral-1", "clamp(2.5rem, 45cqw, 5.25rem)", "1", "-0.02em"],
    ["numeral-2", "clamp(2rem, 30cqw, 4rem)", "1", "-0.02em"],
    ["numeral-3", "clamp(1.5rem, 18cqw, 2.875rem)", "1", "-0.02em"],
    ["numeral-4", "clamp(1.25rem, 15cqw, 2.875rem)", "1", "-0.02em"],
    ["numeral-5", "clamp(1.125rem, 11cqw, 2.875rem)", "1", "-0.02em"],
    ["numeral-6", "clamp(1rem, 10cqw, 2.875rem)", "1", "-0.02em"],
```

Inside the same `describe`, after the `it.each`, add:

```ts
  it("has no text-button token (renamed to text-control, D451)", () => {
    expect(decl("text-button")).toBeUndefined();
  });
```

In `describe("brand radius and spacing", …)`, append rows to its `it.each`:

```ts
    ["grid-template-columns-mirror", "minmax(0, 1fr) auto minmax(0, 1fr)"],
    ["grid-template-columns-scoreboard", "1.3fr 1fr"],
    ["nav-bottom", "max(0.5rem, calc(env(safe-area-inset-bottom) - 0.5rem))"],
    ["nav-clearance", "5.5rem"],
```

At the end of `describe("brand surfaces", …)`, add:

```ts
  it.each([
    "@utility stack-slab-1",
    "@utility stack-slab-2",
    "@utility border-medium",
    "@utility pt-safe",
    "@utility pb-safe",
    "@utility bottom-nav",
    "@utility bottom-above-nav",
    "@utility pb-nav",
    "@utility input-number-plain",
  ])("defines %s", (selector) => {
    expect(() => block(selector)).not.toThrow();
  });

  it("stack slabs carry their radius, slab colour and top light", () => {
    const one = block("@utility stack-slab-1");
    expect(one).toMatch(/border-bottom-left-radius: 1\.1875rem/);
    expect(one).toMatch(/var\(--color-stack-1\)/);
    expect(one).toMatch(/inset 0 -1px 0 oklch\(100% 0 0 \/ 0\.15\)/);
    const two = block("@utility stack-slab-2");
    expect(two).toMatch(/border-bottom-left-radius: 1\.125rem/);
    expect(two).toMatch(/var\(--color-stack-2\)/);
    expect(two).toMatch(/inset 0 -1px 0 oklch\(100% 0 0 \/ 0\.12\)/);
  });
```

- [ ] **Step 2: Write the failing `cn()` tests**

In `app/tests/lib/client/cn.test.ts`, replace the `it.each([...])` name list with:

```ts
  it.each([
    "hero",
    "title",
    "value",
    "tile",
    "card-title",
    "control",
    "eyebrow",
    "eyebrow-lg",
    "body-sm",
    "caption",
    "micro",
    "key",
    "key-label",
    "stat",
    "summary",
    "summary-lg",
    "numeral-1",
    "numeral-6",
  ])("keeps the %s type-scale size beside a text colour", (name) => {
```

Replace `expect(cn("text-sm", "text-button")).toBe("text-button");` with `expect(cn("text-sm", "text-control")).toBe("text-control");`.

Before the closing `});`, add:

```ts
  it("keeps D451 utilities beside the stock classes they sit with", () => {
    expect(cn("border-medium", "border-white/20")).toBe(
      "border-medium border-white/20",
    );
    expect(cn("px-4", "pt-safe", "pb-safe")).toBe("px-4 pt-safe pb-safe");
    expect(cn("fixed", "bottom-above-nav")).toBe("fixed bottom-above-nav");
  });
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `cd app && npm test -- tests/lib/ui/brand-tokens.test.ts tests/lib/client/cn.test.ts`

Expected: FAIL. The `text-control`, `body-sm`, … rows report `expected undefined to be '0.9375rem'`, the `@utility` rows report "not found", and the `cn` rows drop `text-<name>` beside `text-foreground`. If the D451-utility `cn` case already passes, keep it as a guard.

- [ ] **Step 4: Add tokens and utilities to `global.css`**

In `:root` (opens at L7), add after `--stack-2: …;` (L19):

```css
  --nav-bottom: max(0.5rem, calc(env(safe-area-inset-bottom) - 0.5rem));
  --nav-clearance: 5.5rem;
```

In the type scale, replace:

```css
  --text-button: 0.9375rem;
  --text-button--line-height: 1.3;
  --text-button--letter-spacing: 0;
```

with:

```css
  --text-control: 0.9375rem;
  --text-control--line-height: 1.3;
  --text-control--letter-spacing: 0;
```

After the `--text-eyebrow-sm--letter-spacing: 0.1em;` line, add:

```css
  --text-body-sm: 0.8125rem;
  --text-body-sm--line-height: 1.3;
  --text-body-sm--letter-spacing: 0;
  --text-caption: 0.6875rem;
  --text-caption--line-height: 1.2;
  --text-caption--letter-spacing: 0;
  --text-micro: 0.625rem;
  --text-micro--line-height: 1.2;
  --text-micro--letter-spacing: 0;
  --text-key: 1.625rem;
  --text-key--line-height: 1;
  --text-key--letter-spacing: 0;
  --text-key-label: 1.375rem;
  --text-key-label--line-height: 1.2;
  --text-key-label--letter-spacing: 0.08em;
  --text-stat: 1.0625rem;
  --text-stat--line-height: 1;
  --text-stat--letter-spacing: 0;
  --text-summary: 2.5rem;
  --text-summary--line-height: 1;
  --text-summary--letter-spacing: 0;
  --text-summary-lg: 3.25rem;
  --text-summary-lg--line-height: 1;
  --text-summary-lg--letter-spacing: 0;
  --text-numeral-1: clamp(2.5rem, 45cqw, 5.25rem);
  --text-numeral-1--line-height: 1;
  --text-numeral-1--letter-spacing: -0.02em;
  --text-numeral-2: clamp(2rem, 30cqw, 4rem);
  --text-numeral-2--line-height: 1;
  --text-numeral-2--letter-spacing: -0.02em;
  --text-numeral-3: clamp(1.5rem, 18cqw, 2.875rem);
  --text-numeral-3--line-height: 1;
  --text-numeral-3--letter-spacing: -0.02em;
  --text-numeral-4: clamp(1.25rem, 15cqw, 2.875rem);
  --text-numeral-4--line-height: 1;
  --text-numeral-4--letter-spacing: -0.02em;
  --text-numeral-5: clamp(1.125rem, 11cqw, 2.875rem);
  --text-numeral-5--line-height: 1;
  --text-numeral-5--letter-spacing: -0.02em;
  --text-numeral-6: clamp(1rem, 10cqw, 2.875rem);
  --text-numeral-6--line-height: 1;
  --text-numeral-6--letter-spacing: -0.02em;

  --grid-template-columns-mirror: minmax(0, 1fr) auto minmax(0, 1fr);
  --grid-template-columns-scoreboard: 1.3fr 1fr;
```

After the closing `}` of `@utility start-bar-fade` (about L507), add:

```css
@utility stack-slab-1 {
  border-bottom-left-radius: 1.1875rem;
  border-bottom-right-radius: 1.1875rem;
  background-color: var(--color-stack-1);
  box-shadow: inset 0 -1px 0 oklch(100% 0 0 / 0.15);
}

@utility stack-slab-2 {
  border-bottom-left-radius: 1.125rem;
  border-bottom-right-radius: 1.125rem;
  background-color: var(--color-stack-2);
  box-shadow: inset 0 -1px 0 oklch(100% 0 0 / 0.12);
}

@utility border-medium {
  border-width: 1.5px;
}

@utility pt-safe {
  padding-top: calc(env(safe-area-inset-top) + 1rem);
}

@utility pb-safe {
  padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);
}

@utility bottom-nav {
  bottom: var(--nav-bottom);
}

@utility bottom-above-nav {
  bottom: calc(var(--nav-bottom) + var(--nav-clearance));
}

@utility pb-nav {
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--nav-clearance));
}

@utility input-number-plain {
  appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    appearance: none;
  }
}
```

- [ ] **Step 5: Teach `cn()` the new tokens**

Replace the `text: [...]` array in `app/src/lib/client/cn.ts` with:

```ts
      text: [
        "hero",
        "title",
        "value",
        "tile",
        "card-title",
        "control",
        "eyebrow",
        "eyebrow-lg",
        "body-sm",
        "caption",
        "micro",
        "key",
        "key-label",
        "stat",
        "summary",
        "summary-lg",
        "numeral-1",
        "numeral-2",
        "numeral-3",
        "numeral-4",
        "numeral-5",
        "numeral-6",
      ],
```

(`eyebrow-sm` is also missing from this list. That is a pre-existing D450 gap, logged as discovered work. Add it here only if the user has approved it.)

- [ ] **Step 6: Rename `text-button` → `text-control` in markup**

In each file listed under **Files**, replace the substring `text-button` with `text-control`. Then verify:

Run: `grep -rn "text-button" app/src`
Expected: no output.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `cd app && npm test -- tests/lib/ui/brand-tokens.test.ts tests/lib/client/cn.test.ts`
Expected: PASS.

If the D451-utility `cn` case fails because `tailwind-merge` drops a class, add a `classGroups` entry to `extendTailwindMerge` that names the utility in its own group, e.g. `extend: { classGroups: { "border-w": ["border-medium"] } }`. Rerun.

- [ ] **Step 8: Commit**

```bash
git add app/src/styles/global.css app/src/lib/client/cn.ts app/tests/lib/ui/brand-tokens.test.ts app/tests/lib/client/cn.test.ts app/src/components docs/superpowers/handoffs/2026-10-12-tailwind-arbitrary-values-audit.md
git commit -m "feat(style): D451 type tokens, layout utilities, text-button → text-control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Stock renames: spacing, size, radius, blur, transitions

**Files (all under `app/src/`).** Each row replaces the old substring with the new one, on the line given.

| File:line | Old | New |
| --------- | --- | --- |
| `components/ui/BoardMagnifier.astro:122` | `h-[440px] w-[440px]` | `size-110` |
| `components/ui/Modal.astro:69` | `h-[5px]` | `h-1.25` |
| `components/ui/InlayRow.astro:40` and `:64` | `size-[3px]` | `size-0.75` |
| `components/layout/games/RouteChips.astro:26` | `size-[3px]` | `size-0.75` |
| `components/forms/SettingRow.astro:81` | `h-[1lh]` | `h-lh` |
| `components/layout/profile/ProfileIdentity.astro:17` | `h-[1lh]` | `h-lh` |
| `components/layout/profile/ProfileIdentity.astro:45` and `:58` | `min-h-[1lh]` | `min-h-lh` |
| `components/forms/RangeSlider.astro:59` | `h-[30px]` | `h-7.5` |
| `components/forms/RangeSlider.astro:75` | `h-[22px]` | `h-5.5` |
| `components/forms/Switch.astro:31` | `w-[38px] h-[22px]` | `w-9.5 h-5.5` |
| `components/forms/Switch.astro:31` | `after:content-[''] ` (with trailing space) | *(delete)* |
| `components/forms/Switch.astro:31` | `after:size-[18px]` | `after:size-4.5` |
| `components/forms/SlideToStart.astro:68` | `top-[5px]` | `top-1.25` |
| `components/forms/SlideToStart.astro:68` | `size-[50px]` | `size-12.5` |
| `components/forms/SlideToStart.astro:69` | `scale-[1.06]` | `scale-106` |
| `components/layout/training/schedules/ScheduleStrip.astro:26` | `size-[15px]` | `size-3.75` |
| `components/layout/training/schedules/ScheduleStrip.astro:32` | `size-[13px]` | `size-3.25` |
| `components/layout/training/schedules/TrainingScheduleCard.astro:24` | `h-[18px]` | `h-4.5` |
| `components/layout/games/VisitPreview.astro:31` | `h-[18px]` | `h-4.5` |
| `pages/training/index.astro:64` | `h-[18px]` | `h-4.5` |
| `layouts/GameLayout.astro:72` | `size-[18px]` | `size-4.5` |
| `components/ui/InfoSection.astro:55` | `size-[18px]` | `size-4.5` |
| `components/layout/training/schedules/ScheduleFormModal.astro:60` | `gap-[3px]` | `gap-0.75` |
| `components/layout/training/routines/RoutineStepRow.astro:46` | `gap-[3px]` | `gap-0.75` |
| `components/layout/training/routines/ExercisePicker.astro:46` | `gap-[3px]` | `gap-0.75` |
| `components/layout/games/ComparisonSummary.astro:78` | `gap-[3px]` | `gap-0.75` |
| `components/layout/games/ComparisonSummary.astro:44` and `:45` | `gap-[7px]` | `gap-1.75` |
| `components/layout/games/setup/UserSection.astro:38` | `gap-[18px]` | `gap-4.5` |
| `components/layout/training/routines/RoutineRow.astro:26` | `px-[7px]` | `px-1.75` |
| `components/layout/games/SplitScoreboardHalf.astro:52` | `px-[18px]` | `px-4.5` |
| `components/layout/games/VisitPreview.astro:22` | `px-[18px]` | `px-4.5` |
| `components/layout/games/ScoreInput.astro:68` | `py-[5px] pr-[5px]` | `py-1.25 pr-1.25` |
| `components/layout/games/ScoreInput.astro:79` | `w-[110px]` | `w-27.5` |
| `components/layout/games/PlayStatTile.astro:27` | `h-[76px]` | `h-19` |
| `components/layout/games/CricketRecreationalInput.astro:24` | `flex-[2]` | `flex-2` |
| `components/layout/games/TacticsRecreationalInput.astro:27` | `flex-[2]` | `flex-2` |
| `pages/login/index.astro:13` | `group-has-[:focus]:` | `group-has-focus:` |
| `components/layout/games/SplitScoreboardHalf.astro:52` and `:84` | `rounded-[22px]` | `rounded-key` |
| `components/layout/games/ScoreInput.astro:68` | `rounded-[22px]` | `rounded-key` |
| `components/layout/games/VisitPreview.astro:22` | `rounded-[22px]` | `rounded-key` |
| `components/layout/games/SplitScoreboardHalf.astro:107` | `rounded-[14px]` | `rounded-row` |
| `components/layout/games/PlayStatTile.astro:26` | `rounded-[14px]` | `rounded-row` |
| `components/layout/games/setup/Toggle.astro:55` | `rounded-[26px]` | `rounded-switch` |
| `components/layout/games/ScoreInput.astro:79` | `rounded-[17px]` | `rounded-xl` |
| `components/ui/StatsHeatmap.astro:33` | `rounded-[1px]` | `rounded-xs` |
| `components/forms/Select.astro:60` | `backdrop-blur-[2px]` | `backdrop-blur-xs` |
| `components/ui/Link.astro:48` | `transition-[transform,color,background-color,border-color,box-shadow]` | `transition` |
| `components/forms/IconBtn.astro:43` | same | `transition` |
| `components/forms/Button.astro:74` | same | `transition` |
| `components/forms/Input.astro:56` | `transition-[border-color,box-shadow,background-color]` | `transition` |
| `components/layout/training/schedules/ScheduleFormModal.astro:60` | `transition-[color,background-color]` | `transition-colors` |
| `components/layout/games/CheckoutConfirm.astro:44` | `transition-[color,background-color]` | `transition-colors` |
| `components/layout/games/BoardInputPanel.astro:67` | `transition-[filter]` | `transition` |

- [ ] **Step 1: Record the red state**

Run (repo root):
```bash
grep -rnE "(size|h|w|min-h|top|gap|px|py|pr|flex|scale|rounded|rounded-b|backdrop-blur)-\[[0-9.]+(px|lh)?\]|group-has-\[|content-\[|transition-\[(transform|border-color|color|filter)" app/src --include='*.astro'
```
Expected: about 60 lines, one or more per row above. The only `rounded-b-[…]` hits are in `CardStack` (Task 5).

- [ ] **Step 2: Apply every row of the table** with exact substring edits.

- [ ] **Step 3: Confirm the green state**

Run the Step 1 command again.
Expected: only `components/ui/CardStack.astro` lines (`rounded-b-[18px]`, `rounded-b-[19px]`). Task 5 handles those.

- [ ] **Step 4: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors`.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "refactor(style): stock v4 classes for spacing, size, radius, blur, transitions (D451)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Typography: tokens replace hand-rolled sizes, tracking and leading

**Files (all under `app/src/`):**

Existing tokens:

| File:line | Old | New |
| --------- | --- | --- |
| `pages/training/index.astro:25`, `pages/profile/index.astro:16`, `pages/games/index.astro:19` | `text-[26px]/[normal] tracking-[0.02em]` | `text-title` |
| `components/forms/PlayerSettingsCard.astro:37`, `components/forms/AppModeForm.astro:51`, `components/layout/training/schedules/TrainingScheduleCard.astro:20`, `pages/training/index.astro:125` | `text-[13px]/[normal] tracking-[0.06em]` | `text-card-title` |
| `components/layout/home/DailyAverageCard.astro:11`, `components/layout/home/LandingHeatmapCard.astro:13`, `components/layout/games/setup/SettingSectionShell.astro:17`, `components/layout/games/setup/UserSection.astro:32` | `text-[13px] tracking-[0.06em]` | `text-card-title` |
| `components/layout/home/HomeHero.astro:15` | `text-7xl leading-none tracking-[-0.02em]` | `text-hero` |
| `components/layout/home/HomeHero.astro:11` | `text-xs font-semibold tracking-[0.14em]` | `text-eyebrow-lg font-semibold` |
| `components/forms/SettingRow.astro:78`, `components/forms/AppModeForm.astro:37`, `components/forms/PlayerSettingsCard.astro:30` | `text-eyebrow/[normal]` | `text-eyebrow` |
| `components/layout/home/CareerTiles.astro:15` | `text-eyebrow/[1.3]` | `text-eyebrow` |
| `components/layout/games/ResumeSessionCard.astro:19` | `text-eyebrow/[normal]` | `text-eyebrow-lg` |
| `components/layout/sessions/ResumeSessionDeck.astro:55` | `text-[11px] font-semibold tracking-[0.14em]` | `text-eyebrow-lg font-semibold` |
| `components/layout/sessions/ResumeSessionDeck.astro:84` | `tracking-[0.14em] text-foreground` | `text-eyebrow-lg text-foreground` |
| `components/layout/games/ScoreInput.astro:71` | `text-[30px]` | `text-value` |
| `components/forms/Stepper.astro:68` | `text-[32px] leading-none` | `text-value` |

New tokens:

| File:line | Old | New |
| --------- | --- | --- |
| `components/ui/InfoSection.astro:31,50`, `components/layout/training/schedules/ScheduleStrip.astro:21`, `components/layout/sessions/ResumeSessionDeck.astro:62,109,113`, `components/layout/games/SplitScoreboardHalf.astro:110`, `components/layout/games/RouteChips.astro:32`, `components/layout/games/MarkRows.astro:21`, `components/layout/games/CountdownPauseControl.astro:29`, `components/layout/games/setup/ToggleListItem.astro:36`, `pages/login/index.astro:82`, `components/layout/training/routines/RoutineStepRow.astro:64` | `text-[13px]` | `text-body-sm` |
| `components/layout/profile/ProfileIdentity.astro:58`, `components/forms/HandednessForm.astro:37`, `components/forms/AppModeForm.astro:40` | `text-[13px]/[normal]` | `text-body-sm` |
| `components/layout/training/routines/RoutineStepRow.astro:48` | `text-[13px]/[normal] tracking-[0.01em]` | `text-body-sm` |
| `components/ui/BoardMagnifier.astro:112`, `components/ui/DeckPager.astro:46`, `components/forms/RangeSlider.astro:89`, `components/layout/home/DailyAverageCard.astro:13,32`, `components/layout/home/LandingHeatmapCard.astro:15`, `components/layout/home/CareerTiles.astro:23`, `components/layout/training/routines/RoutineStepRow.astro:72`, `components/layout/sessions/ResumeSessionDeck.astro:82` | `text-[11px]` | `text-caption` |
| `components/layout/training/routines/RoutineStepRow.astro:52` | `text-[11px]/[normal]` | `text-caption` |
| `components/layout/training/routines/RoutineRow.astro:26` | `text-[10px]/[normal]` | `text-micro` |
| `components/layout/games/LegBars.astro:42` | `text-[10px]` | `text-micro` |
| `components/forms/SettingRow.astro:147` | `text-[15px]/[normal]` | `text-control` |
| `components/forms/SettingRow.astro:175`, `components/layout/sessions/ResumeSessionDeck.astro:137`, `components/layout/games/BoardInputPanel.astro:107`, `pages/login/index.astro:16`, `lib/training/schedules/training-week.data.ts:23` | `text-[15px]` | `text-control` |
| `components/layout/games/InputButton.astro:48` | `text-[26px]` | `text-key` |
| `components/layout/games/SinglesRecreationalInput.astro:78`, `components/layout/games/DoublesPathRecreationalInput.astro:34` | `text-[22px] tracking-[0.08em]` | `text-key-label` |
| `components/layout/games/TargetGrid.astro:43` | `text-[1.0625rem] leading-none` | `text-stat` |
| `components/layout/games/PlayStatTile.astro:35` | `"text-[17px]"` | `"text-stat"` |
| `components/layout/games/ComparisonSummary.astro:91` | `text-[2.5rem] leading-none` | `text-summary` |
| `components/layout/games/SinglePlayerSummary.astro:41` | `{ lg: "text-[3.25rem]", sm: "text-[2.5rem]" }` | `{ lg: "text-summary-lg", sm: "text-summary" }` |

Stock line-height and tracking:

| File:line | Old | New |
| --------- | --- | --- |
| `components/forms/SettingRow.astro:188`, `components/layout/games/GameRow.astro:57`, `components/layout/games/ResumeSessionCard.astro:26` | `text-xs/[normal]` | `text-xs/tight` |
| `components/layout/profile/ProfileIdentity.astro:15` and `:45` | `text-lg/[normal]` | `text-lg/tight` |
| `components/layout/games/ResumeSessionCard.astro:23` | `text-base/[normal]` | `text-base/tight` |
| `components/forms/AppModeForm.astro:55` | `text-xs/[1.5]` | `text-xs/normal` |
| `components/ui/InfoSection.astro:35` and `:62` | `leading-[1.55]` | `leading-relaxed` |
| `components/forms/SlideToStart.astro:63`, `components/layout/games/setup/SetupShell.astro:39` | `tracking-[0.02em]` | `tracking-wide` |
| `layouts/GameLayout.astro:47` | `tracking-[0.06em]` | `tracking-wider` |
| `components/layout/games/GameRow.astro:35` | ` tracking-[0.01em]` (leading space) | *(delete)* |

`global.css` `@apply`:

| Rule | Old | New |
| ---- | --- | --- |
| `.mode-pill` | `text-[11px]/[normal] font-semibold tracking-[0.08em]` | `text-caption font-semibold tracking-widest` |
| `.section-eyebrow` | `text-[11px]/[normal] font-semibold tracking-[0.14em]` | `text-eyebrow-lg font-semibold` |

- [ ] **Step 1: Record the red state**

Run (repo root):
```bash
grep -rnE "(text|tracking|leading)-\[[^]]+\]|/\[[^]]+\]" app/src --include='*.astro' --include='*.ts' --include='*.css' --exclude='*.test.ts' | grep -v "clamp(" | grep -vE "/\[A-Z\]|name-\["
```
Expected: about 75 lines covering every row above. Lines with `tracking-[-0.02em]` in `SplitScoreboardHalf:70` and `SinglePlayerDisplay:53` remain for Task 4.

- [ ] **Step 2: Apply every row of the four tables** with exact substring edits. When one line has several rows (e.g. `RoutineStepRow:64`), apply them all.

- [ ] **Step 3: Confirm the green state**

Run the Step 1 command again.
Expected: only `SplitScoreboardHalf.astro:70` and `SinglePlayerDisplay.astro:53` (`tracking-[-0.02em]`).

- [ ] **Step 4: Type-check and run the tests**

Run: `cd app && npx astro check && npm test`
Expected: `0 errors`, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "refactor(style): role type tokens replace hand-rolled sizes, tracking, leading (D451)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Play numerals → `text-numeral-*`

**Files:**
- Modify: `app/src/lib/ui/play-display.ts:27-29,39-41,52-53`
- Modify: `app/src/components/layout/games/SplitScoreboardHalf.astro:70`, `app/src/components/layout/games/SinglePlayerDisplay.astro:53`
- Test: `app/tests/lib/ui/play-display.test.ts`

**Interfaces:**
- Consumes: `text-numeral-1` … `text-numeral-6` (Task 1).
- Produces: `bigValueSize(value: unknown): string` and `seatValueSize(value: unknown): string`. Signatures are unchanged; they now return `text-numeral-N`.

Map: `clamp(2.5rem,45cqw,5.25rem)` → `text-numeral-1`; `clamp(2rem,30cqw,4rem)` → `-2`; `clamp(1.5rem,18cqw,2.875rem)` → `-3`; `clamp(1.25rem,15cqw,2.875rem)` → `-4`; `clamp(1.125rem,11cqw,2.875rem)` → `-5`; `clamp(1rem,10cqw,2.875rem)` → `-6`.

- [ ] **Step 1: Update the expectations (failing test)**

In `app/tests/lib/ui/play-display.test.ts`, replace each expected string by the map above, e.g. `"text-[clamp(2.5rem,45cqw,5.25rem)]"` → `"text-numeral-1"`. That is 17 strings across L13-L43, including the `bigValueSize(170)` and `bigValueSize(null)` cases.

- [ ] **Step 2: Run and confirm the failure**

Run: `cd app && npm test -- tests/lib/ui/play-display.test.ts`
Expected: FAIL, e.g. `expected 'text-[clamp(2.5rem,45cqw,5.25rem)]' to be 'text-numeral-1'`.

- [ ] **Step 3: Implement**

Replace L27-29:

```ts
  if (length === 6) return "text-numeral-4";
  if (length <= 8) return "text-numeral-5";
  return "text-numeral-6";
```

Replace L39-41:

```ts
  if (length <= 2) return "text-numeral-1";
  if (length === 3) return "text-numeral-2";
  if (length <= 5) return "text-numeral-3";
```

Replace L52-53:

```ts
  if (length <= 3) return "text-numeral-2";
  if (length <= 5) return "text-numeral-3";
```

In `SplitScoreboardHalf.astro:70` and `SinglePlayerDisplay.astro:53`, delete the substring `leading-none tracking-[-0.02em] `. The token carries line-height 1 and −0.02em.

- [ ] **Step 4: Run and confirm the pass**

Run: `cd app && npm test -- tests/lib/ui/play-display.test.ts`
Expected: PASS.
Run: `grep -rn "clamp(\|tracking-\[" app/src --include='*.astro' --include='*.ts'`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/src app/tests/lib/ui/play-display.test.ts
git commit -m "refactor(play): numeral clamps become text-numeral tokens (D451, D432)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Composites → grid tokens and utilities

**Files (all under `app/src/`):**

| File:line | Old | New |
| --------- | --- | --- |
| `components/layout/games/StatRowComparison.astro:23`, `components/layout/games/ComparisonSummary.astro:66,100` | `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` | `grid-cols-mirror` |
| `components/layout/games/SplitScoreboardHalf.astro:52`, `components/layout/games/SinglePlayerDisplay.astro:42` | `grid-cols-[1.3fr_1fr]` | `grid-cols-scoreboard` |
| `components/ui/Modal.astro:60` | `pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]` | `pt-safe pb-safe` |
| `components/ui/ExpandingModal.astro:62` | `pt-[calc(env(safe-area-inset-top)+1rem)]` | `pt-safe` |
| `components/layout/BottomNav.astro:27` | `bottom-[max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))]` | `bottom-nav` |
| `components/forms/SlideToStart.astro:35` | `bottom-[calc(max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))+5.5rem)]` | `bottom-above-nav` |
| `layouts/AppLayout.astro:16` | `pb-[calc(env(safe-area-inset-bottom)+5.5rem)]` | `pb-nav` |
| `components/ui/CardStack.astro:38` | `rounded-b-[18px] bg-stack-2 shadow-[inset_0_-1px_0_oklch(100%_0_0/0.12)]` | `stack-slab-2` |
| `components/ui/CardStack.astro:48` | `rounded-b-[19px] bg-stack-1 shadow-[inset_0_-1px_0_oklch(100%_0_0/0.15)]` | `stack-slab-1` |
| `components/layout/training/schedules/ScheduleFormModal.astro:114` | `border-[1.5px]` | `border-medium` |
| `components/layout/games/setup/AddGuestButton.astro:34` | `border-[1.5px]` | `border-medium` |
| `components/layout/training/routines/RoutineStepRow.astro:64` | `[appearance:textfield]` | `input-number-plain` |
| `components/layout/training/routines/RoutineStepRow.astro:64` | ` [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none` (leading space) | *(delete)* |

- [ ] **Step 1: Record the red state**

Run: `grep -rnE "grid-cols-\[(minmax\(0,1fr\)_auto|1\.3fr)|env\(safe-area|rounded-b-\[|border-\[1\.5px\]|\[appearance:|\[&::" app/src --include='*.astro'`
Expected: 16 lines, matching the table.

- [ ] **Step 2: Apply every row** with exact substring edits.

- [ ] **Step 3: Confirm the green state**

Run the Step 1 command again.
Expected: no output.

- [ ] **Step 4: Type-check and run the tests**

Run: `cd app && npx astro check && npm test`
Expected: `0 errors`, PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "refactor(style): grid tokens and safe-area/nav/slab/border/input utilities (D451)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Arbitrary-value gate

**Files:**
- Modify: `scripts/check-style-tokens.sh`: header comment (L1-21), a new block after the `NEG_ARBITRARY` block (L77-82), the final OK message (L108)

**Interfaces:**
- Consumes: a clean tree (Tasks 2-5).
- Produces: `ARBITRARY_ALLOW` (bash array of `path|match`), and FAIL output that the Task 7 docs cite.

- [ ] **Step 1: Add the header lines**

After the line `# Scan: app/src/**/*.{astro,css}.`, add:

```bash
# - no Tailwind arbitrary value/modifier/property/variant (D451): prop-[…],
#   /[…], [prop:value], [&…] in app/src .astro/.ts (tests excluded) and in
#   @apply lines of app/src/styles/*.css. Exceptions: ARBITRARY_ALLOW rows
#   ("path|match", match = exact substring the regex extracts), one reason
#   comment each; a row that no longer matches fails, so dead rows cannot
#   linger as cover.
```

- [ ] **Step 2: Add the gate block after the `NEG_ARBITRARY` `fi`**

```bash
ARB_RE='[a-z][a-z0-9-]*-\[[^] ]+\]|/\[[^] ]+\]|\[[a-z-]+:[^] ]+\]|\[&[^] ]+\]'
ARBITRARY_ALLOW=(
  # layout-property animation; no stock transition group covers top/left/width/height
  "app/src/components/ui/GrowingCard.astro|transition-[top,left,width,height]"
  # CSS grid accordion; stock grid-rows-N means repeat(N, …), not a track size
  "app/src/components/forms/Select.astro|grid-rows-[0fr]"
  "app/src/components/forms/Select.astro|grid-rows-[1fr]"
  "app/src/components/forms/Select.astro|transition-[grid-template-rows]"
  # viewport-fraction cap; no stock dvh fraction
  "app/src/components/forms/Select.astro|max-h-[60dvh]"
  # left is in no stock transition group
  "app/src/components/forms/SlideToStart.astro|transition-[left,scale]"
  # sheet height = viewport minus margin
  "app/src/components/ui/Modal.astro|max-h-[calc(100dvh-2rem)]"
  # one-off grid templates; tokenise on second use
  "app/src/components/layout/games/setup/FiveOhOneSetupForm.astro|grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]"
  "app/src/components/layout/games/setup/FiveOhOneSetupForm.astro|grid-cols-[minmax(0,1fr)_72px]"
  "app/src/components/layout/games/SinglePlayerSummary.astro|grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
  "app/src/components/layout/games/setup/SetupShell.astro|grid-cols-[40px_1fr_40px]"
  # glass utilities' top-lit wash; v4 has no theme namespace for gradient position
  "app/src/styles/global.css|bg-radial-[at_50%_0%]"
  # regex literals, not classes
  "app/src/lib/game/rulesets/config-codec.ts|/[A-Z]"
  "app/src/modules/stats/routine-scope.module.ts|name-[0-9a-f]"
)
ARB_HITS=$(
  {
    grep -rnoE "$ARB_RE" app/src --include="*.astro" --include="*.ts" --exclude="*.test.ts" || true
    grep -rnE '@apply' app/src/styles --include="*.css" | while IFS= read -r line; do
      loc=${line%%:*}
      rest=${line#*:}
      num=${rest%%:*}
      printf '%s\n' "${rest#*:}" | grep -oE "$ARB_RE" | sed "s|^|$loc:$num:|"
    done
  } | sort -u
)
ARB_BAD=""
ARB_USED=""
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  file=${hit%%:*}
  rest=${hit#*:}
  match=${rest#*:}
  allowed=0
  for row in "${ARBITRARY_ALLOW[@]}"; do
    if [ "$row" = "$file|$match" ]; then
      allowed=1
      ARB_USED="$ARB_USED$row"$'\n'
    fi
  done
  [ "$allowed" -eq 0 ] && ARB_BAD="$ARB_BAD$hit"$'\n'
done <<< "$ARB_HITS"
ARB_STALE=""
for row in "${ARBITRARY_ALLOW[@]}"; do
  printf '%s' "$ARB_USED" | grep -qxF -- "$row" || ARB_STALE="$ARB_STALE$row"$'\n'
done
if [ -n "$ARB_BAD" ]; then
  echo "FAIL: Tailwind arbitrary value found (D451). Fix in this order:" >&2
  echo "  1. stock v4 class (spacing takes any 0.25 step: h-4.5, gap-0.75; h-lh; scale-106; flex-2)" >&2
  echo "  2. existing @theme token in app/src/styles/global.css (text-*, rounded-*, grid-cols-*)" >&2
  echo "  3. new token in global.css first (D428), then use it" >&2
  echo "  4. @utility in global.css for a repeated composite" >&2
  echo "  5. last resort: an ARBITRARY_ALLOW row in this script, with a reason (reviewed)" >&2
  echo "  See docs/architecture/07-Frontend/07-Style-Guide.md §Arbitrary values." >&2
  printf '%s' "$ARB_BAD" >&2
  FAIL=1
fi
if [ -n "$ARB_STALE" ]; then
  echo "FAIL: ARBITRARY_ALLOW row matches nothing — delete it:" >&2
  printf '%s' "$ARB_STALE" >&2
  FAIL=1
fi
```

- [ ] **Step 3: Update the OK message**

Replace the final `echo "OK: …"` with:

```bash
echo "OK: no {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), leading-dash arbitrary (-prop-[…]) or unlisted arbitrary value under app/src."
```

- [ ] **Step 4: Run on the clean tree**

Run (repo root): `bash scripts/check-style-tokens.sh; echo "exit=$?"`
Expected: the OK line, `exit=0`.

If it FAILs on hits that Tasks 2-5 did not name:
- a class → fix it with the ladder, using an existing token or stock class;
- a non-class `.ts`/frontmatter false positive → add an exact allowlist row with a reason.

Rerun until it prints `exit=0`. List every such addition in the PR body.

- [ ] **Step 5: Red proof, one plant at a time**

For each plant: add it, run `bash scripts/check-style-tokens.sh; echo "exit=$?"`, confirm `exit=1` and that the planted line is listed, then revert it with `git checkout -- <file>`.

| Kind | File | Plant (append to any `class="…"` / string) |
| ---- | ---- | ------------------------------------------- |
| value | `app/src/components/ui/Modal.astro` | `h-[7px]` |
| modifier | `app/src/components/ui/Modal.astro` | `text-xs/[normal]` |
| property | `app/src/components/ui/Modal.astro` | `[appearance:none]` |
| variant | `app/src/components/ui/Modal.astro` | `[&>svg]:size-4` |
| `.ts` string | `app/src/lib/training/schedules/training-week.data.ts` | `text-[15px]` |
| `@apply` | `app/src/styles/global.css` (`.mode-pill` `@apply`) | `tracking-[0.3em]` |
| stale row | `scripts/check-style-tokens.sh` | add `"app/src/components/ui/Modal.astro\|h-[9px]"` to `ARBITRARY_ALLOW` (expect the "matches nothing" FAIL) |

Record the seven FAIL outputs (one line each) for the PR body. Then run the script once more: `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-style-tokens.sh
git commit -m "feat(gates): ban unlisted Tailwind arbitrary values (D451)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and decision D451

**Files:**
- Modify: `decisions/frontend/style.md` (append)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md`: L10 version, L51 type-scale row, Primitives table, L127 numerals row, §Tailwind v4 class syntax, §Anti-patterns
- Modify: `app/src/components/CLAUDE.md` §Style non-negotiables (L5-15)
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` L118, L147

- [ ] **Step 1: Confirm the decision id**

Run: `bash scripts/next-decision-id.sh`
Expected: `D451`. If it prints something else, use that id everywhere below and in the earlier commit messages' successors. Do not amend landed commits.

- [ ] **Step 2: Append D451 to `decisions/frontend/style.md`**

```markdown

### D451 — No Tailwind arbitrary values outside a reviewed allowlist; role-named type bundles
Status: Accepted · Date: 2026-10-12
Decision: `app/src` markup, `.ts` class strings and `@apply` carry no Tailwind arbitrary value, modifier, property or variant (`prop-[…]`, `/[…]`, `[prop:value]`, `[&…]`). The fix ladder is: stock v4 class → existing `@theme` token → new `global.css` token (D428) → `@utility` for a repeated composite → an `ARBITRARY_ALLOW` row (`path|match` plus a reason) in `scripts/check-style-tokens.sh`, which fails on any unlisted hit and on any row that no longer matches. New font sizes are role-named `--text-*` bundles (size, line-height, tracking): `body-sm`, `caption`, `micro`, `key`, `key-label`, `stat`, `summary`, `summary-lg`, and `numeral-1…6` (the D432 cqw clamps, now tokens). `text-button` is renamed `text-control`, the 15px control-text size. No `--tracking-*` or `--leading-*` tokens: tracking lives in a bundle or a stock step. Composites: `grid-cols-mirror`/`-scoreboard`, `stack-slab-1/2`, `border-medium`, `pt-safe`/`pb-safe`, `bottom-nav`/`bottom-above-nav`/`pb-nav` (via `--nav-bottom`, `--nav-clearance`), `input-number-plain`.
Reason: the audit found 190 arbitrary values in 72 files, many re-spelling existing tokens. D428 ("a token before any component uses it") was not enforced, so agents copied neighbours' literals.
Consequences: sub-pixel line-height shifts where `/[normal]` gave way to explicit values; 11→12px and 10→12px "IN PROGRESS" eyebrows; `Stepper` 32→30px; tracking snaps of ≤0.02em; transitions also animate opacity/filter. Visual check per screen, not byte-verifiable. `cn()` lists the new tokens. Source: `docs/superpowers/specs/2026-10-12-tailwind-arbitrary-values-design.md`.
Supersedes: none.
```

- [ ] **Step 3: Style Guide edits**

L10: replace `**Version:** 0.4.1 (2026-10-10 — resume deck: stack/deck tokens, `deck-top-card`, deck keyframes, D442; prior 0.4.0` with `**Version:** 0.5.0 (2026-10-12 — arbitrary-value ban, role type bundles, layout utilities, D451; prior 0.4.1 was 2026-10-10 — resume deck, D442; prior 0.4.0`.

L51: replace the row with:

```markdown
| Type scale | `text-hero` 72, `text-title` 26 (screen title), `text-value` 30, `text-tile` 20, `text-card-title` 13, `text-control` 15 (buttons, fields, control text), `text-eyebrow-sm` 9 / `text-eyebrow` 10 / `text-eyebrow-lg` 12 (mono caps); `text-body-sm` 13, `text-caption` 11, `text-micro` 10; numerals `text-key` 26, `text-key-label` 22, `text-stat` 17, `text-summary` 40 / `text-summary-lg` 52, `text-numeral-1…6` (cqw clamps); body `text-sm`, caption `text-xs` (D451) |
```

Primitives table: append a row:

```markdown
| `@utility stack-slab-1` / `stack-slab-2` / `border-medium` / `pt-safe` / `pb-safe` / `bottom-nav` / `bottom-above-nav` / `pb-nav` / `input-number-plain`; `grid-cols-mirror` / `grid-cols-scoreboard` | Card-stack slabs; 1.5px border; safe-area sheet padding; bottom-nav offset and clearance (`--nav-bottom`, `--nav-clearance`); bare number input; mirrored and scoreboard grids (D451, 2026-10-12) |
```

L127, in the "Large numeric displays" row: replace `` `leading-none tracking-[-0.02em] tabular-nums text-shadow-glow`; size from `bigValueSize` `` with `` `tabular-nums text-shadow-glow`; size, line-height and −0.02em tracking from a `text-numeral-*` token picked by `bigValueSize` ``. Then replace `both a cqw clamp per length` with `both a cqw clamp token per length (D451)`.

§Tailwind v4 class syntax, Container queries paragraph: replace `` use a `cq*`-unit arbitrary value on the descendant, typically wrapped in `clamp()` to bound both ends: `text-[clamp(1.75rem,13cqw,3rem)]`. `` with `` give the descendant a `--text-*` token whose size is a `cq*` clamp (`text-numeral-1…6`); a new clamp enters `global.css` as a token first (D451). ``

After that paragraph (before `---`), add:

```markdown
**Arbitrary values.** No `prop-[…]`, `/[…]`, `[prop:value]` or `[&…]` in markup, `.ts` class strings or `@apply`. Fix in order:
1. Stock v4 class: spacing takes any 0.25 step (`h-4.5`, `gap-0.75`); `h-lh`, `scale-106`, `flex-2`, `group-has-focus:`.
2. Existing `@theme` token: `text-*`, `rounded-*`, `grid-cols-*`.
3. New token in `global.css` first (D428).
4. `@utility` for a repeated composite.
5. Last resort: an `ARBITRARY_ALLOW` row (`path|match` plus a reason) in `scripts/check-style-tokens.sh`.

The gate fails on any unlisted hit and on any row that matches nothing (D451, 2026-10-12).
```

§Anti-patterns table: append:

```markdown
| Arbitrary values `h-[18px]`, `text-[13px]/[normal]`, `tracking-[0.06em]` | Stock step, `@theme` token or `@utility`; allowlist row only as last resort (D451) |
```

- [ ] **Step 4: `app/src/components/CLAUDE.md`**

After the L14 bullet (`- Tailwind v4 utilities only — …`), add:

```markdown
- No Tailwind arbitrary values (`prop-[…]`, `/[…]`, `[prop:value]`, `[&…]`): stock step → `@theme` token → new token in `global.css` → `@utility`; an `ARBITRARY_ALLOW` row in `scripts/check-style-tokens.sh` only as a reviewed last resort (D451, 2026-10-12)
```

In the L15 bullet, replace `+ `-prop-[…]` mechanically enforced` with `+ `-prop-[…]` + unlisted arbitrary values mechanically enforced`.

- [ ] **Step 5: Agent Guide**

L118: append before the final `)`: `; no arbitrary values — stock step, token or `@utility`, allowlist as last resort (D451)`.

L147: append `; no unlisted arbitrary values (D451)` to the checklist item.

- [ ] **Step 6: Run the doc gates**

Run (repo root): `bash scripts/check-decision-ids.sh && bash scripts/check-doc-links.sh && bash scripts/check-doc-sync.sh && bash scripts/check-context-map.sh`
Expected: each prints OK. Fix any finding caused by these edits.

- [ ] **Step 7: Commit**

```bash
git add decisions/frontend/style.md docs/architecture/07-Frontend app/src/components/CLAUDE.md
git commit -m "docs(style): D451 arbitrary-value ban, type bundles, layout utilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Full validation, context maintenance, PR

**Files:** whatever `context-maintenance` names (context map, File Inventory, graph). Nothing else.

- [ ] **Step 1:** Run the `run-all-gates` skill. Expected: every script reports pass.
- [ ] **Step 2:** Run the `validate-app` skill. Expected: astro check `0 errors`, `npm test` PASS. Steps needing `DATABASE_URL` are reported as skipped, not passed.
- [ ] **Step 3:** Run the `context-maintenance` skill and apply its edits. Commit them per its instructions.
- [ ] **Step 4: Device check (user).** Ask the user to check these screens, and wait for their OK:
  - home: hero, resume deck, career tiles, daily average, heatmap card
  - games index and setup: 501 setup grid, user section, toggles, slide-to-start above the bottom nav
  - play: 501 solo and split scoreboard numerals at 2-, 3-, 5- and 6+-digit values; score input; cricket, tactics, singles and doubles-path inputs; board magnifier
  - summaries: comparison and single-player
  - training: index, schedule card, schedule form modal, routine rows and steps (the number input shows no spinners)
  - profile: identity block (`min-h-lh` with `text-lg/tight`)
  - login: label focus colour
  - any modal: top/bottom safe-area padding; stepper value

  Each finding becomes a fix commit on this branch, or a GitHub issue if it is out of scope.
- [ ] **Step 5:** Use `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill (Option 2: push + PR). The PR body lists:
  - the seven red-proof FAIL lines from Task 6
  - every allowlist row added in Task 6 Step 4
  - the accepted visual changes from the spec
  - the issues logged as discovered work
- [ ] **Step 6:** Confirm the PR's `quality` job (GNU grep) runs `check-style-tokens.sh` green.
