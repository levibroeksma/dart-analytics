# Weekly Training Schedules (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player keeps several named weekly schedules, activates one, and `/training` shows today's routine (or rest) with a Start button.

**Architecture:** Two Template-layer tables (`training_schedules`, `training_schedule_days`) with a partial unique index for "one active per player", ISO weekday as `SMALLINT` 1–7, rest = absent row, `RESTRICT` on the routine FK. Two read views. `schedule.service.ts` + `schedule.repository.ts` behind `/api/schedules`. "Today" is resolved client-side. Phase 1's `deleteRoutine` maps the `RESTRICT` violation to `VALIDATION_FAILED { reason: "routine in use", scheduleIds }`.

**Tech Stack:** PostgreSQL/dbmate, drizzle-orm, Zod, Alpine.js, Vitest, `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`. Depends on Phase 1. Independent of Phase 2 (renumber the migration to the chain head).

## Global Constraints

- Branch `feat/weekly-training-schedules` off `main`. No commit/PR without the user's word.
- Migration `0040_training_schedules.sql` (or the chain head at the time); no seed. Never edit applied files.
- Ids UUIDv7 from the service; `day_of_week` ISO 1 = Monday … 7 = Sunday; rest = no row.
- Ownership: the service asserts every `routineTemplateId` is system or caller-owned (through `getRoutine` from Phase 1) before writing; reads filter by `player_id` in the view.
- Error registry closed: foreign schedule → `NOT_FOUND`; scheduled routine delete → `VALIDATION_FAILED`.
- TDD, mirrored tests, comment rules, barrels, gates — as Phase 1's Global Constraints.

## Resolved judgement calls

| Spec item | Resolution |
| --- | --- |
| §3 routine FK | `ON DELETE RESTRICT`; Phase 1 `deleteRoutine` maps it |
| §5 convenience route | `GET /api/schedules/active` → `Schedule | null` (one call for the Today card) |
| §9 week start | Monday first, always |

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `database/migrations/0040_training_schedules.sql` | two tables, partial unique index, two views |
| `database/verification/0040_training_schedule_checks.sql` | constraints fire; cascade; RESTRICT |
| `app/src/db/schema.ts` | tables + views |
| `app/src/repositories/schedule.repository.ts`, `interfaces.ts` | view reads; writes |
| `app/src/services/schedule.service.ts`, `types.ts` | list/get/active/create/replace/activate/deactivate/delete |
| `app/src/services/routine.service.ts` | `deleteRoutine` maps `fk_training_schedule_days_routine_template` |
| `app/src/pages/api/schedules/{index,active,[scheduleId]/index,[scheduleId]/activate,[scheduleId]/deactivate,types}.ts` | controllers + Zod |
| `app/src/pages/api/types.ts` | barrel |
| `app/src/lib/client/api/schedules.ts`, `types.ts` | client |
| `app/src/lib/training/schedules/{today.ts,schedule-route.ts,today-card.data.ts,schedules-index.data.ts,schedule-editor.data.ts,types.ts}` | client logic |
| `app/src/lib/types.ts` | raises `./training/schedules/types` via `./training/types` |
| `app/src/components/layout/training/schedules/{TodayCard,ScheduleEditor,ScheduleDayRow}.astro` | UI |
| `app/src/pages/training/index.astro` | Today card on top |
| `app/src/pages/training/schedules/{index,new,edit}/index.astro` | pages |
| tests | mirrored |

---

### Task 1: Migration, verification, `schema.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feat/weekly-training-schedules
```

- [ ] **Step 2: Verification first** — `database/verification/0040_training_schedule_checks.sql` (fixture player + one user routine at 30 minutes, built as in `0038`'s script; `BEGIN…ROLLBACK`):

1. two active schedules for one player → `unique_violation` (PASS when raised);
2. `day_of_week = 0` and `= 8` → `check_violation`;
3. duplicate weekday in one schedule → `unique_violation`;
4. `DELETE FROM routine_templates` for a scheduled routine → `foreign_key_violation`;
5. deleting the schedule cascades its days (count 0 after);
6. deleting the player cascades schedules (count 0);
7. `v_training_schedules.day_count` equals the inserted days; `v_training_schedule_days.routine_minutes` equals the routine's MINUTES sum.

- [ ] **Step 3: Migration**

```sql
-- ============================================================
-- Migration: 0040_training_schedules.sql
--
-- Purpose:
-- Named, swappable weekly schedules: one routine (or rest) per
-- ISO weekday, at most one active schedule per player
-- (spec 2026-09-18-weekly-training-schedules-design.md; D321).
--
-- Template-layer: mutable, owned, never referenced by runtime
-- tables. Rest is the absence of a row, not a NULL routine — one
-- representation. day_of_week is a SMALLINT with a CHECK, a
-- deliberate exception to Pattern 12 (lookup tables): the ISO
-- weekday is a universal constant with nothing to name or grow.
-- The routine FK is RESTRICT so deleting a scheduled routine
-- fails loudly; the service maps it (a silent SET NULL would turn
-- a training day into rest unnoticed). "One active per player" is
-- a partial unique index, no pointer column on players.
-- ============================================================

-- migrate:up
CREATE TABLE training_schedules (
    id          UUID PRIMARY KEY,
    player_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedules_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT chk_training_schedules_name_not_empty CHECK (length(trim(name)) > 0)
);
COMMENT ON TABLE training_schedules IS 'A player''s named weekly schedule; at most one is active (uq_training_schedules_player_active).';

CREATE UNIQUE INDEX uq_training_schedules_player_active
    ON training_schedules (player_id) WHERE is_active;

CREATE TABLE training_schedule_days (
    id                    UUID PRIMARY KEY,
    training_schedule_id  UUID NOT NULL,
    day_of_week           SMALLINT NOT NULL,
    routine_template_id   UUID NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_training_schedule_days_training_schedule FOREIGN KEY (training_schedule_id) REFERENCES training_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_training_schedule_days_routine_template  FOREIGN KEY (routine_template_id)  REFERENCES routine_templates(id)  ON DELETE RESTRICT,
    CONSTRAINT chk_training_schedule_days_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT uq_training_schedule_days_training_schedule_day_of_week UNIQUE (training_schedule_id, day_of_week)
);
COMMENT ON TABLE training_schedule_days IS 'One routine per ISO weekday (1 = Monday … 7 = Sunday) in a schedule; a missing weekday is a rest day.';
COMMENT ON COLUMN training_schedule_days.day_of_week IS 'ISO weekday, 1 = Monday … 7 = Sunday. SMALLINT with CHECK rather than a lookup table (deliberate Pattern 12 exception).';

CREATE INDEX idx_training_schedule_days_routine_template ON training_schedule_days (routine_template_id);

CREATE VIEW v_training_schedules AS
SELECT ts.id AS schedule_id,
    ts.player_id,
    ts.name,
    ts.is_active,
    ts.updated_at,
    (SELECT count(*) FROM training_schedule_days d WHERE d.training_schedule_id = ts.id) AS day_count
FROM training_schedules ts;
COMMENT ON VIEW v_training_schedules IS 'One row per schedule with its day count; filter by player_id.';

CREATE VIEW v_training_schedule_days AS
SELECT ts.id AS schedule_id,
    ts.player_id,
    ts.name AS schedule_name,
    ts.is_active,
    d.day_of_week,
    rt.id   AS routine_template_id,
    rt.name AS routine_name,
    COALESCE((
        SELECT sum(rs.duration_value)
        FROM routine_steps rs JOIN duration_types dt ON dt.id = rs.duration_type_id
        WHERE rs.routine_template_id = rt.id AND dt.implementation_key = 'MINUTES'
    ), 0)::int AS routine_minutes
FROM training_schedule_days d
    JOIN training_schedules ts ON ts.id = d.training_schedule_id
    JOIN routine_templates rt  ON rt.id = d.routine_template_id;
COMMENT ON VIEW v_training_schedule_days IS 'One row per (schedule, weekday) with the routine''s name and MINUTES total; filter by player_id.';

-- migrate:down
DROP VIEW IF EXISTS v_training_schedule_days;
DROP VIEW IF EXISTS v_training_schedules;
DROP TABLE IF EXISTS training_schedule_days;
DROP TABLE IF EXISTS training_schedules;
```

- [ ] **Step 4: `schema.ts`** — introspect, or hand-add `trainingSchedules`, `trainingScheduleDays` (`pgTable`) and the two `pgView`s with bodies matching the migration text.

- [ ] **Step 5: `cd app && npm test -- tests/db`; commit**

```bash
git add database/migrations/0040_training_schedules.sql database/verification/0040_training_schedule_checks.sql app/src/db/schema.ts
git commit -m "feat(db): 0040 training schedules — weekly days, one active per player, read views"
```

---

### Task 2: Repository and service

**Interfaces:**

```ts
// repositories/interfaces.ts
export interface TrainingScheduleRow { scheduleId: string; playerId: string; name: string; isActive: boolean; updatedAt: string; dayCount: number }
export interface TrainingScheduleDayRow { scheduleId: string; playerId: string; scheduleName: string; isActive: boolean; dayOfWeek: number; routineTemplateId: string; routineName: string; routineMinutes: number }
// repositories/schedule.repository.ts
findScheduleRows(db, playerId, scheduleId?): Promise<TrainingScheduleRow[]>
findScheduleDayRows(db, playerId, scheduleId?): Promise<TrainingScheduleDayRow[]>
findScheduleIdsUsingRoutine(db, playerId, routineTemplateId): Promise<string[]>
insertScheduleRecord(tx, { scheduleId, playerId, name }): Promise<void>
updateScheduleRecord(tx, { scheduleId, playerId, name }): Promise<boolean>
replaceScheduleDayRecords(tx, { scheduleId, days: { id, dayOfWeek, routineTemplateId }[] }): Promise<void>   // delete-then-insert
setActiveSchedule(tx, { playerId, scheduleId }): Promise<boolean>   // UPDATE … SET is_active = FALSE WHERE player_id = ?; then SET TRUE WHERE id = ? AND player_id = ?
clearActiveSchedule(db, { playerId, scheduleId }): Promise<boolean>
deleteScheduleRecord(db, scheduleId, playerId): Promise<boolean>
// services/types.ts
export type ScheduleDay = { dayOfWeek: number; routineId: string; routineName: string; routineMinutes: number };
export type Schedule = { scheduleId: string; name: string; isActive: boolean; days: ScheduleDay[] };
export type ScheduleSummary = { scheduleId: string; name: string; isActive: boolean; dayCount: number };
export type ScheduleWriteInput = { name: string; days: { dayOfWeek: number; routineTemplateId: string }[] };
// services/schedule.service.ts
listSchedules(playerId) → ServiceResult<{ items: ScheduleSummary[]; nextCursor: null }>
getSchedule(playerId, scheduleId) → ServiceResult<Schedule>
getActiveSchedule(playerId) → ServiceResult<Schedule | null>
createSchedule(playerId, input) → ServiceResult<Schedule>          // created inactive
replaceSchedule(playerId, scheduleId, input) → ServiceResult<Schedule>
activateSchedule(playerId, scheduleId) → ServiceResult<Schedule>
deactivateSchedule(playerId, scheduleId) → ServiceResult<Schedule>
deleteSchedule(playerId, scheduleId) → ServiceResult<null>
```

- [ ] **Step 1: Failing repository tests** (`renderingDb`): `findScheduleDayRows` filters `"player_id" = $1` (+ schedule id); `setActiveSchedule` renders two statements in order (clear siblings, then set) — use a `statements.length === 2` assertion, not `onlyStatement`; `replaceScheduleDayRecords` renders `delete` then `insert`; `findScheduleIdsUsingRoutine` reads the *view* `v_training_schedule_days` with `routine_template_id` and `player_id` predicates.

- [ ] **Step 2: Failing service tests** (`schedule.service.test.ts`, mocking the repository, `getRoutine` from `@services/routine.service`, `withTransaction`):

- create: every `routineTemplateId` goes through `getRoutine(playerId, id)`; a `NOT_FOUND` there → `VALIDATION_FAILED { reason: "unknown routineTemplateId", dayOfWeek }`; a duplicate `dayOfWeek` in the input → `VALIDATION_FAILED { reason: "duplicate dayOfWeek" }`; success inserts schedule then days inside one `withTransaction`, reads back through the views.
- replace: `NOT_FOUND` when the view has no row for (player, schedule); update → delete/insert days in one transaction.
- activate: one transaction; `setActiveSchedule` called with `{ playerId, scheduleId }`; result is the schedule with `isActive: true`.
- deactivate: `clearActiveSchedule`; `isActive: false`.
- delete: `NOT_FOUND` vs `{ ok: true, data: null }`.
- `getActiveSchedule`: `null` when none active (`ok: true, data: null`).

And in `routine.service.test.ts`: `deleteRoutine` when `deleteRoutineTemplateRecord` rejects with `{ code: "23503", constraint: "fk_training_schedule_days_routine_template" }` → `findScheduleIdsUsingRoutine` is consulted and the result is `VALIDATION_FAILED { reason: "routine in use", scheduleIds: [...] }`.

- [ ] **Step 3: Implement** the repository (drizzle over `trainingSchedules`, `trainingScheduleDays`, `vTrainingSchedules`, `vTrainingScheduleDays`) and the service. Grouping: `days` sorted by `dayOfWeek`. The `RESTRICT` mapping in `routine.service.ts`:

```ts
const SCHEDULE_ROUTINE_FK = "fk_training_schedule_days_routine_template";

function isScheduledRoutineViolation(error: unknown): boolean {
  // same cause-walk as isRoutineDurationViolation, matching code "23503" and the FK name
}

export async function deleteRoutine(playerId, routineId) {
  const blocked = await ownWritable(playerId, routineId);
  if (blocked) return blocked;
  try {
    const deleted = await deleteRoutineTemplateRecord(getDb(), routineId, playerId);
    return deleted ? { ok: true, data: null } : notFound(routineId);
  } catch (error) {
    if (!isScheduledRoutineViolation(error)) throw error;
    const scheduleIds = await findScheduleIdsUsingRoutine(getDb(), playerId, routineId);
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "routine in use", scheduleIds } };
  }
}
```

Extract the cause-walk into `services/db-errors.ts` `matchesConstraintError(error, { code, constraint })` with its own test, and use it from `isRoutineDurationViolation` too (Phase 1 code) — same guarantee, one helper.

- [ ] **Step 4: Green; commit**

```bash
cd app && npm test && cd ..
git add app/src/repositories app/src/services app/tests/repositories app/tests/services
git commit -m "feat(schedules): schedule.repository/service; routine delete maps RESTRICT to 'routine in use'"
```

---

### Task 3: API and client

- [ ] **Step 1: Contracts** (`pages/api/schedules/types.ts`):

```ts
export const ScheduleDayInput = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  routineTemplateId: z.string().min(1),
});
export const CreateScheduleRequest = z.object({
  name: z.string().trim().min(1).max(60),
  days: z.array(ScheduleDayInput).max(7),
});
export const UpdateScheduleRequest = CreateScheduleRequest;
export const ScheduleDay = z.object({ dayOfWeek: z.number().int(), routineId: z.string(), routineName: z.string(), routineMinutes: z.number().int() });
export const ScheduleResponse = z.object({ scheduleId: z.string(), name: z.string(), isActive: z.boolean(), days: z.array(ScheduleDay) });
export const ScheduleSummary = z.object({ scheduleId: z.string(), name: z.string(), isActive: z.boolean(), dayCount: z.number().int() });
export const ScheduleListResponse = z.object({ items: z.array(ScheduleSummary), nextCursor: z.null() });
```

- [ ] **Step 2: Routes** — `index.ts` (GET list, POST 201), `active.ts` (GET → `ok(schedule | null)`), `[scheduleId]/index.ts` (GET, PUT, DELETE 204), `[scheduleId]/activate.ts` (POST → 200 Schedule), `[scheduleId]/deactivate.ts` (POST → 200 Schedule). Tests per route as in Phase 1 Task 5 (delegation, status codes, 404/422 mapping, malformed body 422). Astro resolves the static `active.ts` before the dynamic `[scheduleId]`.

- [ ] **Step 3: Client** `lib/client/api/schedules.ts`: `listSchedules`, `getSchedule`, `getActiveSchedule`, `createSchedule`, `updateSchedule`, `activateSchedule`, `deactivateSchedule`, `deleteSchedule` — same `unwrap` shape as `routines.ts` (move `unwrap` to `client.ts` as `unwrapOrThrow` if you find yourself copying it a second time; keep `SessionApiError`). Barrel re-exports. Tests as Phase 1.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(api): /api/schedules — list, get, active, create, replace, activate, deactivate, delete"
```

---

### Task 4: Frontend — Today card, schedule list and editor

**Interfaces:**

```ts
// lib/training/schedules/today.ts (pure)
export function isoWeekday(date: Date): number;              // getDay() 0..6 → 1..7 with Sunday = 7
export function weekdayNames(locale?: string): string[];     // Monday..Sunday via Intl.DateTimeFormat
export function todayEntry(schedule: Schedule | null, date: Date): ScheduleDay | null;
// lib/training/schedules/schedule-route.ts
export function scheduleIdFromLocation(): string | null; export function scheduleEditPath(id: string): string;
```

- [ ] **Step 1: Failing tests** for `today.ts` (Sunday → 7; Monday → 1; `weekdayNames("en-GB")[0] === "Monday"`; `todayEntry` returns the matching day or null), `today-card.data.ts` (loads `getActiveSchedule`; hidden when null; `startPath()` = Phase 1 `routinePlayPath(routineId)`; "Rest day" when unmapped), `schedules-index.data.ts` (list; activate/deactivate call the client and refresh), `schedule-editor.data.ts` (seven rows Monday–Sunday each `routineTemplateId: string | null`; `null` = rest; loads `GET /api/routines` for the select; create POSTs only non-null days; edit loads and PUTs; name required).

- [ ] **Step 2: Implement** the four data modules; register `todayCard`, `schedulesIndex`, `scheduleEditor` in `register-route-data.ts`.

- [ ] **Step 3: Components**

`TodayCard.astro` (mounted by `todayCard()` on `/training`, above the list): routine name, `routineMinutes` badge, `Start` → `navigate(startPath())`, "Rest day" copy, link "Schedules" → `/training/schedules`; whole card `x-show="schedule"` `x-cloak`.

`ScheduleEditor.astro`: name `Input`; `<template x-for="(row, index) in rows">` → `ScheduleDayRow.astro` (weekday label from `weekdayNames()`, a native `<select>` bound `x-model="row.routineTemplateId"` with a "Rest" option value `""` and one option per routine from `GET /api/routines`, label `routineName (totalMinutes min)`); `Save`/`Cancel` Buttons. A native `<select>` is allowed — no shared select primitive exists; note it in the component doc comment and inventory.

Pages: `/training/schedules` (list with active badge, Activate/Deactivate `Button`s, New schedule `GameCard`), `/training/schedules/new`, `/training/schedules/edit?schedule=<id>`. `/training/index.astro` gains `<TodayCard />` inside a `x-data="todayCard()"` wrapper above the routine list.

- [ ] **Step 4: Gates and commit**

```bash
cd app && npm test && npm run validate:app && npm run format && cd ..
bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh && bash scripts/check-test-coverage.sh
git add -A app/src/lib/training/schedules app/src/lib/client/alpine/register-route-data.ts app/src/components/layout/training/schedules app/src/pages/training app/tests
git commit -m "feat(training): Today card, schedule list and editor (client-side weekday resolution)"
```

---

### Task 5: Docs, decisions, gates

- `02-Template-Layer.md`: two new sections (`training_schedules`, `training_schedule_days`); `05-Views/00-Overview.md`: two views; `03-Migrations.md`: `## 0040…`; chain range everywhere (`0001`–`0040`).
- `06-API/00-Overview.md` route surface + `04-Endpoint-Contracts.md` new "Training Schedules" section (contract + DTOs + the `deleteRoutine` mapping).
- `09-Training/01-Routines.md` §7: sub-heading under the "Training Plan" note — a schedule is not the multi-block plan; one routine per day, the ≤60-minute block intact.
- `07-Frontend/08-Component-Inventory.md`: three components; `00-Overview.md` if it lists training routes.
- `DECISIONS.md` Deferred list: remove the schedules entry; add "schedule adherence (needs schedule history)".
- Decisions (derive ids): `decisions/database.md` — weekday `SMALLINT` (Pattern 12 exception), rest = absent row, `RESTRICT` + service mapping; `decisions/api.md` — client-side "today", `/active` read; File Inventory rows; history entry; `context-maintenance`; `run-all-gates`; discovered work → issues.

```bash
git add docs decisions DECISIONS.md CLAUDE.md database/CLAUDE.md
git commit -m "docs: weekly training schedules — template layer, API contract, frontend inventory, decisions"
```

---

## Self-review against the spec

§3 → Task 1; §3.1–3.2 → Task 1; §4 → Task 3; §5 → Task 4 (`today.ts`, `/active`); §6 → Task 4; §7 → Tasks 1–4; §8 → Task 5; §9 adherence → Deferred list (Task 5). Names consistent across tasks: `findScheduleDayRows`, `setActiveSchedule`, `clearActiveSchedule`, `findScheduleIdsUsingRoutine`, `getActiveSchedule`, `todayEntry`, `isoWeekday`, `weekdayNames`.
