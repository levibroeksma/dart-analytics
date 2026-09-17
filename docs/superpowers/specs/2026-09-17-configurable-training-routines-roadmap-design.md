<!--
status: design
scope: roadmap for player-composable custom training routines — builder, exercise/game expansion, weekly schedules, sharing
read-when: any future task implementing a phase of this roadmap; extends docs/architecture/09-training-routines.md §19-20
updated: 2026-09-17
-->

# Configurable Training Routines — Roadmap Design

> Status: architecture roadmap only. No implementation in this pass. Each
> phase gets its own brainstorm → spec → plan cycle when it is actually
> picked up.

## 1. Problem

`docs/architecture/09-training-routines.md` already anticipates player-composed
routines (§19 "Preset Routines", §20 "User-Created Routines") and the schema
already carries the ownership split: `routine_templates.player_id` (nullable)
and `is_system_template` exist today (migration `0004`). What is missing is
everything else:

- no CRUD API for routines — `06-API/04-Endpoint-Contracts.md` lists
  `GET /api/routines*` as **not implemented**;
- no builder UI — players can only run system-seeded routines
  (Warm-Up, Balanced Training);
- no path from "pick existing exercises/games into an ordered, editable list"
  to a saved `routine_template`;
- no weekly-schedule or sharing concept at all.

This document sequences that work into four phases and fixes the open
questions each phase would otherwise block on. It does not change any
existing runtime behaviour and does not touch the Runtime or Read-Model
layers.

## 2. Phasing

```text
Phase 1 — Custom Routine Builder        (this doc's main content)
Phase 2 — New games / exercise variants (no new architecture — Pattern 15/18 already covers it)
Phase 3 — Named, swappable weekly schedules
Phase 4 — Sharing (copy-on-share)
```

Each phase is independently implementable and independently valuable. Phase 2
has no dependency on 1/3/4 — it is normal exercise/game expansion work, sequenced
here only because it feeds the Phase 1 picker. Phases 3 and 4 depend on Phase 1
existing (a schedule or a share links to a routine; both need something to link).

## 3. Phase 1 — Custom Routine Builder

### 3.1 Scope

A player picks from the existing exercise/game catalog, composes them into an
ordered list, sets each step's duration, reorders the list, and saves it as
their own `routine_template`. They can reopen and edit it later. Per-step
target/pattern/game-rule customization (beyond duration) is explicitly
deferred — a step's `configuration` stays whatever its `exercise_template`
defaults to, matching `routine_steps.configuration`'s existing nullable
design (a `NULL` step configuration already falls back to the template
default per `05-Database/06-Spec/02-Template-Layer.md`).

### 3.2 Duration bounds

`09-training-routines.md` §7 already caps every routine at ≤60 minutes total
active training time. This phase adds a **floor of 30 minutes**, but only for
user-authored routines:

```text
system routine   (is_system_template = TRUE):   0 < duration ≤ 60m   (unchanged)
user routine     (is_system_template = FALSE):  30m ≤ duration ≤ 60m (new)
```

The floor cannot be universal: the seeded "Warm-Up" system routine
(`0015_warm_up_routine.sql`) is 5 minutes total by design, used both
standalone and as Balanced Training's first step. Scoping the floor to
non-system routines only preserves that without a special case in the
builder.

Routine duration is derived (§6 — sum of step durations), never stored
independently, so the bound is a property of the step list, not a routine
column.

### 3.3 Database

No new tables. `exercise_templates` is already the pickable catalog (a `GAME`
template names its `game_type_id`; every other exercise type is
non-game — Switching, Double Pattern, Warm-Up, etc.). `routine_templates` /
`routine_steps` already model ownership and ordered composition.

One addition: a deferred constraint trigger on `routine_steps`
(`trg_routine_duration_bounds`, new migration) that, on `INSERT`/`UPDATE`/
`DELETE`, resolves the parent `routine_templates` row and — only when
`is_system_template = FALSE` — checks the step-duration sum (normalized
through `duration_types`, today only `MINUTES`) falls within 30–60 minutes.
Deferred to transaction commit, so the builder's save (delete-all-steps,
reinsert-new-order) is checked once at the end, not after every intermediate
statement. A per-row `CHECK` cannot express a cross-row sum, so a trigger is
the correct tool here per `01-Principles.md`'s "Database Constraints over
Application Logic" (the aggregate case, not a violation of it).

The application (service layer) validates the same bound before attempting
the write, so a rejected save surfaces a normal validation error rather than
a raw constraint-violation from the database — defense in depth, not
duplicated authority (the trigger stays the actual guarantee).

### 3.4 API

Fills in the currently unimplemented contract
(`06-API/04-Endpoint-Contracts.md` lines 371–373), following the existing
Controller → Service → Repository layering (Pattern 6):

| Endpoint | Purpose | Ownership |
| --- | --- | --- |
| `GET /api/exercise-templates` | Picker catalog (view-backed) | public read (system content) |
| `GET /api/routines` | List: system routines + caller's own | scoped by `player_id` |
| `GET /api/routines/:routineId` | Detail | system, or owner only |
| `POST /api/routines` | Create (`name`, `description`, ordered `steps[]`) | creates with caller's `player_id` |
| `PUT /api/routines/:routineId` | Replace `name`/`description`/`steps[]` | owner only |
| `DELETE /api/routines/:routineId` | Delete | owner only, never a system routine |

`PUT` takes the full ordered step array rather than incremental patch
operations — the builder's "swappable list" always has the complete order in
memory client-side, and a full replace sidesteps partial-reorder race
conditions without adding a patch DSL. Each step in the payload is
`{ exerciseTemplateId, durationValue, durationTypeKey }`; `sequence_number` is
assigned server-side from array position, never trusted from the client.

Write endpoints reject any attempt to modify a system routine
(`is_system_template = TRUE`) or another player's routine with the standard
403/404 domain error envelope (Pattern 8) — no new authorization mechanism,
same identity-from-JWT check every other player-scoped write already uses.

### 3.5 Frontend

A routine-builder page (exact route TBD at planning time, alongside
`/training`) with:

- an exercise/game picker reading `GET /api/exercise-templates`, styled after
  the existing `GameCard.astro` shape;
- an ordered step list using `@alpinejs/sort` (`x-sort`) for drag-reorder —
  swapping updates the in-memory array; `sequence_number` is recomputed from
  array index at save time, not maintained live;
- a duration input per step (minutes), with a live total-duration readout and
  the 30–60m bound gating the Save action client-side (mirrors §3.3's
  server/DB bound — same UX pattern as any other client-side validation
  already in the codebase, not a new one);
- one page serves both create and edit — edit mode loads an existing
  `routine_template`'s steps into the same builder state.

New reusable components (exact names/props are implementation-plan work, not
fixed here) would register in `07-Frontend/08-Component-Inventory.md` under
`components/layout/training/` per existing convention — e.g. a draggable step
row and a picker-add control.

## 4. Phase 2 — New Games / Exercise Variations

No new architecture. Adding a game follows Pattern 15 (`04-Architecture-patterns.md`)
and the full-stack touch list in `07-Frontend/09-Adding-A-Game.md`; adding a
non-game exercise variant follows `09-training-routines.md` §26 (new
`ExerciseType` + ruleset + `ExerciseEngine` + configuration schema). Neither
requires touching the Phase 1 builder: any `exercise_template` seeded as
`is_system_template = TRUE` becomes pickable automatically, because the
picker reads the catalog rather than a hardcoded list. This is the payoff of
building the picker catalog-driven in Phase 1 — Phase 2 is pure content
expansion using patterns that already exist.

## 5. Phase 3 — Named, Swappable Weekly Schedules

A player can own multiple named schedules (e.g. "Season", "Off-season") and
switch which one is active; a schedule assigns a routine (or nothing, i.e. a
rest day) to each day of the week.

### 5.1 Database (future migration, not this pass)

```text
training_schedules
    id                  UUIDv7
    player_id           FK players (CASCADE)
    name
    is_active           BOOLEAN
    created_at / updated_at

training_schedule_days
    id                  UUIDv7
    training_schedule_id  FK training_schedules (CASCADE)
    day_of_week          SMALLINT (or a day_of_week lookup table, Pattern 12)
    routine_template_id   FK routine_templates (RESTRICT), nullable = rest day
    UNIQUE (training_schedule_id, day_of_week)
```

`UNIQUE (player_id) WHERE is_active` (partial unique index) enforces at most
one active schedule per player without a separate "current schedule" pointer
table.

Both tables are Template-layer entities: mutable, user-facing, never
referenced by runtime. Resolving "today's training" reads the active
schedule + current weekday at Training-start and snapshots the resolved
routine through the existing Template → Snapshot path (Pattern 4) — the
schedule itself never enters the runtime chain, exactly like a routine never
does today.

### 5.2 Open question

Whether "today's routine" resolution is a dedicated endpoint
(`GET /api/schedules/active/today`) or client-side (fetch the active
schedule, index by today's weekday) is left to Phase 3's own brainstorm.

## 6. Phase 4 — Sharing (Copy-on-Share)

Sharing a routine hands the recipient an independent copy: a new
`routine_templates` row (and new `routine_steps` rows) with fresh UUIDs,
owned by the recipient (`player_id` = recipient, `is_system_template =
FALSE`). There is no shared-ownership row and no "linked" routine whose
edits propagate — this matches the Template → Snapshot copy philosophy
(Pattern 4/5) already used everywhere else in the schema, so sharing needs no
new database concept, only a copy operation.

### 6.1 Open question

How a recipient is identified — a share code/link resolved at accept-time,
versus a direct player-to-player share — is explicitly deferred to Phase 4's
own brainstorm. Nothing in Phases 1–3 depends on this being resolved now.

## 7. What This Roadmap Deliberately Does Not Decide

- Exact route paths, component names, and prop shapes for Phase 1's frontend.
- Per-step configuration customization beyond duration (Phase 1 explicitly
  excludes it; may become a later increment of Phase 1 rather than a new
  phase).
- Phase 3's active-schedule resolution mechanism (client vs. endpoint).
- Phase 4's recipient-identification mechanism.

These are intentionally left open per `04-Architecture-patterns.md`'s
"Avoiding Premature Abstraction" — each gets decided when its phase is
actually brainstormed, not speculated here.
