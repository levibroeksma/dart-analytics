---
id: D0249
status: accepted
date: 2026-08-30
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, state, x-show]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 6 games' `resultsSnapshot` promoted to `{ ...; seats: XSeatResult[] }`; results-modal titles extracted into `resultsTitle()` + shared `matchWinnerName()`

## Context and Problem Statement
`docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` wired 1v1 support into every engine, but its own scope/touch-list never named the snapshot-shape change these 6 games' results modals actually needed at the data layer — so they kept computing stats for the owning player only, silently dropping the opponent's data before it ever reached the UI, not merely failing to render it. Separately, every modal's title ternary had grown an unreadable, untested inline expression (`docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md` Issue 2) repeating the same `$store.game.seats.find((s) => s.sideKey === winningSideKey)?.displayName` lookup nine times over.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Around the Clock, Bob's 27, Doubles Training, 121, Singles Training, and Ten Up One Down's `*ResultsSnapshot` types are promoted from flat/single-seat shapes to `{ ...; seats: XSeatResult[] }` — one stats entry per seat, computed for every seat in the match — matching the shape Five Oh One, Score Training, and Shanghai already used. Each of the 9 games' `*PlayContext` also gains a `resultsTitle(this: XPlayContext): string` method, implemented in its `*-play.data.ts`, replacing the inline `x-text` ternary every results modal (`components/layout/games/result-modals/*.astro`) previously carried; each composes the new shared `matchWinnerName(seats, winningSideKey)` helper (`app/src/lib/game/match-result-text.ts`) with that game's own title wording. Singles Training's `resultsTitle()` reads the owner's own per-seat `resultsSnapshot.seats[…].status` rather than a top-level field, since its HARD/EXTREME elimination can resolve one seat WON and the other LOST from the same match. Bob's 27's modal collapses its prior two-sibling-`<h2>`/`x-show` pattern into the same single `x-text="resultsTitle()"` call as every other game, a deliberate, spec-approved change to its pre-completion default text (was a static "Match Summary", now evaluates the same ternary as post-completion and falls through to "Winner!" since Bob's 27 has no tie/no-winner branch).".

### Consequences
`SinglePlayerSummary.astro`/`ComparisonSummary.astro` (D-adjacent, see `docs/architecture/07-Frontend/08-Component-Inventory.md`) and `resultsTitle()`/`matchWinnerName()` are now the canonical results-modal patterns — a new game's results modal uses both from the start rather than hand-rolling either. Bob's 27's 1v1 completion path also picked up a latent fix in the same pass: `status` now reads the match-level `state.status` instead of any one seat's own in-progress status, so a seat that wins purely because the opponent busted is no longer misreported as `"LOST"`. See Pattern 18, `docs/architecture/04-Architecture-patterns.md`, and `docs/architecture/07-Frontend/03-Alpine-Patterns.md`'s Results-Modal Title Pattern section.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-30
