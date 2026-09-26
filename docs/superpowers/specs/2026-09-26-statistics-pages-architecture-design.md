# Detailed Statistics Pages — Architecture Design

> **Date:** 2026-09-26
> **Status:** approved (brainstorming consensus)
> **Branch:** `claude/stats-pages-architecture-4vapgh`
> **Scope:** architecture documentation only — the shared statistics layer, the
> section catalog per game, and the replay route. No code, no migration.
> **Canonical result:** `docs/architecture/10-Statistics/` (`00-Overview.md`,
> `01-Section-Catalog.md`, `02-Replay.md`); decisions D364–D366.

---

## Context

`/statistics` has a Games tab with a game picker and a Routines tab, both showing
"coming soon". The career overview (`GET /api/statistics/overview`) ships and
composes four fact views through pure modules in the service layer. Fact views
exist for visits, legs, darts with intent (`v_dart_analytics`), dart coordinates
(`v_dart_locations`), X01 checkout darts, and replay (`v_game_replay`).

## Decisions made during brainstorming

1. **Time scope:** career aggregates plus time series; month-over-month and
   year-over-year are first-class.
2. **Games only now.** Routine statistics reuse the same layer later.
3. **Analytics mode only** (`VISUAL_BOARD`): the richest data. Stats are tiered by
   the facts a ruleset produces (capability tags), not split per mode.
4. **Several sections per game, each with its own data contract.** A section is
   backed by a thin SQL view when SQL is cheapest, otherwise by the shared fact
   views plus a pure TS module. Computed where cheapest, per section.
5. **Frontend persistence in IndexedDB,** so only data the client lacks is
   fetched; closed time buckets are immutable and never refetched.
6. **Full replays** on a dedicated per-session route, **paginated** by turn pages.
7. **Every endpoint takes a date range**; a `tz` parameter sets bucket
   boundaries without a stored player timezone.
8. **Additive metric components** (numerator + denominator) in every result, so
   buckets re-aggregate exactly and YoY is a client regrouping.
9. **Abandoned sessions** are a first-class population for a `completion`
   section; excluded elsewhere by default.
10. **Play context:** game stats include games run as routine steps (same game
    pair); later routine stats include only routine-context sessions. Only game
    engines run as routine steps count — no exercise-type-to-game mapping.
11. **Loose darts:** a dart landing outside the intended bed and outside its
    adjacent segments/rings.
12. **Every choice reviewed for extensibility** — recorded as the scalability
    table in `00-Overview.md` §11.

## Verified during design

- Only the Singles, Doubles Training and Bob's 27 engines store intended targets.
  X01 and Score Training have none; Shanghai and Around the Clock have implicit
  intent recoverable by engine fold. Sections needing intent follow that split.
- `playAbandonAndExit` uploads pending turns before setting `ABANDONED`; migration
  `0034`'s backfill and training-activity abandon can close a session with no
  turns ("never started").
- A routine-step game stores the same game pair as a standalone game; its context
  is derivable from `activity_configurations`, so no schema change is needed.

## Approaches weighed (aggregation site)

- *App layer over raw facts* (overview precedent): simple, but loads full history
  per request and cannot serve long series cheaply.
- *SQL aggregate view per game:* fast, but pulls game rules into SQL (forbidden)
  and duplicates TS engine logic.
- *Persisted per-session snapshot:* fast, but breaks "statistics are never persisted".
- **Chosen:** per-section compute site under explicit constraints (SQL for
  rule-free reductions and unbounded ranges; server folds on bounded input; client
  on cached bounded windows), with a materialized monthly rollup as the documented
  escalation.

## Rollout

Six phases, each its own spec + plan (`00-Overview.md` §12): base views + session
list + cross-game sections + cache → board and stored-intent sections → checkout
family → derived-intent and game-specific sections → replay → routine statistics.
