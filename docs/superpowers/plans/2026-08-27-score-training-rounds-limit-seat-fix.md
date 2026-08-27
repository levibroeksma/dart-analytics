# 1v1 ROUNDS-limit save failure (Issue #169 Part B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop 1v1 Score Training (and TUOD) sessions from failing to save at match completion by making the shared ROUNDS-limit batch check per-seat instead of session-total.

**Architecture:** `duration_type: "ROUNDS"`'s `duration_value` is a per-seat budget (the engine already enforces it that way). The shared `exceedsRoundsLimit` in `quick-score.validator.ts` currently checks the whole session's combined turn count against that single-seat number, which is wrong for any 2-seat session and always trips at (or before) the legitimate finish. Fix: `countTurnsForSession` groups by participant instead of returning one number, and `exceedsRoundsLimit` checks each participant's own existing+batch turn count independently. This changes a shared interface field (`RulesetValidator.validateBatch`'s `existingTurnCount`), so every implementer and every test constructing that input moves together in one task — the type change does not compile halfway.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest.

## Global Constraints

- New type: `ExistingTurnCounts = Record<string, number>` (participant id → turn count), defined in `app/src/repositories/interfaces.ts` (the existing type barrel for repository-owned shapes — see `ProvisionedPlayer` in the same file, consumed via `@repositories/interfaces` from `player.service.ts`). Not in `services/rulesets/types.ts` — the repository owns this shape, services consume it, matching the codebase's existing Controller → Service → Repository type-flow direction.
- `RulesetValidator.validateBatch`'s field renames `existingTurnCount: number` → `existingTurnCounts: ExistingTurnCounts` (plural — the old singular name reads wrong for a map, and the rename turns every stale call site into a compile error instead of a silently-wrong type).
- A participant absent from `ExistingTurnCounts` has zero existing turns — every consumer treats a missing key as `?? 0`.
- Batch turn `participantRef` (`app/src/pages/api/sessions/types.ts:104`) is the same id as `turns.participant_id` in the database — confirmed via `resolveBatchStructure`/`validateBatchReferences` in `session.service.ts`, which checks batch `participantRef`s directly against `findSessionParticipantIds`'s DB ids. No id translation is needed anywhere in this fix.
- Out of scope: `score-training.engine.module.ts`, `tuod.engine.module.ts` (already correct — this fixes batch validation catching up to them), the retry/stuck-UX flow (issue #169 Part D, separate task), any ruleset other than Score Training and TUOD beyond the type-only signature change forced by the shared interface.
- Spec: `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md`.

---

### Task 1: Per-seat `ExistingTurnCounts` — repository, shared validator fix, and every call site

This is one task, not several, because the type change is atomic: `RulesetValidator.validateBatch`'s `existingTurnCount` field cannot be renamed in the interface without every implementer and every test call site changing in the same commit, or `npm run validate:app` fails whole-app. There is no intermediate state where only part of this compiles.

**Files:**
- Modify: `app/src/repositories/interfaces.ts` — add `ExistingTurnCounts` type
- Modify: `app/src/repositories/session.repository.ts:218-228` — `countTurnsForSession`
- Modify: `app/tests/repositories/session.repository.test.ts:1-12,66-82` — `fakeSelect` helper + `countTurnsForSession` tests
- Modify: `app/src/services/session.service.ts:631-638` — call site
- Modify: `app/tests/services/session.service.test.ts:508` — mock return value
- Modify: `app/src/services/rulesets/interfaces.ts` — `RulesetValidator.validateBatch` signature
- Modify: `app/src/services/rulesets/quick-score.validator.ts:56-111` — `countBatchTurns` → `countBatchTurnsByParticipant`, `exceedsRoundsLimit`
- Modify: `app/src/services/rulesets/score-training/score-training.validator.ts` — pass-through field rename
- Modify: `app/src/services/rulesets/tuod/tuod.validator.ts` — pass-through field rename
- Modify: `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts:47-58` — type-only signature update
- Modify: `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts:48-58` — type-only signature update
- Modify: `app/src/services/rulesets/three-dart.validator.ts:138-146` — type-only signature update (shared factory behind `around-the-clock`, `bobs27`, `doubles-training`, `shanghai`, `singles-training` validators — none of those 5 files declare the field themselves)
- Modify (meaningful new cases + rename): `app/tests/services/rulesets/score-training/score-training.validator.test.ts:193-330`
- Modify (meaningful new cases + rename): `app/tests/services/rulesets/tuod/tuod.validator.test.ts:75-186`
- Modify (mechanical rename only, field unused): `app/tests/services/rulesets/engine-validator-seam.test.ts:71,88`, `app/tests/services/rulesets/five-oh-one/five-oh-one.validator.test.ts:109,120,144,187,213`, `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts:60,71,82,91,113,167,193`, `app/tests/services/rulesets/three-dart.validator.test.ts:90,99,109,118`, `app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts:79,88,97,151,163,206`, `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts:82,91,100,154,166,209`, `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts:73,91,100,109,163,175,218`, `app/tests/services/rulesets/bobs27/bobs27.validator.test.ts:86,95,104,145,157`, `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts:73,82,91,145,157,200`

**Interfaces:**
- Produces: `ExistingTurnCounts = Record<string, number>` (`app/src/repositories/interfaces.ts`), `countTurnsForSession(db, sessionId): Promise<ExistingTurnCounts>`, `RulesetValidator.validateBatch(input: { ...; existingTurnCounts: ExistingTurnCounts; ... })`, `exceedsRoundsLimit(config, batch, existingTurnCounts: ExistingTurnCounts): boolean`.

- [ ] **Step 1: Add the `ExistingTurnCounts` type**

In `app/src/repositories/interfaces.ts`, add (after the existing `ProvisionedPlayer` block, or anywhere among the other exported interfaces — file has no enforced ordering):

```ts
/**
 * Turns already persisted for a session, grouped by participant id — the
 * same id a batch turn's `participantRef` carries (see
 * `resolveBatchStructure`/`validateBatchReferences` in `session.service.ts`).
 * A participant absent from this map has zero existing turns.
 */
export type ExistingTurnCounts = Record<string, number>;
```

- [ ] **Step 2: Write the failing repository test**

In `app/tests/repositories/session.repository.test.ts`, first add `groupBy` to the shared mock chain at the top of the file (the real query will call it; the mock needs to accept the call and keep chaining):

```ts
function fakeSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows), // supports `await db.select(...).from(...)` without .limit()
  };
  return chain;
}
```

Then replace the `describe("countTurnsForSession", ...)` block (lines 66-82) with:

```ts
describe("countTurnsForSession", () => {
  it("groups turn counts by participant id", async () => {
    const db = {
      select: vi.fn(() =>
        fakeSelect([
          { participantId: "p1", count: 2 },
          { participantId: "p2", count: 1 },
        ]),
      ),
    } as any;
    const { countTurnsForSession } =
      await import("@repositories/session.repository");
    const result = await countTurnsForSession(db, "s1");
    expect(result).toEqual({ p1: 2, p2: 1 });
  });

  it("returns an empty map when no rows exist", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { countTurnsForSession } =
      await import("@repositories/session.repository");
    const result = await countTurnsForSession(db, "s1");
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts -t countTurnsForSession`
Expected: FAIL — `result` is `2` (old scalar return), not `{ p1: 2, p2: 1 }`.

- [ ] **Step 4: Implement the grouped query**

In `app/src/repositories/session.repository.ts`, replace `countTurnsForSession` (lines 218-228):

```ts
export async function countTurnsForSession(
  db: Db,
  sessionId: string,
): Promise<ExistingTurnCounts> {
  const rows = await db
    .select({
      participantId: turns.participantId,
      count: sql<number>`count(*)::int`,
    })
    .from(turns)
    .innerJoin(exerciseStages, eq(exerciseStages.id, turns.exerciseStageId))
    .where(eq(exerciseStages.exerciseSessionId, sessionId))
    .groupBy(turns.participantId);
  return Object.fromEntries(rows.map((r) => [r.participantId, r.count]));
}
```

Add `ExistingTurnCounts` to the existing type-only import from `"./interfaces"` at the top of the file (alongside `ActiveSessionSummary`, `BatchInsertInput`, etc.).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts -t countTurnsForSession`
Expected: PASS (2 tests)

- [ ] **Step 6: Update the service call site and its test**

In `app/src/services/session.service.ts`, at the `appendBatch` function (around line 631), rename the local to match the new plural shape:

```ts
  const existingTurnCounts = await countTurnsForSession(db, sessionId);
  const batchValidation = validator.validateBatch({
    config,
    batch,
    existingTurnCounts,
    captureModeKey: session.captureModeKey,
    inputModeKey: session.inputModeKey,
  });
```

In `app/tests/services/session.service.test.ts:508`, update the mock:

```ts
    vi.mocked(repo.countTurnsForSession).mockResolvedValue({});
```

- [ ] **Step 7: Update the `RulesetValidator` interface**

In `app/src/services/rulesets/interfaces.ts`, replace the `validateBatch` field:

```ts
  validateBatch(input: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCounts: ExistingTurnCounts;
    captureModeKey?: string;
    inputModeKey?: string;
  }): BatchValidationResult;
```

Add the import at the top of the file:

```ts
import type { ExistingTurnCounts } from "@repositories/interfaces";
```

- [ ] **Step 8: Write the failing per-seat tests for the shared validator**

In `app/tests/services/rulesets/score-training/score-training.validator.test.ts`, inside `describe("scoreTrainingValidator.validateBatch", ...)` (which uses `config = { duration_type: "ROUNDS", duration_value: 2, max_darts_per_turn: 3 }` and a `batchWithTurns` helper that puts every turn on `participantRef: "p1"`), add two new tests after the existing "rejects exceeding the ROUNDS ceiling across existing + new turns" test:

```ts
  it("accepts a 1v1 batch where each seat is under its own ROUNDS budget, even though the combined total is over it", () => {
    const batch = {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 45,
              completedAt: null,
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: { p1: 2, p2: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a 1v1 batch when one seat's own turn count would exceed the ROUNDS budget", () => {
    const batch = {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 45,
              completedAt: null,
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: { p1: 2, p2: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
```

In `app/tests/services/rulesets/tuod/tuod.validator.test.ts`, inside `describe("tuodValidator.validateBatch", ...)`, add two analogous tests after "rejects a batch pushing a ROUNDS session past its attempt count" (existing config there is `{ ...validConfig, duration_value: 2 }`, `batchWithTurns` also fixes `participantRef: "p1"`):

```ts
  it("accepts a 1v1 batch where each seat is under its own ROUNDS budget, even though the combined total is over it", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 41,
              completedAt: "2026-07-26T10:00:00.000Z",
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch,
      existingTurnCounts: { p1: 2, p2: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a 1v1 batch when one seat's own attempt count would exceed the ROUNDS budget", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 41,
              completedAt: "2026-07-26T10:00:00.000Z",
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch,
      existingTurnCounts: { p1: 2, p2: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
```

Now migrate every other `existingTurnCount:` literal in both files to the new field name and shape (all on `participantRef: "p1"` batches, so each maps 1:1):

`score-training.validator.test.ts` — lines 197, 221, 232, 301, 327: `existingTurnCount: 0,` → `existingTurnCounts: {},`. Line 243: `existingTurnCount: 2,` → `existingTurnCounts: { p1: 2 },`. Line 258: `existingTurnCount: 999,` → `existingTurnCounts: { p1: 999 },`.

`tuod.validator.test.ts` — lines 80, 91, 102, 114, 123, 156, 180: `existingTurnCount: 0,` → `existingTurnCounts: {},`. Line 134: `existingTurnCount: 1,` → `existingTurnCounts: { p1: 1 },`. Line 145: `existingTurnCount: 5,` → `existingTurnCounts: { p1: 5 },`.

- [ ] **Step 9: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/score-training/score-training.validator.test.ts tests/services/rulesets/tuod/tuod.validator.test.ts`
Expected: FAIL — the new field name doesn't exist on `RulesetValidator.validateBatch`'s still-old signature yet (or a type error if run through `tsc`; at minimum the two new per-seat tests fail because `exceedsRoundsLimit` hasn't changed).

- [ ] **Step 10: Implement the per-seat check in the shared validator**

In `app/src/services/rulesets/quick-score.validator.ts`, replace `countBatchTurns` (lines 55-58) and `exceedsRoundsLimit` (lines 97-111):

```ts
/** How many turns the batch carries per participant, across every stage. */
function countBatchTurnsByParticipant(
  batch: EventsBatchRequestInput,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      counts[turn.participantRef] = (counts[turn.participantRef] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Whether any one seat's own turn count — existing plus this batch — would
 * exceed the ROUNDS budget. `duration_value` is a per-seat cap: the engine
 * has every seat play out its own full budget (`durationSeatComplete` in
 * `modules/game/seat-state.module.ts`), so a 1v1 session's combined turn
 * count is legitimately up to 2×`duration_value` — checking the combined
 * total against the single-seat number rejected every 1v1 session at
 * completion (issue #169). A MINUTES session is bounded by its countdown
 * rather than a visit count, so it never exceeds one.
 */
export function exceedsRoundsLimit(
  config: Record<string, unknown>,
  batch: EventsBatchRequestInput,
  existingTurnCounts: ExistingTurnCounts,
): boolean {
  if (config.duration_type !== "ROUNDS") return false;
  const durationValue = config.duration_value as number;
  const batchCounts = countBatchTurnsByParticipant(batch);
  const participantRefs = new Set([
    ...Object.keys(existingTurnCounts),
    ...Object.keys(batchCounts),
  ]);
  for (const ref of participantRefs) {
    const total = (existingTurnCounts[ref] ?? 0) + (batchCounts[ref] ?? 0);
    if (total > durationValue) return true;
  }
  return false;
}
```

Add the import at the top of the file:

```ts
import type { ExistingTurnCounts } from "@repositories/interfaces";
```

- [ ] **Step 11: Update the two real callers of `exceedsRoundsLimit`**

In `app/src/services/rulesets/score-training/score-training.validator.ts`, add the import:

```ts
import type { ExistingTurnCounts } from "@repositories/interfaces";
```

Replace the `roundsLimitRejection` helper's signature (lines 28-32):

```ts
function roundsLimitRejection(
  config: Record<string, unknown>,
  batch: EventsBatchRequestInput,
  existingTurnCounts: ExistingTurnCounts,
): BatchValidationResult {
  if (exceedsRoundsLimit(config, batch, existingTurnCounts)) {
```

(the function body's `return`/closing brace are unchanged — only the parameter name changes, and the `if` line above now reads `existingTurnCounts` instead of `existingTurnCount`).

In `validateBatch`'s destructured parameter type (around line 81), change `existingTurnCount: number;` to `existingTurnCounts: ExistingTurnCounts;`. Both call sites in the function body — `roundsLimitRejection(config, batch, existingTurnCount)` (visual-board path) and `roundsLimitRejection(config, batch, existingTurnCount)` (quick-score path) — become `roundsLimitRejection(config, batch, existingTurnCounts)`.

In `app/src/services/rulesets/tuod/tuod.validator.ts`, add the same import. In `validateBatch`'s destructured parameter type, change `existingTurnCount: number;` to `existingTurnCounts: ExistingTurnCounts;`. The one call site (around line 102), `exceedsRoundsLimit(config, batch, existingTurnCount)`, becomes `exceedsRoundsLimit(config, batch, existingTurnCounts)`.

- [ ] **Step 12: Update the three type-only pass-through validators**

In `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts`, the `validateBatch` destructure type (lines 52-58) changes `existingTurnCount: number;` to `existingTurnCounts: ExistingTurnCounts;`. Add `import type { ExistingTurnCounts } from "@repositories/interfaces";`.

In `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`, same change to its `validateBatch` destructure type (lines 53-58), same import.

In `app/src/services/rulesets/three-dart.validator.ts`, the shared factory's `validateBatch` destructure type (lines 141-146) changes `existingTurnCount: number;` to `existingTurnCounts: ExistingTurnCounts;`. Add the same import. This one change covers `around-the-clock`, `bobs27`, `doubles-training`, `shanghai`, and `singles-training` validators — they all call `createThreeDartValidator(...)` and declare no `validateBatch` signature of their own.

- [ ] **Step 13: Run the score-training and tuod validator tests to verify they pass**

Run: `cd app && npx vitest run tests/services/rulesets/score-training/score-training.validator.test.ts tests/services/rulesets/tuod/tuod.validator.test.ts`
Expected: PASS (all cases, including the 4 new 1v1 cases)

- [ ] **Step 14: Mechanically rename the remaining test call sites**

These files construct a `validateBatch` input purely to satisfy the type — none reads `existingTurnCount`'s value. In each, replace every `existingTurnCount: 0,` with `existingTurnCounts: {},` at the lines listed:

- `app/tests/services/rulesets/engine-validator-seam.test.ts`: lines 71, 88
- `app/tests/services/rulesets/five-oh-one/five-oh-one.validator.test.ts`: lines 109, 120, 144, 187, 213
- `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`: lines 60, 71, 82, 91, 113, 167, 193
- `app/tests/services/rulesets/three-dart.validator.test.ts`: lines 90, 99, 109, 118
- `app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts`: lines 79, 88, 97, 151, 163, 206
- `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`: lines 82, 91, 100, 154, 166, 209
- `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`: lines 73, 91, 100, 109, 163, 175, 218
- `app/tests/services/rulesets/bobs27/bobs27.validator.test.ts`: lines 86, 95, 104, 145, 157
- `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`: lines 73, 82, 91, 145, 157, 200

- [ ] **Step 15: Run the full suite and the type gate**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints. This is the first point at which the whole app compiles again — confirm no other file references `countBatchTurns` or the old `existingTurnCount` name (`git grep -n "existingTurnCount\b" app/src app/tests` and `git grep -n "countBatchTurns\b" app/src` should both return nothing).

- [ ] **Step 16: Commit**

```bash
git add app/src/repositories/interfaces.ts app/src/repositories/session.repository.ts \
  app/tests/repositories/session.repository.test.ts \
  app/src/services/session.service.ts app/tests/services/session.service.test.ts \
  app/src/services/rulesets/interfaces.ts app/src/services/rulesets/quick-score.validator.ts \
  app/src/services/rulesets/score-training/score-training.validator.ts \
  app/src/services/rulesets/tuod/tuod.validator.ts \
  app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts \
  app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts \
  app/src/services/rulesets/three-dart.validator.ts \
  app/tests/services/rulesets/score-training/score-training.validator.test.ts \
  app/tests/services/rulesets/tuod/tuod.validator.test.ts \
  app/tests/services/rulesets/engine-validator-seam.test.ts \
  app/tests/services/rulesets/five-oh-one/five-oh-one.validator.test.ts \
  app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts \
  app/tests/services/rulesets/three-dart.validator.test.ts \
  app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts \
  app/tests/services/rulesets/singles-training/singles-training.validator.test.ts \
  app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts \
  app/tests/services/rulesets/bobs27/bobs27.validator.test.ts \
  app/tests/services/rulesets/shanghai/shanghai.validator.test.ts
git commit -m "fix: check the ROUNDS turn limit per seat, not per session

1v1 Score Training and TUOD sessions failed to save at completion —
duration_value is a per-seat budget but exceedsRoundsLimit compared it
against the whole session's combined turn count, always tripping once
both seats' turns summed past it. Fixes issue #169 Part B."
```

---

### Task 2: Decision entry and context maintenance

**Files:**
- Modify: `decisions/api.md`
- Modify: `docs/architecture/00-File-Inventory.md` (size estimate for `decisions/api.md` if it drifts past 20%)
- Run: `context-maintenance` skill

**Interfaces:**
- Consumes: the fix landed in Task 1.

- [ ] **Step 1: Append decision D239 to `decisions/api.md`**

Append after the last existing block (`D221`), following the same block format:

```markdown
### D239 — `ROUNDS` batch validation checks the turn-count limit per seat, not per session
Status: Accepted · Date: 2026-08-27
Decision: `duration_type: "ROUNDS"`'s `duration_value` is a per-seat budget — every seat plays out its own full round count before a match is decided (`durationSeatComplete`, `modules/game/seat-state.module.ts`). The shared batch-validation check (`exceedsRoundsLimit`, `quick-score.validator.ts`, used by Score Training and TUOD) now checks each participant's own existing-plus-batch turn count against `duration_value` independently, via a new `ExistingTurnCounts` map (`app/src/repositories/interfaces.ts`) keyed by participant id instead of one session-wide number.
Reason: The old check summed turns across every seat and compared that to the single-seat budget, so any 2-seat ROUNDS session's legitimate combined turn count (up to 2×`duration_value`) tripped the "exceeds limit" rejection — always, at or before the real finish. Solo sessions never hit this (one seat's turns are the whole session's turns), which is why it shipped unnoticed until 1v1 (issue #169).
Consequences: `RulesetValidator.validateBatch`'s `existingTurnCount: number` field is renamed `existingTurnCounts: ExistingTurnCounts` — a breaking signature change for every ruleset validator, though only Score Training's and TUOD's `validateBatch` read the value; the rest carry the field only to satisfy the interface. `countTurnsForSession` (`session.repository.ts`) returns a per-participant map instead of a scalar.
```

- [ ] **Step 2: Run the context-maintenance skill**

Follow `.claude/skills/context-maintenance/SKILL.md`'s procedure: check whether any context-map/File-Inventory size estimates drifted (`decisions/api.md` gained one block), update stale entries, confirm no other doc references the old `existingTurnCount`/`countBatchTurns` names.

- [ ] **Step 3: Run the repo-root structural gates**

Run: `bash scripts/check-context-map.sh && bash scripts/check-context-budget.sh && bash scripts/check-doc-links.sh && bash scripts/check-decision-ids.sh && bash scripts/check-findings-log.sh`
Expected: all OK.

- [ ] **Step 4: Final validation**

Run: `cd app && npm run validate:app && npm run format && npm run format:check`
Expected: 0 errors/warnings/hints; `format` produces no diff (or commit it if it does).

- [ ] **Step 5: Commit and push**

```bash
git add decisions/api.md docs/architecture/00-File-Inventory.md
git commit -m "docs: D239 — ROUNDS turn-count limit is per-seat (issue #169 Part B)"
git push -u origin claude/issue-169-brainstorming-hxzm90
```
