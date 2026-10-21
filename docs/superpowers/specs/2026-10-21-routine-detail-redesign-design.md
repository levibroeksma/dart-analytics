# Routine Detail redesign — design

Source: claude.ai/design project `cdea52ee-4746-4efb-b646-81448a40c033`, file `Routine Detail.dc.html` (sections 01 Screen, 02 New elements: Brand Guide 08.7 / 11.7 / 11.8).

## Intent

The routine detail page (`/training/routines/detail`) should show what a routine is before the player starts it: total time, how that time splits across steps, and each step in order. Today it's a plain heading + `<ol>` + full-width Start/Edit/Delete buttons. The design replaces that with a glass header, a summary card with a step timeline, a card of step rows, and a red destructive treatment for delete.

## Goals

1. **Destructive glass IconBtn variant**: raised glass tinted with the error hue (design 08.7). Used for the header trashcan.
2. **Routine summary card** (11.7): eyebrow, name, duration pill, description, and a timeline bar split into one segment per step, each sized by that step's duration. Footer: `N STEPS` left, `0:00 → MM:00` right.
3. **Routine step list** (11.8): one glass card with divided rows. Each row has a number ring toned like its timeline segment, the name (Michroma), the duration right-aligned (mono, `15 MIN`), the description, and one category tag pill.
4. **Destructive confirm action**: the ConfirmDialog confirm button can render as red glass (same treatment as goal 1, full-label `h-13 rounded-2xl` sheet shape).
5. **Page composition** in `RoutineDetail.astro`: header row, summary card, `STEPS` label, step list, Start button, and the confirm sheet.

## Non-goals

- No API or schema change. Tags come from the existing `/api/catalog-tags`.
- No change to delete/start behaviour, routing, or `routineDetail()` semantics beyond adding derived helpers.
- No Brand Guide page in the repo (the guide lives in the design project).
- The play page and the builder are untouched.

## Anti-goals

- Changing other ConfirmDialog call sites' look. The destructive confirm is opt-in.
- Hand-rolled `<button>` markup or arbitrary Tailwind values (`components/CLAUDE.md` style rules, D451). New colours become tokens or `@utility` in `global.css`.
- Persisting any derived value (timeline fractions, totals). All derived client-side.

## Decided

### Header row

- Grid `[88px_1fr_88px]`-equivalent (stock/token widths, not arbitrary): glass back link (chevron rotated 90°, `aria-label="Back to training"`, href `/training`), centred `Routine` title (`font-display text-lg`), right cluster.
- Right cluster only when `canEdit()`: trashcan `IconBtn variant="destructive"` (`ariaLabel="Delete routine"`, `@click="requestDelete()"`) **left of** pencil `IconBtn` in glass (`ariaLabel="Edit routine"`, navigates to `editPath()`). Both `size-10`.
- The side columns are fixed and equal width, so the title stays centred when the right cluster is hidden (system routines).
- *Call:* the header always renders, in loading, error and "No routine selected" states too, so a failed load still has a back link. Summary card, step list and Start stay inside `x-if="routine"`.
- Copy the back-link pattern from `components/layout/games/setup/SetupShell.astro`.
- Add a trashcan icon `app/src/icons/trash.svg` using the design's path (`M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3`, stroke 2, round caps/joins, `currentColor`, matching the repo's icon file format). The existing `delete.svg` is a backspace glyph and is not reused.
- The existing full-width Edit/Delete buttons are removed.

### Destructive glass

- New `@utility glass-destructive` in `global.css`. Design values: background `radial-gradient(at 50% 0%, oklch(62% 0.17 28 / 0.18), oklch(62% 0.17 28 / 0.32) 85%)`, border-top `oklch(72% 0.15 30 / 0.55)`, border-bottom `oklch(68% 0.15 30 / 0.25)`, shadow `0 2px 8px oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(80% 0.12 30 / 0.2)`, `backdrop-blur-md`. Mirrors `glass-button`'s structure.
- Foreground: icon `oklch(78% 0.13 30)`, label `oklch(90% 0.05 30)`. Expose as semantic tokens (e.g. `--error-glass-icon`, `--error-glass-foreground`) alongside the existing `--error*` set.
- `IconBtn.astro` gains `variant="destructive"` → `glass-destructive` + icon colour token, no `border-3`.
- `Button.astro` gains `variant="sheet-destructive"` → `h-13 rounded-2xl text-control glass-destructive` + label colour token (same shape as `sheet-raised`).

### ConfirmDialog

- New optional prop `confirmVariant?: "sheet-raised" | "sheet-destructive"` (default `"sheet-raised"`), forwarded to the confirm `Button`. Routine delete passes `"sheet-destructive"`. Title, description, `InlayRow` context and cancel button stay as they are.

### Summary card (`RoutineSummaryCard.astro`, new, under `components/layout/training/routines/`)

- `glass` card, `rounded-2xl p-4 gap-3` (20px radius per design → nearest stock/token).
- Eyebrow: `PERSONAL ROUTINE` when `canEdit()`, else `ROUTINE` (mono, 10px, tracking `.14em`, accent-light).
- Name: Michroma 20px. Duration pill: accent-tinted (`accent/16` bg, `accent/50` border, mono 11px uppercase), text from `durationLabel()` uppercased (`45 MIN`). Check whether `Badge.astro` can express this before adding markup.
- Description: 13px muted, hidden when null.
- Timeline: flex row, `gap-0.75`, `h-2`. One segment per step, `rounded`, `flex-grow` = the step's weight (below), background = the step's tone.
- Footer: `N STEPS` / `0:00 → {total}:00` (mono 10px, muted).

### Step list (`RoutineStepList.astro`, new; the existing `RoutineStepRow.astro` is the builder's and stays as is)

- `STEPS` label above (mono 11px, tracking `.14em`, muted, `pt-2.5 px-1`).
- `glass` card `rounded-2xl px-4`, `<ol>` of rows; each row `flex gap-3 py-3.5`, divider `border-t border-white/8` on every row but the first.
- Number ring: `size-8 rounded-full border-[1.5px]`-equivalent (token/utility, not arbitrary). Only the border takes the step's tone (white/35 too). No fill; the number is mono 12px in `text-foreground` (white), per the design.
- Name `font-display` 14px; duration right, mono 11px uppercase from `stepDuration(step)` (`15 MIN` / `3 ROUNDS`).
- Description 12px muted; omitted when null.
- One tag pill (mono 10px, `bg-white/7`, `rounded-md px-1.75 py-0.5`); omitted when no tag.

### Tones

`TONES = [accent, accent/70, accent/45, white/35]`, step `i` gets `TONES[i % 4]`. Expose as `stepTone(index)` returning a class name (static class list so Tailwind sees them), used by both the timeline segment and the number ring.

### Duration sizing

- `stepWeight(step)`: `durationValue` when `durationTypeKey === "MINUTES"`, else `1` (a minimal segment; the API only accepts MINUTES today, D321).
- Total stays `durationLabel()` (MINUTES-only sum, as now).
- Sizing via inline `:style="{ flexGrow: stepWeight(step) }"`. This is a runtime value, not a Tailwind arbitrary class.

### Category tag

- `routineDetail()` also fetches `fetchCatalogTags()` in parallel with `getRoutine()`. A failed tags fetch sets `catalogTags = null` and does **not** set `error`.
- `stepTag(step)`: tag set = `step.exerciseTypeKey === "GAME" && step.gameTypeKey ? tags.games[step.gameTypeKey]?.routineStep : tags.exercises[step.exerciseTypeKey]`, same lookup as `catalog-groups.ts`. Extract a shared helper into `lib/training/routines/` rather than duplicating it. Result: `cardTags(set, "exercise")[0]?.name ?? null`, rendered uppercase.

### Start

- Keep the existing Start `Button` (`variant="primary"`, `grow`, `loadingExpr="starting"`, `@click="start()"`) below the step list. The design's slide-to-start is **not** adopted: the play page's `RoutineReadyGate` already has the slide that unlocks audio, and a slide here would mean two slides in a row (user decision, 2026-10-21).

### Persistence check (Hard Invariant)

UI-only. Reads `RoutineExecutionData` via the existing API (view-backed). No new state is captured or stored.

## Tests (TDD, `app/CLAUDE.md`)

Unit tests in the `routine-detail.data` test file for `stepWeight`, `stepTone`, `stepTag` (game step, exercise step, missing set, `catalogTags === null`), and for `init` still loading the routine when the tags fetch rejects. The tag-set lookup helper gets its own test if extracted. No Astro component test runner (D101).

## Left to the builder

- Exact token/utility names, and stock-step approximations of the design's px values.
- Whether the duration pill is a `Badge` variant or local markup.
- Wiring `lib/training/routines/types.ts` (`RoutineDetailContext`) for the new fields and helpers.
- Context-maintenance updates (Style Guide entry for destructive glass, context map / File Inventory rows for new components, decision entry if warranted).
