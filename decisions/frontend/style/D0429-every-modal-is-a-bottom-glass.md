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
<!-- backfill: pending -->

# Every modal is a bottom glass sheet via `Modal.astro`

## Context and Problem Statement
one chrome for every dialog removes per-modal overlays and keeps new modals on the tokens.
Copy, wording and content follow the mock where it exists (button labels, titles, overlines, 501 match summary with hero, legs bars and winner-tinted ledger, routine summary ledger, segmented checkout pills, form rows); `--text-shadow-glow` is the accent hero glow, and `InlayRow` is the context row. Consequences: destructive confirms no longer show a coral fill; the 501 summary drops 120+ (and 180s on the solo view) as the mock does. Deferred (GitHub issue): context rows needing per-game session data (Exit, finish confirms, Continue session). `.astro` carries no unit test (D101); the gate and `brand-tokens.test.ts` pin the guarantees.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "all modals follow the Claude Design `Modals.dc.html` mock. `Modal.astro` is the one shell: `bg-scrim` backdrop, `glass-sheet` panel with a grabber, `header`/default/`footer` slots and an optional `overline`. `SheetActions` holds the action pair; `Button` gains `sheet-muted` (`inset-well-muted`) and `sheet-raised` (`glass-button`). Confirm, session, setup, results, routine summary, trivia and expanding-form dialogs all render through it; `ExpandingModal` becomes a corner `sheet-raised` toggle that opens the same sheet. Results use `StatTile` and an `inset-well` comparison ledger. Greys the tokens lack snap to the nearest token (72/75 → `muted-foreground`, 80 → `soft-foreground`, 60/62 → `muted`). `ConfirmDialog` drops `confirmVariant`: confirms use the raised button. `check-style-tokens.sh` allows `fixed inset-0` and `role="dialog"` only in `ui/Modal.astro`. New token: `--animate-sheet-in`.".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-08
Referenced by D0455's `Supersedes:` line.
Referenced by D0477's `Supersedes:` line.
Referenced by D0526's `Supersedes:` line.
