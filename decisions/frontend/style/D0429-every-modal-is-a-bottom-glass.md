---
id: D0429
status: accepted
date: 2026-10-08
origin: contemporaneous
original-date:
tags: [frontend/style, style, token, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Every modal is a bottom glass sheet via `Modal.astro`

## Context and Problem Statement
one chrome for every dialog removes per-modal overlays and keeps new modals on the tokens.
Copy, wording and content follow the mock where it exists (button labels, titles, overlines, 501 match summary with hero, legs bars and winner-tinted ledger, routine summary ledger, segmented checkout pills, form rows); `--text-shadow-glow` is the accent hero glow, and `InlayRow` is the context row. Consequences: destructive confirms no longer show a coral fill; the 501 summary drops 120+ (and 180s on the solo view) as the mock does. Deferred (GitHub issue): context rows needing per-game session data (Exit, finish confirms, Continue session). `.astro` carries no unit test (D101); the gate and `brand-tokens.test.ts` pin the guarantees.

## Decision Drivers
* Restyle every modal to the Claude Design `Modals.dc.html` reference: a bottom glass sheet over a scrim (spec, Intent).
* Build the sheet only from the D428 brand tokens (spec, Intent).
* Use one shared shell, so consumers swap content, not chrome (spec, Intent).

## Considered Options
* Approach A: shared sheet primitives that every modal consumes. The spec records it as chosen in chat and names no other approach (spec, Decisions).

## Decision Outcome
Chosen option: "all modals follow the Claude Design `Modals.dc.html` mock. `Modal.astro` is the one shell: `bg-scrim` backdrop, `glass-sheet` panel with a grabber, `header`/default/`footer` slots and an optional `overline`. `SheetActions` holds the action pair; `Button` gains `sheet-muted` (`inset-well-muted`) and `sheet-raised` (`glass-button`). Confirm, session, setup, results, routine summary, trivia and expanding-form dialogs all render through it; `ExpandingModal` becomes a corner `sheet-raised` toggle that opens the same sheet. Results use `StatTile` and an `inset-well` comparison ledger. Greys the tokens lack snap to the nearest token (72/75 → `muted-foreground`, 80 → `soft-foreground`, 60/62 → `muted`). `ConfirmDialog` drops `confirmVariant`: confirms use the raised button. `check-style-tokens.sh` allows `fixed inset-0` and `role="dialog"` only in `ui/Modal.astro`. New token: `--animate-sheet-in`.".

### Consequences
* Neutral, because the plan defers the context rows and the 1v1 legs bars: no call site has that data wired, and an unused component fails the fallow gate (plan, Plan-time amendments). Commit `0c14b2e5` nonetheless adds `InlayRow.astro`; only the per-game context rows stay deferred.
* Neutral, because `RoutineSummaryModal` and `QuickSubtract` go onto `Modal` directly, not onto `ResultsModalShell`, which neither fits (plan, Plan-time amendments).
* Neutral, because `GrowingCard` stays out of scope, as it is not a modal (spec, Decisions).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-style-tokens.sh` confines full-viewport overlays and `role="dialog"` to `ui/Modal.astro`. The plan replaces the spec's source-reading vitest tests for `.astro` with that gate rule (D101).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-08
Referenced by D0455's `Supersedes:` line.
Referenced by D0477's `Supersedes:` line.
Referenced by D0526's `Supersedes:` line.

* Commit `0c14b2e5` (2026-10-08): origin of the existing Decision Outcome text; its message lists the shell, primitives and gate rule. It rebuilt no section here.
* `docs/superpowers/specs/2026-10-08-modal-sheets-design.md` (Intent, Decisions, Testing & docs): rebuilt Decision Drivers, Considered Options and Consequences.
* `docs/superpowers/plans/2026-10-08-modal-sheets.md` (Plan-time amendments): rebuilt Consequences and Confirmation.
