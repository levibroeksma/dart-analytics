# 1v1 ROUNDS-limit save failure (Issue #169, Part B) — Design

Status: Draft · Date: 2026-08-27

## Problem

Issue #169 comment 1: "On completion in 1v1 recreational mode, the match
doesn't save and shows an error: Could not save your game. Check your
connection and retry."

## Root cause

`exceedsRoundsLimit` (`app/src/services/rulesets/quick-score.validator.ts:103`)
rejects a batch when `existingTurnCount + countBatchTurns(batch) >
durationValue`. `existingTurnCount` comes from
`countTurnsForSession` (`app/src/repositories/session.repository.ts:218`),
which counts turns for the whole session — every seat combined.

`duration_value` under `duration_type: "ROUNDS"` is a **per-seat** budget:
`durationSeatComplete` (`app/src/modules/game/seat-state.module.ts:67`) checks
each seat's own `turnCount` against it, and the engine's own doc
(`score-training.engine.module.ts:56-58`) states "both seats always play out
their own full ROUNDS budget."

So a solo session's session-total turn count equals its one seat's turn
count — the check is accidentally correct there. A 1v1 session's session
total is 2×`duration_value` at completion, so the very last `appendBatch`
call before `completeSession` gets rejected with `VALIDATION_FAILED`, which
`score-training-play.data.ts`'s `uploadAndCompleteSession` (and the shared
`play-lifecycle.ts` copy) surfaces as "Could not save your game."

`exceedsRoundsLimit` is shared: `tuod.validator.ts:102` calls it too, and
TUOD also supports 1v1 + ROUNDS (`tuod-setup.data.ts:99-102` — adding a
guest locks the mode to ROUNDS). Same defect, same trigger, untested in
either validator's test file (no multi-seat case in
`score-training.validator.test.ts` or `tuod.validator.test.ts`).

## Scope

**In scope:** make the ROUNDS-limit check per-seat, fixing Score Training and
TUOD in the one shared function both use. Files:

- `app/src/repositories/session.repository.ts` — `countTurnsForSession`
- `app/src/services/session.service.ts` — call site
- `app/src/services/rulesets/interfaces.ts` — `RulesetValidator.validateBatch`'s
  `existingTurnCount` type
- `app/src/services/rulesets/types.ts` — new shared type
- `app/src/services/rulesets/quick-score.validator.ts` — `exceedsRoundsLimit`
- `app/src/services/rulesets/score-training/score-training.validator.ts`,
  `app/src/services/rulesets/tuod/tuod.validator.ts` — pass-through, no
  logic change
- `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts`,
  `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`,
  `app/src/services/rulesets/three-dart.validator.ts` — type-only
  (`existingTurnCount: number` → new type), unused otherwise
- Every test file constructing a `validateBatch` input with
  `existingTurnCount` (11 files under `app/tests/services/rulesets/`, plus
  `app/tests/repositories/session.repository.test.ts` and
  `app/tests/services/session.service.test.ts`)

**Out of scope:** the engine (`score-training.engine.module.ts`,
`tuod.engine.module.ts` untouched — they already enforce the per-seat budget
correctly; this is a batch-validation defense-in-depth check catching up to
that). The retry/stuck-UX flow (issue #169's Part D, deferred separately).
Any other ruleset's `existingTurnCount` field beyond the type-only signature
update needed to satisfy the shared interface.

## Design

### Data shape

```ts
// app/src/services/rulesets/types.ts
/**
 * Turns already persisted for a session, grouped by participant id (the
 * same id a batch turn's `participantRef` carries — see
 * `resolveBatchStructure`/`validateBatchReferences`). A participant absent
 * from this map has zero existing turns.
 */
export type ExistingTurnCounts = Record<string, number>;
```

### Repository

```ts
// app/src/repositories/session.repository.ts
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

A session with no turns yet returns `{}` (was `0`) — every call site treats
a missing key as zero already (`?? 0` pattern below), so this is not a
breaking behavior change, only a type change.

### Service call site

`app/src/services/session.service.ts:631` — rename the local to
`existingTurnCounts` (plural, matches the new shape), pass through
unchanged otherwise.

### Shared validator logic

```ts
// app/src/services/rulesets/quick-score.validator.ts
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
 * exceed the ROUNDS budget. `duration_value` is a per-seat cap (the engine
 * has every seat play its own full budget), so this checks each participant
 * independently rather than the batch's combined total.
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

`countBatchTurns` (the old whole-batch counter) is removed — its only two
callers were `exceedsRoundsLimit` (replaced above) and nothing else
(verify at implementation time via `git grep countBatchTurns`).

### Interface

```ts
// app/src/services/rulesets/interfaces.ts
validateBatch(input: {
  config: Record<string, unknown>;
  batch: EventsBatchRequestInput;
  existingTurnCounts: ExistingTurnCounts;
  captureModeKey?: string;
  inputModeKey?: string;
}): BatchValidationResult;
```

Field renamed `existingTurnCount` → `existingTurnCounts` at the interface
level too (not just the type) — the old singular name reads wrong for a
per-participant map, and the rename makes every call site's outdated
literal (`existingTurnCount: 0`) a compile error instead of a silently
wrong type, forcing every one to be looked at.

### Testing

- `session.repository.test.ts` — `countTurnsForSession` gains a case
  asserting per-participant grouping (two participants, different turn
  counts, one query).
- `session.service.test.ts` — mock return value `0` → `{}`.
- `score-training.validator.test.ts`, `tuod.validator.test.ts` — add a 1v1
  case: two participants, each individually under `duration_value`, combined
  total over it → accepted. Plus the existing single-seat cases, migrated to
  the new shape (`existingTurnCounts: { p1: N }`).
- Every other validator test file touching `existingTurnCount` — mechanical
  rename to `existingTurnCounts: {}` (unused, type-only).
- `engine-validator-seam.test.ts` — check whether it constructs a
  `validateBatch` input; update if so.

No new production test file — `quick-score.validator.ts` has no dedicated
test file today (score-training/tuod validators test it through their own
`validateBatch`); this task does not introduce one, following the same
precedent.

## Non-goals

- No change to how `duration_value` is chosen or displayed in setup UI.
- No change to `ROUNDS` semantics for `MINUTES`-duration sessions.
- No retry/stuck-UX change (Part D, separate task).
