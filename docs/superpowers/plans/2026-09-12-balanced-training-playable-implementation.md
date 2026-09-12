# Making Balanced Training Playable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Balanced Training's Start button work end-to-end — orchestrate its 4 steps (Warm-Up, Switching, Double Pattern, Finishing/TUOD), persist each step's own session, and return to `/training` on completion.

**Architecture:** A new `training-session.service.ts` (parallel to `session.service.ts`, D264) resolves the routine template into a snapshot, mints one `activities` row, then mints one `exercise_sessions` row per step as the player reaches it — reusing the existing exercise engines, the existing TUOD play UI, and a generalized visual-board input panel. Three new thin API routes front the service; everything else (dart/turn capture, per-session status) reuses existing, untouched endpoints.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Drizzle (Neon/Postgres), Vitest, Zod.

## Global Constraints

- Never modify applied migrations (`0001`-`0032`); this plan needs no new migration — `routine_step_sequence_number`, `exercise_ruleset_version_id`, `exercise_type_id` NOT NULL all already exist (migrations 0029-0031, confirmed against current `main`).
- Every existing caller of `insertSessionRecords`/`insertSessionWithActiveGuard`/`createSession` keeps its exact current behavior — every change here is additive (new exported functions, new optional fields).
- `app/CLAUDE.md`: TDD mandatory — write the failing test before the implementation, in every task. `scripts/check-test-coverage.sh` fails a runtime `.ts` source change with no covering test touched in the same change set.
- `ExerciseEngine`/`DartExerciseEngine` stay parallel to `GameEngine` (D264) — no task here touches `modules/exercise/*.engine.module.ts` or the exercise ruleset registries; they are consumed as-is.
- Styling: semantic tokens only, reuse `components/forms/Button.astro` for actions, `cn()` for class composition — `07-Style-Guide.md`.
- Format: `cd app && npm run format` before any commit that touches `.astro`/`.ts`.
- Source spec: `docs/superpowers/specs/2026-09-12-balanced-training-playable-design.md` (validated against `main` commit `e351f3a`). This plan refines three of its mechanisms with exact signatures discovered while reading the current code (noted per-task) — the spec's scope decisions (§2) are unchanged.

---

## File Map

| File | Status | Responsibility |
| --- | --- | --- |
| `app/src/repositories/interfaces.ts` | modify | Widen `CreateSessionRecordsInput`; add `RoutineStepTemplateRow` |
| `app/src/repositories/session.repository.ts` | modify | Split `insertSessionRecords` into `insertActivityRecord` + `insertExerciseSessionRecord` (both exported); add `findExerciseRulesetVersionId` |
| `app/src/repositories/training-session.repository.ts` | **create** | `findRoutineTemplateSteps`, `insertTrainingActivity` |
| `app/src/services/session.service.ts` | modify | Export `isActiveSessionConflict` (one line) |
| `app/src/services/training-session.service.ts` | **create** | `startTraining`, `startTrainingStep`, `completeTraining` |
| `app/src/pages/api/training-sessions/types.ts` | **create** | Request/response Zod schemas |
| `app/src/pages/api/training-sessions/index.ts` | **create** | `POST /api/training-sessions` |
| `app/src/pages/api/training-sessions/[activityId]/steps/[sequenceNumber].ts` | **create** | `POST .../steps/[sequenceNumber]` |
| `app/src/pages/api/training-sessions/[activityId]/complete.ts` | **create** | `PATCH .../complete` |
| `app/src/pages/api/types.ts` | modify | Barrel: add `export * from "./training-sessions/types"` |
| `app/src/lib/client/api/training-sessions.ts` | **create** | Browser client wrapper (mirrors `lib/client/api/sessions.ts`) |
| `app/src/lib/client/api/types.ts` | modify | Barrel: re-export the new request/response types |
| `app/src/lib/game/board-input.data.ts` | modify | `boardInputData()`/`markersForTurns()` take a turns accessor param |
| `app/src/components/layout/games/BoardInputPanel.astro` | modify | One-line call-site update for the new param |
| `app/src/components/layout/training/ExerciseBoardInputPanel.astro` | **create** | Board + magnifier + undo for a non-game exercise session |
| `app/src/lib/exercise/solo-participant-upload.ts` | **create** | Remaps `SOLO_PARTICIPANT_REF` turns to the session's real participant id before upload |
| `app/src/lib/training/balanced-training-play.data.ts` | **create** | Page store: routine orchestration + all 4 steps |
| `app/src/pages/training/balanced-training/play/index.astro` | **create** | Play page, per-step markup |
| `app/src/components/layout/training/WarmUpPanel.astro` | **create** | Warm-Up phase display |
| `app/src/components/layout/training/SwitchingPanel.astro` | **create** | Switching target/score display, wraps `ExerciseBoardInputPanel` |
| `app/src/components/layout/training/DoublePatternPanel.astro` | **create** | Double Pattern target/score display, wraps `ExerciseBoardInputPanel` |
| `app/src/components/layout/training/RoutineDetail.astro` | modify | Start button: drop `disabled`, wire `@click` |
| `app/src/lib/training/routine-start.data.ts` | **create** | The Start button's small `x-data` wrapper |

---

### Task 1: Split `insertSessionRecords`; widen `CreateSessionRecordsInput`

**Files:**
- Modify: `app/src/repositories/interfaces.ts`
- Modify: `app/src/repositories/session.repository.ts:332-375` (current `insertSessionRecords`)
- Test: `app/tests/repositories/session.repository.test.ts`

**Interfaces:**
- Produces: `insertActivityRecord(tx, params): Promise<void>`, `insertExerciseSessionRecord(tx, params): Promise<{ sessionId: string }>`, both exported from `session.repository.ts`. `insertSessionRecords(input)` keeps its exact current signature and behavior (now calls both internally).
- Produces: `findExerciseRulesetVersionId(db, key): Promise<string | undefined>`.

`CreateSessionRecordsInput` today requires `gameTypeId`/`rulesetVersionId`/`captureModeId`/`inputModeId` (the columns are nullable in `exercise_sessions`, migration 0029) and has no `exerciseRulesetVersionId`/`routineStepSequenceNumber`. Widen it so the same interface covers a non-game insert too:

```ts
// app/src/repositories/interfaces.ts — replace the existing CreateSessionRecordsInput
export interface CreateSessionRecordsInput {
  activityId: string;
  sessionId: string;
  configurationId: string;
  participants: {
    id: string;
    participantTypeId: number;
    playerId: string | null;
    displayName: string;
  }[];
  playerId: string;
  gameTypeId?: string;
  rulesetVersionId?: string;
  captureModeId?: number;
  inputModeId?: number;
  activeStatusId: number;
  exerciseTypeId: string;
  exerciseRulesetVersionId?: string;
  routineStepSequenceNumber?: number;
  configuration: Record<string, unknown>;
}

export interface RoutineStepTemplateRow {
  sequenceNumber: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  durationTypeKey: string;
  durationValue: number;
  defaultConfiguration: unknown;
  stepConfiguration: unknown;
}
```

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/repositories/session.repository.test.ts`, inside the existing `vi.mock("@db/client", ...)` block's file (after the existing `describe("insertSessionRecords", ...)`):

```ts
describe("insertActivityRecord", () => {
  beforeEach(() => {
    insertedValuesByTable.clear();
  });

  it("inserts one activities row with the given id", async () => {
    const { insertActivityRecord } =
      await import("@repositories/session.repository");
    const { activities } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    await withTransaction((tx) =>
      insertActivityRecord(tx as any, {
        activityId: "act-1",
        playerId: "p1",
        activeStatusId: 1,
      }),
    );
    const row = insertedValuesByTable.get(activities) as { id?: string };
    expect(row.id).toBe("act-1");
  });
});

describe("insertExerciseSessionRecord", () => {
  beforeEach(() => {
    insertedValuesByTable.clear();
  });

  it("does not touch the activities table", async () => {
    const { insertExerciseSessionRecord } =
      await import("@repositories/session.repository");
    const { activities } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    await withTransaction((tx) =>
      insertExerciseSessionRecord(tx as any, {
        activityId: "act-1",
        sessionId: "s1",
        configurationId: "c1",
        participants: [
          { id: "pt1", participantTypeId: 1, playerId: "p1", displayName: "Levi" },
        ],
        playerId: "p1",
        activeStatusId: 1,
        exerciseTypeId: "et-warmup",
        exerciseRulesetVersionId: "erv-1",
        routineStepSequenceNumber: 1,
        configuration: { phases: [] },
      }),
    );
    expect(insertedValuesByTable.has(activities)).toBe(false);
  });

  it("writes routineStepSequenceNumber and exerciseRulesetVersionId onto the row", async () => {
    const { insertExerciseSessionRecord } =
      await import("@repositories/session.repository");
    const { exerciseSessions } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    await withTransaction((tx) =>
      insertExerciseSessionRecord(tx as any, {
        activityId: "act-1",
        sessionId: "s1",
        configurationId: "c1",
        participants: [
          { id: "pt1", participantTypeId: 1, playerId: "p1", displayName: "Levi" },
        ],
        playerId: "p1",
        activeStatusId: 1,
        exerciseTypeId: "et-warmup",
        exerciseRulesetVersionId: "erv-1",
        routineStepSequenceNumber: 2,
        configuration: { phases: [] },
      }),
    );
    const row = insertedValuesByTable.get(exerciseSessions) as {
      routineStepSequenceNumber?: number;
      exerciseRulesetVersionId?: string;
      gameTypeId?: string | null;
    };
    expect(row.routineStepSequenceNumber).toBe(2);
    expect(row.exerciseRulesetVersionId).toBe("erv-1");
    expect(row.gameTypeId).toBeUndefined();
  });
});

describe("findExerciseRulesetVersionId", () => {
  it("returns the id for a matching implementation key", async () => {
    const db = { select: vi.fn(() => fakeSelect([{ id: "erv1" }])) } as any;
    const { findExerciseRulesetVersionId } =
      await import("@repositories/session.repository");
    const result = await findExerciseRulesetVersionId(db, "WARM_UP_V1");
    expect(result).toBe("erv1");
  });

  it("returns undefined when no row matches", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findExerciseRulesetVersionId } =
      await import("@repositories/session.repository");
    const result = await findExerciseRulesetVersionId(db, "UNKNOWN");
    expect(result).toBeUndefined();
  });
});
```

`fakeSelect` is the helper already defined near the top of this test file — no new import needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: FAIL — `insertActivityRecord`/`insertExerciseSessionRecord`/`findExerciseRulesetVersionId` are not exported yet.

- [ ] **Step 3: Widen the interface**

Apply the `CreateSessionRecordsInput`/`RoutineStepTemplateRow` change above to `app/src/repositories/interfaces.ts`.

- [ ] **Step 4: Split the implementation**

In `app/src/repositories/session.repository.ts`, replace the current `insertSessionRecords` (lines 332-375) with:

```ts
type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

export async function insertActivityRecord(
  tx: Tx,
  input: { activityId: string; playerId: string; activeStatusId: number },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(activities).values({
    id: input.activityId,
    playerId: input.playerId,
    statusId: input.activeStatusId,
    startedAt: now,
    createdAt: now,
  });
}

export async function insertExerciseSessionRecord(
  tx: Tx,
  input: Omit<CreateSessionRecordsInput, "participants"> & {
    participants: CreateSessionRecordsInput["participants"];
  },
): Promise<{ sessionId: string }> {
  const now = new Date().toISOString();
  await tx.insert(exerciseSessions).values({
    id: input.sessionId,
    activityId: input.activityId,
    playerId: input.playerId,
    gameTypeId: input.gameTypeId ?? null,
    captureModeId: input.captureModeId ?? null,
    inputModeId: input.inputModeId ?? null,
    statusId: input.activeStatusId,
    rulesetVersionId: input.rulesetVersionId ?? null,
    exerciseTypeId: input.exerciseTypeId,
    exerciseRulesetVersionId: input.exerciseRulesetVersionId ?? null,
    routineStepSequenceNumber: input.routineStepSequenceNumber ?? null,
    startedAt: now,
    createdAt: now,
  });
  await tx.insert(exerciseConfigurations).values({
    id: input.configurationId,
    exerciseSessionId: input.sessionId,
    configuration: input.configuration,
    createdAt: now,
  });
  await tx.insert(participants).values(
    input.participants.map((participant) => ({
      id: participant.id,
      exerciseSessionId: input.sessionId,
      participantTypeId: participant.participantTypeId,
      playerId: participant.playerId,
      displayName: participant.displayName,
      createdAt: now,
    })),
  );
  return { sessionId: input.sessionId };
}

export async function insertSessionRecords(
  input: CreateSessionRecordsInput,
): Promise<{ sessionId: string }> {
  return withTransaction(async (tx) => {
    await insertActivityRecord(tx, {
      activityId: input.activityId,
      playerId: input.playerId,
      activeStatusId: input.activeStatusId,
    });
    return insertExerciseSessionRecord(tx, input);
  });
}
```

Add `findExerciseRulesetVersionId` next to the existing `findExerciseTypeId` (same file):

```ts
export async function findExerciseRulesetVersionId(
  db: Db,
  key: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: exerciseRulesetVersions.id })
    .from(exerciseRulesetVersions)
    .where(eq(exerciseRulesetVersions.implementationKey, key))
    .limit(1);
  return row?.id;
}
```

Add `exerciseRulesetVersions` to this file's existing `@db/schema` import list.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: PASS, all cases including the pre-existing `insertSessionRecords` ones (unchanged behavior).

- [ ] **Step 6: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: 0 errors; full suite green (this only adds exports, nothing existing changed shape).

- [ ] **Step 7: Commit**

```bash
git add app/src/repositories/interfaces.ts app/src/repositories/session.repository.ts app/tests/repositories/session.repository.test.ts
git commit -m "refactor(app): split insertSessionRecords into activity/session inserts

Training routines need a step's own exercise_sessions row to join an
already-existing activities row, which insertSessionRecords could not
express — it always minted both together. insertActivityRecord and
insertExerciseSessionRecord are the same two inserts, now independently
callable; insertSessionRecords itself is unchanged for every existing
caller."
```

---

### Task 2: `training-session.repository.ts` — resolve a routine template, create its activity

**Files:**
- Create: `app/src/repositories/training-session.repository.ts`
- Test: `app/tests/repositories/training-session.repository.test.ts`

**Interfaces:**
- Consumes: `withTransaction`, `Tx` type, `activities`, `activityConfigurations`, `routineTemplates`, `routineSteps`, `exerciseTemplates`, `exerciseTypes`, `exerciseRulesetVersions`, `durationTypes`, `gameTypes` from `@db/schema`; `RoutineStepTemplateRow` from `./interfaces` (Task 1).
- Produces: `findRoutineTemplateSteps(db, routineTemplateName): Promise<{ routineTemplateId: string; steps: RoutineStepTemplateRow[] } | undefined>`, `insertTrainingActivity(input: { activityId: string; playerId: string; activeStatusId: number; configurationId: string; configuration: unknown }): Promise<void>`.

Exactly one `exercise_ruleset_version` per `exercise_type` exists today for every non-`GAME` exercise type (`WARM_UP_V1`/`SWITCHING_V1`/`DOUBLE_PATTERN_V1` — confirmed, one engine factory registers each). The `leftJoin` below relies on that; a second version for the same exercise type would fan this query out and needs its own resolution, same as `rulesetVersions` already requires the client to name a version explicitly for games with more than one.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/repositories/training-session.repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

function fakeSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

describe("findRoutineTemplateSteps", () => {
  it("returns undefined when no system routine matches the name", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    const result = await findRoutineTemplateSteps(db, "Unknown Routine");
    expect(result).toBeUndefined();
  });

  it("returns the routine id and its resolved steps in sequence order", async () => {
    const templateRow = [{ id: "rt-1" }];
    const stepRows = [
      {
        sequenceNumber: 1,
        exerciseTypeKey: "WARM_UP",
        exerciseRulesetVersionKey: "WARM_UP_V1",
        gameTypeKey: null,
        durationTypeKey: "MINUTES",
        durationValue: 10,
        defaultConfiguration: { phases: [{ name: "Upper", targets: [5], weight: 1 }] },
        stepConfiguration: null,
      },
      {
        sequenceNumber: 4,
        exerciseTypeKey: "GAME",
        exerciseRulesetVersionKey: null,
        gameTypeKey: "TUOD",
        durationTypeKey: "MINUTES",
        durationValue: 10,
        defaultConfiguration: null,
        stepConfiguration: { starting_target: 41 },
      },
    ];
    let call = 0;
    const db = {
      select: vi.fn(() => fakeSelect(call++ === 0 ? templateRow : stepRows)),
    } as any;
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    const result = await findRoutineTemplateSteps(db, "Balanced Training");
    expect(result?.routineTemplateId).toBe("rt-1");
    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[1].gameTypeKey).toBe("TUOD");
  });
});

const insertedValuesByTable = new Map<unknown, unknown>();
vi.mock("@db/client", () => ({
  withTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          insertedValuesByTable.set(table, values);
          return Promise.resolve();
        },
      }),
    };
    return fn(tx);
  }),
}));

describe("insertTrainingActivity", () => {
  beforeEach(() => {
    insertedValuesByTable.clear();
  });

  it("inserts one activities row and one activity_configurations row", async () => {
    const { insertTrainingActivity } =
      await import("@repositories/training-session.repository");
    const { activities, activityConfigurations } = await import("@db/schema");
    await insertTrainingActivity({
      activityId: "act-1",
      playerId: "p1",
      activeStatusId: 1,
      configurationId: "cfg-1",
      configuration: { routineName: "Balanced Training", steps: [] },
    });
    expect((insertedValuesByTable.get(activities) as { id?: string }).id).toBe(
      "act-1",
    );
    expect(
      (insertedValuesByTable.get(activityConfigurations) as { activityId?: string })
        .activityId,
    ).toBe("act-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/repositories/training-session.repository.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// app/src/repositories/training-session.repository.ts
import { and, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  activities,
  activityConfigurations,
  durationTypes,
  exerciseRulesetVersions,
  exerciseTemplates,
  exerciseTypes,
  gameTypes,
  routineSteps,
  routineTemplates,
} from "@db/schema";
import type { RoutineStepTemplateRow } from "./interfaces";

type Db = ReturnType<typeof getDb>;

export async function findRoutineTemplateSteps(
  db: Db,
  routineTemplateName: string,
): Promise<
  { routineTemplateId: string; steps: RoutineStepTemplateRow[] } | undefined
> {
  const [template] = await db
    .select({ id: routineTemplates.id })
    .from(routineTemplates)
    .where(
      and(
        eq(routineTemplates.name, routineTemplateName),
        eq(routineTemplates.isSystemTemplate, true),
      ),
    )
    .limit(1);
  if (!template) return undefined;

  const steps = await db
    .select({
      sequenceNumber: routineSteps.sequenceNumber,
      exerciseTypeKey: exerciseTypes.implementationKey,
      exerciseRulesetVersionKey: exerciseRulesetVersions.implementationKey,
      gameTypeKey: gameTypes.implementationKey,
      durationTypeKey: durationTypes.implementationKey,
      durationValue: routineSteps.durationValue,
      defaultConfiguration: exerciseTemplates.defaultConfiguration,
      stepConfiguration: routineSteps.configuration,
    })
    .from(routineSteps)
    .innerJoin(
      exerciseTemplates,
      eq(exerciseTemplates.id, routineSteps.exerciseTemplateId),
    )
    .innerJoin(
      exerciseTypes,
      eq(exerciseTypes.id, exerciseTemplates.exerciseTypeId),
    )
    .innerJoin(durationTypes, eq(durationTypes.id, routineSteps.durationTypeId))
    .leftJoin(gameTypes, eq(gameTypes.id, exerciseTemplates.gameTypeId))
    .leftJoin(
      exerciseRulesetVersions,
      eq(exerciseRulesetVersions.exerciseTypeId, exerciseTemplates.exerciseTypeId),
    )
    .where(eq(routineSteps.routineTemplateId, template.id))
    .orderBy(routineSteps.sequenceNumber);

  return { routineTemplateId: template.id, steps };
}

export async function insertTrainingActivity(input: {
  activityId: string;
  playerId: string;
  activeStatusId: number;
  configurationId: string;
  configuration: unknown;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const now = new Date().toISOString();
    await tx.insert(activities).values({
      id: input.activityId,
      playerId: input.playerId,
      statusId: input.activeStatusId,
      startedAt: now,
      createdAt: now,
    });
    await tx.insert(activityConfigurations).values({
      id: input.configurationId,
      activityId: input.activityId,
      configuration: input.configuration,
      createdAt: now,
    });
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/repositories/training-session.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 6: Commit**

```bash
git add app/src/repositories/training-session.repository.ts app/tests/repositories/training-session.repository.test.ts
git commit -m "feat(app): add training-session.repository for routine resolution"
```

---

### Task 3: `training-session.service.ts` — `startTraining`

**Files:**
- Create: `app/src/services/training-session.service.ts`
- Create: `app/src/services/training-session.types.ts`
- Test: `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Consumes: `findRoutineTemplateSteps`, `insertTrainingActivity` (Task 2); `findGameStatusId` (existing, from `session.repository.ts`); `generateId` (`@lib/id`).
- Produces:

```ts
// app/src/services/training-session.types.ts
export type TrainingStepResolved = {
  sequenceNumber: number;
  exerciseTypeKey: "WARM_UP" | "SWITCHING" | "DOUBLE_PATTERN" | "GAME";
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  durationSeconds: number;
  configuration: Record<string, unknown>;
};

export type StartTrainingResult = {
  activityId: string;
  routineName: string;
  steps: TrainingStepResolved[];
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; details?: Record<string, unknown> };
```

`WARM_UP`'s resolved `configuration` gains a `stepDurationSeconds` field (the routine step's own duration) — `WarmUpEngineInput` needs it and neither `default_configuration` (only `phases`) nor `routine_steps.configuration` (`NULL` for this step) carries it.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/services/training-session.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@lib/id", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("@repositories/training-session.repository", () => ({
  findRoutineTemplateSteps: vi.fn(),
  insertTrainingActivity: vi.fn(),
}));
vi.mock("@repositories/session.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repositories/session.repository")>();
  return { ...actual, findGameStatusId: vi.fn() };
});

import * as trainingRepo from "@repositories/training-session.repository";
import * as sessionRepo from "@repositories/session.repository";
import { startTraining } from "@services/training-session.service";

const RESOLVED = {
  routineTemplateId: "rt-1",
  steps: [
    {
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      gameTypeKey: null,
      durationTypeKey: "MINUTES",
      durationValue: 10,
      defaultConfiguration: { phases: [{ name: "Upper", targets: [5], weight: 1 }] },
      stepConfiguration: null,
    },
    {
      sequenceNumber: 4,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: "TUOD",
      durationTypeKey: "MINUTES",
      durationValue: 10,
      defaultConfiguration: null,
      stepConfiguration: { starting_target: 41 },
    },
  ],
};

describe("startTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns VALIDATION_FAILED when the routine name has no system template", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(undefined);
    const result = await startTraining("p1", "Unknown Routine");
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateName" },
    });
  });

  it("resolves steps, injects stepDurationSeconds for WARM_UP, and creates the activity", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "Balanced Training");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.activityId).toBe("generated-id");
    expect(result.data.routineName).toBe("Balanced Training");
    expect(result.data.steps[0]).toMatchObject({
      exerciseTypeKey: "WARM_UP",
      durationSeconds: 600,
      configuration: { stepDurationSeconds: 600, phases: RESOLVED.steps[0].defaultConfiguration.phases },
    });
    expect(result.data.steps[1]).toMatchObject({
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      configuration: { starting_target: 41 },
    });
    expect(trainingRepo.insertTrainingActivity).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: "generated-id", playerId: "p1" }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: FAIL — `@services/training-session.service` does not exist.

- [ ] **Step 3: Implement**

```ts
// app/src/services/training-session.service.ts
import { generateId } from "@lib/id";
import { findGameStatusId } from "@repositories/session.repository";
import {
  findRoutineTemplateSteps,
  insertTrainingActivity,
} from "@repositories/training-session.repository";
import { getDb } from "@db/client";
import type {
  ServiceResult,
  StartTrainingResult,
  TrainingStepResolved,
} from "./training-session.types";

const EXERCISE_TYPE_KEYS = new Set([
  "WARM_UP",
  "SWITCHING",
  "DOUBLE_PATTERN",
  "GAME",
]);

function durationSecondsFor(durationTypeKey: string, durationValue: number): number {
  return durationTypeKey === "MINUTES" ? durationValue * 60 : durationValue;
}

function resolveStep(
  row: Awaited<ReturnType<typeof findRoutineTemplateSteps>> extends
    | { steps: (infer S)[] }
    | undefined
    ? S
    : never,
): TrainingStepResolved {
  if (!EXERCISE_TYPE_KEYS.has(row.exerciseTypeKey)) {
    throw new Error(`unknown exerciseTypeKey ${row.exerciseTypeKey}`);
  }
  const durationSeconds = durationSecondsFor(row.durationTypeKey, row.durationValue);
  const configuration: Record<string, unknown> = {
    ...(row.defaultConfiguration as Record<string, unknown> | null),
    ...(row.stepConfiguration as Record<string, unknown> | null),
  };
  if (row.exerciseTypeKey === "WARM_UP") {
    configuration.stepDurationSeconds = durationSeconds;
  }
  return {
    sequenceNumber: row.sequenceNumber,
    exerciseTypeKey: row.exerciseTypeKey as TrainingStepResolved["exerciseTypeKey"],
    exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
    gameTypeKey: row.gameTypeKey,
    durationSeconds,
    configuration,
  };
}

export async function startTraining(
  playerId: string,
  routineTemplateName: string,
): Promise<ServiceResult<StartTrainingResult>> {
  const db = getDb();
  const resolved = await findRoutineTemplateSteps(db, routineTemplateName);
  if (!resolved) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateName" },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  if (!activeStatusId) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
  }

  const steps = resolved.steps.map(resolveStep);
  const activityId = generateId();
  await insertTrainingActivity({
    activityId,
    playerId,
    activeStatusId,
    configurationId: generateId(),
    configuration: { routineName: routineTemplateName, steps },
  });

  return { ok: true, data: { activityId, routineName: routineTemplateName, steps } };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/training-session.service.ts app/src/services/training-session.types.ts app/tests/services/training-session.service.test.ts
git commit -m "feat(app): add training-session.service startTraining"
```

---

### Task 4: `training-session.service.ts` — `startTrainingStep`

**Files:**
- Modify: `app/src/services/session.service.ts` (export `isActiveSessionConflict`)
- Modify: `app/src/services/training-session.service.ts`
- Modify: `app/src/services/training-session.types.ts`
- Test: `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Consumes: `isActiveSessionConflict` (now exported), `findActiveSessionForGameType`, `findExerciseTypeId`, `findExerciseRulesetVersionId`, `findGameTypeAndRuleset`, `findCaptureModeId`, `findInputModeId`, `findParticipantTypeId`, `findPlayerDisplayName`, `insertExerciseSessionRecord` (all existing or Task 1).
- Produces:

```ts
// add to training-session.types.ts
export type StartTrainingStepResult = {
  sessionId: string;
  exerciseTypeKey: TrainingStepResolved["exerciseTypeKey"];
  configuration: Record<string, unknown>;
  participant: { ref: string; displayName: string };
  gameTypeKey?: string;
  rulesetVersionKey?: string;
  captureModeKey?: string;
  inputModeKey?: string;
};
```

`startTrainingStep` reads the step from the activity's OWN `activity_configurations` snapshot (runtime immutability — never the live template). For v1 Finishing always runs as a single `PLAYER` seat, matching `createSession`'s own default when `participants` is omitted. Fixed constant for Finishing's ruleset — `TUOD` has exactly one ruleset version today, and every other TUOD call site (`tuod-play.data.ts`) already hardcodes the same key rather than deriving it, since `exercise_templates` carries no ruleset-version FK for its `GAME` row.

- [ ] **Step 1: Export the one helper**

In `app/src/services/session.service.ts`, change:

```ts
function isActiveSessionConflict(error: unknown): boolean {
```

to:

```ts
export function isActiveSessionConflict(error: unknown): boolean {
```

- [ ] **Step 2: Write the failing tests**

Append to `app/tests/services/training-session.service.test.ts` (extend the existing mocks: add `findActivityConfiguration: vi.fn()` to the `training-session.repository` mock, and to the `session.repository` mock add `findExerciseTypeId`, `findExerciseRulesetVersionId`, `findGameTypeAndRuleset`, `findCaptureModeId`, `findInputModeId`, `findParticipantTypeId`, `findPlayerDisplayName`, `insertExerciseSessionRecord`, `findActiveSessionForGameType`):

```ts
vi.mock("@repositories/training-session.repository", () => ({
  findRoutineTemplateSteps: vi.fn(),
  insertTrainingActivity: vi.fn(),
  findActivityConfiguration: vi.fn(),
}));
vi.mock("@repositories/session.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repositories/session.repository")>();
  return {
    ...actual,
    findGameStatusId: vi.fn(),
    findExerciseTypeId: vi.fn(),
    findExerciseRulesetVersionId: vi.fn(),
    findGameTypeAndRuleset: vi.fn(),
    findCaptureModeId: vi.fn(),
    findInputModeId: vi.fn(),
    findParticipantTypeId: vi.fn(),
    findPlayerDisplayName: vi.fn(),
    insertExerciseSessionRecord: vi.fn(),
    findActiveSessionForGameType: vi.fn(),
  };
});

import { startTrainingStep } from "@services/training-session.service";

const SNAPSHOT = {
  routineName: "Balanced Training",
  steps: [
    {
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      gameTypeKey: null,
      durationSeconds: 600,
      configuration: { stepDurationSeconds: 600, phases: [] },
    },
    {
      sequenceNumber: 4,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: "TUOD",
      durationSeconds: 600,
      configuration: { starting_target: 41 },
    },
  ],
};

describe("startTrainingStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns VALIDATION_FAILED for an out-of-range sequenceNumber", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    const result = await startTrainingStep("p1", "act-1", 99);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown sequenceNumber" },
    });
  });

  it("inserts a non-game exercise session for WARM_UP", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-warmup");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue("erv-1");
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exerciseTypeKey).toBe("WARM_UP");
    expect(sessionRepo.insertExerciseSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: "act-1",
        exerciseTypeId: "et-warmup",
        exerciseRulesetVersionId: "erv-1",
        routineStepSequenceNumber: 1,
        gameTypeId: undefined,
        rulesetVersionId: undefined,
      }),
    );
  });

  it("inserts a GAME exercise session for Finishing, resolving TUOD_V1", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-tuod",
      rulesetVersionId: "rv-tuod-1",
    });
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.gameTypeKey).toBe("TUOD");
    expect(result.data.rulesetVersionKey).toBe("TUOD_V1");
    expect(sessionRepo.findGameTypeAndRuleset).toHaveBeenCalledWith(
      expect.anything(),
      "TUOD",
      "TUOD_V1",
    );
  });

  it("returns SESSION_ALREADY_ACTIVE when the Finishing insert hits the unique-active conflict", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-tuod",
      rulesetVersionId: "rv-tuod-1",
    });
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockRejectedValue({
      code: "23505",
      constraint: "uq_sessions_single_active",
    });
    vi.mocked(sessionRepo.findActiveSessionForGameType).mockResolvedValue({
      sessionId: "active-1",
      startedAt: "2026-09-12T00:00:00Z",
    });

    const result = await startTrainingStep("p1", "act-1", 4);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-1" },
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: FAIL — `startTrainingStep`/`findActivityConfiguration` don't exist yet.

- [ ] **Step 4: Add `findActivityConfiguration` to the repository (Task 2's file)**

```ts
// app/src/repositories/training-session.repository.ts — add
export async function findActivityConfiguration(
  db: Db,
  activityId: string,
): Promise<{ routineName: string; steps: RoutineStepTemplateRow[] } | undefined> {
  const [row] = await db
    .select({ configuration: activityConfigurations.configuration })
    .from(activityConfigurations)
    .where(eq(activityConfigurations.activityId, activityId))
    .limit(1);
  return row?.configuration as
    | { routineName: string; steps: RoutineStepTemplateRow[] }
    | undefined;
}
```

Note: the column actually stores `TrainingStepResolved[]` (Task 3's shape) under `steps`, not the raw `RoutineStepTemplateRow[]` — reuse `TrainingStepResolved` as the return type instead (update the signature to import it from `./training-session.types` once Task 3's file exists; avoid a circular import by keeping this function's return type as `unknown` cast at the call site in the service, matching how `ConfigSnapshot` is read elsewhere).

- [ ] **Step 5: Implement `startTrainingStep`**

```ts
// app/src/services/training-session.service.ts — add
import { generateId } from "@lib/id";
import {
  findActivityConfiguration,
  findRoutineTemplateSteps,
  insertTrainingActivity,
} from "@repositories/training-session.repository";
import {
  findCaptureModeId,
  findExerciseRulesetVersionId,
  findExerciseTypeId,
  findGameStatusId,
  findGameTypeAndRuleset,
  findInputModeId,
  findParticipantTypeId,
  findPlayerDisplayName,
  insertExerciseSessionRecord,
  findActiveSessionForGameType,
} from "@repositories/session.repository";
import { isActiveSessionConflict } from "./session.service";
import type {
  ServiceResult,
  StartTrainingStepResult,
  TrainingStepResolved,
} from "./training-session.types";

const FINISHING_GAME_TYPE_KEY = "TUOD";
const FINISHING_RULESET_VERSION_KEY = "TUOD_V1";

export async function startTrainingStep(
  playerId: string,
  activityId: string,
  sequenceNumber: number,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const db = getDb();
  const snapshot = await findActivityConfiguration(db, activityId);
  const step = (snapshot?.steps as TrainingStepResolved[] | undefined)?.find(
    (candidate) => candidate.sequenceNumber === sequenceNumber,
  );
  if (!step) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown sequenceNumber" },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  const playerParticipantTypeId = await findParticipantTypeId(db, "PLAYER");
  const displayName = await findPlayerDisplayName(db, playerId);
  if (!activeStatusId || !playerParticipantTypeId || !displayName) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
  }

  const participantId = generateId();
  const participants = [
    {
      id: participantId,
      participantTypeId: playerParticipantTypeId,
      playerId,
      displayName,
    },
  ];
  const sessionId = generateId();

  if (step.exerciseTypeKey === "GAME") {
    const exerciseTypeId = await findExerciseTypeId(db, "GAME");
    const gameLookup = await findGameTypeAndRuleset(
      db,
      FINISHING_GAME_TYPE_KEY,
      FINISHING_RULESET_VERSION_KEY,
    );
    const captureModeId = await findCaptureModeId(db, "ANALYTICS");
    const inputModeId = await findInputModeId(db, "VISUAL_BOARD");
    if (!exerciseTypeId || !gameLookup || !captureModeId || !inputModeId) {
      return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
    }
    try {
      await insertExerciseSessionRecord({
        activityId,
        sessionId,
        configurationId: generateId(),
        participants,
        playerId,
        gameTypeId: gameLookup.gameTypeId,
        rulesetVersionId: gameLookup.rulesetVersionId,
        captureModeId,
        inputModeId,
        activeStatusId,
        exerciseTypeId,
        routineStepSequenceNumber: sequenceNumber,
        configuration: step.configuration,
      } as never);
    } catch (error) {
      if (!isActiveSessionConflict(error)) throw error;
      const active = await findActiveSessionForGameType(
        db,
        playerId,
        gameLookup.gameTypeId,
      );
      return active
        ? {
            ok: false,
            code: "SESSION_ALREADY_ACTIVE",
            details: { sessionId: active.sessionId, startedAt: active.startedAt },
          }
        : { ok: false, code: "INTERNAL_ERROR", details: { reason: "conflict with no active row" } };
    }
    return {
      ok: true,
      data: {
        sessionId,
        exerciseTypeKey: "GAME",
        configuration: step.configuration,
        participant: { ref: participantId, displayName },
        gameTypeKey: FINISHING_GAME_TYPE_KEY,
        rulesetVersionKey: FINISHING_RULESET_VERSION_KEY,
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      },
    };
  }

  const exerciseTypeId = await findExerciseTypeId(db, step.exerciseTypeKey);
  const exerciseRulesetVersionId = step.exerciseRulesetVersionKey
    ? await findExerciseRulesetVersionId(db, step.exerciseRulesetVersionKey)
    : undefined;
  if (!exerciseTypeId) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
  }
  await insertExerciseSessionRecord({
    activityId,
    sessionId,
    configurationId: generateId(),
    participants,
    playerId,
    activeStatusId,
    exerciseTypeId,
    exerciseRulesetVersionId,
    routineStepSequenceNumber: sequenceNumber,
    configuration: step.configuration,
  } as never);

  return {
    ok: true,
    data: {
      sessionId,
      exerciseTypeKey: step.exerciseTypeKey,
      configuration: step.configuration,
      participant: { ref: participantId, displayName },
    },
  };
}
```

`ANALYTICS`/`VISUAL_BOARD` are the fixed capture/input modes for Finishing inside a routine — the spec's §6 reuses TUOD's existing visual-board play UI, so the session is always created in that mode (unlike standalone TUOD setup, which lets the player choose). Remove `as never` once `insertExerciseSessionRecord`'s parameter type is confirmed to accept `Omit<..., "participants"> & {...}` cleanly in Step 4 of Task 1 — if the compiler still complains here, it means the widened interface needs one more optional field; fix the interface, not this call site.

- [ ] **Step 6: Run to verify it passes**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: 0 errors, 0 warnings, 0 hints; full suite green.

- [ ] **Step 8: Commit**

```bash
git add app/src/services/session.service.ts app/src/services/training-session.service.ts app/src/services/training-session.types.ts app/src/repositories/training-session.repository.ts app/tests/services/training-session.service.test.ts
git commit -m "feat(app): add training-session.service startTrainingStep"
```

---

### Task 5: `training-session.service.ts` — `completeTraining`

**Files:**
- Modify: `app/src/services/training-session.service.ts`, `training-session.types.ts`
- Modify: `app/src/repositories/training-session.repository.ts` (add `updateActivityStatusRecord`)
- Test: `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Produces: `completeTraining(playerId, activityId): Promise<ServiceResult<{ activityId: string; completedAt: string }>>`.

- [ ] **Step 1: Write the failing test**

```ts
vi.mock("@repositories/training-session.repository", () => ({
  findRoutineTemplateSteps: vi.fn(),
  insertTrainingActivity: vi.fn(),
  findActivityConfiguration: vi.fn(),
  updateActivityStatusRecord: vi.fn(),
}));

import { completeTraining } from "@services/training-session.service";

describe("completeTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the activity completed", async () => {
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(2);
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const result = await completeTraining("p1", "act-1");
    expect(result).toEqual({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
    });
    expect(trainingRepo.updateActivityStatusRecord).toHaveBeenCalledWith(
      expect.anything(),
      { activityId: "act-1", playerId: "p1", statusId: 2 },
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the repository piece**

```ts
// app/src/repositories/training-session.repository.ts — add
export async function updateActivityStatusRecord(
  db: Db,
  input: { activityId: string; playerId: string; statusId: number },
): Promise<{ activityId: string; completedAt: string } | undefined> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(activities)
    .set({ statusId: input.statusId, completedAt: now })
    .where(
      and(eq(activities.id, input.activityId), eq(activities.playerId, input.playerId)),
    )
    .returning({ activityId: activities.id, completedAt: activities.completedAt });
  return row as { activityId: string; completedAt: string } | undefined;
}
```

Confirm `activities` has a `completedAt` column and `update(...).returning(...)` is Drizzle's supported pattern here by checking one existing `UPDATE ... RETURNING` call in this codebase (`updateSessionStatusRecord` in `session.repository.ts`) and mirroring its exact shape — copy its `.returning({...})` syntax rather than guessing.

- [ ] **Step 4: Implement the service function**

```ts
// app/src/services/training-session.service.ts — add
import { updateActivityStatusRecord } from "@repositories/training-session.repository";

export async function completeTraining(
  playerId: string,
  activityId: string,
): Promise<ServiceResult<{ activityId: string; completedAt: string }>> {
  const db = getDb();
  const completedStatusId = await findGameStatusId(db, "COMPLETED");
  if (!completedStatusId) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
  }
  const updated = await updateActivityStatusRecord(db, {
    activityId,
    playerId,
    statusId: completedStatusId,
  });
  if (!updated) {
    return { ok: false, code: "NOT_FOUND", details: { activityId } };
  }
  return { ok: true, data: updated };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd app && npx vitest run tests/services/training-session.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/src/services/training-session.service.ts app/src/services/training-session.types.ts app/src/repositories/training-session.repository.ts app/tests/services/training-session.service.test.ts
git commit -m "feat(app): add training-session.service completeTraining"
```

---

### Task 6: API layer — 3 routes, Zod schemas, client wrapper

**Files:**
- Create: `app/src/pages/api/training-sessions/types.ts`
- Create: `app/src/pages/api/training-sessions/index.ts`
- Create: `app/src/pages/api/training-sessions/[activityId]/steps/[sequenceNumber].ts`
- Create: `app/src/pages/api/training-sessions/[activityId]/complete.ts`
- Modify: `app/src/pages/api/types.ts`
- Create: `app/src/lib/client/api/training-sessions.ts`
- Modify: `app/src/lib/client/api/types.ts`
- Test: `app/tests/pages/api/training-sessions/training-sessions.test.ts`

**Interfaces:**
- Consumes: `startTraining`, `startTrainingStep`, `completeTraining` (Tasks 3-5); `ok`/`fail` (`@server/envelope`); `parseAndValidateBody` (`@server/parse-json-body`); `apiRequest` (`@client/api/client`).

- [ ] **Step 1: Write the failing tests**

```ts
// app/tests/pages/api/training-sessions/training-sessions.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@services/training-session.service", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
}));

import * as service from "@services/training-session.service";

function request(body: unknown) {
  return new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/training-sessions", () => {
  it("delegates to startTraining and returns 201", async () => {
    vi.mocked(service.startTraining).mockResolvedValue({
      ok: true,
      data: { activityId: "act-1", routineName: "Balanced Training", steps: [] },
    });
    const { POST } = await import("@pages/api/training-sessions/index");
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      request: request({ routineTemplateName: "Balanced Training" }),
    } as any);
    expect(response.status).toBe(201);
    expect(service.startTraining).toHaveBeenCalledWith("p1", "Balanced Training");
  });

  it("returns a VALIDATION_FAILED envelope when the body is malformed", async () => {
    const { POST } = await import("@pages/api/training-sessions/index");
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      request: request({}),
    } as any);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/training-sessions/[activityId]/steps/[sequenceNumber]", () => {
  it("delegates to startTrainingStep", async () => {
    vi.mocked(service.startTrainingStep).mockResolvedValue({
      ok: true,
      data: {
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: {},
        participant: { ref: "pt1", displayName: "Levi" },
      },
    });
    const { POST } = await import(
      "@pages/api/training-sessions/[activityId]/steps/[sequenceNumber]"
    );
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1", sequenceNumber: "1" },
      request: request({}),
    } as any);
    expect(response.status).toBe(201);
    expect(service.startTrainingStep).toHaveBeenCalledWith("p1", "act-1", 1);
  });
});

describe("PATCH /api/training-sessions/[activityId]/complete", () => {
  it("delegates to completeTraining", async () => {
    vi.mocked(service.completeTraining).mockResolvedValue({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
    });
    const { PATCH } = await import(
      "@pages/api/training-sessions/[activityId]/complete"
    );
    const response = await PATCH({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.completeTraining).toHaveBeenCalledWith("p1", "act-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/pages/api/training-sessions/training-sessions.test.ts`
Expected: FAIL — routes don't exist.

- [ ] **Step 3: Implement the schemas**

```ts
// app/src/pages/api/training-sessions/types.ts
import { z } from "zod";

export const StartTrainingRequest = z.object({ routineTemplateName: z.string() });
export type StartTrainingRequestInput = z.infer<typeof StartTrainingRequest>;

const TrainingStepResolved = z.object({
  sequenceNumber: z.number().int(),
  exerciseTypeKey: z.enum(["WARM_UP", "SWITCHING", "DOUBLE_PATTERN", "GAME"]),
  exerciseRulesetVersionKey: z.string().nullable(),
  gameTypeKey: z.string().nullable(),
  durationSeconds: z.number().int(),
  configuration: z.record(z.unknown()),
});

export const StartTrainingResponse = z.object({
  activityId: z.string(),
  routineName: z.string(),
  steps: z.array(TrainingStepResolved),
});
export type StartTrainingResponseData = z.infer<typeof StartTrainingResponse>;

export const StartTrainingStepRequest = z.object({}).strict();
export type StartTrainingStepRequestInput = z.infer<typeof StartTrainingStepRequest>;

export const StartTrainingStepResponse = z.object({
  sessionId: z.string(),
  exerciseTypeKey: z.enum(["WARM_UP", "SWITCHING", "DOUBLE_PATTERN", "GAME"]),
  configuration: z.record(z.unknown()),
  participant: z.object({ ref: z.string(), displayName: z.string() }),
  gameTypeKey: z.string().optional(),
  rulesetVersionKey: z.string().optional(),
  captureModeKey: z.string().optional(),
  inputModeKey: z.string().optional(),
});
export type StartTrainingStepResponseData = z.infer<typeof StartTrainingStepResponse>;

export const CompleteTrainingResponse = z.object({
  activityId: z.string(),
  completedAt: z.string(),
});
export type CompleteTrainingResponseData = z.infer<typeof CompleteTrainingResponse>;
```

- [ ] **Step 4: Implement the routes**

```ts
// app/src/pages/api/training-sessions/index.ts
import type { APIRoute } from "astro";
import { StartTrainingRequest } from "./types";
import { startTraining } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    StartTrainingRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await startTraining(auth.playerId!, parsed.data.routineTemplateName);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};
```

```ts
// app/src/pages/api/training-sessions/[activityId]/steps/[sequenceNumber].ts
import type { APIRoute } from "astro";
import { startTrainingStep } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

export const POST: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const activityId = params.activityId!;
  const sequenceNumber = Number(params.sequenceNumber);
  if (!Number.isInteger(sequenceNumber)) {
    return fail("VALIDATION_FAILED", locals.requestId, {
      reason: "sequenceNumber must be an integer",
    });
  }

  const result = await startTrainingStep(auth.playerId!, activityId, sequenceNumber);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};
```

```ts
// app/src/pages/api/training-sessions/[activityId]/complete.ts
import type { APIRoute } from "astro";
import { completeTraining } from "@services/training-session.service";
import { ok, fail } from "@server/envelope";

export const PATCH: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const activityId = params.activityId!;

  const result = await completeTraining(auth.playerId!, activityId);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};
```

Check `fail`'s exact status-code mapping for `"NOT_FOUND"` against `@server/envelope`'s existing switch before relying on it returning 404 — if that code isn't mapped yet, add it there (additive) rather than reusing a mismatched existing code.

- [ ] **Step 5: Wire the barrels**

`app/src/pages/api/types.ts` — add:

```ts
export * from "./training-sessions/types";
```

`app/src/lib/client/api/types.ts` — add to the existing `export { ... } from "@routes/types"` block:

```ts
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
```

- [ ] **Step 6: Implement the client wrapper**

```ts
// app/src/lib/client/api/training-sessions.ts
import { apiRequest } from "./client";
import {
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
} from "./types";
import { SessionApiError } from "./sessions";

export async function startTraining(
  body: StartTrainingRequestInput,
): Promise<StartTrainingResponseData> {
  const payload = StartTrainingRequest.parse(body);
  const result = await apiRequest<StartTrainingResponseData>(
    "/api/training-sessions",
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!result.ok) throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function startTrainingStep(
  activityId: string,
  sequenceNumber: number,
): Promise<StartTrainingStepResponseData> {
  const result = await apiRequest<StartTrainingStepResponseData>(
    `/api/training-sessions/${activityId}/steps/${sequenceNumber}`,
    { method: "POST", body: "{}" },
  );
  if (!result.ok) throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function completeTraining(
  activityId: string,
): Promise<CompleteTrainingResponseData> {
  const result = await apiRequest<CompleteTrainingResponseData>(
    `/api/training-sessions/${activityId}/complete`,
    { method: "PATCH" },
  );
  if (!result.ok) throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}
```

`SessionApiError` is exported from `lib/client/api/sessions.ts` already — import and reuse it rather than declaring a second error class.

- [ ] **Step 7: Run to verify the tests pass**

Run: `cd app && npx vitest run tests/pages/api/training-sessions/training-sessions.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add app/src/pages/api/training-sessions app/src/pages/api/types.ts app/src/lib/client/api/training-sessions.ts app/src/lib/client/api/types.ts app/tests/pages/api/training-sessions
git commit -m "feat(app): add /api/training-sessions routes and client wrapper"
```

---

### Task 7: Generalize `boardInputData()`'s turns source

**Files:**
- Modify: `app/src/lib/game/board-input.data.ts`
- Modify: `app/src/components/layout/games/BoardInputPanel.astro`
- Test: `app/tests/lib/game/board-input.data.test.ts` (extend if present, else create)

**Interfaces:**
- Produces: `boardInputData(onCommit, getTurns)` — `getTurns: () => TurnFact[]` replaces the hardcoded `this.$store.game.turns` read inside `visitMarkers()`.
- Every existing caller (`tuod-play.data.ts`, every other `*-play.data.ts` spreading `boardInputData(...)`) breaks at compile time until updated — this task updates all of them in the same commit (mechanical, one extra argument each).

- [ ] **Step 1: Find every call site**

Run: `cd app && grep -rln "boardInputData(" src/lib src/components | sort`
Expected: a list including `lib/game/tuod-play.data.ts` and every other `*-play.data.ts` that captures darts via the board, plus `board-input.data.ts` itself.

- [ ] **Step 2: Write/extend the failing test**

If `app/tests/lib/game/board-input.data.test.ts` exists, add (else create the file with just this):

```ts
import { describe, it, expect, vi } from "vitest";
import { markersForTurns } from "@lib/game/board-input.data";

describe("markersForTurns", () => {
  it("reads whatever turns array it is given, not a fixed store", () => {
    const turns = [
      {
        clientKey: "t1",
        participantRef: "solo",
        sequence: 1,
        totalScore: 0,
        completedAt: null,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "SINGLE",
            score: 20,
            locationX: 5,
            locationY: -10,
          },
        ],
      },
    ];
    const markers = markersForTurns(turns as never);
    expect(markers).toHaveLength(1);
  });
});
```

(`markersForTurns` itself takes a plain array already — this test should already pass and documents the contract the generalization must not break. The real regression risk is `visitMarkers()`'s own store read, asserted next.)

Add this to the same file:

```ts
describe("boardInputData().visitMarkers", () => {
  it("reads turns from the getTurns() callback, not a fixed store", () => {
    const turns = [
      {
        clientKey: "t1",
        participantRef: "solo",
        sequence: 1,
        totalScore: 0,
        completedAt: null,
        darts: [],
      },
    ];
    const { boardInputData } = require("@lib/game/board-input.data");
    const factory = boardInputData(
      () => {},
      () => turns,
    );
    const context = { ...factory, $store: { boardInput: { handedness: "RIGHT" } } };
    expect(context.visitMarkers.call(context)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/board-input.data.test.ts`
Expected: FAIL on the second case — `boardInputData` doesn't accept a second argument yet, `visitMarkers()` still reads `this.$store.game.turns`.

- [ ] **Step 4: Implement**

In `app/src/lib/game/board-input.data.ts`, change the context type and factory signature:

```ts
type BoardInputDataContext = {
  input: BoardInputController | null;
  board: BoardView;
  pointerX: number;
  pointerY: number;
  $refs: { board: SVGSVGElement };
  $store: {
    boardInput: { handedness: Handedness };
  };
  // ...unchanged methods below
  visitMarkers(this: BoardInputDataContext): BoardMarker[];
};
```

(drop `game: { turns: TurnFact[] }` from `$store` — nothing in this file reads it once `visitMarkers` changes below.)

```ts
export function boardInputData(
  onCommit: (observation: DartObservation) => void,
  getTurns: () => TurnFact[],
) {
  return {
    // ...all existing fields and methods unchanged...
    visitMarkers(this: BoardInputDataContext): BoardMarker[] {
      return markersForTurns(getTurns());
    },
  };
}
```

- [ ] **Step 5: Update every call site**

For `BoardInputPanel.astro`'s own scope (`tuod-play.data.ts` and siblings), change:

```ts
...boardInputData((observation) => self.recordDart(observation)),
```

to:

```ts
...boardInputData(
  (observation) => self.recordDart(observation),
  () => self.$store.game.turns,
),
```

Apply the same one-line change to every other file `grep` found in Step 1. `BoardInputPanel.astro` itself needs no change — it never calls `boardInputData()`, only reads what the page's own scope already provides.

- [ ] **Step 6: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/board-input.data.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and full suite (regression check)**

Run: `cd app && npx astro check && npx vitest run`
Expected: 0 errors, 0 warnings, 0 hints; every existing game's play tests still pass unchanged — this step is the proof that no game regressed.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/board-input.data.ts app/tests/lib/game/board-input.data.test.ts $(git diff --name-only -- 'app/src/lib/game/*-play.data.ts')
git commit -m "refactor(app): boardInputData() takes its turns source as a parameter

visitMarkers() read \$store.game.turns directly, coupling board input to
the game store. A training exercise session has no game store to read.
Every existing play store now passes its own turns accessor explicitly;
behavior is unchanged."
```

---

### Task 8: `ExerciseBoardInputPanel.astro`

**Files:**
- Create: `app/src/components/layout/training/ExerciseBoardInputPanel.astro`

**Interfaces:**
- Consumes: the enclosing scope's `board`, `onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`, `recordUnseen`, `visitMarkers()` (all from `boardInputData()`, spread into the Switching/Double Pattern store — Tasks 10-11), plus `finished`/`undoVisit()` it defines itself.
- No test: this is pure Astro markup (`.astro` frontmatter logic stays untested per `app/CLAUDE.md`'s Test-Driven Development rules — no Astro-component test runner exists in this project).

Mirrors `BoardInputPanel.astro` exactly, minus the `$store.game.inputModeKey`/`timerPaused` gate (an exercise session is always `VISUAL_BOARD`, and has no countdown-pause concept — D264, exercise engines own no clock, and Switching/Double Pattern have no `timerPaused` field at all).

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Pointer-driven dartboard for a non-game exercise session (Switching,
 * Double Pattern) — mirrors BoardInputPanel.astro, minus the game-store
 * gate: an exercise session has no inputModeKey choice (always
 * VISUAL_BOARD) and no timerPaused flag (D264, no clock).
 *
 * Declares no x-data of its own: mounts inside the exercise step's own
 * scope and reads what boardInputData() contributes there (board, the
 * pointer handlers, recordUnseen, visitMarkers) plus the page's `finished`
 * flag and `undoVisit()`.
 */

// Components
import DartBoard from "@components/ui/DartBoard.astro";
import BoardMagnifier from "@components/ui/BoardMagnifier.astro";
import Button from "@components/forms/Button.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  x-show="!finished"
  x-cloak
  class="mt-3 flex min-h-0 flex-col items-center gap-3"
>
  <div
    class="relative min-h-0 max-h-[60vh] max-w-full flex-1 aspect-square touch-none"
    @pointerdown="onPointerDown($event)"
    @pointermove="onPointerMove($event)"
    @pointerup="onPointerUp()"
    @pointercancel="onPointerCancel()"
  >
    <DartBoard boardRef="board">
      <div
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <template
          x-for="marker in visitMarkers()"
          :key="marker.sequence"
        >
          <span
            class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
            :style="`left: ${marker.leftPercent}%; top: ${marker.topPercent}%`"
          >
          </span>
        </template>
      </div>
    </DartBoard>

    <BoardMagnifier />
  </div>

  <div class="flex w-full shrink-0 gap-3">
    <Button
      type="button"
      variant="secondary"
      icon
      ariaLabel="Undo dart"
      class="flex-1"
      @click="undoVisit()"
    >
      <UndoIcon
        slot="iconBefore"
        class="size-6 text-muted"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      title="Bounce out"
      class="glass flex-1"
      @click="recordUnseen()"
    />
  </div>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints (this component is unused until Task 10, so check passes vacuously — confirms no syntax/import error).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/training/ExerciseBoardInputPanel.astro
git commit -m "feat(app): add ExerciseBoardInputPanel for non-game dart capture"
```

---

### Task 9: `solo-participant-upload.ts` — remap engine refs to the real participant id

**Files:**
- Create: `app/src/lib/exercise/solo-participant-upload.ts`
- Test: `app/tests/lib/exercise/solo-participant-upload.test.ts`

**Interfaces:**
- Produces: `resolveSoloParticipantRef(facts: EngineFacts, realParticipantRef: string): EngineFacts`.

`SwitchingEngine`/`DoublePatternEngine` stamp every turn's `participantRef` as the fixed string `SOLO_PARTICIPANT_REF` (`"solo"`) — there is no seat-composition step for an exercise session to mint a real id upfront the way `composeSeatFacts` does for games. The server's `validateBatchReferences` checks `turn.participantRef` against the session's real DB participant ids (`participants.id`, a UUID) — `"solo"` never matches one, so every batch upload for Switching/Double Pattern would fail `BATCH_REFERENCE_MISSING` without this remap. `startTrainingStep`'s response already returns the real id as `participant.ref` (Task 4) — this function substitutes it in before the facts are handed to `buildEventsBatch`.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/exercise/solo-participant-upload.test.ts
import { describe, it, expect } from "vitest";
import { resolveSoloParticipantRef } from "@lib/exercise/solo-participant-upload";

describe("resolveSoloParticipantRef", () => {
  it("replaces every turn's solo participantRef with the real one", () => {
    const facts = {
      stages: [{ clientKey: "st1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }],
      turns: [
        { clientKey: "t1", participantRef: "solo", sequence: 1, totalScore: 0, completedAt: null, darts: [] },
      ],
    };
    const result = resolveSoloParticipantRef(facts as never, "pt-real-1");
    expect(result.turns[0].participantRef).toBe("pt-real-1");
  });

  it("leaves stages untouched", () => {
    const facts = {
      stages: [{ clientKey: "st1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }],
      turns: [],
    };
    const result = resolveSoloParticipantRef(facts as never, "pt-real-1");
    expect(result.stages).toEqual(facts.stages);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/exercise/solo-participant-upload.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/exercise/solo-participant-upload.ts
import { SOLO_PARTICIPANT_REF } from "@modules/exercise/solo-participant.module";
import type { EngineFacts } from "@modules/types";

/**
 * Exercise engines stamp every turn with the fixed SOLO_PARTICIPANT_REF
 * constant — there is no seat to mint a real id from. The server validates
 * a batch's turn.participantRef against the session's real DB participant
 * id, so this swap must happen before upload.
 */
export function resolveSoloParticipantRef(
  facts: EngineFacts,
  realParticipantRef: string,
): EngineFacts {
  return {
    stages: facts.stages,
    turns: facts.turns.map((turn) =>
      turn.participantRef === SOLO_PARTICIPANT_REF
        ? { ...turn, participantRef: realParticipantRef }
        : turn,
    ),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/exercise/solo-participant-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd app && npx astro check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/exercise/solo-participant-upload.ts app/tests/lib/exercise/solo-participant-upload.test.ts
git commit -m "feat(app): add resolveSoloParticipantRef for exercise batch uploads"
```

---

### Task 10: `balanced-training-play.data.ts` — skeleton + Warm-Up step

**Files:**
- Create: `app/src/lib/training/balanced-training-play.data.ts`
- Create: `app/src/components/layout/training/WarmUpPanel.astro`
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `startTraining`, `startTrainingStep`, `completeTraining` (`@client/api/training-sessions`, Task 6); `trainingEngine` (`@modules/training/training.module`); `getExerciseEngineFactory` (`@modules/exercise/engine.registry`); `warmUpEngineFactory`'s registration side-effect import (`@modules/exercise/warm-up.engine.module`).
- Produces the store's public shape other tasks build on:

```ts
export type BalancedTrainingPlayContext = {
  loading: boolean;
  error: string;
  activityId: string | null;
  training: TrainingEngine | null;
  warmUpEngine: ExerciseEngine<WarmUpState> | null;
  init(): Promise<void>;
  currentStep(): RoutineStepSnapshot | null;
  startCurrentStep(): Promise<void>;
  advanceWarmUp(): void;
  completeCurrentStep(): Promise<void>;
};
```

`completeCurrentStep()` is the one seam every step type (Tasks 10-13) calls once its own work is done — it marks the CURRENT `exercise_sessions` row's status (reusing the existing `PATCH /api/sessions/[sessionId]` the spec's §5 already names as untouched, for Switching/Double Pattern/Finishing — Warm-Up has no dart facts to gate completion on, so it completes on `advanceWarmUp()` reaching the last phase) and then either moves `training` to the next step or, if it was the last, calls `completeTraining` and navigates to `/training`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/tests/lib/training/balanced-training-play.data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
}));

import * as trainingApi from "@client/api/training-sessions";
import { balancedTrainingPlay } from "@lib/training/balanced-training-play.data";

const STEPS = [
  {
    sequenceNumber: 1,
    exerciseTypeKey: "WARM_UP",
    exerciseRulesetVersionKey: "WARM_UP_V1",
    gameTypeKey: null,
    durationSeconds: 600,
    configuration: {
      stepDurationSeconds: 600,
      phases: [{ name: "Upper", targets: [5], weight: 1 }],
    },
  },
];

describe("balancedTrainingPlay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("init() starts the routine and builds the training engine from the returned steps", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    const store = balancedTrainingPlay();
    await store.init();
    expect(store.activityId).toBe("act-1");
    expect(store.currentStep()?.exerciseTypeKey).toBe("WARM_UP");
  });

  it("startCurrentStep() calls startTrainingStep with the current sequenceNumber and builds the Warm-Up engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = balancedTrainingPlay();
    await store.init();
    await store.startCurrentStep();
    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith("act-1", 1);
    expect(store.warmUpEngine).not.toBeNull();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
  });

  it("advanceWarmUp() moves the engine to its next phase", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = balancedTrainingPlay();
    await store.init();
    await store.startCurrentStep();
    store.advanceWarmUp();
    expect(store.warmUpEngine!.state().status).toBe(
      STEPS[0].configuration.phases.length > 1 ? "IN_PROGRESS" : "COMPLETE",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the skeleton + Warm-Up**

```ts
// app/src/lib/training/balanced-training-play.data.ts
import {
  startTraining,
  startTrainingStep,
  completeTraining as apiCompleteTraining,
} from "@client/api/training-sessions";
import { completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/training.module";
import { getExerciseEngineFactory } from "@modules/exercise/engine.registry";
import "@modules/exercise/warm-up.engine.module";
import type { TrainingEngine } from "@modules/training/interfaces";
import type { RoutineStepSnapshot } from "@modules/training/types";
import type { ExerciseEngine } from "@modules/exercise/interfaces";
import type { WarmUpState } from "@modules/exercise/types";
import type { WarmUpEngineInput } from "@lib/types";

const ROUTINE_NAME = "Balanced Training";

export type BalancedTrainingPlayContext = {
  loading: boolean;
  error: string;
  activityId: string | null;
  currentSessionId: string | null;
  currentParticipantRef: string | null;
  training: TrainingEngine | null;
  warmUpEngine: ExerciseEngine<WarmUpState> | null;
  init(this: BalancedTrainingPlayContext): Promise<void>;
  currentStep(this: BalancedTrainingPlayContext): RoutineStepSnapshot | null;
  startCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  advanceWarmUp(this: BalancedTrainingPlayContext): void;
  completeCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
};

export function balancedTrainingPlay(): BalancedTrainingPlayContext {
  return {
    loading: false,
    error: "",
    activityId: null,
    currentSessionId: null,
    currentParticipantRef: null,
    training: null,
    warmUpEngine: null,

    async init(this: BalancedTrainingPlayContext) {
      this.loading = true;
      this.error = "";
      try {
        const result = await startTraining({ routineTemplateName: ROUTINE_NAME });
        this.activityId = result.activityId;
        this.training = trainingEngine.create({
          routineName: result.routineName,
          steps: result.steps.map((step) => ({
            sequenceNumber: step.sequenceNumber,
            exerciseName: step.exerciseTypeKey,
            exerciseRulesetVersionKey: (step.exerciseRulesetVersionKey ??
              "TUOD_V1") as RoutineStepSnapshot["exerciseRulesetVersionKey"],
            configuration: step.configuration,
          })),
        });
        await this.startCurrentStep();
      } catch {
        this.error = "Could not start this routine. Check your connection and retry.";
      } finally {
        this.loading = false;
      }
    },

    currentStep(this: BalancedTrainingPlayContext): RoutineStepSnapshot | null {
      return this.training?.state().currentStep ?? null;
    },

    async startCurrentStep(this: BalancedTrainingPlayContext) {
      const step = this.currentStep();
      if (!this.activityId || !step) return;
      const result = await startTrainingStep(this.activityId, step.sequenceNumber);
      this.currentSessionId = result.sessionId;
      this.currentParticipantRef = result.participant.ref;

      if (result.exerciseTypeKey === "WARM_UP") {
        const factory = getExerciseEngineFactory("WARM_UP_V1");
        this.warmUpEngine = factory
          ? (factory.create(result.configuration as WarmUpEngineInput) as ExerciseEngine<WarmUpState>)
          : null;
      }
    },

    advanceWarmUp(this: BalancedTrainingPlayContext) {
      if (!this.warmUpEngine) return;
      this.warmUpEngine.advance();
      if (this.warmUpEngine.isComplete()) {
        void this.completeCurrentStep();
      }
    },

    async completeCurrentStep(this: BalancedTrainingPlayContext) {
      if (!this.currentSessionId || !this.training || !this.activityId) return;
      await completeSession(this.currentSessionId, "COMPLETED");
      this.currentSessionId = null;
      this.currentParticipantRef = null;
      this.warmUpEngine = null;
      const state = this.training.completeStep();
      if (state.status === "COMPLETE") {
        await apiCompleteTraining(this.activityId);
        globalThis.location.href = "/training";
        return;
      }
      await this.startCurrentStep();
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: `WarmUpPanel.astro`**

```astro
---
/** Warm-Up phase display: name, targets, and a manual "Next phase" advance
 * — the engine owns no clock (D264), so the store's own countdown (added
 * in this page, not this component) drives advanceWarmUp(). */
import Button from "@components/forms/Button.astro";
---

<div class="flex flex-col items-center gap-4 p-4">
  <p
    class="text-sm text-muted-foreground"
    x-text="`Phase ${warmUpEngine.state().phaseIndex + 1} of ${warmUpEngine.state().phaseCount}`"
  >
  </p>
  <h2
    class="text-xl font-semibold text-foreground"
    x-text="warmUpEngine.state().phaseName"
  >
  </h2>
  <p
    class="text-sm text-muted-foreground"
    x-text="warmUpEngine.state().targets.join(', ')"
  >
  </p>
  <Button
    title="Next phase"
    variant="primary"
    grow
    @click="advanceWarmUp()"
  />
</div>
```

- [ ] **Step 6: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean (note: `WarmUpPanel.astro` is unused until Task 13 wires up the play page — `astro check` still validates its syntax/types).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/training/balanced-training-play.data.ts app/src/components/layout/training/WarmUpPanel.astro app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "feat(app): add balanced-training-play store skeleton and Warm-Up step"
```

---

### Task 11: Switching step

**Files:**
- Modify: `app/src/lib/training/balanced-training-play.data.ts`
- Create: `app/src/components/layout/training/SwitchingPanel.astro`
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `boardInputData` (Task 7's generalized signature); `resolveSoloParticipantRef` (Task 9); `getDartExerciseEngineFactory` (`@modules/exercise/dart-engine.registry`); `buildEventsBatch` (`@modules/game/events.payload.module`); `appendBatch` (`@client/api/sessions`); side-effect import `@modules/exercise/switching.engine.module`.
- Produces: `switchingEngine: DartExerciseEngine<SwitchingState> | null` on the context; `recordSwitchingDart(observation)`; `...boardInputData(...)` spread into the returned object (the page's own scope, matching how `tuodPlay()` spreads it).

Switching/Double Pattern have no countdown timer built into this plan's v1 — the step's own `durationSeconds` (already resolved server-side, Task 3) bounds it, but since `SwitchingEngine`/`DoublePatternEngine` require an explicit `expireTimer()` call and own no clock themselves (D264), **this task adds a plain `setTimeout` in the store**, started in `startCurrentStep()` when the step is Switching/Double Pattern, calling `expireTimer()` then `completeCurrentStep()` when it fires — mirrors `SegmentTimer`'s role in `tuod-play.data.ts` but simpler, since Switching/Double Pattern need only a single fire-once deadline, not a resumable countdown (no mid-routine resume, §7 — so nothing needs to survive a reload).

- [ ] **Step 1: Write the failing tests**

Extend `balanced-training-play.data.test.ts`:

```ts
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
  appendBatch: vi.fn(),
}));

const SWITCHING_STEP = {
  sequenceNumber: 2,
  exerciseTypeKey: "SWITCHING",
  exerciseRulesetVersionKey: "SWITCHING_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: { targets: [20, 19, 18], scoring: { single: 1, double: 2, treble: 3 } },
};

describe("balancedTrainingPlay — Switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("startCurrentStep() for SWITCHING builds the dart engine and arms a deadline", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = balancedTrainingPlay();
    await store.init();
    expect(store.switchingEngine).not.toBeNull();
    expect(store.switchingEngine!.state().currentTargetNumber).toBe(20);
  });

  it("recordSwitchingDart() folds the dart into the engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = balancedTrainingPlay();
    await store.init();
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(store.switchingEngine!.state().dartsThrown).toBe(1);
  });

  it("the armed deadline expires the engine and completes the step", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = balancedTrainingPlay();
    await store.init();
    vi.advanceTimersByTime(300_000);
    await vi.runAllTimersAsync();
    expect(sessionApi.appendBatch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: FAIL — `switchingEngine`/`recordSwitchingDart` don't exist.

- [ ] **Step 3: Implement**

Add to `balanced-training-play.data.ts`:

```ts
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { resolveSoloParticipantRef } from "@lib/exercise/solo-participant-upload";
import { getDartExerciseEngineFactory } from "@modules/exercise/dart-engine.registry";
import "@modules/exercise/switching.engine.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { appendBatch, completeSession } from "@client/api/sessions";
import type { DartExerciseEngine } from "@modules/exercise/interfaces";
import type { SwitchingState } from "@modules/exercise/types";
import type { DartObservation, TurnFact } from "@modules/types";
import type { SwitchingConfigData } from "@lib/types";
import type { BoardMarker } from "@lib/game/types";
```

Extend the returned object (same factory function, same `return {` literal — not a second factory):

```ts
    switchingEngine: null as DartExerciseEngine<SwitchingState> | null,
    stepDeadline: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData(
      (observation) => self.recordSwitchingDart(observation),
      () => self.switchingEngine?.facts().turns ?? [],
    ),

    visitMarkers(this: BalancedTrainingPlayContext): BoardMarker[] {
      return markersForTurns(this.switchingEngine?.facts().turns ?? []);
    },

    recordSwitchingDart(this: BalancedTrainingPlayContext, observation: DartObservation) {
      if (!this.switchingEngine) return;
      this.switchingEngine.record(observation);
    },

    undoVisit(this: BalancedTrainingPlayContext) {
      this.switchingEngine?.undo();
    },

    async uploadCurrentStepFacts(this: BalancedTrainingPlayContext) {
      const engine = this.switchingEngine;
      if (!engine || !this.currentSessionId || !this.currentParticipantRef) return;
      const resolved = resolveSoloParticipantRef(engine.facts(), this.currentParticipantRef);
      const batch = buildEventsBatch(resolved);
      const idempotencyKey = crypto.randomUUID();
      await appendBatch(this.currentSessionId, idempotencyKey, batch);
    },
```

`self` needs declaring the same way `tuod-play.data.ts` does it — add right above `export function balancedTrainingPlay()`:

```ts
let self: BalancedTrainingPlayContext;
```

and at the top of `init()`, first line: `self = this;` (mirrors `tuod-play.data.ts`'s own `init()`).

Update `startCurrentStep()`'s body to add the Switching branch alongside the existing `WARM_UP` one, and arm the deadline for any dart-capture step:

```ts
      if (result.exerciseTypeKey === "WARM_UP") {
        const factory = getExerciseEngineFactory("WARM_UP_V1");
        this.warmUpEngine = factory
          ? (factory.create(result.configuration as WarmUpEngineInput) as ExerciseEngine<WarmUpState>)
          : null;
      }
      if (result.exerciseTypeKey === "SWITCHING") {
        const factory = getDartExerciseEngineFactory("SWITCHING_V1");
        this.switchingEngine = factory
          ? (factory.create(result.configuration as SwitchingConfigData) as DartExerciseEngine<SwitchingState>)
          : null;
        this.armStepDeadline(step.durationSeconds);
      }
```

and add the deadline helper + update `completeCurrentStep()` to clear it and upload facts first:

```ts
    armStepDeadline(this: BalancedTrainingPlayContext, durationSeconds: number) {
      this.stepDeadline = setTimeout(() => {
        this.switchingEngine?.expireTimer();
        void this.completeCurrentStep();
      }, durationSeconds * 1000);
    },

    async completeCurrentStep(this: BalancedTrainingPlayContext) {
      if (!this.currentSessionId || !this.training || !this.activityId) return;
      if (this.stepDeadline) {
        clearTimeout(this.stepDeadline);
        this.stepDeadline = null;
      }
      await this.uploadCurrentStepFacts();
      await completeSession(this.currentSessionId, "COMPLETED");
      this.currentSessionId = null;
      this.currentParticipantRef = null;
      this.warmUpEngine = null;
      this.switchingEngine = null;
      const state = this.training.completeStep();
      if (state.status === "COMPLETE") {
        await apiCompleteTraining(this.activityId);
        globalThis.location.href = "/training";
        return;
      }
      await this.startCurrentStep();
    },
```

(this replaces Task 10's `completeCurrentStep` — one function, grown in place, not a second one.)

`step` inside `startCurrentStep()` is already in scope from `const step = this.currentStep();` at the top of that function (Task 10) — no new lookup needed.

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: `SwitchingPanel.astro`**

```astro
---
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <dl class="space-y-1 px-4">
    <StatRow
      label="Target"
      value="switchingEngine.state().currentTargetNumber"
    />
    <StatRow
      label="Points"
      value="switchingEngine.state().totalPoints"
    />
  </dl>
  <ExerciseBoardInputPanel />
</div>
```

Check `StatRow.astro`'s actual prop names (`label`/`value` vs. `x-text` bindings) before using it as written — mirror whichever existing `<StatRow .../>` call in `TenUpOneDown.astro` already does, adjusting this snippet's attribute names/bindings to match exactly rather than guessing.

- [ ] **Step 6: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/training/balanced-training-play.data.ts app/src/components/layout/training/SwitchingPanel.astro app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "feat(app): add Switching step to balanced-training-play store"
```

---

### Task 12: Double Pattern step

**Files:**
- Modify: `app/src/lib/training/balanced-training-play.data.ts`
- Create: `app/src/components/layout/training/DoublePatternPanel.astro`
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Identical shape to Task 11, one exercise type over. Consumes `getDartExerciseEngineFactory("DOUBLE_PATTERN_V1")`, side-effect import `@modules/exercise/double-pattern.engine.module`.

Double Pattern and Switching cannot both be "the" dart-capture step at once — the `ExerciseBoardInputPanel`/`boardInputData` wiring from Task 11 is shared, not duplicated: `visitMarkers()`/`recordDart`-equivalent must dispatch to whichever of `switchingEngine`/`doublePatternEngine` is currently non-null.

- [ ] **Step 1: Write the failing tests**

Extend `balanced-training-play.data.test.ts` mirroring Task 11's three tests, substituting:

```ts
const DOUBLE_PATTERN_STEP = {
  sequenceNumber: 3,
  exerciseTypeKey: "DOUBLE_PATTERN",
  exerciseRulesetVersionKey: "DOUBLE_PATTERN_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: { patterns: [[20, 10, 5]] },
};
```

asserting `store.doublePatternEngine` instead of `store.switchingEngine`, and a `recordDoublePatternDart()` instead of `recordSwitchingDart()`, plus one case proving the shared `visitMarkers()`/undo route to whichever engine is active:

```ts
it("visitMarkers() reads from doublePatternEngine when that is the active step", async () => {
  vi.mocked(trainingApi.startTraining).mockResolvedValue({
    activityId: "act-1",
    routineName: "Balanced Training",
    steps: [DOUBLE_PATTERN_STEP] as never,
  });
  vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
    sessionId: "s1",
    exerciseTypeKey: "DOUBLE_PATTERN",
    configuration: DOUBLE_PATTERN_STEP.configuration,
    participant: { ref: "pt1", displayName: "Levi" },
  });
  const store = balancedTrainingPlay();
  await store.init();
  store.recordDoublePatternDart({
    hitTargetNumber: 20,
    hitZoneKey: "DOUBLE",
    locationX: 0,
    locationY: 0,
  });
  expect(store.visitMarkers()).toHaveLength(0);
  expect(store.doublePatternEngine!.state().totalPoints).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `balanced-training-play.data.ts`:

```ts
import "@modules/exercise/double-pattern.engine.module";
import type { DoublePatternState } from "@modules/exercise/types";
import type { DoublePatternConfigData } from "@lib/types";
```

```ts
    doublePatternEngine: null as DartExerciseEngine<DoublePatternState> | null,
```

Replace the `visitMarkers()`/`recordSwitchingDart()`/`undoVisit()`/`uploadCurrentStepFacts()` bodies from Task 11 with dispatch over whichever dart-capture engine is active:

```ts
    activeDartEngine(this: BalancedTrainingPlayContext): DartExerciseEngine<unknown> | null {
      return this.switchingEngine ?? this.doublePatternEngine ?? null;
    },

    visitMarkers(this: BalancedTrainingPlayContext): BoardMarker[] {
      return markersForTurns(this.activeDartEngine()?.facts().turns ?? []);
    },

    recordSwitchingDart(this: BalancedTrainingPlayContext, observation: DartObservation) {
      this.switchingEngine?.record(observation);
    },

    recordDoublePatternDart(this: BalancedTrainingPlayContext, observation: DartObservation) {
      this.doublePatternEngine?.record(observation);
    },

    undoVisit(this: BalancedTrainingPlayContext) {
      this.activeDartEngine()?.undo();
    },

    async uploadCurrentStepFacts(this: BalancedTrainingPlayContext) {
      const engine = this.activeDartEngine();
      if (!engine || !this.currentSessionId || !this.currentParticipantRef) return;
      const resolved = resolveSoloParticipantRef(engine.facts(), this.currentParticipantRef);
      const batch = buildEventsBatch(resolved);
      const idempotencyKey = crypto.randomUUID();
      await appendBatch(this.currentSessionId, idempotencyKey, batch);
    },
```

`boardInputData(...)`'s `onCommit` callback (set up in Task 11) must now route to whichever engine is active instead of calling `recordSwitchingDart` unconditionally — update that one spread call:

```ts
    ...boardInputData(
      (observation) => {
        if (self.switchingEngine) self.recordSwitchingDart(observation);
        else if (self.doublePatternEngine) self.recordDoublePatternDart(observation);
      },
      () => self.activeDartEngine()?.facts().turns ?? [],
    ),
```

Add the `DOUBLE_PATTERN` branch to `startCurrentStep()`, alongside `SWITCHING`'s:

```ts
      if (result.exerciseTypeKey === "DOUBLE_PATTERN") {
        const factory = getDartExerciseEngineFactory("DOUBLE_PATTERN_V1");
        this.doublePatternEngine = factory
          ? (factory.create(result.configuration as DoublePatternConfigData) as DartExerciseEngine<DoublePatternState>)
          : null;
        this.armStepDeadline(step.durationSeconds);
      }
```

And clear it in `completeCurrentStep()` alongside `switchingEngine`:

```ts
      this.switchingEngine = null;
      this.doublePatternEngine = null;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts`
Expected: PASS, all cases from Tasks 10-12.

- [ ] **Step 5: `DoublePatternPanel.astro`**

```astro
---
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <dl class="space-y-1 px-4">
    <StatRow
      label="Double"
      value="'D' + doublePatternEngine.state().currentDoubleNumber"
    />
    <StatRow
      label="Points"
      value="doublePatternEngine.state().totalPoints"
    />
  </dl>
  <ExerciseBoardInputPanel />
</div>
```

Same caveat as Task 11's `SwitchingPanel.astro` — confirm `StatRow`'s real prop/binding names against an existing call site before finalizing.

- [ ] **Step 6: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/training/balanced-training-play.data.ts app/src/components/layout/training/DoublePatternPanel.astro app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "feat(app): add Double Pattern step to balanced-training-play store"
```

---

### Task 13: Finishing step — compose `tuodPlay()`, bridge completion into the routine

**Files:**
- Create: `app/src/lib/training/finishing-step.data.ts`
- Test: `app/tests/lib/training/finishing-step.data.test.ts`

**Interfaces:**
- Consumes: `tuodPlay()` (`@lib/game/tuod-play.data`, unmodified); `gameStore`-shaped `$store.game` — the Finishing step needs its OWN isolated copy of the game-store shape, not the real persisted `Alpine.store('game')`, since a routine step's Finishing session must never collide with (or be confused for) a standalone TUOD session's persisted state.
- Produces: `finishingStep(onStepComplete: () => Promise<void>)` — a factory wrapping `tuodPlay()`, overriding `uploadAndCompleteSession()` to call through to the original and then `onStepComplete()`.

`TenUpOneDown.astro`/`BoardInputPanel.astro` read `$store.game` as Alpine's GLOBAL registered store (`Alpine.store('game')`), not a local object — they cannot be pointed at a page-local substitute by passing props. **This is a real constraint the spec's §6 did not resolve at the level of detail needed to implement it.** The only two options are: (a) populate the real global `$store.game` for the Finishing step (exactly as a standalone TUOD session would, via `$store.game.startSession(...)`), relying on `$store.game.reset()` once the step completes so no stale game-store state leaks into a later standalone TUOD game; or (b) fork `TenUpOneDown.astro`/`BoardInputPanel.astro` to accept an injected store. (a) is the additive, minimal choice — it reuses the existing global store exactly as designed, at the cost of the Finishing step temporarily "borrowing" it (acceptable: Balanced Training's Finishing step and a standalone TUOD game can never run at the same time for one player, and `$store.game.reset()` already exists for exactly this kind of cleanup).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/training/finishing-step.data.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(() => ({
    finished: false,
    async uploadAndCompleteSession() {
      this.finished = true;
    },
  })),
}));

import { finishingStep } from "@lib/training/finishing-step.data";

describe("finishingStep", () => {
  it("calls onStepComplete after tuodPlay()'s own upload finishes", async () => {
    const onStepComplete = vi.fn();
    const wrapped = finishingStep(onStepComplete);
    await wrapped.uploadAndCompleteSession();
    expect(wrapped.finished).toBe(true);
    expect(onStepComplete).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/training/finishing-step.data.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/training/finishing-step.data.ts
import { tuodPlay } from "@lib/game/tuod-play.data";

/**
 * Wraps the existing TUOD play store so the Finishing step's completion
 * also advances the routine. tuodPlay() itself is untouched — its own
 * uploadAndCompleteSession() still uploads facts and marks the
 * exercise_sessions row COMPLETED exactly as a standalone TUOD game does;
 * onStepComplete is the routine's own advance-or-finish call
 * (balanced-training-play.data.ts's completeCurrentStep).
 */
export function finishingStep(onStepComplete: () => Promise<void>) {
  const base = tuodPlay();
  const baseUpload = base.uploadAndCompleteSession.bind(base);
  base.uploadAndCompleteSession = async function (this: typeof base) {
    await baseUpload();
    await onStepComplete();
  };
  return base;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/training/finishing-step.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `balanced-training-play.data.ts`**

Add to `startCurrentStep()`, alongside the other three branches — this one populates the GLOBAL game store rather than a local engine field, per the constraint above:

```ts
      if (result.exerciseTypeKey === "GAME") {
        self.$store.game.reset();
        self.$store.game.startSession({
          gameTypeKey: result.gameTypeKey!,
          rulesetVersionKey: result.rulesetVersionKey as never,
          sessionId: result.sessionId,
          templateRef: null,
          configSnapshot: { ...(result.configuration as object), seats: [] } as never,
          captureModeKey: result.captureModeKey!,
          inputModeKey: result.inputModeKey!,
        });
        this.finishing = finishingStep(() => this.completeCurrentStep());
      }
```

Add `finishing: ReturnType<typeof finishingStep> | null` to the context type and the returned object's initial `null`, and import `finishingStep` + add `$store: { game: GameStoreShape }` to the context type (reuse the existing `@stores/types` `ConfigSnapshot`/store typing the same way `TuodPlayContext` already does, rather than redefining it).

`completeCurrentStep()` gains one more cleanup line alongside clearing `switchingEngine`/`doublePatternEngine`:

```ts
      this.finishing = null;
```

Completion for the `GAME` step does NOT call `completeSession(...)` itself — `finishingStep`'s wrapped `uploadAndCompleteSession()` already does that (it's `tuodPlay()`'s own call), so `completeCurrentStep()` must skip its own `completeSession` call when the step that just finished was `GAME` (it would otherwise PATCH an already-COMPLETED session a second time — harmless per the existing `SESSION_ALREADY_COMPLETED` idempotency, but redundant). Guard it:

```ts
      if (this.currentStep()?.exerciseTypeKey !== "GAME") {
        await completeSession(this.currentSessionId, "COMPLETED");
      }
```

placed where Task 11's unconditional `await completeSession(...)` call currently is.

- [ ] **Step 6: Run the full store test file**

Run: `cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts tests/lib/training/finishing-step.data.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and full suite**

Run: `cd app && npx astro check && npx vitest run`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/training/finishing-step.data.ts app/src/lib/training/balanced-training-play.data.ts app/tests/lib/training/finishing-step.data.test.ts app/tests/lib/training/balanced-training-play.data.test.ts
git commit -m "feat(app): bridge TUOD's play store into the Finishing step"
```

---

### Task 14: `play/index.astro` — assemble the page

**Files:**
- Create: `app/src/pages/training/balanced-training/play/index.astro`

**Interfaces:**
- Consumes: `balancedTrainingPlay()` (Task 10-13); `WarmUpPanel`/`SwitchingPanel`/`DoublePatternPanel` (Tasks 10-12); `TenUpOneDown` (existing, reused for Finishing per the `finishing` sub-scope Task 13 built).
- No new exported interfaces — this is the leaf page.

- [ ] **Step 1: Write the page**

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import WarmUpPanel from "@components/layout/training/WarmUpPanel.astro";
import SwitchingPanel from "@components/layout/training/SwitchingPanel.astro";
import DoublePatternPanel from "@components/layout/training/DoublePatternPanel.astro";
import TenUpOneDown from "@components/layout/games/interfaces/TenUpOneDown.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<AppLayout title="Balanced Training">
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="balancedTrainingPlay()"
    x-init="init()"
  >
    <ErrorAlert
      x-show="error"
      x-text="error"
      x-cloak
    />

    <template x-if="!loading && currentStep()?.exerciseTypeKey === 'WARM_UP' && warmUpEngine">
      <WarmUpPanel />
    </template>

    <template x-if="!loading && currentStep()?.exerciseTypeKey === 'SWITCHING' && switchingEngine">
      <SwitchingPanel />
    </template>

    <template x-if="!loading && currentStep()?.exerciseTypeKey === 'DOUBLE_PATTERN' && doublePatternEngine">
      <DoublePatternPanel />
    </template>

    <template x-if="!loading && currentStep()?.exerciseTypeKey === 'GAME' && finishing">
      <div x-data="finishing">
        <TenUpOneDown x-show="!finished" />
        <div
          x-show="finished"
          class="p-4 text-center"
        >
          <p class="text-foreground">Finishing complete.</p>
        </div>
      </div>
    </template>
  </div>
</AppLayout>
```

`balancedTrainingPlay` must be registered as a global Alpine data function the same way every other `*-play.data.ts` factory is — find that registration site (likely `app/src/layouts/AppLayout.astro` or a central Alpine bootstrap file) and add `balancedTrainingPlay` to it, mirroring exactly how `tuodPlay`/`singlesTrainingPlay` are already registered there. Do the same lookup-and-mirror for `finishingStep` if the `x-data="finishing"` nested scope above needs its own registration (it does not — it binds directly to the parent scope's `finishing` object via Alpine's implicit `x-data="finishing"` evaluation, not a registered global name).

- [ ] **Step 2: Register the store factory**

Find the registration: `cd app && grep -rn "Alpine.data(\"tuodPlay\"" src/`. Add an identical line for `balancedTrainingPlay` immediately after it, importing from `@lib/training/balanced-training-play.data`.

- [ ] **Step 3: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 4: Manual browser verification**

```bash
cd app && astro dev --background
```

Navigate to `/training/balanced-training/play` (after Task 15 wires the Start button, or directly by URL before that). Walk all 4 steps: advance Warm-Up's 5 phases, throw darts for Switching and Double Pattern (or let the deadline elapse), play Finishing to completion, confirm landing on `/training`. Check Neon (or local dev DB) for one `activities` row with 4 `exercise_sessions` rows sharing its id, each with the right `routine_step_sequence_number`.

```bash
astro dev stop
```

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/training/balanced-training/play/index.astro
git commit -m "feat(app): assemble the Balanced Training play page"
```

---

### Task 15: Wire the Start button

**Files:**
- Create: `app/src/lib/training/routine-start.data.ts`
- Modify: `app/src/components/layout/training/RoutineDetail.astro`
- Modify: `app/src/pages/training/balanced-training/index.astro`
- Test: `app/tests/lib/training/routine-start.data.test.ts`

**Interfaces:**
- Produces: `routineStart(playPath: string)` — `{ starting: boolean; start(): void }`. It does not itself call `startTraining` — that already happens inside `balancedTrainingPlay().init()` on the PLAY page (Task 10). The Start button's own job is only navigation with a loading flag, mirroring the `Button.astro` `loadingExpr` convention other setup screens use.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/training/routine-start.data.test.ts
import { describe, it, expect, vi } from "vitest";
import { routineStart } from "@lib/training/routine-start.data";

describe("routineStart", () => {
  it("start() sets starting=true and navigates to the given path", () => {
    const original = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
    });
    const store = routineStart("/training/balanced-training/play");
    store.start();
    expect(store.starting).toBe(true);
    expect(globalThis.location.href).toBe("/training/balanced-training/play");
    Object.defineProperty(globalThis, "location", { value: original });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/training/routine-start.data.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/training/routine-start.data.ts
export function routineStart(playPath: string) {
  return {
    starting: false,
    start(this: { starting: boolean }) {
      this.starting = true;
      globalThis.location.href = playPath;
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/training/routine-start.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `RoutineDetail.astro`**

Add a `playPath` prop and wire the button:

```astro
---
interface RoutineDetailStep {
  name: string;
  duration: string;
  description: string;
}

interface Props {
  title: string;
  durationLabel: string;
  steps: RoutineDetailStep[];
  playPath: string;
}

const { title, durationLabel, steps, playPath }: Props = Astro.props;

import Badge from "@components/ui/Badge.astro";
import Button from "@components/forms/Button.astro";
---

<div
  class="space-y-4"
  x-data={`routineStart(${JSON.stringify(playPath)})`}
>
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">{title}</h1>
    <Badge>{durationLabel}</Badge>
  </div>

  <ol class="space-y-4">
    {
      steps.map((step, index) => (
        <li class="space-y-1">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-accent">
              {index + 1}. {step.name}
            </span>
            <span class="text-xs text-muted-foreground">— {step.duration}</span>
          </div>
          <p class="text-sm text-muted-foreground">{step.description}</p>
        </li>
      ))
    }
  </ol>

  <Button
    title="Start"
    variant="primary"
    grow
    @click="start()"
    loadingExpr="starting"
  />
</div>
```

Register `routineStart` alongside `balancedTrainingPlay` in the same Alpine bootstrap file Task 14 found.

- [ ] **Step 6: Pass `playPath` from the routine's detail page**

In `app/src/pages/training/balanced-training/index.astro`, add `playPath="/training/balanced-training/play"` to the existing `<RoutineDetail ... />` call.

- [ ] **Step 7: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 8: Manual browser verification**

```bash
cd app && astro dev --background
```

Navigate to `/training/balanced-training`, confirm the Start button is enabled (no more `disabled`/"coming soon"), click it, confirm it lands on the play page and begins Warm-Up.

```bash
astro dev stop
```

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/training/routine-start.data.ts app/src/components/layout/training/RoutineDetail.astro app/src/pages/training/balanced-training/index.astro app/tests/lib/training/routine-start.data.test.ts
git commit -m "feat(app): wire Balanced Training's Start button to the play page

The button was hardcoded disabled since the orchestration layer it needed
(training-session service, API routes, play page) did not exist. It now
navigates to the play page, which starts the routine itself."
```

---

### Task 16: Full validation and context maintenance

**Files:** none (verification only)

- [ ] **Step 1: Full gate run**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; `npx fallow` passes; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Format**

Run: `cd app && npm run format && npm run format:check`
Expected: clean; commit any formatting diff separately if one appears.

- [ ] **Step 3: Context maintenance**

Run the `context-maintenance` skill (mandatory per root `CLAUDE.md`, every task) — update `docs/architecture/00-Context-Map.md`/`00-File-Inventory.md` with the new files this plan added (`training-session.service.ts`, the 3 API routes, `balanced-training-play.data.ts`, the new `components/layout/training/*` components), and close out any finding this work resolves (check `FINDINGS.md` for F78/F79 — already closed by the `main` commit this plan built on; confirm no new finding needs logging).

- [ ] **Step 4: Commit context updates (if any)**

```bash
git add docs/architecture/00-Context-Map.md docs/architecture/00-File-Inventory.md FINDINGS.md
git commit -m "docs: update context map and file inventory for Balanced Training orchestration"
```

- [ ] **Step 5: Push**

```bash
git push -u origin claude/finalize-balanced-training-playable
```

---

## Self-Review Notes

- **Spec coverage:** §2 (persistence/reuse decisions) — Tasks 1-13 throughout. §3 (board reuse) — Tasks 7-8. §4 (service layer) — Tasks 1-5, with two corrections the spec itself now also carries (activity/session insert split; `isActiveSessionConflict` export) discovered while grounding this plan in the current code. §5 (API surface) — Task 6. §6 (frontend) — Tasks 9-15. §7 (out of scope) — respected: no summary screen, no resume, no `09-training-routines.md` edits. §8 (testing) — every task includes its own Vitest coverage; `.astro` frontmatter stays untested per convention.
- **New risk surfaced during planning, not in the original spec:** `SOLO_PARTICIPANT_REF`'s fixed-string engine ref cannot validate against the server's real participant id as-is (Task 9 resolves it) — this is exactly the "CHECK the state shape can be persisted" invariant from root `CLAUDE.md` doing its job before implementation, not after.
- **Type consistency:** `TrainingStepResolved`/`StartTrainingResult`/`StartTrainingStepResult` (Task 3-4) are the one shape threaded through the service, API schemas (Task 6), and the client response types the store consumes (Task 10) — named identically end to end.
