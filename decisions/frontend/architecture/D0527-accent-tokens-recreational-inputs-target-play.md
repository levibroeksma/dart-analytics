---
id: D0527
status: accepted
date: 2026-11-05
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Accent tokens, recreational inputs, target play screens, results parts and replay test helpers are shared

## Context and Problem Statement
the CSS, `.astro` and test-helper clone groups left after D525. Variation is props, slots or a callback, so no flags.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`global.css` gains `--gradient-accent-feature`, `--shadow-accent-glow` and `--shadow-accent-glow-halo` (`.feature-card`, `.home-feature-card`, `.accent-orb`, `.accent-orb-halo`, `glass-blue`; glow lengths in rem), and `@utility deck-card` sets `--deck-return-transition`, which `deck-entering`/`deck-exiting` use; each keeps its own `prefers-reduced-motion` block. New components under `components/layout/games/`: `TargetTapRecreationalInput` (Mickey Mouse, Tactics), `NumberPadRecreationalInput` (Killer, Follow the Leader; bottom row as slot), `RoundTargetPlayScreen` (Baseball, Shanghai; `roundLabel`), `AttemptTargetPlayScreen` (121, Ten Up One Down; `tiles` and `finishConfirm`, the game's finish-confirm flag in the four disabled expressions), `OutOrderRow` (Killer, Follow the Leader results) and `DartsToCloseSummary` (Mickey Mouse, Tactics results). Test helpers: `tests/lib/stats/replay-turns.ts` `replayTurns`, an unexported `playSteps` in `replay-step-games.ts`, and `tests/integration/fixtures/rolled-back.ts` `rolledBack(sql, body)` (testing domain, `decisions/testing.md`, cited here so the phase has one record).", because the CSS, `.astro` and test-helper clone groups left after D525. Variation is props, slots or a callback, so no flags.

### Consequences
proven by a resolved-CSS diff of the built bundle (custom properties expanded) and a built-HTML diff of every page after normalising the per-build `paused-play-*` SVG ids; suites keep their test counts. No visual change, so no design sync (D524). Accepted differences: the glow lengths are rem, so they scale with the browser font size (the app sets no root font-size, so 1rem = 16px by default); the tokens resolve `--accent` at `:root`, so an element under `.tab-wrapper` (the only `--accent` override, no consumer today) would differ. Left for Phase 4c: the engine groups, `validateBatch` (#1184), the `statistics.repository.ts` self-clone and a `respond()` route helper. Baseline 17 → 7 rows. Plan: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4b.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D513, D524.
