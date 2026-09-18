<!--
status: design
scope: Phase 3 of the configurable-training-routines roadmap — named, swappable weekly schedules assigning a routine (or rest) to each weekday, one active per player, resolved client-side
read-when: writing or executing the Phase 3 implementation plan; extends docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md §5 and §8
updated: 2026-09-18
-->

# Weekly Training Schedules (Phase 3) — Design

> Drafted without an interactive brainstorm (autonomous session).
> **[decide]** marks judgement calls. Depends on Phase 1 (routines exist,
> list and detail endpoints, start by id). Independent of Phase 2.

## 1. Problem

A player who owns several routines has no way to say which one today is
for. The roadmap sketched two tables and left two questions open; both are
answered here (D321 §8 items 7–9).

## 2. Scope

**In:** several named schedules per player; exactly one active (or none);
each weekday maps to one routine (system or own) or rest; a "Today" card
on `/training`; schedule list and editor pages.

**Out:** calendar dates, repeating blocks longer than a week, reminders or
notifications, adherence statistics (see §9), sharing a schedule (Phase 4
covers routines only).

## 3. Database — migration `0041_training_schedules.sql` (number follows Phase 2's chain; renumber if Phase 2 has not landed)

Both tables are Template-layer entities: mutable, owned, never referenced
by the runtime chain (`02-Template-Layer.md`).

```sql
CREATE TABLE training_schedules (
    id          UUID PRIMARY KEY,                       -- UUIDv7, app-generated
    player_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedules_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT chk_training_schedules_name_not_empty CHECK (length(trim(name)) > 0)
);
CREATE UNIQUE INDEX uq_training_schedules_player_active
    ON training_schedules (player_id) WHERE is_active;

CREATE TABLE training_schedule_days (
    id                    UUID PRIMARY KEY,
    training_schedule_id  UUID NOT NULL,
    day_of_week           SMALLINT NOT NULL,             -- ISO: 1 = Monday … 7 = Sunday
    routine_template_id   UUID NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedule_days_training_schedule FOREIGN KEY (training_schedule_id) REFERENCES training_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_training_schedule_days_routine_template  FOREIGN KEY (routine_template_id)  REFERENCES routine_templates(id)  ON DELETE RESTRICT,
    CONSTRAINT chk_training_schedule_days_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT uq_training_schedule_days_training_schedule_day_of_week UNIQUE (training_schedule_id, day_of_week)
);
```

Decisions folded in:

- **Rest day = no row.** One representation, not two (a `NULL` routine and
  a missing row would both have meant rest).
- **Weekday is `SMALLINT` with a `CHECK`, not a lookup table.** Pattern 12
  governs domain-controlled sets that grow or need names; the ISO weekday
  is a universal constant. Recorded as a deliberate exception.
- **`RESTRICT` on the routine FK.** Deleting a scheduled routine fails; the
  service maps it to `VALIDATION_FAILED` `{ reason: "routine in use",
  scheduleIds }` on Phase 1's `DELETE /api/routines/:id`. A silent
  `SET NULL` would turn a training day into rest with no one noticing.
  **[decide: RESTRICT vs. SET NULL + warning]**
- **One active per player** by partial unique index; no pointer column on
  `players`.
- Ownership of the routine is *not* re-checked by the schema (a foreign
  routine id would still FK-resolve). The service asserts every
  `routine_template_id` is system or caller-owned before writing; the
  read view (§3.1) is filtered by `player_id` so a foreign routine never
  reads back.

### 3.1 View `v_training_schedule_days`

One row per (schedule, day) with `player_id`, schedule `name`, `is_active`,
`day_of_week`, `routine_template_id`, `routine_name`, and `routine_minutes`
(sum of the routine's `MINUTES` steps). Schedules with no days still need
to list: the service reads `training_schedules` through a second small view
`v_training_schedules` (`player_id`, id, name, is_active, `day_count`).
Reads stay view-backed; the runtime chain is untouched.

### 3.2 Verification

`database/verification/0041_training_schedule_checks.sql`: two active
schedules for one player fail; `day_of_week 0`/`8` fail; duplicate weekday
fails; routine delete blocked while scheduled; player delete cascades both
tables.

## 4. API

| Endpoint | Body / Response | Notes |
| --- | --- | --- |
| `GET /api/schedules` | `ListResult<ScheduleSummary>` | own only |
| `GET /api/schedules/:scheduleId` | `Schedule` (`days[]` of `{ dayOfWeek, routineId, routineName, routineMinutes }`) | own, else `NOT_FOUND` |
| `POST /api/schedules` | `{ name, days: { dayOfWeek, routineTemplateId }[] }` → `201 Schedule` | created inactive |
| `PUT /api/schedules/:scheduleId` | same body, full replace of `days[]` | delete-then-insert days in one transaction |
| `POST /api/schedules/:scheduleId/activate` | → `Schedule` | one transaction: `UPDATE … SET is_active = FALSE WHERE player_id = ?` then `SET is_active = TRUE WHERE id = ?` — ordered so the partial unique index never trips |
| `POST /api/schedules/:scheduleId/deactivate` | → `Schedule` | leaves the player with no active schedule |
| `DELETE /api/schedules/:scheduleId` | `204` | days cascade; deleting the active schedule leaves none active |

No `/today` endpoint (§5). Contract goes into `04-Endpoint-Contracts.md`
under a new "Training Schedules" section before implementation, the D299/
D306 practice.

## 5. Resolving "today" — client-side

`players` has no timezone column and the API sets no cookie the server
could read one from. The server therefore cannot know the player's weekday
without a new fact about the player, which would be data minimisation in
the wrong direction. The client computes `new Date().getDay()` mapped to
ISO, indexes the active schedule's `days[]`, and shows the result. A
`GET /api/schedules/active` convenience read (the active schedule or `204`)
saves the list call on `/training` **[decide: convenience route or reuse
the list]**.

## 6. Frontend

| Route | Content |
| --- | --- |
| `/training` | a "Today" card at the top: routine name, minutes, `Start` → the Phase 1 play route; "Rest day" when unmapped; a link to schedules; hidden when no schedule is active |
| `/training/schedules` | list of own schedules, active badge, `Activate`/`Deactivate`, `New schedule` |
| `/training/schedules/edit?schedule=<id>` and `/new` | name input; seven rows Monday–Sunday, each a select over `GET /api/routines` (system + own) with a "Rest" option; `Save` |

Components under `components/layout/training/routines/`
(`ScheduleEditor.astro`, `ScheduleDayRow.astro`, `TodayCard.astro`),
data factories under `lib/training/routines/`. Weekday names come from
`Intl.DateTimeFormat` with the browser locale, not a hand-written list.

## 7. Tests

| File | Asserts |
| --- | --- |
| `tests/services/schedule.service.test.ts` | ownership on every routine id; activate clears siblings in one transaction; full-replace days; delete active leaves none |
| `tests/services/routine.service.test.ts` | delete of a scheduled routine → `VALIDATION_FAILED` with `scheduleIds` |
| `tests/lib/training/routines/today.data.test.ts` | JS `getDay()` → ISO mapping (Sunday = 7); rest when unmapped |
| `tests/pages/api/schedules.test.ts` | envelopes, codes |
| verification SQL | §3.2 |

## 8. Documentation and decisions owed

- `02-Template-Layer.md`: two new sections; `05-Views/00-Overview.md`;
  `03-Migrations.md`; `10-Database-Agent-Guide.md` quick reference; the
  migration range in root `CLAUDE.md` and the context map.
- `06-API/00-Overview.md` route surface + `04-Endpoint-Contracts.md`.
- `09-Training/01-Routines.md`: a new sub-heading under §7's "Training Plan"
  note — a schedule is *not* the multi-block Training Plan that section
  reserves; it assigns one routine per day and leaves the ≤60-minute block
  intact.
- `DECISIONS.md` Deferred list: remove the schedules entry.
- Decisions: weekday as `SMALLINT` (Pattern 12 exception), rest as absent
  row, client-side resolution, `RESTRICT` mapping.

## 9. Open points

- **Adherence:** "did the player train on the scheduled day" is derivable
  later from `activities.started_at` and the schedule *if* the schedule's
  history is kept; today an edit overwrites it. Storing a snapshot per
  activity would make the runtime reference a template concept, which
  `02-Template-Layer.md` forbids. Left out; note in the Deferred list.
- **Week start:** the editor always renders Monday first (ISO). A
  locale-aware start is presentation only.

## 10. Plan seeds

1. Migration + views + verification.
2. Repository/service/API (TDD).
3. Phase 1 delete mapping.
4. `/training` Today card; schedules list and editor.
5. Docs, decisions, gates.
