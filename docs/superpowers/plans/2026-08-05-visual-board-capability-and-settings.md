# Visual Board Capability & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declare which ruleset versions support which capture/input mode combinations — in code, in the database, and to the player — and let the player choose their app mode from the profile page.

**Architecture:** A cross-runtime constant declares each ruleset version's supported mode pairs, imported by both the client engine registry and the Worker's session-creation path so neither can accept a combination no engine implements. A seeded `ruleset_version_capabilities` table plus a composite foreign key on `exercise_sessions` gives the same guarantee at the database level. The player's default modes move from client-local storage into `player_settings`, exposed through `GET`/`PATCH /api/players/me/settings`, and the games page filters its cards by what the chosen mode supports.

**Tech Stack:** PostgreSQL (dbmate migrations + seeds), TypeScript, Zod, Astro, Alpine.js, Vitest, Cloudflare Workers.

## Prerequisite

**Plan 1 (`2026-08-05-visual-board-capture-core.md`) must be merged first.** This plan seeds capability rows for `ANALYTICS + VISUAL_BOARD`, which is only honest once the engines from plan 1 can actually produce dart-level facts. Migration `0017` (which creates `ruleset_version_capabilities`) and seed `0005` (the `VISUAL_BOARD` input mode) both come from plan 1.

## Global Constraints

- The six existing ruleset version keys are `501_V1`, `TUOD_V1`, `SINGLES_V1`, `SCORE_TRAINING_V1`, `BOBS27_V1`, `DOUBLES_TRAINING_V1`.
- Seeded lookup ids: `capture_modes` `1 RECREATIONAL`, `2 ANALYTICS`; `input_modes` `1 QUICK_SCORE`, `2 DETAILED_DARTS`, `3 VISUAL_BOARD`.
- **Every mode combination any existing session already uses must be seeded before migration `0018` runs**, or the composite FK rejects live rows.
- Input mode is chosen in the profile only. Setup pages inherit it and offer no override.
- A game with an active session is never filtered out of the games page, whatever the current mode.
- Missing `player_settings` row reads as `RECREATIONAL` + `QUICK_SCORE`; the row is created lazily on first write. No backfill.
- Reads go through views (`v_*`); writes go to tables, in a transaction. Never expose a raw table through the API.
- Controller → Service → Repository layering. Middleware verifies JWT; handlers never parse it.
- Service layer generates UUIDv7 for runtime records.
- No `//` or `/* */` comments inside function bodies in `app/src/**/*.ts`.
- Astro: semantic tokens only, `cn()` for class composition, every `x-show` paired with `x-cloak`, no HTML comments in template regions.
- Run `cd app && npm run format` before any commit touching `app/`.

---

### Task 1: Capability declaration constant

**Files:**
- Create: `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Consumes: `RulesetVersionKey` from `@lib/types`.
- Produces:
  - `type ModePair = { captureModeKey: string; inputModeKey: string }`
  - `RULESET_CAPABILITIES: Readonly<Record<RulesetVersionKey, readonly ModePair[]>>`
  - `supportsMode(rulesetVersionKey: RulesetVersionKey, captureModeKey: string, inputModeKey: string): boolean`
  - `capableRulesets(captureModeKey: string, inputModeKey: string): readonly RulesetVersionKey[]`

This lives in `lib/game/rulesets/` because that folder is already designated cross-runtime — the Worker imports from it, and `modules/` is client-only.

- [ ] **Step 1: Confirm each ruleset's current mode pair**

Run: `cd app && grep -rn "isQuickScoreCapture\|CAPTURE_MODE\|INPUT_MODE" src/services/rulesets/*.ts | head -30`
Expected: shows which rulesets validate as `RECREATIONAL + QUICK_SCORE` and which take dart rows. Record what you find — the constant below must match reality, and if it disagrees with the table in Step 3, the code wins and you fix the table.

- [ ] **Step 2: Write the failing test**

Create `app/tests/lib/game/rulesets/capabilities.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  RULESET_CAPABILITIES,
  capableRulesets,
  supportsMode,
} from "@lib/game/rulesets/capabilities";

describe("RULESET_CAPABILITIES", () => {
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "501_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });

  it("gives every ruleset at least one supported pair", () => {
    for (const pairs of Object.values(RULESET_CAPABILITIES)) {
      expect(pairs.length).toBeGreaterThan(0);
    }
  });
});

describe("supportsMode", () => {
  it("accepts visual board for 501", () => {
    expect(supportsMode("501_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("accepts visual board for Score Training", () => {
    expect(supportsMode("SCORE_TRAINING_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(
      true,
    );
  });

  it("rejects visual board for a game with no visual engine path", () => {
    expect(supportsMode("TUOD_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(false);
  });

  it("keeps every ruleset's original pair supported", () => {
    expect(supportsMode("501_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
    expect(supportsMode("TUOD_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
  });

  it("rejects an unknown pair", () => {
    expect(supportsMode("501_V1", "ANALYTICS", "DETAILED_DARTS")).toBe(false);
  });
});

describe("capableRulesets", () => {
  it("lists only the two visual-capable rulesets", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "501_V1",
      "SCORE_TRAINING_V1",
    ]);
  });

  it("lists every quick-score ruleset", () => {
    expect(capableRulesets("RECREATIONAL", "QUICK_SCORE").length).toBeGreaterThan(
      0,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the constant**

Create `app/src/lib/game/rulesets/capabilities.ts`. Correct the non-visual pairs against what Step 1 found — the visual pairs for `501_V1` and `SCORE_TRAINING_V1` are fixed by this plan, the rest describe what already ships:

```typescript
import type { RulesetVersionKey } from "@lib/types";
import type { ModePair } from "./types";

const QUICK_SCORE: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
};

const DETAILED_DARTS: ModePair = {
  captureModeKey: "ANALYTICS",
  inputModeKey: "DETAILED_DARTS",
};

const VISUAL_BOARD: ModePair = {
  captureModeKey: "ANALYTICS",
  inputModeKey: "VISUAL_BOARD",
};

/**
 * Which capture/input mode combinations each ruleset version's engine actually
 * implements. This is the code-side source of truth, imported by the client
 * registry and by the Worker's session-creation path so a mode no engine can
 * satisfy is refused on both sides.
 *
 * `database/seeds/0006_ruleset_version_capabilities.sql` mirrors this table
 * into `ruleset_version_capabilities`, and a parity test proves the two agree.
 * Adding a pair here without adding the seed row leaves the database rejecting
 * sessions the code accepts.
 */
export const RULESET_CAPABILITIES: Readonly<
  Record<RulesetVersionKey, readonly ModePair[]>
> = {
  "501_V1": [QUICK_SCORE, VISUAL_BOARD],
  SCORE_TRAINING_V1: [QUICK_SCORE, VISUAL_BOARD],
  TUOD_V1: [QUICK_SCORE],
  SINGLES_V1: [DETAILED_DARTS],
  BOBS27_V1: [DETAILED_DARTS],
  DOUBLES_TRAINING_V1: [DETAILED_DARTS],
};

/** Whether this ruleset version's engine implements the given mode pair. */
export function supportsMode(
  rulesetVersionKey: RulesetVersionKey,
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  const pairs = RULESET_CAPABILITIES[rulesetVersionKey];
  if (!pairs) return false;
  return pairs.some(
    (pair) =>
      pair.captureModeKey === captureModeKey &&
      pair.inputModeKey === inputModeKey,
  );
}

/** Every ruleset version playable under the given mode pair. */
export function capableRulesets(
  captureModeKey: string,
  inputModeKey: string,
): readonly RulesetVersionKey[] {
  return (Object.keys(RULESET_CAPABILITIES) as RulesetVersionKey[]).filter(
    (key) => supportsMode(key, captureModeKey, inputModeKey),
  );
}
```

Create `app/src/lib/game/rulesets/types.ts` additions — if that file already exists, append rather than replacing it:

```typescript
/** One capture/input mode combination a ruleset version's engine implements. */
export type ModePair = {
  captureModeKey: string;
  inputModeKey: string;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/rulesets app/tests/lib/game/rulesets
git commit -m "Declare each ruleset version's supported mode pairs"
```

---

### Task 2: Seed the capability table

**Files:**
- Create: `database/seeds/0006_ruleset_version_capabilities.sql`
- Modify: `database/README.md`

**Interfaces:**
- Consumes: `ruleset_version_capabilities` (plan 1, migration `0017`).
- Produces: one row per declared pair, matching `RULESET_CAPABILITIES`.

Every row must exist before Task 4's composite FK runs, including the pairs existing sessions already use.

- [ ] **Step 1: Check what mode pairs live sessions actually use**

Run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  SELECT rv.implementation_key AS ruleset,
         cm.implementation_key AS capture_mode,
         im.implementation_key AS input_mode,
         COUNT(*) AS sessions
  FROM exercise_sessions es
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    JOIN input_modes im      ON im.id = es.input_mode_id
  GROUP BY 1, 2, 3 ORDER BY 1;
"
```

Expected: the distinct combinations in use. **Every row returned must appear in the seed below.** If one is missing, add it — otherwise Task 4 fails on real data.

- [ ] **Step 2: Write the seed**

Create `database/seeds/0006_ruleset_version_capabilities.sql`:

```sql
-- ============================================================
-- Seed: 0006_ruleset_version_capabilities.sql
--
-- Declares which capture/input mode combination each ruleset
-- version supports. Mirrors app/src/lib/game/rulesets/
-- capabilities.ts; a parity test proves the two agree.
--
-- Migration 0018 adds the composite foreign key from
-- exercise_sessions to this table, so every combination any
-- existing session already uses MUST be present here before
-- that migration runs.
-- ============================================================
BEGIN;

INSERT INTO ruleset_version_capabilities (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id,
        created_at
    )
SELECT rv.id,
    cm.id,
    im.id,
    now()
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'ANALYTICS', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
    JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
    JOIN capture_modes cm ON cm.implementation_key = declared.capture_key
    JOIN input_modes im ON im.implementation_key = declared.input_key ON CONFLICT DO NOTHING;

COMMIT;
```

Adjust the `VALUES` list so it matches both Step 1's live combinations and Task 1's constant.

- [ ] **Step 3: Apply and verify the row count**

Run: `cd app && npm run db:seed && npx dbmate --url "$DATABASE_URL" query "SELECT COUNT(*) FROM ruleset_version_capabilities;"`
Expected: 8 (or however many `VALUES` rows you declared) — never 0, which would mean every join missed.

- [ ] **Step 4: Verify no live session is left undeclared**

Run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  SELECT COUNT(*) AS undeclared
  FROM exercise_sessions es
  WHERE NOT EXISTS (
    SELECT 1 FROM ruleset_version_capabilities c
    WHERE c.ruleset_version_id = es.ruleset_version_id
      AND c.capture_mode_id = es.capture_mode_id
      AND c.input_mode_id = es.input_mode_id
  );
"
```

Expected: `0`. **Any other number means Task 4 will fail** — add the missing pairs to the seed and re-run before continuing.

- [ ] **Step 5: Register the seed**

Add `0006_ruleset_version_capabilities.sql` to `database/README.md`'s `## Seed Order` list, following the existing formatting.

- [ ] **Step 6: Commit**

```bash
git add database/seeds/0006_ruleset_version_capabilities.sql database/README.md
git commit -m "Seed ruleset version capability rows"
```

---

### Task 3: Constant-to-seed parity test

**Files:**
- Test: `app/tests/lib/game/rulesets/capability-seed-parity.test.ts`

**Interfaces:**
- Consumes: `RULESET_CAPABILITIES` (Task 1), the seed file (Task 2).
- Produces: nothing.

Parses the seed's `VALUES` list as text rather than querying the database, so the test runs with no connection — matching the project's no-network-in-unit-tests rule.

- [ ] **Step 1: Write the test**

Create `app/tests/lib/game/rulesets/capability-seed-parity.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULESET_CAPABILITIES } from "@lib/game/rulesets/capabilities";

const seedPath = fileURLToPath(
  new URL(
    "../../../../../database/seeds/0006_ruleset_version_capabilities.sql",
    import.meta.url,
  ),
);

function seededTriples(): string[] {
  const sql = readFileSync(seedPath, "utf8");
  const triples: string[] = [];
  for (const match of sql.matchAll(
    /\('([A-Z0-9_]+)',\s*'([A-Z_]+)',\s*'([A-Z_]+)'\)/g,
  )) {
    triples.push(`${match[1]}|${match[2]}|${match[3]}`);
  }
  return triples.sort();
}

function declaredTriples(): string[] {
  const triples: string[] = [];
  for (const [rulesetKey, pairs] of Object.entries(RULESET_CAPABILITIES)) {
    for (const pair of pairs) {
      triples.push(
        `${rulesetKey}|${pair.captureModeKey}|${pair.inputModeKey}`,
      );
    }
  }
  return triples.sort();
}

describe("capability constant and seed agree", () => {
  it("finds triples in the seed at all", () => {
    expect(seededTriples().length).toBeGreaterThan(0);
  });

  it("declares exactly the same triples on both sides", () => {
    expect(seededTriples()).toEqual(declaredTriples());
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-seed-parity.test.ts`
Expected: PASS, 2 tests. A failure means the constant and the seed genuinely disagree — reconcile them; do not relax the assertion.

- [ ] **Step 3: Commit**

```bash
cd app && npm run format && cd ..
git add app/tests/lib/game/rulesets/capability-seed-parity.test.ts
git commit -m "Guard capability constant against seed drift"
```

---

### Task 4: Migration 0018 — the composite foreign key

**Files:**
- Create: `database/migrations/0018_session_capability_fk.sql`
- Modify: `database/README.md`
- Modify: `app/DEPLOYMENT.md`

**Interfaces:**
- Consumes: seed `0006` (Task 2).
- Produces: `fk_sessions_capability` on `exercise_sessions`.

**This migration fails on any populated database if seed `0006` has not run.** That is the single most likely way this change breaks a deploy, so it is documented in three places.

- [ ] **Step 1: Re-verify the precondition**

Run the undeclared-session query from Task 2 Step 4 again.
Expected: `0`. Do not proceed otherwise.

- [ ] **Step 2: Write the migration**

Create `database/migrations/0018_session_capability_fk.sql`:

```sql
-- ============================================================
-- Migration: 0018_session_capability_fk.sql
--
-- Purpose:
-- Make an undeclared capture/input mode combination physically
-- unstorable: exercise_sessions gains a composite foreign key
-- to ruleset_version_capabilities.
--
-- PREREQUISITE: database/seeds/0006_ruleset_version_
-- capabilities.sql MUST have been applied first. Seeds run
-- after migrations in the standard flow, so this migration is
-- deliberately separated from 0017 (which creates the table)
-- and the apply order for this change is:
--
--   db:migrate (through 0017) -> db:seed -> db:migrate (0018)
--
-- Applying this against a populated database whose sessions
-- use a combination not present in the capability table will
-- fail on constraint validation.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_sessions
ADD CONSTRAINT fk_sessions_capability FOREIGN KEY (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id
    ) REFERENCES ruleset_version_capabilities (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id
    ) ON DELETE RESTRICT;

-- migrate:down
ALTER TABLE exercise_sessions
DROP CONSTRAINT fk_sessions_capability;
```

- [ ] **Step 3: Apply it**

Run: `cd app && npm run db:migrate && npm run db:status`
Expected: `0018_session_capability_fk.sql` applied.

- [ ] **Step 4: Verify it refuses an undeclared combination**

Run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  INSERT INTO exercise_sessions (
    id, activity_id, player_id, game_type_id, capture_mode_id,
    input_mode_id, status_id, ruleset_version_id, started_at, created_at
  )
  SELECT gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
         gt.id, 2, 3, 1, rv.id, now(), now()
  FROM ruleset_versions rv JOIN game_types gt ON gt.id = rv.game_type_id
  WHERE rv.implementation_key = 'TUOD_V1';
" 2>&1 | head -3
```

Expected: an error naming `fk_sessions_capability` (TUOD declares no visual pair). An error naming a different FK first is also acceptable proof the row was refused; a success means the constraint is not doing its job.

- [ ] **Step 5: Document the apply order**

In `database/README.md`, under `## Standard Local Flow`, replace the flow block with one that names the three-phase order explicitly:

```sh
npm run db:status
npm run db:migrate     # through 0017
npm run db:seed        # 0006 fills the capability table
npm run db:migrate     # 0018 adds the composite FK
npm run db:introspect
```

Add a sentence stating that `0018` requires seed `0006` and fails without it.

In `app/DEPLOYMENT.md`, add the same three-phase order to the deploy steps, with the same warning.

- [ ] **Step 6: Re-introspect**

Run: `cd app && npx drizzle-kit introspect`
Expected: `app/src/db/schema.ts` gains the composite FK.

- [ ] **Step 7: Commit**

```bash
git add database/migrations/0018_session_capability_fk.sql database/README.md app/DEPLOYMENT.md app/src/db/schema.ts
git commit -m "Enforce declared mode combinations with a composite FK"
```

---

### Task 5: Engine registry declares supported modes

**Files:**
- Modify: `app/src/modules/game/engine.registry.ts`
- Modify: `scripts/check-game-engines.sh`
- Test: `app/tests/modules/game/engine.registry.test.ts`

**Interfaces:**
- Consumes: `supportsMode`, `capableRulesets` (Task 1).
- Produces: `registeredRulesetsFor(captureModeKey, inputModeKey): readonly RulesetVersionKey[]` on the registry.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/engine.registry.test.ts`:

```typescript
describe("registeredRulesetsFor", () => {
  it("lists only registered rulesets that declare the pair", () => {
    resetEngineRegistry();
    registerEngineFactory({
      rulesetVersionKey: "501_V1",
      create: () => ({}) as never,
    });

    expect(registeredRulesetsFor("ANALYTICS", "VISUAL_BOARD")).toEqual([
      "501_V1",
    ]);
  });

  it("excludes a registered ruleset that does not declare the pair", () => {
    resetEngineRegistry();
    registerEngineFactory({
      rulesetVersionKey: "TUOD_V1",
      create: () => ({}) as never,
    });

    expect(registeredRulesetsFor("ANALYTICS", "VISUAL_BOARD")).toEqual([]);
  });

  it("excludes a capable ruleset whose engine is not registered", () => {
    resetEngineRegistry();

    expect(registeredRulesetsFor("ANALYTICS", "VISUAL_BOARD")).toEqual([]);
  });
});
```

Add `registeredRulesetsFor` to the file's existing import from `@modules/game/engine.registry`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: FAIL — `registeredRulesetsFor` is not exported.

- [ ] **Step 3: Add the lookup**

Append to `app/src/modules/game/engine.registry.ts`:

```typescript
/**
 * Every registered ruleset version playable under the given mode pair —
 * the intersection of what an engine exists for and what that engine declares
 * it supports. The games page filters its cards on this, so a game whose
 * engine was never registered never appears, even if the capability table
 * declares it.
 */
export function registeredRulesetsFor(
  captureModeKey: string,
  inputModeKey: string,
): readonly RulesetVersionKey[] {
  return capableRulesets(captureModeKey, inputModeKey).filter((key) =>
    REGISTRY.has(key),
  );
}
```

Add the import at the top: `import { capableRulesets } from "@lib/game/rulesets/capabilities";`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend the engine gate**

In `scripts/check-game-engines.sh`, add a check that every `rulesetVersionKey` registered in `app/src/modules/game/*.engine.module.ts` appears as a key in `RULESET_CAPABILITIES` in `app/src/lib/game/rulesets/capabilities.ts`. Follow the script's existing style, and extend its header comment's "what this cannot catch" section to say it proves the key is declared, not that the declared pairs match the engine's real behaviour.

- [ ] **Step 6: Run the gate**

Run: `cd .. && bash scripts/check-game-engines.sh`
Expected: `OK`. If it reports a missing declaration, add that ruleset to `RULESET_CAPABILITIES` and to the seed, then re-run Task 3's parity test.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/engine.registry.ts app/tests/modules/game/engine.registry.test.ts scripts/check-game-engines.sh
git commit -m "Filter registered engines by declared mode support"
```

---

### Task 6: Session creation rejects undeclared modes

**Files:**
- Modify: `app/src/pages/api/sessions/index.ts` or its service — locate in Step 1
- Test: the matching test file

**Interfaces:**
- Consumes: `supportsMode` (Task 1).
- Produces: `POST /api/sessions` returns `VALIDATION_FAILED` for an undeclared pair.

The database now refuses these rows. Without this check the player gets an opaque 500 from a constraint violation instead of a named validation error.

- [ ] **Step 1: Locate the create-session handler**

Run: `cd app && grep -rn "CreateSessionRequest" src --include=*.ts | head`
Expected: the route handler and the service it calls.

- [ ] **Step 2: Write the failing test**

In the handler's or service's existing test file, add:

```typescript
it("rejects a mode pair the ruleset does not declare", async () => {
  const result = await createSession({
    playerId: "0198f200-0000-7000-8000-000000000001",
    gameTypeKey: "TUOD",
    rulesetVersionKey: "TUOD_V1",
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
    config: { source: "inline", config: {} },
  });

  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe("VALIDATION_FAILED");
});

it("accepts a mode pair the ruleset declares", async () => {
  const result = await createSession({
    playerId: "0198f200-0000-7000-8000-000000000001",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
    config: { source: "inline", config: {} },
  });

  expect(result.ok).toBe(true);
});
```

Match the real function name and argument shape found in Step 1, and follow the file's existing repository-mocking style.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run <the test file>`
Expected: FAIL — the undeclared pair is accepted.

- [ ] **Step 4: Add the guard**

In the service, before any write, add:

```typescript
  if (
    !supportsMode(
      request.rulesetVersionKey as RulesetVersionKey,
      request.captureModeKey,
      request.inputModeKey,
    )
  ) {
    return validationFailed(
      `${request.rulesetVersionKey} does not support ${request.captureModeKey} + ${request.inputModeKey}`,
    );
  }
```

Use the file's existing error-construction helper rather than `validationFailed` if it is named differently.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run <the test file>`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src app/tests
git commit -m "Reject undeclared mode pairs at session creation"
```

---

### Task 7: `v_player_settings` read model

**Files:**
- Create: `database/migrations/0020_player_settings_read_model.sql`

**Interfaces:**
- Consumes: `player_settings`, `capture_modes`, `input_modes`.
- Produces: view `v_player_settings`.

Reads go through views; the API never selects from `player_settings` directly.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0020_player_settings_read_model.sql`:

```sql
-- ============================================================
-- Migration: 0020_player_settings_read_model.sql
--
-- Purpose:
-- Expose player mode preferences as keys rather than ids.
--
-- A player with no settings row has no row here either; the
-- service applies the RECREATIONAL + QUICK_SCORE defaults and
-- creates the row lazily on first write. No backfill.
-- ============================================================

-- migrate:up
CREATE VIEW v_player_settings AS
SELECT ps.player_id,
    cm.implementation_key AS default_capture_mode_key,
    im.implementation_key AS default_input_mode_key,
    ps.updated_at
FROM player_settings ps
    LEFT JOIN capture_modes cm ON cm.id = ps.default_capture_mode_id
    LEFT JOIN input_modes im ON im.id = ps.default_input_mode_id;

COMMENT ON VIEW v_player_settings IS 'Player mode preferences as implementation keys; absent row means defaults apply.';

-- migrate:down
DROP VIEW IF EXISTS v_player_settings;
```

- [ ] **Step 2: Apply and verify**

Run: `cd app && npm run db:migrate && npx dbmate --url "$DATABASE_URL" query "SELECT * FROM v_player_settings LIMIT 1;"`
Expected: applies; returns zero rows without error.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/0020_player_settings_read_model.sql
git commit -m "Add v_player_settings read model"
```

---

### Task 8: Settings endpoints

**Files:**
- Create: `app/src/pages/api/players/settings.ts`
- Create: `app/src/services/players/settings.service.ts`
- Create: `app/src/repositories/players/settings.repository.ts` — match the project's actual repository folder, found in Step 1
- Modify: `app/src/pages/api/players/types.ts`
- Test: `app/tests/services/players/settings.service.test.ts`

**Interfaces:**
- Consumes: `v_player_settings` (Task 7), `supportsMode` (Task 1).
- Produces:
  - `GET /api/players/me/settings` → `{ defaultCaptureModeKey, defaultInputModeKey }`
  - `PATCH /api/players/me/settings` with the same body shape
  - `readSettings(playerId: string): Promise<PlayerSettings>`
  - `writeSettings(playerId: string, next: PlayerSettings): Promise<PlayerSettings>`
  - `type PlayerSettings = { defaultCaptureModeKey: string; defaultInputModeKey: string }`

- [ ] **Step 1: Confirm the layering conventions**

Run: `cd app && ls src/services src/repositories 2>/dev/null && grep -rn "export const prerender" src/pages/api/players/provision.ts`
Expected: shows the real folder names and the route-file conventions to copy. Use what you find, not the paths guessed above.

- [ ] **Step 2: Write the failing test**

Create `app/tests/services/players/settings.service.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const findSettings = vi.fn();
const upsertSettings = vi.fn();

vi.mock("@repositories/players/settings.repository", () => ({
  findSettings: (...args: unknown[]) => findSettings(...args),
  upsertSettings: (...args: unknown[]) => upsertSettings(...args),
}));

const { readSettings, writeSettings } = await import(
  "@services/players/settings.service"
);

const playerId = "0198f200-0000-7000-8000-000000000001";

beforeEach(() => {
  findSettings.mockReset();
  upsertSettings.mockReset();
});

describe("readSettings", () => {
  it("returns the stored preference", async () => {
    findSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
  });

  it("falls back to quick score when no row exists", async () => {
    findSettings.mockResolvedValue(null);

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "QUICK_SCORE",
    });
  });

  it("falls back when the row exists with null columns", async () => {
    findSettings.mockResolvedValue({
      defaultCaptureModeKey: null,
      defaultInputModeKey: null,
    });

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "QUICK_SCORE",
    });
  });
});

describe("writeSettings", () => {
  it("stores a pair some ruleset supports", async () => {
    upsertSettings.mockResolvedValue(undefined);

    await expect(
      writeSettings(playerId, {
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "VISUAL_BOARD",
      }),
    ).resolves.toEqual({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
    expect(upsertSettings).toHaveBeenCalledOnce();
  });

  it("refuses a pair no ruleset supports", async () => {
    await expect(
      writeSettings(playerId, {
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "QUICK_SCORE",
      }),
    ).rejects.toThrow();
    expect(upsertSettings).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/players/settings.service.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write the repository**

Create the repository, reading through the view and writing to the table. Follow the layering of an existing repository exactly — the shape below shows what it must do, not the project's import style:

```typescript
import type { PlayerSettings } from "./types";

/** Reads the player's stored preference, or null when they have no settings row. */
export async function findSettings(
  playerId: string,
): Promise<PlayerSettings | null> {
  const rows = await db
    .select({
      defaultCaptureModeKey: vPlayerSettings.defaultCaptureModeKey,
      defaultInputModeKey: vPlayerSettings.defaultInputModeKey,
    })
    .from(vPlayerSettings)
    .where(eq(vPlayerSettings.playerId, playerId))
    .limit(1);

  return rows[0] ?? null;
}

/** Creates or replaces the player's settings row, resolving mode keys to ids. */
export async function upsertSettings(
  playerId: string,
  next: PlayerSettings,
): Promise<void> {
  await db.transaction(async (tx) => {
    const captureModeId = await modeIdByKey(
      tx,
      captureModes,
      next.defaultCaptureModeKey,
    );
    const inputModeId = await modeIdByKey(
      tx,
      inputModes,
      next.defaultInputModeKey,
    );

    await tx
      .insert(playerSettings)
      .values({
        playerId,
        defaultCaptureModeId: captureModeId,
        defaultInputModeId: inputModeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: playerSettings.playerId,
        set: {
          defaultCaptureModeId: captureModeId,
          defaultInputModeId: inputModeId,
          updatedAt: new Date(),
        },
      });
  });
}
```

- [ ] **Step 5: Write the service**

Create `app/src/services/players/settings.service.ts`:

```typescript
import { capableRulesets } from "@lib/game/rulesets/capabilities";
import {
  findSettings,
  upsertSettings,
} from "@repositories/players/settings.repository";
import type { PlayerSettings } from "./types";

const DEFAULT_SETTINGS: PlayerSettings = {
  defaultCaptureModeKey: "RECREATIONAL",
  defaultInputModeKey: "QUICK_SCORE",
};

/**
 * The player's mode preference, falling back to quick score when they have no
 * settings row — every player provisioned before settings shipped is in that
 * state, and no backfill runs.
 */
export async function readSettings(playerId: string): Promise<PlayerSettings> {
  const stored = await findSettings(playerId);
  if (
    !stored ||
    stored.defaultCaptureModeKey === null ||
    stored.defaultInputModeKey === null
  ) {
    return { ...DEFAULT_SETTINGS };
  }
  return stored;
}

/**
 * Stores the player's mode preference.
 * @throws when no ruleset version supports the pair, which would leave the
 *   player with an app mode in which no game can be played.
 */
export async function writeSettings(
  playerId: string,
  next: PlayerSettings,
): Promise<PlayerSettings> {
  if (
    capableRulesets(next.defaultCaptureModeKey, next.defaultInputModeKey)
      .length === 0
  ) {
    throw new Error(
      `no ruleset supports ${next.defaultCaptureModeKey} + ${next.defaultInputModeKey}`,
    );
  }

  await upsertSettings(playerId, next);
  return next;
}
```

Add to `app/src/services/players/types.ts` (create it if absent):

```typescript
/** A player's default capture and input modes, as implementation keys. */
export type PlayerSettings = {
  defaultCaptureModeKey: string;
  defaultInputModeKey: string;
};
```

- [ ] **Step 6: Write the route handler**

Create `app/src/pages/api/players/settings.ts` with `GET` and `PATCH`, reading `locals.auth` for the player id (never parsing the JWT itself), validating the `PATCH` body with a Zod schema in `app/src/pages/api/players/types.ts`, and returning the project's frozen envelope. Copy the structure of `provision.ts` exactly, including its `prerender` declaration and error-boundary usage.

Add to `app/src/pages/api/players/types.ts`:

```typescript
export const UpdatePlayerSettingsRequest = z.object({
  defaultCaptureModeKey: z.string(),
  defaultInputModeKey: z.string(),
});
export type UpdatePlayerSettingsInput = z.infer<
  typeof UpdatePlayerSettingsRequest
>;
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/players/settings.service.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
cd app && npm run format && cd ..
git add app/src app/tests
git commit -m "Add player settings endpoints backed by v_player_settings"
```

---

### Task 9: Settings store and API client

**Files:**
- Create: `app/src/lib/client/api/settings.ts`
- Create: `app/src/stores/settings.store.ts`
- Test: `app/tests/stores/settings.store.test.ts`

**Interfaces:**
- Consumes: the endpoints from Task 8.
- Produces:
  - `fetchSettings(): Promise<PlayerSettings>`
  - `saveSettings(next: PlayerSettings): Promise<PlayerSettings>`
  - `settingsStore()` — Alpine factory exposing `captureModeKey`, `inputModeKey`, `loading`, `error`, `load()`, `save(capture, input)`

Modules never import `@client/api`; stores may. Keep the fetch calls in the client file and the state in the store.

- [ ] **Step 1: Write the failing test**

Create `app/tests/stores/settings.store.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSettings = vi.fn();
const saveSettings = vi.fn();

vi.mock("@client/api/settings", () => ({
  fetchSettings: () => fetchSettings(),
  saveSettings: (next: unknown) => saveSettings(next),
}));

const { settingsStore } = await import("@stores/settings.store");

beforeEach(() => {
  fetchSettings.mockReset();
  saveSettings.mockReset();
});

describe("settingsStore", () => {
  it("loads the stored modes", async () => {
    fetchSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const store = settingsStore();
    await store.load();

    expect(store.captureModeKey).toBe("ANALYTICS");
    expect(store.inputModeKey).toBe("VISUAL_BOARD");
    expect(store.loading).toBe(false);
  });

  it("keeps quick score when the load fails", async () => {
    fetchSettings.mockRejectedValue(new Error("offline"));

    const store = settingsStore();
    await store.load();

    expect(store.captureModeKey).toBe("RECREATIONAL");
    expect(store.inputModeKey).toBe("QUICK_SCORE");
    expect(store.error).not.toBeNull();
  });

  it("saves a new pair and adopts it", async () => {
    saveSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const store = settingsStore();
    await store.save("ANALYTICS", "VISUAL_BOARD");

    expect(saveSettings).toHaveBeenCalledWith({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
    expect(store.inputModeKey).toBe("VISUAL_BOARD");
  });

  it("leaves the previous pair in place when the save fails", async () => {
    saveSettings.mockRejectedValue(new Error("rejected"));

    const store = settingsStore();
    await store.save("ANALYTICS", "VISUAL_BOARD");

    expect(store.inputModeKey).toBe("QUICK_SCORE");
    expect(store.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/stores/settings.store.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the API client**

Create `app/src/lib/client/api/settings.ts` with `fetchSettings` and `saveSettings`, calling `/api/players/me/settings`. Copy the request/response handling and error mapping of an existing file in that folder exactly — including how it unwraps the frozen envelope and maps error codes.

- [ ] **Step 4: Write the store**

Create `app/src/stores/settings.store.ts`:

```typescript
import { fetchSettings, saveSettings } from "@client/api/settings";

/**
 * The player's app mode. Defaults to quick score until a load succeeds, so a
 * failed or slow settings call leaves every game visible rather than hiding
 * the whole games page behind a network error.
 */
export function settingsStore() {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    loading: false,
    error: null as string | null,

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const settings = await fetchSettings();
        this.captureModeKey = settings.defaultCaptureModeKey;
        this.inputModeKey = settings.defaultInputModeKey;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },

    async save(captureModeKey: string, inputModeKey: string) {
      this.loading = true;
      this.error = null;
      try {
        const settings = await saveSettings({
          defaultCaptureModeKey: captureModeKey,
          defaultInputModeKey: inputModeKey,
        });
        this.captureModeKey = settings.defaultCaptureModeKey;
        this.inputModeKey = settings.defaultInputModeKey;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "save failed";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/stores/settings.store.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/client/api/settings.ts app/src/stores/settings.store.ts app/tests/stores/settings.store.test.ts
git commit -m "Add settings API client and Alpine store"
```

---

### Task 10: Profile mode form

**Files:**
- Modify: `app/src/pages/profile/index.astro`
- Create: `app/src/components/forms/AppModeForm.astro`

**Interfaces:**
- Consumes: `settingsStore()` (Task 9).
- Produces: a working mode picker on the profile page.

The profile page is currently an empty shell — a heading and nothing else.

- [ ] **Step 1: Read the conventions**

Read `app/src/components/forms/` for an existing form component and `docs/architecture/07-Frontend/07-Style-Guide.md` for the token vocabulary. The component below must match both.

- [ ] **Step 2: Write the component**

Create `app/src/components/forms/AppModeForm.astro`:

```astro
---
import { cn } from "@utils/cn";

type Props = {
  class?: string;
};

const { class: className, ...props } = Astro.props;
---

<section
  class={cn("space-y-4", className)}
  x-data="settingsStore()"
  x-init="load()"
  {...props}
>
  <div class="space-y-1">
    <h2 class="text-lg font-semibold text-foreground">App mode</h2>
    <p class="text-sm text-muted-foreground">
      Analytics mode records every dart's landing point, and only games that
      support it are shown.
    </p>
  </div>

  <div class="space-y-2">
    <button
      type="button"
      class="w-full rounded-lg border border-border px-4 py-3 text-left"
      @click="save('RECREATIONAL', 'QUICK_SCORE')"
      :aria-pressed="inputModeKey === 'QUICK_SCORE'"
    >
      <span class="block font-semibold text-foreground">Quick score</span>
      <span class="block text-sm text-muted-foreground">
        Enter a visit total each turn.
      </span>
    </button>

    <button
      type="button"
      class="w-full rounded-lg border border-border px-4 py-3 text-left"
      @click="save('ANALYTICS', 'VISUAL_BOARD')"
      :aria-pressed="inputModeKey === 'VISUAL_BOARD'"
    >
      <span class="block font-semibold text-foreground">Analytics</span>
      <span class="block text-sm text-muted-foreground">
        Tap the board where each dart lands.
      </span>
    </button>
  </div>

  <p
    class="text-sm text-danger"
    x-cloak
    x-show="error !== null"
    x-text="error"
  >
  </p>
</section>
```

Replace `text-danger`, `border-border` and `text-muted-foreground` with whatever the style guide actually names — `scripts/check-style-tokens.sh` rejects invented tokens.

The `x-init="load()"` above conflicts with the handbook's "no `x-init`" rule. Check `07-Frontend/03-Alpine-Patterns.md` for the project's sanctioned initialisation pattern and use that instead.

- [ ] **Step 3: Mount it on the profile page**

Replace `app/src/pages/profile/index.astro` with:

```astro
---
export const prerender = true;
import AppModeForm from "@components/forms/AppModeForm.astro";
import AppLayout from "@layouts/AppLayout.astro";
---

<AppLayout title="Profile">
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-semibold text-foreground">Profile</h1>
    <AppModeForm />
  </div>
</AppLayout>
```

- [ ] **Step 4: Register the store with Alpine**

Find where existing Alpine factories are registered (search for `Alpine.data(` under `app/src`) and register `settingsStore` the same way.

- [ ] **Step 5: Verify in the browser**

Run: `cd app && npx astro dev --background` then open the profile page.
Expected: two mode buttons; clicking one persists it; a reload shows the chosen mode still selected. Stop with `npx astro dev stop`.

- [ ] **Step 6: Run the Astro gates**

Run: `cd .. && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh`
Expected: all OK.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/components/forms/AppModeForm.astro app/src/pages/profile/index.astro app/src
git commit -m "Add the app mode form to the profile page"
```

---

### Task 11: Games page filter and banner

**Files:**
- Modify: `app/src/pages/games/index.astro`
- Modify: `app/src/components/layout/games/GameCard.astro`
- Test: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `settingsStore()` (Task 9), `capableRulesets` (Task 1).
- Produces: `visibleGames(captureModeKey, inputModeKey, activeRulesetKey): readonly GameCardDescriptor[]`

The page stays `prerender = true`; the filter runs client-side against the store.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/rulesets/games-visibility.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { visibleGames } from "@lib/game/rulesets/games-visibility";

describe("visibleGames", () => {
  it("shows every game under quick score", () => {
    const keys = visibleGames("RECREATIONAL", "QUICK_SCORE", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("501_V1");
    expect(keys).toContain("SCORE_TRAINING_V1");
  });

  it("shows only visual-capable games under analytics", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.sort()).toEqual(["501_V1", "SCORE_TRAINING_V1"]);
  });

  it("never hides a game with an active session", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", "TUOD_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("TUOD_V1");
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V1")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `app/src/lib/game/rulesets/games-visibility.ts`:

```typescript
import type { RulesetVersionKey } from "@lib/types";
import { supportsMode } from "./capabilities";
import type { GameCardDescriptor } from "./types";

/** The games the page can offer, in display order, independent of mode. */
const GAME_CARDS: readonly GameCardDescriptor[] = [
  {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    href: "/games/score-training/setup",
    title: "Score training",
    caption: "Exercise your scoring abilities.",
  },
  {
    rulesetVersionKey: "501_V1",
    href: "/games/501/setup",
    title: "501",
    caption: "Classic double-out darts.",
  },
];

/**
 * Which game cards to show for a mode. A game with an active session is always
 * shown, whatever the mode: that session snapshotted its own modes at start and
 * is unaffected by a later preference change, but hiding its card would strand
 * it — the recovery flow is reachable only from here.
 */
export function visibleGames(
  captureModeKey: string,
  inputModeKey: string,
  activeRulesetKey: RulesetVersionKey | null,
): readonly GameCardDescriptor[] {
  return GAME_CARDS.filter(
    (game) =>
      supportsMode(game.rulesetVersionKey, captureModeKey, inputModeKey) ||
      game.rulesetVersionKey === activeRulesetKey,
  );
}
```

Add to `app/src/lib/game/rulesets/types.ts`:

```typescript
/** One game card on the games page, with the ruleset version that gates it. */
export type GameCardDescriptor = {
  rulesetVersionKey: RulesetVersionKey;
  href: string;
  title: string;
  caption: string;
};
```

Import `RulesetVersionKey` in that file if it is not already imported.

The third test asserts `TUOD_V1` appears when active, but `GAME_CARDS` has no TUOD entry — TUOD has no setup page yet. Either add TUOD to `GAME_CARDS` with its real route once it exists, or change that test to use a ruleset that is in the list and assert the active-session rule with `SCORE_TRAINING_V1` under a mode it does not support. Pick one and make the test and the data agree; do not leave a test asserting a card that cannot render.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the page**

Rewrite `app/src/pages/games/index.astro` to render every card with `x-show` bound to the filter, plus the analytics banner and the empty state. Every `x-show` needs `x-cloak`. Follow `03-Alpine-Patterns.md` for the store wiring, and keep the existing `GameCard` props unchanged.

The banner text when analytics is on: "Analytics mode — only games that record every dart are shown." The empty state when no game is capable: a line explaining why and a link back to the profile page.

- [ ] **Step 6: Verify in the browser**

Run: `cd app && npx astro dev --background`, set analytics mode on the profile page, then open the games page.
Expected: both cards still shown (both are visual-capable), banner visible. Switch back to quick score: banner gone. Stop the server.

- [ ] **Step 7: Run the Astro gates**

Run: `cd .. && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh`
Expected: all OK.

- [ ] **Step 8: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/pages/games app/src/lib/game/rulesets app/tests/lib/game/rulesets
git commit -m "Filter the games page by app mode"
```

---

### Task 12: Documentation and context maintenance

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/03-Player-Layer.md`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/05-Database/05-Views.md`
- Modify: `docs/architecture/05-Database/03-Migrations.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `decisions/api.md`, `decisions/architecture.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation matching the shipped behaviour.

- [ ] **Step 1: Un-defer the settings layer**

In `03-Player-Layer.md`, replace the "**v1 status:** deferred" paragraph with:

```markdown
**Status:** shipped (2026-08-05). `GET`/`PATCH /api/players/me/settings` read
through `v_player_settings` and write the table. A player with no settings row
reads as `RECREATIONAL` + `QUICK_SCORE`; the row is created lazily on first
write, and no backfill runs. Settings remain **defaults only** — they are read
at session start and copied onto the session, so changing one never rewrites
history. This supersedes D60's deferral clause; the client no longer persists
last-used modes locally.
```

Also correct the Relationships section: the `capture_modes` / `input_modes` foreign keys it always claimed now genuinely exist, added in migration `0017`.

- [ ] **Step 2: Document the endpoints**

Add the two settings endpoints to `06-API/04-Endpoint-Contracts.md`, following the file's existing per-endpoint format: method, path, auth, request body, response envelope, error codes. Include the `VALIDATION_FAILED` case for a mode pair no ruleset supports.

- [ ] **Step 3: Register the views**

Add `v_player_settings` contract rows to `06-Spec/05-Read-Model-Layer.md` and `05-Database/05-Views.md`.

- [ ] **Step 4: Update the migration chain**

In `03-Migrations.md`, extend the chain to `0020`, describing `0018` (capability composite FK, **requires seed `0006` first**) and `0020` (`v_player_settings`).

- [ ] **Step 5: Append the decisions**

To `decisions/api.md`, append a decision recording the settings endpoints shipping, citing `Supersedes:` against D60's deferral clause. To `decisions/architecture.md`, append one recording the capability declaration: a cross-runtime constant as the code-side source plus a seeded table and composite FK as the database-side guarantee, and why capability is keyed on ruleset version rather than game type. Use the next free ids and copy the existing block format exactly.

- [ ] **Step 6: Update the context map**

Bump the version line with a dated note; update the migration range and seed list in **Current Implementation State**; register `capabilities.ts`, `games-visibility.ts`, `settings.service.ts`, `settings.repository.ts`, `settings.store.ts`, `AppModeForm.astro` and the new migrations/seeds in the File Inventory.

- [ ] **Step 7: Run every gate**

Run:

```bash
cd .. && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-decision-ids.sh && bash scripts/check-agent-mirrors.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-type-barrels.sh && bash scripts/check-file-locations.sh && bash scripts/check-alias-sync.sh && bash scripts/check-game-engines.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh
```

Expected: every script OK.

- [ ] **Step 8: Run the full validation**

Run: `cd app && npm run validate:app`
Expected: passes end to end.

- [ ] **Step 9: Commit**

```bash
cd app && npm run format && cd ..
git add docs decisions
git commit -m "Document capability declaration and player settings"
```

---

## Self-Review

**Spec coverage.** Cross-runtime capability constant (Task 1); capability seed (Task 2); constant-seed parity (Task 3); migration `0018` composite FK with its apply-order documentation (Task 4); registry filtering and the extended engine gate (Task 5); session-creation rejection (Task 6); `v_player_settings` (Task 7); settings endpoints through controller/service/repository (Task 8); client and store (Task 9); profile form (Task 10); games filter, banner, empty state and the active-session guard (Task 11); all documentation and decisions (Task 12).

**Type consistency.** `ModePair` is defined once (Task 1) and consumed by `supportsMode` / `capableRulesets` throughout. `PlayerSettings` is defined in Task 8's service types and used identically by the repository, the API client and the store. `GameCardDescriptor` is defined in Task 11 and used only there. `capableRulesets` is consumed by Task 5's registry, Task 8's service and Task 11's visibility module with the same signature in each.

**Known softness, stated rather than papered over.** Three tasks point at code this plan cannot name exactly without opening the files: Task 6's create-session service signature, Task 8's repository folder and envelope helpers, and Task 9's API-client conventions. Each begins with a locate step and says to follow what is found. Task 10's `x-init` usage is flagged in-task as conflicting with the handbook's no-`x-init` rule, with instructions to substitute the sanctioned pattern — I could not confirm what that pattern is without reading `03-Alpine-Patterns.md`, which is outside this plan's context budget. Task 11 Step 3 contains a deliberate contradiction between the test and the card list, called out with instructions to resolve it either way rather than silently shipping a test that asserts an unrenderable card.
