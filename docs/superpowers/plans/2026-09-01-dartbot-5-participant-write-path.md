# DartBot Phase 5: Participant Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove — and permanently regression-guard — that a `DARTBOT` participant's visit persists through the real events-batch write path attributed to its own `participantRef`, and stays excluded from both owner-scoped dart views, then close `DECISIONS.md`'s "DartBot participants" deferral and correct `08-DartBot.md`'s own dependency table, which still describes the write path as blocked.

**Architecture:** Phase 4 (merged to `main`, 2026-09-01) admitted `DARTBOT` at the session-create wire contract, so a session is now creatable with a bot seat. Everything downstream of that — `buildEventsBatch(facts)`, `appendBatch`'s `validateBatchReferences`/`resolveBatchStructure`, the three-dart and quick-score ruleset validators, and migration `0023`'s owner-scoped view join — reads a turn's `participantRef` (or the underlying `participants.participant_type_id`) generically. None of it branches on participant type. That generic write path shipped with D220, before `DARTBOT` could be seated at all, so nothing has ever actually exercised it with a real `DARTBOT`-typed seat. This phase closes that gap by proof, not by new gating code: one test drives a real `DARTBOT` seat through a real 1v1 engine using the already-shipped throw pipeline (phases 1–3: `throw-engine.module.ts`, `skill-profile.module.ts`, `dictated.strategy.module.ts`) and confirms `buildEventsBatch` carries the bot's `participantRef` through unchanged; a second test confirms `appendBatch` persists that turn via the same call `insertBatchRecords` receives for any other seat; a SQL verification script extends migration `0023`'s own proof to a fixture that includes a `DARTBOT` dart, confirming it is still excluded from `v_dart_analytics` and `v_dart_locations`. No source file changes — the write path does not need to change, only to be exercised and have the paper trail closed.

**Tech Stack:** TypeScript, Vitest, PostgreSQL/Neon (verification script only).

## Global Constraints

- No database migration. `DARTBOT` (`participant_type_id = 3`) and its `chk_participants_dartbot_display_name` CHECK are already seeded (`database/seeds/0001_reference_data.sql`, `database/migrations/0005_runtime_core.sql`); the owner-scoped view join (migration `0023`, D222) already excludes any participant whose `player_id IS NULL`, which every `DARTBOT` row satisfies by the same CHECK that requires it.
- No play-loop, no `DartBot` class, no live gameplay trigger. Whose-turn-it-is comparison, the `botThrowing` guard, `undoToActiveSeat()`, and the QUICK_SCORE scratch-engine fold are phase 6's scope (`08-DartBot.md` §Delivery Phases row 6) and are not touched here. This phase drives an engine directly, the same way `app/tests/modules/dartbot/harness/*.contract.test.ts` already drives one for a solo bot — it does not add a page-level trigger.
- The write path (`buildEventsBatch`, `appendBatch`, `validateBatchReferences`, `resolveBatchStructure`, `createThreeDartValidator`, `quick-score.validator.ts`) is confirmed type-agnostic over `participantRef` by direct reading — no branch anywhere checks `participantTypeKey` or `participant_type_id`. Do not add one. A `DARTBOT`-specific branch anywhere in this path would be solving a problem that does not exist and would itself be the kind of thing `08-DartBot.md`'s anti-pattern table would need a new row for.
- Ruleset scope: `BOBS27_V1`, one of the three rulesets `RULESET_DARTBOT` admits since phase 4 (`AROUND_THE_CLOCK_V1`, `BOBS27_V1`, `DOUBLES_TRAINING_V1`). Chosen because `app/tests/modules/game/bobs27.engine.module.test.ts`'s existing `describe("Bobs27Engine — 1v1", ...)` block already establishes the two-seat driving pattern this plan's Task 1 extends with a real bot seat.
- `DECISIONS.md`'s `## Deferred` list is a maintained bullet list, not an append-only `decisions/**` ledger — striking a shipped item from it (as the guest half of "DartBot participants" already was) is the established pattern, confirmed by `08-DartBot.md`'s own line: "the guest half having been struck".

---

## File Structure

| File | Responsibility |
|---|---|
| `app/tests/modules/dartbot/harness/bobs27-dartbot-seat.contract.test.ts` | **New.** Drives a real `DARTBOT`-typed 1v1 seat through `Bobs27Engine` using the shipped throw pipeline; asserts `buildEventsBatch` carries the bot's `participantRef` through unchanged |
| `app/tests/services/session.service.test.ts` | Extended: `appendBatch` persists a `DETAILED_DARTS` turn attributed to a `DARTBOT` participant exactly as it does for any other seat |
| `database/verification/0023_owner_scoped_dart_view_checks.sql` | Extended: a third fixture participant (`DARTBOT`) with its own turn/dart, and checks proving its dart is absent from both views, alongside the existing `GUEST` checks |
| `docs/architecture/08-DartBot.md` | Dependency table's write-path row flips from "still deferred" to shipped; version note bumped |
| `DECISIONS.md` | "DartBot participants (2026-07-12)" struck from `## Deferred` |

---

## Task 1: Contract test — a `DARTBOT` seat's visit survives `buildEventsBatch` unchanged

**Files:**
- Create: `app/tests/modules/dartbot/harness/bobs27-dartbot-seat.contract.test.ts`

**Interfaces:**
- Consumes: `bobs27EngineFactory` (`@modules/game/bobs27.engine.module`), `doublesPath`/`targetAt` (`@modules/game/board-progression.module`), `buildEventsBatch` (`@modules/game/events.payload.module`), `skillProfileForLevel` (`@modules/dartbot/skill-profile.module`), `createDartRng` (`@modules/dartbot/rng.module`), `throwDart` (`@modules/dartbot/throw-engine.module`), `chooseTarget` (`@modules/dartbot/strategy/dictated.strategy.module`) — all shipped in phases 1–3. `Bobs27State`/`DartObservation` types (`@modules/types`).
- Produces: nothing consumed by later tasks — this is a standalone contract test satisfying `08-DartBot.md`'s Test Strategy row "Contract — attribution".

This is the first test in the repo to combine a real `DARTBOT`-typed `SeatFact` (phase 4) with the real throw pipeline (phases 1–3) and the real write-path serializer (D220). Nothing under test changes — this step's "failing" state is "does not exist yet".

- [ ] **Step 1: Write the test**

```ts
// app/tests/modules/dartbot/harness/bobs27-dartbot-seat.contract.test.ts
import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { Bobs27State, DartObservation } from "@modules/types";

/** Mirrors `play-dictated-session.ts`'s own ceiling, same rationale: a real
 * infinite-loop regression should fail fast rather than hang the suite. */
const MAX_DARTS = 500;

const HUMAN_REF = "human-1";
const BOT_REF = "bot-1";
const BOT_LEVEL = 8;
const BOT_SEED = 424242;

const seats = [
  {
    participantRef: HUMAN_REF,
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: BOT_REF,
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: { level: BOT_LEVEL, seed: BOT_SEED, levelSource: "MANUAL" as const },
  },
];

const config = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats,
};

function missDart(): DartObservation {
  return {
    hitTargetNumber: 1,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function botSeatState(state: Bobs27State) {
  return state.seats.find((seat) => seat.participantRef === BOT_REF)!;
}

/**
 * Drives the same 1v1 shape `bobs27.engine.module.test.ts`'s "Bobs27Engine —
 * 1v1" block already proves alternation for, except the human's darts are
 * fixed misses and the bot's are the real output of the throw pipeline
 * (phase 1) plus `DictatedStrategy` (phase 3) — the join point
 * `08-DartBot.md`'s §Position in the System names, exercised here for the
 * first time against a real `DARTBOT`-typed seat (phase 4).
 */
function playToCompletion() {
  const engine = bobs27EngineFactory.create(config);
  const profile = skillProfileForLevel(BOT_LEVEL);
  let dartIndex = 0;
  let state = engine.state();

  while (state.status === "IN_PROGRESS") {
    if (dartIndex >= MAX_DARTS) {
      throw new Error(`Match did not complete within ${MAX_DARTS} darts`);
    }
    if (state.activeParticipantRef === BOT_REF) {
      const target = targetAt(doublesPath(), botSeatState(state).targetIndex);
      const intent = chooseTarget({ target });
      const rng = createDartRng(BOT_SEED, dartIndex);
      const thrown = throwDart(intent, profile, rng);
      engine.record({
        hitTargetNumber: thrown.hit.targetNumber,
        hitZoneKey: thrown.hit.zoneKey,
        locationX: thrown.landing.x,
        locationY: thrown.landing.y,
      });
    } else {
      engine.record(missDart());
    }
    dartIndex++;
    state = engine.state();
  }

  return engine;
}

describe("DartBot-driven Bob's 27 1v1 — write-path attribution", () => {
  it("reaches a decided outcome with the bot throwing its own visits", () => {
    const state = playToCompletion().state();
    expect(state.status).toBe("COMPLETE");
    expect(["A", "B"]).toContain(state.winningSideKey);
  });

  it("stamps every bot visit with the bot's own participantRef and real darts", () => {
    const engine = playToCompletion();
    const botTurns = engine
      .facts()
      .turns.filter((turn) => turn.participantRef === BOT_REF);
    expect(botTurns.length).toBeGreaterThan(0);
    expect(botTurns.every((turn) => turn.darts.length > 0)).toBe(true);
    expect(
      engine
        .facts()
        .turns.some(
          (turn) =>
            turn.participantRef !== BOT_REF && turn.participantRef !== HUMAN_REF,
        ),
    ).toBe(false);
  });

  it("buildEventsBatch emits the bot's participantRef unchanged for every bot turn", () => {
    const engine = playToCompletion();
    const facts = engine.facts();
    const expectedBotTurnKeys = facts.turns
      .filter((turn) => turn.participantRef === BOT_REF)
      .map((turn) => turn.clientKey);

    const batch = buildEventsBatch(facts);
    const batchBotTurns = batch.stages
      .flatMap((stage) => stage.turns)
      .filter((turn) => expectedBotTurnKeys.includes(turn.clientKey));

    expect(batchBotTurns).toHaveLength(expectedBotTurnKeys.length);
    expect(batchBotTurns.every((turn) => turn.participantRef === BOT_REF)).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/harness/bobs27-dartbot-seat.contract.test.ts`
Expected: PASS — 3/3. (No implementation step: every function this test calls already ships. If any import fails to resolve or `record()` rejects the bot's own `DartObservation`, that is a real defect in the shipped write path or throw pipeline — stop and diagnose rather than adjusting the test to route around it.)

- [ ] **Step 3: Commit**

```bash
cd app && git add tests/modules/dartbot/harness/bobs27-dartbot-seat.contract.test.ts
git commit -m "test: prove a DARTBOT seat's visit survives buildEventsBatch unchanged"
```

---

## Task 2: `appendBatch` persists a turn attributed to a `DARTBOT` participant

**Files:**
- Modify: `app/tests/services/session.service.test.ts`

**Interfaces:**
- Consumes: `appendBatch` (`@services/session.service`), the existing `describe("appendBatch", ...)` block's `beforeEach` mocks (`app/tests/services/session.service.test.ts:603-634`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing... test**

This test does not fail against current code (the write path is already generic), but it is the first assertion that a `DARTBOT`-attributed turn reaches `insertBatchRecords` — add it and confirm it passes green, which is itself the proof this phase exists to produce.

Add inside the existing `describe("appendBatch", ...)` block in `app/tests/services/session.service.test.ts`, after the `"accepts dart rows for a visual-board session"` test:

```ts
  it("persists a DETAILED_DARTS turn attributed to a DARTBOT participant, exactly like a human's", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 1,
      rulesetVersionKey: "BOBS27_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    vi.mocked(repo.findSessionParticipantIds).mockResolvedValue([
      "participant-1",
      "bot-1",
    ]);
    vi.mocked(repo.findSessionConfiguration).mockResolvedValue({});
    vi.mocked(repo.findDartZoneIdMap).mockResolvedValue(
      new Map([
        ["DOUBLE", 4],
        ["SINGLE", 1],
      ]),
    );

    const botDart = (sequence: number, hit: boolean) => ({
      sequence,
      intendedTargetNumber: 1,
      intendedZoneKey: "DOUBLE" as const,
      hitTargetNumber: 1,
      hitZoneKey: hit ? ("DOUBLE" as const) : ("SINGLE" as const),
      score: hit ? 2 : 1,
      locationX: 1.5,
      locationY: -3.2,
    });

    const result = await appendBatch("player-1", "session-1", "idem-bot-1", {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "bot-turn-1",
              participantRef: "bot-1",
              sequence: 1,
              totalScore: 4,
              completedAt: "2026-09-01T10:00:00.000Z",
              darts: [botDart(1, true), botDart(2, true), botDart(3, false)],
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({ ok: true });
    expect(vi.mocked(repo.insertBatchRecords)).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          expect.objectContaining({
            participantId: "bot-1",
            darts: expect.arrayContaining([
              expect.objectContaining({ locationX: 1.5, locationY: -3.2 }),
            ]),
          }),
        ],
      }),
    );
  });
```

- [ ] **Step 2: Run the test**

Run: `cd app && npx vitest run tests/services/session.service.test.ts -t "DARTBOT participant"`
Expected: PASS. `resolveBatchStructure`'s `validateBatchReferences` accepts `"bot-1"` because `findSessionParticipantIds` returns it in the membership list — the same generic check every other participant type passes — and `bobs27Validator` (via `createThreeDartValidator`) accepts the batch because it never inspects who threw it.

- [ ] **Step 3: Run the full `session.service.test.ts` suite**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: PASS — no regression in the pre-existing `appendBatch` tests.

- [ ] **Step 4: Commit**

```bash
cd app && git add tests/services/session.service.test.ts
git commit -m "test: prove appendBatch persists a DARTBOT-attributed turn"
```

---

## Task 3: Extend migration 0023's verification script to a `DARTBOT` fixture

**Files:**
- Modify: `database/verification/0023_owner_scoped_dart_view_checks.sql`

**Interfaces:**
- Consumes: nothing new — extends the existing fixture and check set.
- Produces: the phase gate's other half — proof, against a real database, that a `DARTBOT`'s dart is excluded from both owner-scoped views, not just a `GUEST`'s.

Cannot be executed inside this sandbox (no `DATABASE_URL` — the established D193 precedent every prior verification script and the phase 4 plan's own manual-verification step already carries). Write the SQL correctly and note in the completion report that a human with Neon access must run it before merge, exactly as `0023_owner_scoped_dart_view_checks.sql` itself was introduced.

- [ ] **Step 1: Add the header note**

In `database/verification/0023_owner_scoped_dart_view_checks.sql`, replace the header comment's list:

```sql
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0023_owner_scoped_dart_views.sql (D193 — SQL that
-- cannot be applied locally ships with a verification script the
-- owner runs against the real Neon database before merge):
--
--   1. v_dart_analytics returns only the session owner's own
--      dart, not a GUEST or DARTBOT participant's, for a session
--      with one of each
--   2. v_dart_locations does the same
--   3. v_game_replay returns ALL THREE participants' turns for
--      the same session -- proving the lack of owner-scoping there
--      (migration 0023's own comment) is deliberate, not a gap
--      this script is failing to also catch
--
-- The DARTBOT fixture was added in phase 5 (2026-09-01,
-- `08-DartBot.md` Delivery Phases row 5): migration 0023 excluded
-- DARTBOT by construction before a bot could ever be seated (any
-- participant_type_id = 3 row has player_id IS NULL by the same
-- CHECK that requires it), but nothing had exercised that exclusion
-- against an actual DARTBOT dart until this fixture did.
```

- [ ] **Step 2: Add the `DARTBOT` fixture participant, turn and dart**

After the existing `INSERT INTO participants` statement (the one inserting the owner and the guest), add:

```sql
INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000230b',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM participant_types WHERE implementation_key = 'DARTBOT'),
        NULL,
        'DartBot',
        now()
    );
```

After the existing `INSERT INTO turns` statement, add:

```sql
INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000230c',
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-00000000230b',
        1,
        25,
        now()
    );
```

After the existing `INSERT INTO darts` statement, add:

```sql
INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        intended_target_number,
        intended_zone_id,
        hit_target_number,
        hit_zone_id,
        score,
        location_x,
        location_y,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000230d',
        '01990000-0000-7000-8000-00000000230c',
        1,
        25,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        25,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        25,
        40.00,
        40.00,
        now()
    );
```

- [ ] **Step 3: Extend Step 1's checks (`v_dart_analytics`)**

Replace the existing "returns exactly 1 row" check's `check_name` and add a new check right after the existing "belongs to the PLAYER, not the GUEST" one:

```sql
INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics returns exactly 1 row for the fixture session (PLAYER + GUEST + DARTBOT all present)',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN hit_target_number = 20 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('hit_target_number=%s (expected 20, the owner''s dart -- 19 would be the guest''s)', hit_target_number)
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics row belongs to the PLAYER, not DartBot',
    CASE
        WHEN hit_target_number = 20 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('hit_target_number=%s (expected 20, the owner''s dart -- 25 would be DartBot''s)', hit_target_number)
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';
```

- [ ] **Step 4: Extend Step 2's checks (`v_dart_locations`)** the same way

```sql
INSERT INTO verification_results
SELECT '2',
    'v_dart_locations returns exactly 1 row for the fixture session (PLAYER + GUEST + DARTBOT all present)',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '2',
    'v_dart_locations row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN location_x = 5.00 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('location_x=%s (expected 5.00, the owner''s dart -- -5.00 would be the guest''s)', location_x)
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '2',
    'v_dart_locations row belongs to the PLAYER, not DartBot',
    CASE
        WHEN location_x = 5.00 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('location_x=%s (expected 5.00, the owner''s dart -- 40.00 would be DartBot''s)', location_x)
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';
```

- [ ] **Step 5: Extend Step 3's checks (`v_game_replay`) to 3 rows**

Replace the two Step 3 checks:

```sql
INSERT INTO verification_results
SELECT '3',
    'v_game_replay returns 3 turn rows (one per participant) for the fixture session',
    CASE
        WHEN count(*) = 3 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 3, found %s', count(*))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '3',
    'v_game_replay rows are DartBot, Verification Owner and Verification Guest',
    CASE
        WHEN names.agg = ARRAY['DartBot', 'Verification Guest', 'Verification Owner'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found participant_name(s): %s', names.agg)
FROM (
        SELECT array_agg(
                DISTINCT participant_name
                ORDER BY participant_name
            ) AS agg
        FROM v_game_replay
        WHERE session_id = '01990000-0000-7000-8000-000000002303'
    ) names;
```

- [ ] **Step 6: Update the anti-vacuity guard's expected count**

Step 1 and Step 2 each grew from 2 checks to 3; Step 3 stayed at 2. Replace:

```sql
INSERT INTO verification_results
SELECT '4',
    'all 8 view-driven checks actually ran',
    CASE
        WHEN count(*) = 8 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 8 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');
```

- [ ] **Step 7: Note the manual run requirement**

This script cannot run inside this sandbox — no `DATABASE_URL` (D193 precedent). Record in the completion report that a human with Neon access must run:

```bash
psql "$DATABASE_URL" -f database/verification/0023_owner_scoped_dart_view_checks.sql
```

Expected: every result row reads `PASS`, `ALL 9 CHECKS PASSED` (8 view-driven checks + the anti-vacuity guard itself) in the final summary row.

- [ ] **Step 8: Commit**

```bash
git add database/verification/0023_owner_scoped_dart_view_checks.sql
git commit -m "test: extend migration 0023's verification script to prove DartBot dart exclusion"
```

---

## Task 4: Close the deferral

**Files:**
- Modify: `docs/architecture/08-DartBot.md`
- Modify: `DECISIONS.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Correct `08-DartBot.md`'s dependency table row**

In `docs/architecture/08-DartBot.md`, find the `| The DartBot **write path** | **still deferred** — ...` row in the dependency table (§Scope and Status) and replace it:

```markdown
| The DartBot **write path**                                                                                                                                              | **shipped** — phase 4 admitted `DARTBOT` at the create contract; phase 5 (2026-09-01) drove a real `DARTBOT`-typed seat through a real engine and the real events-batch write path, and extended migration 0023's verification script to prove a bot's dart is excluded from both dart views. No source change was needed: attribution (D220) and owner-scoping (D222) were already type-agnostic. `DECISIONS.md` §Deferred no longer lists "DartBot participants" | `app/src/modules/game/events.payload.module.ts`, `app/src/services/session.service.ts`, `database/verification/0023_owner_scoped_dart_view_checks.sql` |
```

- [ ] **Step 2: Bump the version note**

Replace the opening of the `> **Version:**` blockquote — find `> **Version:** 0.5.0 (2026-08-28` and prepend a new entry before it:

```markdown
> **Version:** 0.6.0 (2026-09-01 — phase 5 closes the write-path deferral this document's own dependency table named. The row previously read "still deferred" and "`DARTBOT` is explicitly refused at the create contract" — both true on 2026-08-28, both false since phase 4 shipped 2026-09-01. Phase 5 proved the already-generic write path (D220, D222) holds for a real `DARTBOT`-typed seat rather than changing it, and closed `DECISIONS.md`'s "DartBot participants" deferral. Nothing else in this document changed — the play loop, ghost mode and 501 opponent mode remain exactly as phases 6–8 describe them.) 0.5.0 (2026-08-28
```

- [ ] **Step 3: Strike the deferral from `DECISIONS.md`**

In `DECISIONS.md`'s `## Deferred` bullet list, remove `DartBot participants (2026-07-12) · ` from the middle of the list (leaving the `·`-separated items on either side of it joined directly, exactly as the guest half was struck before it):

Before:
```
ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12; raw notes: `docs/game-rules/routines/`) · multi-session activities (2026-07-12) · DartBot participants (2026-07-12) · guest-adding UI for the other 8 setup screens beyond 501 (2026-08-21; 501 shipped, D225) · ...
```

After:
```
ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12; raw notes: `docs/game-rules/routines/`) · multi-session activities (2026-07-12) · guest-adding UI for the other 8 setup screens beyond 501 (2026-08-21; 501 shipped, D225) · ...
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/08-DartBot.md DECISIONS.md
git commit -m "docs: close the DartBot participant write-path deferral"
```

---

## Task 5: Context maintenance and full validation

**Files:** `docs/architecture/00-Context-Map-History.md`, `00-File-Inventory.md` (only if any file's char/token estimate materially shifts), `FINDINGS.md` (no change expected).

- [ ] **Step 1: Run `run-all-gates`**

Invoke the `run-all-gates` skill. Confirm every gate passes, including:
- `npm test` — full suite green, including the two new tests from Tasks 1–2
- `npx fallow` — exits 0
- `astro check --minimumFailingSeverity hint` — 0 errors/0 warnings/0 hints
- `scripts/check-test-coverage.sh` — Tasks 1–2 only add test files, touching no runtime `.ts`, so nothing is newly subject to the gate; confirm it still passes (no regression)
- `scripts/check-findings-log.sh` — passes, no findings opened or expected to be touched by this phase
- `db:status`/`db:migrate`/`db:introspect` — expected to be unable to run in this sandbox (no `DATABASE_URL`, D193 precedent); this phase added no migration, so nothing here should differ from that precedent. Note in the completion report that Task 3's verification script still needs a human to run it against Neon before merge.

- [ ] **Step 2: Invoke `context-maintenance`**

Follow its procedure exactly. Expected updates:
- `docs/architecture/00-Context-Map-History.md` — new version entry summarizing phase 5 (write-path proof, verification script extension, deferral closure).
- `decisions/**` — none expected. This phase confirms D220 and D222 already cover a `DARTBOT`-typed seat; it does not weigh or reject a new alternative, so no new decision block is needed, per the same judgment phase 4's own Task 13 recorded.
- `00-File-Inventory.md` — update char/4 token estimates only for `08-DartBot.md` and `0023_owner_scoped_dart_view_checks.sql`, the two files materially grown by this phase.

- [ ] **Step 3: Confirm the branch is ready to integrate**

Confirm: no uncommitted changes (`git status`), all 4 preceding commits present, branch is a single hop off `main`.

Per `finishing-a-development-branch`, present merge/PR/cleanup options to the user rather than deciding unilaterally.

---

## Self-Review

**Spec coverage** (against `08-DartBot.md`'s Delivery Phases row 5 and its own dependency table):

| Named item | Task |
|---|---|
| Gate: "A bot turn persists on its own participantRef" | 1 (in-memory attribution), 2 (persists via `appendBatch`/`insertBatchRecords`) |
| Gate: "absent from both dart views" | 3 |
| "closes the DECISIONS.md deferral" | 4 |
| Dependency table's stale "still deferred"/"explicitly refused" claim | 4 |
| No play-loop, no `DartBot` class (phase 6's scope) | Explicitly out of scope — Global Constraints |

**Placeholder scan:** none found — every step carries complete code, exact file paths, and exact commands.

**Type consistency:** the `DARTBOT` `SeatFact` shape used in Task 1 (`{ participantRef; displayName; sideKey; participantTypeKey: "DARTBOT"; dartbot: { level; seed; levelSource } }`) matches phase 4's `SeatFact` discriminated union exactly (`app/src/lib/game/rulesets/types.ts`). The `EventsBatchRequestInput` turn shape Task 2 posts matches `ParticipantInput`/`EventsBatchRequest`'s existing schema — no new fields introduced anywhere.

**Scope:** confined to proving and closing the write-path gap phase 4 explicitly deferred ("no write-path persistence beyond the participant row... phase 5's own deferral", `2026-09-01-dartbot-4-seat-admission.md` Self-Review). No source file under `app/src/` changes in this plan — verified by re-reading the full write path (`events.payment.module.ts`, `session.service.ts`, `session-seats.service.ts`, `three-dart.validator.ts`, `quick-score.validator.ts`) and confirming none of it branches on participant type. If implementation surfaces a genuine gap this research missed, that is new information — stop and report it rather than silently patching around it.

**Ambiguity:** none left open. The one judgment call — which ruleset to exercise — is settled by Global Constraints (`BOBS27_V1`, matching the existing 1v1 test precedent) rather than left for the executor to pick.
