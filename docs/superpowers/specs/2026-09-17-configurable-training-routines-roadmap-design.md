<!--
status: design
scope: roadmap for player-composable custom training routines — builder, exercise/game expansion, weekly schedules, sharing
read-when: any future task implementing a phase of this roadmap; extends docs/architecture/09-Training/01-Routines.md §19-20
updated: 2026-09-17
-->

# Configurable Training Routines — Roadmap Design

> Status: architecture roadmap only. No implementation in this pass. Each
> phase has its own spec (§9), from which its implementation plan is written.
>
> **Corrected 2026-09-18** — §8 lists every correction and why. Where a
> sentence below still reads as first written, §8 wins.

## 1. Problem

`docs/architecture/09-Training/01-Routines.md` already anticipates player-composed
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

A saved routine must also be **runnable** — a builder whose output cannot be
started is not a deliverable. Today `POST /api/training-sessions` takes a
`routineTemplateName` and resolves it with `is_system_template = TRUE` (D299),
and the only play page is hardcoded to "Balanced Training". Phase 1 therefore
also adds start-by-id and a data-driven detail/play route (§3.4, §3.5).

### 3.2 Duration bounds

`09-Training/01-Routines.md` §7 already caps every routine at ≤60 minutes total
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
`is_system_template = FALSE` — checks the step-duration sum falls within
30–60 minutes. `duration_types` seeds both `ROUNDS` and `MINUTES`
(`seeds/0001`); a `ROUNDS` step has no wall-clock length, so Phase 1 accepts
`MINUTES` only for user-authored steps and the trigger counts only `MINUTES`
rows — the same rule `routine-duration.module.ts` already applies client-side.
Deferred to transaction commit, so the builder's save (delete-all-steps,
reinsert-new-order) is checked once at the end, not after every intermediate
statement. A per-row `CHECK` cannot express a cross-row sum, so a trigger is
the correct tool here per `01-Principles.md`'s "Database Constraints over
Application Logic" (the aggregate case, not a violation of it).

The application (service layer) validates the same bound before attempting
the write, so a rejected save surfaces a normal validation error rather than
a raw constraint-violation from the database — defense in depth, not
duplicated authority (the trigger stays the actual guarantee).

Three further schema-level facts the first draft missed (§8):

- `routine_templates` has no ownership `CHECK`; `configuration_templates`
  does (`chk_configuration_templates_system_ownership`, `0010`). The same
  migration adds the equivalent so a user routine can never carry
  `player_id = NULL`.
- `v_routine_execution` projects neither `player_id` nor `description`, so
  "system + caller's own" cannot be read through it. The view is recreated
  (precedent `0036`) with both columns; reads stay view-backed (Pattern 7).
- The seeded "Finishing" template (`seeds/0017`) has `default_configuration =
  NULL` — its TUOD config lives only on Balanced Training's step. A picked
  Finishing step would resolve to `{}`. A seed `UPDATE` gives it defaults,
  and `startTraining` validates a `GAME` step's config against its game
  ruleset (issue #392), which the builder's write path genuinely requires.

### 3.4 API

Fills in the currently unimplemented contract
(`06-API/04-Endpoint-Contracts.md` lines 371–373), following the existing
Controller → Service → Repository layering (Pattern 6):

| Endpoint | Purpose | Ownership |
| --- | --- | --- |
| `GET /api/exercise-templates` | Picker catalog (view-backed) | public read (system content) |
| `GET /api/routines` | List: system routines + caller's own | scoped by `player_id` |
| `GET /api/routines/:routineId` | Detail (the `/execution` alias is dropped — same shape, D321) | system, or owner only |
| `POST /api/routines` | Create (`name`, `description`, ordered `steps[]`) | creates with caller's `player_id` |
| `PUT /api/routines/:routineId` | Replace `name`/`description`/`steps[]` | owner only |
| `DELETE /api/routines/:routineId` | Delete | owner only, never a system routine |
| `POST /api/training-sessions` | gains `routineTemplateId`; resolves system or caller-owned routine by id | system, or owner only |

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

A routine-builder page (`/training/routines/new`, edit via
`/training/routines/edit?routine=<id>` — prerendered shells that read the id
from the query string, the precedent `game-layout.data.ts` already uses) with:

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
  `routine_template`'s steps into the same builder state;
- a data-driven detail page and a play page that take the routine id from
  the query string, replacing the hand-written Balanced Training copy
  (`RoutineDetail.astro` keeps its shape; its steps come from
  `GET /api/routines/:routineId`).

New reusable components (exact names/props are implementation-plan work, not
fixed here) would register in `07-Frontend/08-Component-Inventory.md` under
`components/layout/training/` per existing convention — e.g. a draggable step
row and a picker-add control.

## 4. Phase 2 — Step-Kind Generalisation, Then New Games / Exercise Variations

The first draft said "no new architecture — any seeded `exercise_template`
becomes pickable automatically". That is true of the *picker* and false of
everything downstream of it:

- `startGameStep` (`training-session.service.ts`) hardcodes `TUOD` /
  `TUOD_V1`; `exercise_templates` pins no game ruleset version, and
  `v_routine_execution` carries `game_type_key` but no ruleset key;
- `TrainingStepResolved.exerciseTypeKey` is a closed Zod enum
  (`WARM_UP | SWITCHING | DOUBLE_PATTERN | GAME`), and the play page,
  header store labels and summary module all dispatch on it by hand;
- the only in-routine game UI is the TUOD adapter (`finishing-step.data.ts`,
  D269).

So a 501 `GAME` template or a fifth non-game exercise type each require code
in the routine runtime. Phase 2 is therefore two increments: (a) generalise
the step kinds — pin `game_ruleset_version_id` on `GAME` templates (mirroring
`0035`), resolve game type + ruleset from the template, and route each step
through a per-kind adapter registry on the client; then (b) add content,
which from that point on really is catalog-only for games already playable
standalone. Adding a brand-new non-game exercise still follows
`09-Training/01-Routines.md` §26 (type + ruleset + engine + schema) and
registers one adapter. Spec: §9.

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
    day_of_week          SMALLINT CHECK 1..7 (ISO; no lookup table — a weekday is a universal constant, not a domain-controlled set)
    routine_template_id   FK routine_templates (RESTRICT), NOT NULL — a rest day is the absence of a row
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

### 5.2 Resolution of "today" (decided in the Phase 3 spec)

Client-side. `players` stores no timezone, so the server cannot know the
player's weekday; the client fetches the active schedule and indexes by its
own local weekday. A `RESTRICT` FK means Phase 1's `DELETE /api/routines/:id`
must return a `409 ROUTINE_IN_USE` naming the schedules once Phase 3 exists.

## 6. Phase 4 — Sharing (Copy-on-Share)

Sharing a routine hands the recipient an independent copy: a new
`routine_templates` row (and new `routine_steps` rows) with fresh UUIDs,
owned by the recipient (`player_id` = recipient, `is_system_template =
FALSE`). There is no shared-ownership row and no "linked" routine whose
edits propagate — this matches the Template → Snapshot copy philosophy
(Pattern 4/5) already used everywhere else in the schema, so sharing needs no
new database concept, only a copy operation.

Only user-owned routines are shareable: a system routine is already visible
to every player. The copy re-runs the Phase 1 duration bound — the copy is a
user routine and the floor applies to it.

### 6.1 Recipient identification (decided in the Phase 4 spec)

A server-generated share code resolved at accept time. `players.display_name`
is not unique and the app exposes no player directory, so direct
player-to-player targeting has nothing to target.

## 7. What This Roadmap Deliberately Does Not Decide

- Exact route paths, component names, and prop shapes for Phase 1's frontend.
- Per-step configuration customization beyond duration (Phase 1 explicitly
  excludes it; may become a later increment of Phase 1 rather than a new
  phase).
- Per-step configuration UI beyond duration (Phase 1 excludes it; Phase 2's
  adapter registry is where a per-kind config form would attach).

The two questions the first draft left open here (Phase 3 resolution, Phase 4
recipient) are decided in their phase specs (§5.2, §6.1). The remainder is
intentionally left open per `04-Architecture-patterns.md`'s
"Avoiding Premature Abstraction" — each gets decided when its phase is
actually brainstormed, not speculated here.

## 8. Corrections (2026-09-18)

| # | First draft said | Corrected to | Why |
| --- | --- | --- | --- |
| 1 | `docs/architecture/09-training-routines.md` | `docs/architecture/09-Training/01-Routines.md` | file moved under D308; the old path resolves nowhere |
| 2 | Phase 1 = build + edit | Phase 1 = build + edit + **run** | `POST /api/training-sessions` resolves by name with `is_system_template = TRUE`; play page hardcodes "Balanced Training" — a saved routine could not start |
| 3 | `duration_types` "today only `MINUTES`" | `ROUNDS` and `MINUTES` are both seeded; user steps accept `MINUTES` only | `seeds/0001`; a `ROUNDS` step cannot satisfy a minute floor |
| 4 | "No new tables", trigger only | trigger + ownership `CHECK` + `v_routine_execution` recreated with `player_id`/`description` + Finishing `default_configuration` seed + `GAME` config validation | view lacks the owner column the list needs; `configuration_templates` precedent; `seeds/0017`; issue #392 |
| 5 | `GET /api/routines/:id` and `/:id/execution` both planned | `/execution` dropped | identical shape, two routes |
| 6 | Phase 2 "no new architecture" | Phase 2 = step-kind generalisation first, content second | `startGameStep` hardcodes TUOD; closed step-key enum; TUOD-only adapter |
| 7 | Phase 3 `day_of_week` lookup optional; nullable routine = rest | `SMALLINT` ISO weekday with `CHECK`; rest = no row | one representation of "rest"; weekday is not a controlled set |
| 8 | Phase 3 resolution open | client-side | `players` has no timezone column |
| 9 | Phase 4 recipient open | share code, accept-time copy | `display_name` not unique; no directory |

Recorded as D321 (`decisions/api.md`). D305/D306 stand; D321 refines D306.

## 9. Phase Specs

| Phase | Spec |
| --- | --- |
| 1 | `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` |
| 2 | `docs/superpowers/specs/2026-09-18-routine-step-kind-generalisation-design.md` |
| 3 | `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md` |
| 4 | `docs/superpowers/specs/2026-09-18-routine-sharing-design.md` |
