# Routine Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/training/routines/detail` per the design: glass header with destructive trash + edit IconBtns, summary card with duration-sized timeline, step list card, red confirm button.

**Architecture:** Derived helpers (`stepWeight`, `stepTone`, `stepTag`, `totalMinutes`) added to the `routineDetail()` Alpine factory and TDD'd. Shared tag-set lookup extracted from `catalog-groups.ts`. New visual primitives (`glass-destructive`, `chip`) as `@utility` in `global.css`; new variants on IconBtn/Button/ConfirmDialog; new `PageHeader`, `RoutineSummaryCard`, `RoutineStepList` Astro components composed in `RoutineDetail.astro`.

**Tech Stack:** Astro, Alpine.js, Tailwind v4, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-routine-detail-redesign-design.md`

## Global Constraints

- Semantic tokens only; no Tailwind arbitrary values except SetupShell's existing `grid-cols-[40px_1fr_40px]` (moved, not added) (D451).
- `cn()` for class merging, never `class:list`; spread `{...props}`, never `{...rest}`.
- Alpine shorthand (`@click`, `:style`); every `x-show` has `x-cloak`; no `x-init`.
- No `.ts` files under `components/`.
- Other ConfirmDialog call sites keep `sheet-raised` (default).
- No API, schema or persisted value change.
- TDD per `app/CLAUDE.md`: test first, `npm test` (from `app/`) red, then green.
- Commit only when the user has asked; each task's commit step assumes that permission.

## Review Focus

1. Routine with zero steps: timeline renders empty, footer `0 STEPS` / `0:00 → 0:00`, no crash. → Task 2 test `totalMinutes is 0 with no steps`.
2. Tags fetch rejects: routine still loads, `error` stays `""`, chips just vanish. → Task 2 test.
3. Non-MINUTES step: weight 1, excluded from total. → Task 2 tests.
4. GAME step with `gameTypeKey: null`: no tag, no throw. → Task 1 test.
5. System routine / failed load: header still shows back link; no trash/edit buttons. → Task 7 manual check.

---

### Task 1: Shared step tag-set lookup

**Files:**
- Create: `app/src/lib/training/routines/step-tag-set.ts`
- Modify: `app/src/lib/training/routines/catalog-groups.ts:18-28` (delete local `tagSet`, call helper)
- Test: `app/tests/lib/training/routines/step-tag-set.test.ts`

**Interfaces:**
- Produces: `stepTagSet(tags: CatalogTagsResponse | null, exerciseTypeKey: string, gameTypeKey: string | null): CatalogTagSet | undefined`. Logic = old `tagSet`: `null` tags → `undefined`; `exerciseTypeKey === "GAME"` → `tags.games[gameTypeKey ?? exerciseTypeKey]?.routineStep`; else `tags.exercises[exerciseTypeKey]`.

- [ ] **Step 1: Write failing tests** (fixture shape as in `catalog-groups.test.ts:27-43`)
  - `returns routineStep set for a GAME step` — `stepTagSet(tags, "GAME", "TUOD")` toBe `tags.games.TUOD.routineStep`
  - `returns the exercise set for an exercise step` — `stepTagSet(tags, "BULL_UP", null)` toBe `tags.exercises.BULL_UP`
  - `undefined for GAME without gameTypeKey` — `stepTagSet(tags, "GAME", null)` toBeUndefined
  - `undefined for unknown key` — `stepTagSet(tags, "NOPE", null)` toBeUndefined
  - `undefined when tags is null` — `stepTagSet(null, "BULL_UP", null)` toBeUndefined
- [ ] **Step 2:** `npm test -- step-tag-set` → FAIL (module not found).
- [ ] **Step 3:** Implement helper; in `groupCatalog` call `stepTagSet(tags, entry.exerciseTypeKey, entry.gameTypeKey)`; drop the local `tagSet`. Keep `GAME_TYPE_KEY` in catalog-groups only if `groupKey` still uses it.
- [ ] **Step 4:** `npm test -- step-tag-set catalog-groups` → PASS (catalog-groups tests unchanged).
- [ ] **Step 5:** Commit `refactor(routines): extract stepTagSet from catalog-groups`.

### Task 2: routineDetail derived helpers + tags fetch

**Files:**
- Modify: `app/src/lib/training/routines/routine-detail.data.ts`
- Modify: `app/src/lib/training/routines/types.ts` (`RoutineDetailContext`, ~line 413)
- Test: `app/tests/lib/training/routines/routine-detail.data.test.ts`

**Interfaces:**
- Consumes: `stepTagSet` (Task 1); `fetchCatalogTags` from `@client/api/catalog`; `cardTags` from `@lib/catalog/tags`.
- Produces (on factory + `RoutineDetailContext`):
  - `catalogTags: CatalogTagsResponse | null` (initial `null`)
  - `totalMinutes(this): number` — MINUTES-only sum; `durationLabel()` becomes `` `${this.totalMinutes()} min` ``
  - `stepWeight(step: Step): number` — `durationValue` if MINUTES, else `1`
  - `stepTone(index: number, part: "bg" | "border"): string` — `index % 4` into static lists `["bg-accent","bg-accent/70","bg-accent/45","bg-white/35"]` / `["border-accent","border-accent/70","border-accent/45","border-white/35"]` (literal strings so Tailwind sees them)
  - `stepTag(this, step: Step): string | null` — `cardTags(set, "exercise")[0]?.name ?? null` where `set = stepTagSet(this.catalogTags, step.exerciseTypeKey, step.gameTypeKey)`; `null` if no set

- [ ] **Step 1: Write failing tests.** Add `vi.mock("@client/api/catalog", () => ({ fetchCatalogTags: vi.fn() }))`; in `beforeEach` default `vi.mocked(fetchCatalogTags).mockResolvedValue(TAGS)` with `TAGS = { games: { TUOD: { standalone: set, routineStep: set } }, exercises: { SWITCHING: set } }`, `set.tags = [{ axis: "SKILL", key: "SCORING", name: "Scoring", primary: true }]`.
  - `stepWeight uses minutes, else 1` — MINUTES 30 → `30`; `{ durationTypeKey: "ROUNDS", durationValue: 3 }` → `1`
  - `stepTone cycles four tones` — `stepTone(0,"bg")` `"bg-accent"`, `stepTone(3,"border")` `"border-white/35"`, `stepTone(4,"bg")` `"bg-accent"`
  - `totalMinutes is 0 with no steps` — routine `steps: []` → `0`, `durationLabel()` `"0 min"`
  - `totalMinutes skips non-minute steps` — 30 MIN + 3 ROUNDS → `30`
  - `stepTag reads the exercise set` — after `init`, `stepTag(ROUTINE.steps[0])` `"Scoring"`
  - `stepTag reads a game step's routineStep set` — step `{ exerciseTypeKey: "GAME", gameTypeKey: "TUOD" }` → `"Scoring"`
  - `stepTag null for a missing set` — `exerciseTypeKey: "NOPE"` → `null`
  - `loads the routine when the tags fetch rejects` — `fetchCatalogTags` rejects; after `init`: `routine` toEqual ROUTINE, `catalogTags` null, `error` `""`, `stepTag(...)` null
- [ ] **Step 2:** `npm test -- routine-detail.data` → new tests FAIL.
- [ ] **Step 3:** Implement. In `init`, `Promise.all([getRoutine(routineId), fetchCatalogTags().catch(() => null)])` (same pattern as `routine-builder.data.ts:121`), assign both inside the existing try.
- [ ] **Step 4:** `npm test -- routine-detail.data` → PASS; `npx astro check` clean for types.ts.
- [ ] **Step 5:** Commit `feat(routines): routine detail step weight, tone, tag helpers`.

### Task 3: CSS primitives — `glass-destructive`, tokens, `chip`

**Files:**
- Modify: `app/src/styles/global.css` (tokens near `--error*` ~line 44; `@theme` colours ~line 108; utilities after `glass-button` ~line 469)
- Modify: `app/src/components/layout/training/routines/RoutineRow.astro:26,31`

**Interfaces:**
- Produces: tokens `--error-glass-icon: oklch(78% 0.13 30)`, `--error-glass-foreground: oklch(90% 0.05 30)` + `--color-error-glass-icon`, `--color-error-glass-foreground` (→ `text-error-glass-icon`, `text-error-glass-foreground`); `@utility glass-destructive` (spec §Destructive glass values, same structure as `glass-button`); `@utility chip` = `@apply rounded-md bg-white/7 px-1.75 py-0.5 font-mono text-micro font-semibold text-chip-foreground`.

- [ ] **Step 1:** Add tokens + utilities.
- [ ] **Step 2:** Replace both RoutineRow chip class strings with `chip`.
- [ ] **Step 3:** `npm run build` (from `app/`) → succeeds; `/training` chips look unchanged in `npm run dev`.
- [ ] **Step 4:** Commit `feat(styles): glass-destructive and chip utilities`.

### Task 4: Variants — IconBtn, Button, ConfirmDialog, trash icon

**Files:**
- Create: `app/src/icons/trash.svg` (spec path, `viewBox="0 0 24 24"`, `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, matching `pencil.svg`'s format)
- Modify: `app/src/components/forms/IconBtn.astro`
- Modify: `app/src/components/forms/Button.astro:5,15-22,62-71`
- Modify: `app/src/components/ui/ConfirmDialog.astro`

**Interfaces:**
- Consumes: Task 3 utilities/tokens.
- Produces:
  - IconBtn `variant`: add `"glass"` → `"border-0 glass-button text-foreground"`, `"destructive"` → `"border-0 glass-destructive text-error-glass-icon"` (`border-0` neutralises base `border-3`; `glass-*` re-adds 1px y-borders — verify computed border in devtools, else move `border-3` out of base for these two)
  - Button `variant`: add `"sheet-destructive"` → `"h-13 rounded-2xl text-control glass-destructive text-error-glass-foreground"`
  - ConfirmDialog prop `confirmVariant?: "sheet-raised" | "sheet-destructive"` default `"sheet-raised"`, forwarded to the confirm Button's `variant`; JSDoc `@param` added

- [ ] **Step 1:** Implement all four; update each component's JSDoc variant list.
- [ ] **Step 2:** `npx astro check` → 0 errors.
- [ ] **Step 3:** Commit `feat(ui): destructive glass variants and trash icon`.

### Task 5: `PageHeader` extracted; SetupShell adopts it

**Files:**
- Create: `app/src/components/layout/PageHeader.astro`
- Modify: `app/src/components/layout/games/setup/SetupShell.astro` (header block + JSDoc)

**Interfaces:**
- Produces: `<PageHeader backHref backLabel title>` + optional named slot `actions`. Markup = SetupShell's current header (`<header class="grid … items-center pt-3 pb-2">`, `<a class="glass-button flex size-10 items-center justify-center rounded-full" aria-label={backLabel}>` with `ChevronDownIcon class="size-5.5 rotate-90 text-muted-foreground"`, `<h2 class="text-center font-display text-lg tracking-wide text-foreground">`). Grid: `Astro.slots.has("actions") ? "grid-cols-3" : "grid-cols-[40px_1fr_40px]"` via `cn()`. Actions wrapper: `flex justify-end gap-2`.

- [ ] **Step 1:** Create component; SetupShell uses `<PageHeader backHref="/games" backLabel="Back to games" title={title} />`.
- [ ] **Step 2:** `npx astro check` → 0 errors; a setup page (e.g. `/games/501/setup`) header looks identical in `npm run dev`.
- [ ] **Step 3:** Commit `refactor(layout): extract PageHeader from SetupShell`.

### Task 6: `RoutineSummaryCard` + `RoutineStepList`

**Files:**
- Create: `app/src/components/layout/training/routines/RoutineSummaryCard.astro`
- Create: `app/src/components/layout/training/routines/RoutineStepList.astro`

**Interfaces:**
- Consumes: parent-scope `routine`, `canEdit()`, `durationLabel()`, `totalMinutes()`, `stepWeight`, `stepTone`, `stepTag`, `stepDuration` (Task 2); `chip` (Task 3); `Badge`.
- Produces: two prop-less components rendered inside `x-if="routine"`.

Summary card (spec §Summary card): eyebrow `x-text="canEdit() ? 'Personal routine' : 'Routine'"` with ready-gate eyebrow classes; name `font-display text-xl`; `Badge variant="accent" class="font-mono text-micro uppercase" x-text="durationLabel()"`; description `text-sm text-muted-foreground` with `x-show="routine.description" x-cloak`; timeline `flex h-2 gap-0.75` → `x-for` segments `class="rounded"` `:class="stepTone(index, 'bg')"` `:style="{ flexGrow: stepWeight(step) }"`; footer `flex justify-between font-mono text-micro uppercase text-muted-foreground` with `` `${routine.steps.length} steps` `` and `` `0:00 → ${totalMinutes()}:00` ``.

Step list (spec §Step list): `.section-eyebrow pt-2.5` "Steps"; `<ol class="glass flex flex-col rounded-2xl px-4 shadow-none">`; row `flex gap-3 py-3.5` `:class="index === 0 ? '' : 'border-t border-border'"`; ring `flex size-8 shrink-0 items-center justify-center rounded-full border-medium font-mono text-xs text-foreground` `:class="stepTone(index, 'border')"` `x-text="index + 1"`; body `min-w-0 flex-1`: top line name `font-display text-sm` + duration `ml-auto font-mono text-xs uppercase text-muted-foreground x-text="stepDuration(step)"`; description `text-xs text-muted-foreground` `x-show="step.exerciseDescription" x-cloak`; chip `<span class="chip uppercase" x-show="stepTag(step)" x-cloak x-text="stepTag(step)">`.

- [ ] **Step 1:** Create both; header JSDoc names the parent factory as in `RoutineDetail.astro`.
- [ ] **Step 2:** `npx astro check` → 0 errors.
- [ ] **Step 3:** Commit `feat(routines): summary card and step list`.

### Task 7: Compose `RoutineDetail.astro`

**Files:**
- Modify: `app/src/components/layout/training/routines/RoutineDetail.astro`

**Interfaces:**
- Consumes: Tasks 4–6.

- [ ] **Step 1:** Layout: `PageHeader backHref="/training" backLabel="Back to training" title="Routine"` outside `x-if`, `actions` slot wrapped in `<template x-if="canEdit()">` holding `IconBtn variant="destructive" ariaLabel="Delete routine" class="size-10" @click="requestDelete()"` (trash, `size-5`) then `IconBtn variant="glass" ariaLabel="Edit routine" class="size-10" @click="navigate(editPath())"` (pencil). Then `ErrorAlert`; inside `x-if="routine"`: `RoutineSummaryCard`, `RoutineStepList`, existing Start Button. Remove old heading, `<ol>`, Edit/Delete buttons. ConfirmDialog gets `confirmVariant="sheet-destructive"`; rest unchanged. Update file JSDoc.
- [ ] **Step 2:** `npx astro check` → 0 errors; `npm test` → all pass.
- [ ] **Step 3:** Manual in `npm run dev`: own routine (trash+edit, red confirm, delete works), system routine (no actions, eyebrow "ROUTINE"), bad `?routine=` id (header + error, no card), zero-tag step (no chip).
- [ ] **Step 4:** Commit `feat(routines): recompose routine detail page`.

### Task 8: Context maintenance, gates, PR

- [ ] **Step 1:** Run `context-maintenance` skill: Style Guide entry for `glass-destructive` / `chip` / new variants; context map + File Inventory rows for `PageHeader`, `RoutineSummaryCard`, `RoutineStepList`, `step-tag-set.ts`; decision entry only if warranted (e.g. PageHeader extraction).
- [ ] **Step 2:** Run `run-all-gates` + `validate-app`; report each pass/fail.
- [ ] **Step 3:** Discovered work → GitHub issues (`capturing-discovered-work`).
- [ ] **Step 4:** `finishing-a-dart-branch`: push `feat/routine-detail-redesign`, open PR.
