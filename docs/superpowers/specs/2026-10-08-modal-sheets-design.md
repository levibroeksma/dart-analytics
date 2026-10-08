# Modal sheets — design

Date: 2026-10-08 · Status: approved in chat · Source: Claude Design `Modals.dc.html` (project cdea52ee-4746-4efb-b646-81448a40c033)

## Intent

Restyle every modal in the app to the Claude Design "Modals" reference: a bottom glass sheet over a scrim, built only from D428 brand tokens. One shared shell; consumers swap content, not chrome.

## Decisions (from chat)

- Approach A: shared sheet primitives; every modal consumes them.
- Greys absent from the token set snap to the nearest token — no new tokens:
  72%/75% → `muted-foreground` (70), 80% → `soft-foreground` (78), 60%/62% → `muted` (55).
- QuickSubtract "Session complete" (no frame) uses the Results sheet.
- The 10 non-501 result modals map onto the 501 solo / 1v1 patterns by analogy.
- GrowingCard (ReplayCard) is out of scope — not a modal.
- Delete confirm uses the raised button like every confirm (per frame); `confirmVariant` is removed.

## Token map (design value → token)

| Design | Token |
| --- | --- |
| backdrop `oklch(0 0 0 / .6)` | `bg-scrim` |
| sheet: radius 32, radial white 5→10 %, border-y white/25, blur 16, shadow `0 24px 60px` | `glass-sheet` |
| inlay `oklch(0 0 0 / .35)` + inset shadow | `inset-well` |
| muted button `oklch(0 0 0 / .2)` + inset shadow | `inset-well-muted` |
| raised button (radial 8→16 %, border 35/15, blur 8) | `glass-button` |
| title Michroma 20 | `font-display text-xl` |
| overline JetBrains Mono 11, `oklch(80% .13 237)` | `font-mono text-eyebrow text-accent-bright` |
| success pill `oklch(72% .16 155)` | `text-success` / `bg-success` |
| error text `oklch(68% .15 30)` | `text-error` |
| accent bar | `bg-accent` |

## 1. Primitives

- **`ui/Modal.astro`** → sheet shell.
  - Backdrop: `fixed inset-0 z-50 flex flex-col items-center justify-end p-4 bg-scrim`; `role="dialog"`, `aria-modal`, `aria-labelledby`, optional `aria-describedby` (unchanged).
  - Panel: `glass-sheet mb-3 flex w-full max-w-lg flex-col items-center gap-5 px-5 pt-3 pb-5`; first child a decorative grabber (`h-[5px] w-10 rounded-full bg-white/25`, `aria-hidden`).
  - New optional `overline` prop (eyebrow above the title) and `header` slot; default + `footer` slots kept.
  - Dismiss contract unchanged (Escape + backdrop → `onDismiss`; throws when dismissible without it).
  - Motion: opacity fade + slide-up, 150–200 ms `ease-out` (style guide §motion).
- **`forms/Button.astro`**: add variants
  - `sheet-muted`: `inset-well-muted text-muted-foreground`
  - `sheet-raised`: `glass-button text-foreground`
  - both: `h-13 rounded-2xl text-[15px]`, used with `grow`.
- **`ui/SheetActions.astro`** (new): `flex w-full gap-2.5`; muted left, raised right.
- **`ui/InlayRow.astro`** (new): `inset-well flex h-13 w-full items-center justify-between gap-3 rounded-2xl px-4`; left slot = dot-separated meta (`text-sm font-medium text-soft-foreground`, dots `bg-muted`), optional right value (`font-display text-lg`).

## 2. Consumers

**Confirm** — `ui/ConfirmDialog.astro`: centred `font-display text-xl` title, `text-muted-foreground` description, optional `context` slot (InlayRow), `SheetActions` (cancel `sheet-muted`, confirm `sheet-raised`). Call sites (context data from each site's Alpine state):
ExitModal, RoutineDetail (delete), 501 / 121 / TUOD / score-training play, routines play ×3.

**Session & setup** — inner markup restyled to frames (inlay segments / rows / fields, SheetActions):
ContinueSessionModal, CheckoutConfirm, GuestNameModal, OpponentChooserModal (+ DartBot difficulty step), BlockedStepModal, OpenRoutineModal.

**Results** — `games/ResultsModalShell.astro` rebuilt on Modal (gains `role="dialog"`, Escape). Patterns:
- solo: overline (`<GAME> · <LABEL>`), title, hero stat (`font-display` 52 px, `text-shadow-hero`) + side stats, 2×2 `inset-well` tiles, optional success pill.
- 1v1: score, legs bars (`bg-white/15` track, `bg-accent` fill), comparison ledger in an `inset-well`.
- actions: "Back to games" `sheet-muted`, "Rematch" `sheet-raised`; ErrorAlert kept.
- consumers: all 11 `result-modals/*Results.astro` (mapped by analogy), `RoutineSummaryModal`, trivia `QuickSubtract` finished overlay.

**Expanding** — `ui/ExpandingModal.astro`: toggle = 44 px round `glass-button` with the plus icon; open state renders the standard Modal sheet (no in-place growth). Consumers RoutineFormModal, ScheduleFormModal: inputs and list rows `inset-well rounded-2xl`, section headers `font-display` + mono count eyebrow, Cancel muted / Save raised.

**Out of scope**: GrowingCard, Select popover, BottomNav, debug strip.

## 3. Testing & docs

- TDD; source-reading vitest tests (pattern: `tests/lib/ui/brand-tokens.test.ts`):
  - Modal panel uses `glass-sheet`, backdrop `bg-scrim`, keeps dialog ARIA.
  - No `.astro` under `src/` contains `bg-black/50`, `bg-black/70`, or a hand-rolled `fixed inset-0` overlay outside `ui/Modal.astro` / `ui/ExpandingModal.astro` (allow-list: GrowingCard, Select, BottomNav, GameLayout debug).
  - Button `sheet-muted` / `sheet-raised` map to their utilities.
  - ConfirmDialog has no `confirmVariant`.
- Gates: validate-app (astro check, tests, fallow), run-all-gates.
- Visual check: 390 px screenshots vs frames.
- Docs: style guide §dialogs + surface table (sheet replaces centred panel), new decision D429 in `decisions/frontend/style.md`, context-maintenance.

## Persistence

UI-only; no schema, state shape, or `turns`/`darts` mapping change.
