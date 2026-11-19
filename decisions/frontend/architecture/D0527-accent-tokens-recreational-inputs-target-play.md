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

# Accent tokens, recreational inputs, target play screens, results parts and replay test helpers are shared

## Context and Problem Statement
the CSS, `.astro` and test-helper clone groups left after D525. Variation is props, slots or a callback, so no flags. The phase 4b plan targets 10 of the 17 baseline rows: `global.css`, six `.astro` pairs and the test helpers.

## Decision Drivers
* No visual change: rendered markup, class strings and computed CSS stay identical.
* D524 sets the design-sync rule; the owner skips it for phases with no visual change, and the plan asks again before the PR.
* Per-copy differences must not leak between games.

## Considered Options
* Fold each group into a shared token, component or test helper that takes props, slots or a callback (chosen).
* Add per-game flags to shared components.
* Leave the groups in the clone baseline.

## Decision Outcome
Chosen option: "`global.css` gains `--gradient-accent-feature`, `--shadow-accent-glow` and `--shadow-accent-glow-halo` (`.feature-card`, `.home-feature-card`, `.accent-orb`, `.accent-orb-halo`, `glass-blue`; glow lengths in rem), and `@utility deck-card` sets `--deck-return-transition`, which `deck-entering`/`deck-exiting` use; each keeps its own `prefers-reduced-motion` block. New components under `components/layout/games/`: `TargetTapRecreationalInput` (Mickey Mouse, Tactics), `NumberPadRecreationalInput` (Killer, Follow the Leader; bottom row as slot), `RoundTargetPlayScreen` (Baseball, Shanghai; `roundLabel`), `AttemptTargetPlayScreen` (121, Ten Up One Down; `tiles` and `finishConfirm`, the game's finish-confirm flag in the four disabled expressions), `OutOrderRow` (Killer, Follow the Leader results) and `DartsToCloseSummary` (Mickey Mouse, Tactics results). Test helpers: `tests/lib/stats/replay-turns.ts` `replayTurns`, an unexported `playSteps` in `replay-step-games.ts`, and `tests/integration/fixtures/rolled-back.ts` `rolledBack(sql, body)` (testing domain, `decisions/testing.md`, cited here so the phase has one record).", because the CSS, `.astro` and test-helper clone groups left after D525. Variation is props, slots or a callback, so no flags.

### Consequences
proven by a resolved-CSS diff of the built bundle (custom properties expanded) and a built-HTML diff of every page after normalising the per-build `paused-play-*` SVG ids; suites keep their test counts. No visual change, so no design sync (D524). Accepted differences: the glow lengths are rem, so they scale with the browser font size (the app sets no root font-size, so 1rem = 16px by default); the tokens resolve `--accent` at `:root`, so an element under `.tab-wrapper` (the only `--accent` override, no consumer today) would differ. Left for Phase 4c: the engine groups, `validateBatch` (#1184), the `statistics.repository.ts` self-clone and a `respond()` route helper. Baseline 17 → 7 rows. Plan: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4b.md`.

* Good, because the baseline fell from 17 to 7 rows with no visual change.
* Neutral, because the tokens resolve `--accent` at `:root`, so an element under `.tab-wrapper` would differ; no consumer exists today.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
A resolved-CSS diff of the built bundle and a built-HTML diff of every page prove the change. Suite test counts stay equal. `scripts/check-dupes.sh` shows the lowered baseline.

## Pros and Cons of the Options
### Shared tokens, components and helpers (chosen)

* Good, because variation is carried by props, slots or a callback, so no flags are needed.

### Per-game flags

* Bad, because the Context rules them out.

### Leave the groups

* Bad, because the ratchet keeps those rows until the groups are extracted.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D513, D524.

* `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4b.md` (Goal, Global Constraints, Review Focus, Baseline, Task 1): rebuilt Context, Decision Drivers and Confirmation.
* Commit `a9d88781` (PR #1239, 2026-11-05; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
* Applied in: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4c.md`.
