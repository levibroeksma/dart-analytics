---
id: D0442
status: accepted
date: 2026-10-10
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Homepage resume deck replaces the static resume card

## Context and Problem Statement
the static card of D425 showed sample data and a hard-coded link, and the design's multi-session frame needs one card per game. Config alone gives a useful summary for any session; live turns only exist on the device that holds the session.

## Decision Drivers
* `GET /api/sessions/active` listed every active session but carried only ids, modes, `gameTypeName`, `rulesetVersionKey` and `startedAt` (spec "Constraints found").
* Game turns reach the server only at session end, so a server fold of an active session sees no turns (spec "Constraints found").
* `v_active_sessions` exposes neither configuration nor routine membership (spec "Constraints found").
* The design's `home-multi` frame shows several games in progress (spec header, Goal).

## Considered Options
* Replace the static `ResumeGameCard` with a data-backed resume deck, one card per active game session (chosen; spec "Goal").
* Fold routine membership and configuration into `v_active_sessions` in a later migration. The spec defers this to a follow-up issue because `app/src/db/schema.ts` is off-limits in this workspace (spec § 1).
* Keep the static card (status quo).

## Decision Outcome
Chosen option: "the homepage lists every active non-routine game session, newest first, in a stacked `ResumeSessionDeck` (`CardStack` + `DeckPager`, factory `resumeDeck()`). Progress is hybrid. `GET /api/sessions/active` returns a config-derived `progress` summary for every session, built by `summarizeProgress()` (`modules/game/session-progress.module.ts`). The client recomputes it from `$store.game` for the one session held locally. Game turns upload only at session end, so a server fold of an active session sees none. The API flags `isRoutineStep` and the deck filters those out, while `resumeTarget` skips them; routine steps are resumed from their routine (`resumeOpenRoutine`), not from the deck. `findActiveSessions` reads the routine flag and configuration by joining `exercise_sessions` and `exercise_configurations` onto `v_active_sessions` at runtime, because `v_active_sessions` is not changed and `schema.ts` is not editable in this workspace. Resume always links to the game card's setup route.".

### Consequences
supersedes only the always-visible static resume card of D425; the rest of D425 stands. No migration. A session started on another device shows its config summary, not live progress, until incremental fact upload exists (#815 stays open). Cards for sessions not held on this device read "Start over" with a "Progress is on another device" note, because opening setup abandons them (#897); live cross-device progress depends on #815. `/games` `ResumeSessionCard` still has its own static card. The runtime join stays until `is_routine_step` and configuration are folded into the view. New tokens `--stack-1`, `--stack-2`, `--deck-top-from`, `--deck-top-to`, class `.deck-top-card`, keyframes `deck-out`/`deck-rise`/`deck-in` plus `deck-fade-*` for reduced motion. `.astro`/CSS carry no unit test (D101); the factory, summary and sort/filter helpers are tested. Spec `docs/superpowers/specs/2026-10-10-home-resume-deck-design.md`.
* Bad, because a session started on another device shows only its config summary, not live progress, until incremental fact upload exists (spec "Out of scope"; #815).

### Confidence
Rationale unknown — no source found.

### Revisit When
* Incremental fact upload during play exists (#815). The spec lists it as out of scope and as the precondition for live progress of sessions not held locally ("Out of scope").
* A later migration folds `is_routine_step` and configuration into `v_active_sessions` (spec § 1 follow-up issue).

### Confirmation
Spec § 4 lists the tests. They exist today: `app/tests/modules/game/session-progress.module.test.ts`, `app/tests/lib/utils/started-ago.test.ts` and `app/tests/lib/game/resume-deck.data.test.ts`. `.astro` and CSS carry no unit test (D101).

## Pros and Cons of the Options
* Hybrid progress, credited to the chosen option: the server returns a config-derived summary for every session, and the client recomputes it from live turns for the session held in `$store.game` (spec "Decisions" table).
* Runtime join in `findActiveSessions`, credited to the chosen option: the view stays unchanged and no migration is needed (spec § 1).
* Folding the columns into the view, credited to that option: removes the runtime join, which stays until then (spec § 1).

## Evidence / More Information
Decided: 2026-10-10
Supersedes: D425 (static resume card only).
Referenced by D0534's `Supersedes:` line.
Referenced by D0455's `Supersedes:` line.
Referenced by D0463's `Supersedes:` line.
* `docs/superpowers/specs/2026-10-10-home-resume-deck-design.md` (approved in chat 2026-10-10): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When, Confirmation ("Constraints found", "Decisions", § 1, § 4, "Out of scope").
* Commit `7bdbb818` (2026-10-10, "docs: resume deck decision and inventory"): adds the D442 row; its text is the existing Context, Decision Outcome and Consequences.
