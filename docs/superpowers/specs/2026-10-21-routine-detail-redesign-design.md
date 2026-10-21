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

- **New `PageHeader.astro`** (`components/layout/`), extracted from the inline header in `components/layout/games/setup/SetupShell.astro`: props `backHref`, `backLabel`, `title`, optional `actions` slot. It holds the glass back link (`glass-button size-10 rounded-full`, `chevron-down.svg` rotated 90°) and the centred title (`font-display text-lg tracking-wide`). `SetupShell` switches to it, so the back link + title markup exists once.
- Grid: with no `actions` slot, keep SetupShell's current `grid-cols-[40px_1fr_40px]` (no visual change there). With `actions`, use stock `grid-cols-3`: equal columns keep the title centred and fit two 40px buttons. Branch on `Astro.slots.has("actions")`.
- Detail page: `<PageHeader backHref="/training" backLabel="Back to training" title="Routine">`.
- `actions` slot, rendered only when `canEdit()`: trashcan `IconBtn variant="destructive"` (`ariaLabel="Delete routine"`, `@click="requestDelete()"`) **left of** the existing `pencil.svg` in a new `IconBtn variant="glass"` (`glass-button text-foreground`, `ariaLabel="Edit routine"`, `@click="navigate(editPath())"`). Both `size-10`.
- *Call:* the header always renders, in loading, error and "No routine selected" states too, so a failed load still has a back link. Summary card, step list and Start stay inside `x-if="routine"`.
- Add a trashcan icon `app/src/icons/trash.svg` using the design's path (`M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3`, stroke 2, round caps/joins, `currentColor`, matching the repo's icon file format). The existing `delete.svg` is a backspace glyph and is not reused.
- The existing full-width Edit/Delete buttons are removed.

### Destructive glass

- No existing error glass: `--error*` tokens and `btn-error` are solid fills. New `@utility glass-destructive` in `global.css`. Design values: background `radial-gradient(at 50% 0%, oklch(62% 0.17 28 / 0.18), oklch(62% 0.17 28 / 0.32) 85%)`, border-top `oklch(72% 0.15 30 / 0.55)`, border-bottom `oklch(68% 0.15 30 / 0.25)`, shadow `0 2px 8px oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(80% 0.12 30 / 0.2)`, `backdrop-blur-md`. Mirrors `glass-button`'s structure.
- Foreground: icon `oklch(78% 0.13 30)`, label `oklch(90% 0.05 30)`. Expose as semantic tokens (e.g. `--error-glass-icon`, `--error-glass-foreground`) alongside the existing `--error*` set.
- `IconBtn.astro` gains `variant="destructive"` → `glass-destructive` + icon colour token, no `border-3`.
- `Button.astro` gains `variant="sheet-destructive"` → `h-13 rounded-2xl text-control glass-destructive` + label colour token (same shape as `sheet-raised`).

### ConfirmDialog

- New optional prop `confirmVariant?: "sheet-raised" | "sheet-destructive"` (default `"sheet-raised"`), forwarded to the confirm `Button`. Routine delete passes `"sheet-destructive"`. Title, description, `InlayRow` context and cancel button stay as they are.

### Summary card (`RoutineSummaryCard.astro`, new, under `components/layout/training/routines/`)

- `glass rounded-2xl p-4 flex flex-col gap-3`, the same surface as the `/training` routine card.
- Eyebrow: `PERSONAL ROUTINE` when `canEdit()`, else `ROUTINE`. Reuse the ready gate's eyebrow classes (`font-mono text-eyebrow font-semibold uppercase tracking-widest text-accent-bright`, `RoutineReadyGate.astro`).
- Name: Michroma 20px. Duration pill: existing `Badge variant="accent"` (already used on this page) with `class="font-mono text-micro uppercase"`, `x-text="durationLabel()"`. Badge's accent border is `/25` against the design's `/50`; the existing Badge wins over a pixel match.
- Description: 13px muted, hidden when null.
- Timeline: flex row, `gap-0.75`, `h-2`. One segment per step, `rounded`, `flex-grow` = the step's weight (below), background = the step's tone.
- Footer: `N STEPS` / `0:00 → {total}:00` (mono 10px, muted).

### Step list (`RoutineStepList.astro`, new; the existing `RoutineStepRow.astro` is the builder's and stays as is)

- `STEPS` label above: existing `.section-eyebrow pt-2.5`, as on `/training`'s `ROUTINES` label.
- Card: `glass flex flex-col rounded-2xl px-4 shadow-none`, same as `/training`'s routine card. `<ol>` of rows, each `flex gap-3 py-3.5` with `border-t border-border` on every row but the first, the same row rhythm as `RoutineRow.astro`.
- Number ring: `size-8 rounded-full border-medium` (existing 1.5px utility). Only the border takes the step's tone (white/35 too). No fill; the number is mono 12px in `text-foreground` (white), per the design.
- Name `font-display` 14px; duration right, mono 11px uppercase from `stepDuration(step)` (`15 MIN` / `3 ROUNDS`).
- Description 12px muted; omitted when null.
- One tag chip, omitted when there's no tag. The design's chip is exactly the neutral chip `RoutineRow.astro` already writes out twice (`rounded-md bg-white/7 px-1.75 py-0.5 font-mono text-micro font-semibold text-chip-foreground`). Promote it to `@utility chip` in `global.css`, switch both `RoutineRow` copies to it, and use it here. `Tag.astro` is **not** used: its pills are axis-coloured and outlined, but the design's chip is neutral.

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

## Reuse audit (2026-10-21)

| Need | Source |
| ---- | ------ |
| Back link + title | `PageHeader.astro`, new: extracted from `SetupShell.astro`, which adopts it |
| Edit / Delete buttons | `IconBtn.astro`, adding `glass` and `destructive` variants |
| Confirm sheet | `ConfirmDialog.astro` + `InlayRow.astro` as-is, adding `confirmVariant` |
| Red sheet button | `Button.astro`, adding `sheet-destructive` |
| Duration pill | `Badge.astro` accent |
| Card surfaces | `glass` utility (+ `/training` card classes) |
| `STEPS` label | `.section-eyebrow` |
| Number ring border | `border-medium` |
| Tag chip | new `@utility chip`, deduplicating `RoutineRow.astro`'s two copies |
| Tag lookup | shared helper extracted from `catalog-groups.ts`, plus `cardTags` |
| Start | `Button.astro` primary, unchanged |

Genuinely new: `RoutineSummaryCard.astro` (timeline bar), `RoutineStepList.astro` (`RoutineReadyGate`'s rows are inset wells with no description or tag, and `RoutineStepRow` is the builder's editable row, so neither fits), `glass-destructive` + its two colour tokens, and `trash.svg`.

## Tests (TDD, `app/CLAUDE.md`)

Unit tests in the `routine-detail.data` test file for `stepWeight`, `stepTone`, `stepTag` (game step, exercise step, missing set, `catalogTags === null`), and for `init` still loading the routine when the tags fetch rejects. The tag-set lookup helper gets its own test if extracted. No Astro component test runner (D101).

## Left to the builder

- Exact token/utility names, and stock-step approximations of the design's px values.
- Wiring `lib/training/routines/types.ts` (`RoutineDetailContext`) for the new fields and helpers.
- Context-maintenance updates (Style Guide entry for destructive glass, context map / File Inventory rows for new components, decision entry if warranted).
