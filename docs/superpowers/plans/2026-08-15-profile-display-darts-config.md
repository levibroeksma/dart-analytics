# Profile Display Name + Darts Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player set an editable display name and record the darts (free text) + weight (grams) they play with, on the profile page.

**Architecture:** `players` table gains two nullable columns (`darts_description`, `darts_weight_grams`); a new `v_player_profile` view backs a new `GET`/`PATCH /api/players/me` endpoint, sibling to the existing `/me/settings`. Full stack: migration → repository → service → route → client → Alpine store → two Astro form components on the profile page.

**Tech Stack:** Astro, TypeScript, Alpine.js, Drizzle (hand-authored `schema.ts`, no live DB in this container), PostgreSQL/Neon, Zod, Vitest.

## Global Constraints

- Reads are view-backed (`v_player_profile`); writes target the `players` table directly, per the hard invariant (`Reads via views, writes to runtime tables`).
- `PATCH /api/players/me` replaces all three fields — `displayName`, `dartsDescription`, `dartsWeightGrams` — no partial update, mirroring the existing `PATCH /api/players/me/settings` convention.
- `darts_weight_grams`: nullable `SMALLINT`, CHECK `darts_weight_grams IS NULL OR (darts_weight_grams > 0 AND darts_weight_grams <= 100)`.
- `darts_description`: nullable `TEXT`, CHECK `darts_description IS NULL OR length(trim(darts_description)) > 0` (mirrors `chk_players_display_name_not_empty`).
- `displayName` stays `NOT NULL` and non-empty (existing constraint, unchanged).
- No live PostgreSQL server exists in this container (no `DATABASE_URL`) — migrations/`schema.ts` are hand-authored to match what `dbmate`/`drizzle-kit introspect` would produce, and the new verification script must be run against the real Neon database by the operator before merge (D193). Flag this explicitly; do not claim it ran.
- Two separate visual cards on the profile page (`DisplayNameForm.astro`, `DartsConfigForm.astro`), both backed by one `profile` Alpine store and one endpoint — decided in the approved design spec `docs/superpowers/specs/2026-08-15-profile-display-darts-config-design.md`.
- TypeScript comments: no `//`/`/* */` inside function bodies (JSDoc above declarations only) — `app/CLAUDE.md`.
- No `x-init` anywhere in `.astro` files; every `x-show` needs a paired `x-cloak`.
- Run `cd app && npm run format` before considering any task with `.astro`/`.ts` changes done.

---

### Task 1: Database — migration, schema.ts, verification script, docs

**Files:**
- Create: `database/migrations/0022_player_profile_read_model.sql`
- Create: `database/verification/0022_player_profile_checks.sql`
- Modify: `app/src/db/schema.ts` (players table `:200-222`, add view near `:1013-1020`)
- Modify: `docs/architecture/05-Database/06-Spec/03-Player-Layer.md`
- Modify: `docs/architecture/05-Database/05-Views.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/05-Database/03-Migrations.md`
- Modify: `database/README.md`

**Interfaces:**
- Produces: table columns `players.darts_description` (`TEXT`, nullable), `players.darts_weight_grams` (`SMALLINT`, nullable); view `v_player_profile(player_id, display_name, darts_description, darts_weight_grams, updated_at)`; Drizzle exports `players` (widened), `vPlayerProfile` from `@db/schema`.
- Consumes: nothing (first task).

- [ ] **Step 1: Write the migration**

Create `database/migrations/0022_player_profile_read_model.sql`:

```sql
-- ============================================================
-- Migration: 0022_player_profile_read_model.sql
--
-- Purpose:
-- Let a player configure their display name and the darts
-- equipment (darts description + weight in grams) they play
-- with, and expose both as a read model.
--
-- display_name already existed (migration 0003); it had no
-- write path beyond provisioning. darts_description and
-- darts_weight_grams are new, both nullable — a player may
-- never set them.
-- ============================================================

-- migrate:up
ALTER TABLE players
ADD COLUMN darts_description TEXT,
    ADD COLUMN darts_weight_grams SMALLINT;

ALTER TABLE players
ADD CONSTRAINT chk_players_darts_description_not_empty CHECK (
        darts_description IS NULL
        OR length(TRIM(BOTH FROM darts_description)) > 0
    ),
    ADD CONSTRAINT chk_players_darts_weight_grams_range CHECK (
        darts_weight_grams IS NULL
        OR (
            darts_weight_grams > 0
            AND darts_weight_grams <= 100
        )
    );

COMMENT ON COLUMN players.darts_description IS 'Free-text darts the player uses, e.g. "Winmau Pro-Series 23g". NULL until set.';
COMMENT ON COLUMN players.darts_weight_grams IS 'Weight of the player''s darts in grams, 1-100. NULL until set.';

CREATE VIEW v_player_profile AS
SELECT id AS player_id,
    display_name,
    darts_description,
    darts_weight_grams,
    updated_at
FROM players;

COMMENT ON VIEW v_player_profile IS 'Player display name and darts equipment.';

-- migrate:down
DROP VIEW IF EXISTS v_player_profile;

ALTER TABLE players
DROP CONSTRAINT chk_players_darts_weight_grams_range,
    DROP CONSTRAINT chk_players_darts_description_not_empty;

ALTER TABLE players
DROP COLUMN darts_weight_grams,
    DROP COLUMN darts_description;
```

- [ ] **Step 2: Hand-update `app/src/db/schema.ts` to match**

There is no live database in this container, so `drizzle-kit introspect` cannot run — hand-edit `schema.ts` to what it would produce, matching the existing `v_player_settings`/`player_settings` precedent (also hand-authored under the same constraint). `text`, `smallint`, `check`, `pgView`, `sql` are already imported at the top of the file — no new imports needed.

Replace the `players` table block (currently `schema.ts:200-222`):

```ts
export const players = pgTable(
  "players",
  {
    id: uuid().primaryKey().notNull(),
    authUserId: text("auth_user_id").notNull(),
    displayName: text("display_name").notNull(),
    dartsDescription: text("darts_description"),
    dartsWeightGrams: smallint("darts_weight_grams"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    unique("uq_players_auth_user_id").on(table.authUserId),
    check(
      "chk_players_display_name_not_empty",
      sql`length(TRIM(BOTH FROM display_name)) > 0`,
    ),
    check(
      "chk_players_darts_description_not_empty",
      sql`darts_description IS NULL OR length(TRIM(BOTH FROM darts_description)) > 0`,
    ),
    check(
      "chk_players_darts_weight_grams_range",
      sql`darts_weight_grams IS NULL OR (darts_weight_grams > 0 AND darts_weight_grams <= 100)`,
    ),
  ],
);
```

Add a new view export directly after the `vPlayerSettings` block (currently `schema.ts:1013-1020`):

```ts
export const vPlayerProfile = pgView("v_player_profile", {
  playerId: uuid("player_id"),
  displayName: text("display_name"),
  dartsDescription: text("darts_description"),
  dartsWeightGrams: smallint("darts_weight_grams"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
}).as(
  sql`SELECT id AS player_id, display_name, darts_description, darts_weight_grams, updated_at FROM players`,
);
```

- [ ] **Step 3: Write the verification script**

Create `database/verification/0022_player_profile_checks.sql`:

```sql
-- ============================================================
-- Verification: 0022_player_profile_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0022_player_profile_read_model.sql (D193 — SQL
-- that cannot be applied locally ships with a verification
-- script the owner runs against the real Neon database before
-- merge):
--
--   1. v_player_profile exists as a view and exposes exactly
--      (player_id, display_name, darts_description,
--      darts_weight_grams, updated_at), in that order
--   2. a player with darts_description/darts_weight_grams set
--      resolves both through the view
--   3. a player who never set darts equipment resolves both
--      columns as NULL through the view, not defaulted
--   4. chk_players_darts_description_not_empty rejects an
--      empty string, accepts a non-empty string, accepts NULL
--   5. chk_players_darts_weight_grams_range rejects 0 and 101,
--      accepts 1 and 100, accepts NULL
--
-- No seeded lookup table is involved here — unlike the
-- settings/capability checks, darts_description and
-- darts_weight_grams are plain player-owned columns, not FK-
-- backed, so nothing in this file resolves by
-- implementation_key.
--
-- Everything runs inside one transaction that ends in
-- ROLLBACK, so no fixture row survives.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0022_player_profile_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0022.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: two players.
--
-- A has darts_description and darts_weight_grams set
--   (step 2).
-- B has never set either (step 3) — the default, unconfigured
--   state.
-- ------------------------------------------------------------
INSERT INTO players (
        id,
        auth_user_id,
        display_name,
        darts_description,
        darts_weight_grams,
        created_at,
        updated_at
    )
VALUES (
        '01990000-0000-7000-8000-000000f22a01',
        'verification-0022-a',
        'Verification Fixture A',
        'Winmau Pro-Series 23g',
        23,
        now(),
        now()
    );

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000f22a02',
        'verification-0022-b',
        'Verification Fixture B',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Step 1: v_player_profile exists as a view.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_profile exists as a view',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s matching information_schema.views row(s) found', count(*))
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name = 'v_player_profile';

-- ------------------------------------------------------------
-- Step 1 (continued): exactly the five expected columns, in
-- the expected order.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_profile exposes exactly (player_id, display_name, darts_description, darts_weight_grams, updated_at) in order',
    CASE
        WHEN cols.names = ARRAY['player_id', 'display_name', 'darts_description', 'darts_weight_grams', 'updated_at'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found column order: %s', cols.names)
FROM (
        SELECT array_agg(
                column_name::TEXT
                ORDER BY ordinal_position
            ) AS names
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'v_player_profile'
    ) cols;

-- ------------------------------------------------------------
-- Step 2: a configured player's darts resolve through the
-- view.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'darts_description resolves through the view',
    CASE
        WHEN darts_description = 'Winmau Pro-Series 23g' THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', darts_description)
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a01';

INSERT INTO verification_results
SELECT '2',
    'darts_weight_grams resolves through the view',
    CASE
        WHEN darts_weight_grams = 23 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', darts_weight_grams)
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a01';

-- ------------------------------------------------------------
-- Step 3: an unconfigured player's darts read as NULL, not
-- defaulted.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'unconfigured player reads darts_description/darts_weight_grams as NULL',
    CASE
        WHEN darts_description IS NULL
        AND darts_weight_grams IS NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    format(
        'description=%s weight=%s',
        darts_description,
        darts_weight_grams
    )
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a02';

-- ------------------------------------------------------------
-- Step 4: chk_players_darts_description_not_empty. Each
-- attempt runs in its own savepoint so a rejection does not
-- abort the surrounding transaction.
-- ------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        UPDATE players
        SET darts_description = ''
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'empty darts_description is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'empty darts_description is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_description = 'Target Agora 23g'
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'non-empty darts_description is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'non-empty darts_description is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_description = NULL
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'NULL darts_description is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'NULL darts_description is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- ------------------------------------------------------------
-- Step 5: chk_players_darts_weight_grams_range.
-- ------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        UPDATE players
        SET darts_weight_grams = 0
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 0 is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 0 is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 101
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 101 is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 101 is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 1
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 1 is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 1 is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 100
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 100 is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 100 is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = NULL
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'NULL weight is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'NULL weight is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against the view, so a broken column could make one
-- vanish silently instead of failing. Assert the count of
-- checks that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all view-driven checks actually ran',
    CASE
        WHEN count(*) = 5 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 5 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 4: Run the dynamically-discovered verification-runner tests**

```bash
cd app && npx vitest run tests/scripts/verify-db.test.ts tests/db/migration-numeric-typing.test.ts
```

Expected: PASS — `verify-db.test.ts` discovers `0022_player_profile_checks.sql` via `readdirSync` and asserts it starts with `BEGIN;`, ends with `ROLLBACK;`, contains `implementation_key`, and is registered in `database/README.md` (registered in Step 6 below — if this test runs before Step 6, the "registered in database/README.md" case for `0022...` fails until Step 6 lands; run this command again after Step 6 to confirm green).

- [ ] **Step 5: Run the full test suite to confirm `schema.ts` still compiles/loads cleanly**

```bash
cd app && npm test
```

Expected: PASS, same count as before this task (no test yet exercises the new columns/view — that starts in Task 2).

- [ ] **Step 6: Update database docs**

In `docs/architecture/05-Database/06-Spec/03-Player-Layer.md`:

Change the front-matter `updated: 2026-08-08` to `updated: 2026-08-15`.

Change the `players` "## Key Columns" list from:

```markdown
- id
- auth_user_id (unique — external identity reference)
- display_name (NOT NULL; set at provisioning: request displayName → JWT name claim → 'Player')
- created_at
- updated_at
```

to:

```markdown
- id
- auth_user_id (unique — external identity reference)
- display_name (NOT NULL; set at provisioning: request displayName → JWT name claim → 'Player')
- darts_description (nullable — free-text darts the player uses, e.g. "Winmau Pro-Series 23g")
- darts_weight_grams (nullable SMALLINT, 1-100)
- created_at
- updated_at
```

In the players "## Relationships" section, add a line after the "Referenced by:" list:

```markdown
Read through:

- `v_player_profile` (migration `0022`) — display name and darts equipment
```

In the players "## Design Rationale" section, change:

```markdown
Initial value comes from POST /api/players/provision; a rename endpoint is deferred post-v1. <!-- 2026-07-13 -->
```

to:

```markdown
Initial value comes from POST /api/players/provision. `GET`/`PATCH /api/players/me` (shipped 2026-08-15) is the rename/darts-config endpoint deferred by the note above. <!-- 2026-07-13; rename endpoint shipped 2026-08-15 -->

`darts_description`/`darts_weight_grams` are nullable — a player may never configure equipment — and are edited through the same endpoint as `display_name`, replacing all three fields together (no partial update), matching `PATCH /api/players/me/settings`'s convention. <!-- 2026-08-15 -->
```

In `docs/architecture/05-Database/05-Views.md`:

Change front-matter `updated: 2026-08-08` to `updated: 2026-08-15`, and `> **Version:** 1.2.0` to `> **Version:** 1.3.0`.

Change the heading `# Implemented Views (migrations 0009–0021)` to `# Implemented Views (migrations 0009–0022)`.

Add a row to the Implemented Views table, after the `v_player_settings` row:

```markdown
| `v_player_profile` | API Read Model | Player display name + darts equipment (2026-08-15) |
```

In `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`:

Change front-matter `updated: 2026-08-08` to `updated: 2026-08-15`.

Change the intro sentence `Migration \`0021\` adds \`v_player_settings\`. <!-- 2026-08-08 -->` to add, right after it: `Migration \`0022\` adds \`v_player_profile\`. <!-- 2026-08-15 -->`

Add a new section after `# v_player_settings` (before `# Read Model Layer Summary`):

```markdown
---

# v_player_profile

## Category

API Read Model

## Purpose

Exposes a player's display name and darts equipment. Backs `GET /api/players/me` and the read half of `PATCH`. <!-- 2026-08-15 -->

## Sources

- players

## Exposes

`player_id`, `display_name`, `darts_description`, `darts_weight_grams`, `updated_at`.

## Design Rationale

A plain projection over `players` — no joins, since `darts_description`/`darts_weight_grams` are not FK-backed. Reads still go through this view rather than the raw table, per the view-backed-reads rule. `darts_description` and `darts_weight_grams` are NULL for a player who never configured equipment; the view does not invent defaults.
```

Add a row to the "Read Model Layer Summary" table:

```markdown
| Player profile | v_player_profile |
```

In `docs/architecture/05-Database/03-Migrations.md`:

Change front-matter `updated: 2026-08-05` to `updated: 2026-08-15`, and `> **Version:** 1.6.0` to `> **Version:** 1.7.0`.

In the "# Migration Structure" file tree, change:

```
│   └── 0021_player_settings_read_model.sql
```

to:

```
│   ├── 0021_player_settings_read_model.sql
│   └── 0022_player_profile_read_model.sql
```

Add a new section after `## 0021_player_settings_read_model.sql` (before `# Schema Changes`):

```markdown
---

## 0022_player_profile_read_model.sql

Purpose:

Let a player configure their display name and darts equipment; expose both as a read model. <!-- 2026-08-15 -->

Contains:

- `players.darts_description` (`TEXT`, nullable) and `players.darts_weight_grams` (`SMALLINT`, nullable)
- `chk_players_darts_description_not_empty` / `chk_players_darts_weight_grams_range` (1-100)
- new `v_player_profile` (`player_id`, `display_name`, `darts_description`, `darts_weight_grams`, `updated_at`)

`display_name` already existed (migration `0003`); this migration only adds its write path (`GET`/`PATCH /api/players/me`) at the application layer — no column change to `display_name` itself.

Never edits `0003`/`0009`/`0013`/`0014`/`0016`/`0018`/`0021`.
```

In `database/README.md`:

Change the migrations line in the directory tree from `# ordered schema migrations (0001–0021)` to `# ordered schema migrations (0001–0022)`.

Add a row to the "Verification Scripts" table:

```markdown
| `verification/0022_player_profile_checks.sql` | `v_player_profile` exists with the exact expected columns, resolves configured and unconfigured players correctly, `chk_players_darts_description_not_empty`/`chk_players_darts_weight_grams_range` fire on invalid input and accept valid/NULL input (11 checks) |
```

- [ ] **Step 7: Re-run the verification-runner tests to confirm the README registration check now passes**

```bash
cd app && npx vitest run tests/scripts/verify-db.test.ts
```

Expected: PASS, including the `0022_player_profile_checks.sql is registered in database/README.md` case.

- [ ] **Step 8: Commit**

```bash
git add database/migrations/0022_player_profile_read_model.sql \
  database/verification/0022_player_profile_checks.sql \
  database/README.md \
  app/src/db/schema.ts \
  docs/architecture/05-Database/06-Spec/03-Player-Layer.md \
  docs/architecture/05-Database/05-Views.md \
  docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md \
  docs/architecture/05-Database/03-Migrations.md
git commit -m "Add player profile columns, v_player_profile view, migration 0022"
```

---

### Task 2: Repository layer

**Files:**
- Modify: `app/src/repositories/interfaces.ts`
- Modify: `app/src/repositories/player.repository.ts`
- Test: `app/tests/repositories/player.repository.test.ts`

**Interfaces:**
- Consumes: `players`, `vPlayerProfile` from `@db/schema` (Task 1).
- Produces: `PlayerProfileRow { displayName: string; dartsDescription: string | null; dartsWeightGrams: number | null }`, `PlayerProfileInput` (same shape); `findPlayerProfile(db, playerId): Promise<PlayerProfileRow>` (throws if no row), `updatePlayerProfile(db, playerId, next: PlayerProfileInput): Promise<PlayerProfileRow>`.

- [ ] **Step 1: Add the row/input types**

In `app/src/repositories/interfaces.ts`, append:

```ts
/** A `v_player_profile` row. */
export interface PlayerProfileRow {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
}

/** Profile fields to store on a player's row. */
export interface PlayerProfileInput {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
}
```

- [ ] **Step 2: Write the failing repository tests**

Create `app/tests/repositories/player.repository.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

function fakeSelect(rows: unknown[]) {
  const fromCalls: unknown[] = [];
  const chain = {
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      return chain;
    }),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return { chain, fromCalls };
}

describe("findPlayerProfile", () => {
  it("reads from v_player_profile and returns the row", async () => {
    const row = {
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerProfile } = await import("@db/schema");
    const { findPlayerProfile } = await import(
      "@repositories/player.repository"
    );

    const result = await findPlayerProfile(db, "p1");

    expect(result).toEqual(row);
    expect(fromCalls).toEqual([vPlayerProfile]);
  });

  it("throws when no row is found", async () => {
    const { chain } = fakeSelect([]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findPlayerProfile } = await import(
      "@repositories/player.repository"
    );

    await expect(findPlayerProfile(db, "missing")).rejects.toThrow(
      /no v_player_profile row for player missing/,
    );
  });
});

function fakeUpdate(row: unknown) {
  const state: { table: unknown; values: unknown } = {
    table: undefined,
    values: undefined,
  };
  const chain = {
    set: vi.fn((values: unknown) => {
      state.values = values;
      return chain;
    }),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
  };
  const db = {
    update: vi.fn((table: unknown) => {
      state.table = table;
      return chain;
    }),
  };
  return { db, state };
}

describe("updatePlayerProfile", () => {
  it("writes the given profile fields and returns the stored row", async () => {
    const stored = {
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    };
    const { db, state } = fakeUpdate(stored);
    const { players } = await import("@db/schema");
    const { updatePlayerProfile } = await import(
      "@repositories/player.repository"
    );

    const result = await updatePlayerProfile(db as any, "player-1", {
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });

    expect(result).toEqual(stored);
    expect(db.update).toHaveBeenCalledWith(players);
    expect(state.values).toMatchObject({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });
  });

  it("stores null darts fields to clear them", async () => {
    const stored = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    const { db, state } = fakeUpdate(stored);
    const { updatePlayerProfile } = await import(
      "@repositories/player.repository"
    );

    const result = await updatePlayerProfile(db as any, "player-1", {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    });

    expect(result).toEqual(stored);
    expect(state.values).toMatchObject({
      dartsDescription: null,
      dartsWeightGrams: null,
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/repositories/player.repository.test.ts
```

Expected: FAIL — `findPlayerProfile`/`updatePlayerProfile` are not exported from `@repositories/player.repository`.

- [ ] **Step 4: Implement the repository functions**

Replace the full contents of `app/src/repositories/player.repository.ts` with:

```ts
import { eq, sql } from "drizzle-orm";
import { players, vPlayerProfile } from "@db/schema";
import type { getDb } from "@db/client";
import type {
  PlayerProfileInput,
  PlayerProfileRow,
  ProvisionedPlayer,
} from "./interfaces";

type Db = ReturnType<typeof getDb>;

/**
 * Creates or returns the player row for the given auth user id.
 * `created` is true when a new row was inserted, false when it already existed.
 * Detection uses the system column `xmax`: a freshly inserted row has xmax = 0,
 * while an ON CONFLICT DO UPDATE touch sets it non-zero. On conflict, existing
 * `display_name` is preserved — provision is idempotent.
 */
export async function upsertPlayerByAuthUserId(
  db: Db,
  authUserId: string,
  id: string,
  displayName: string,
): Promise<ProvisionedPlayer> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(players)
    .values({
      id,
      authUserId,
      displayName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: players.authUserId,
      set: { updatedAt: now },
    })
    .returning({
      playerId: players.id,
      authUserId: players.authUserId,
      xmax: sql<string>`xmax::text`,
    });

  return {
    playerId: row.playerId,
    authUserId: row.authUserId,
    created: row.xmax === "0",
  };
}

/**
 * Reads the player's display name and darts equipment through
 * `v_player_profile`. Every valid player id has exactly one row (a plain
 * projection over `players`, not a LEFT JOIN) — a missing row means the
 * caller passed an id that does not resolve to a provisioned player.
 */
export async function findPlayerProfile(
  db: Db,
  playerId: string,
): Promise<PlayerProfileRow> {
  const [row] = await db
    .select({
      displayName: vPlayerProfile.displayName,
      dartsDescription: vPlayerProfile.dartsDescription,
      dartsWeightGrams: vPlayerProfile.dartsWeightGrams,
    })
    .from(vPlayerProfile)
    .where(eq(vPlayerProfile.playerId, playerId))
    .limit(1);

  if (!row) {
    throw new Error(`no v_player_profile row for player ${playerId}`);
  }

  return row;
}

/**
 * Replaces the player's display name and darts equipment in one UPDATE.
 * Darts fields are nullable, so passing null clears them.
 */
export async function updatePlayerProfile(
  db: Db,
  playerId: string,
  next: PlayerProfileInput,
): Promise<PlayerProfileRow> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(players)
    .set({
      displayName: next.displayName,
      dartsDescription: next.dartsDescription,
      dartsWeightGrams: next.dartsWeightGrams,
      updatedAt: now,
    })
    .where(eq(players.id, playerId))
    .returning({
      displayName: players.displayName,
      dartsDescription: players.dartsDescription,
      dartsWeightGrams: players.dartsWeightGrams,
    });

  return row;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/repositories/player.repository.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/repositories/interfaces.ts app/src/repositories/player.repository.ts app/tests/repositories/player.repository.test.ts
git commit -m "Add player profile repository functions"
```

---

### Task 3: Service layer

**Files:**
- Modify: `app/src/services/types.ts`
- Modify: `app/src/services/player.service.ts`
- Test: `app/tests/services/player.service.test.ts`

**Interfaces:**
- Consumes: `findPlayerProfile`, `updatePlayerProfile`, `PlayerProfileInput` (Task 2).
- Produces: `PlayerProfile { displayName: string; dartsDescription: string | null; dartsWeightGrams: number | null }`, `readProfile(playerId): Promise<PlayerProfile>`, `writeProfile(playerId, next: PlayerProfile): Promise<ServiceResult<PlayerProfile>>`.

- [ ] **Step 1: Add the `PlayerProfile` type**

In `app/src/services/types.ts`, append (after the existing `PlayerSettings` type):

```ts
/** A player's display name and darts equipment. */
export type PlayerProfile = {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
};
```

- [ ] **Step 2: Write the failing service tests**

Create `app/tests/services/player.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@lib/id", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("@repositories/player.repository", () => ({
  upsertPlayerByAuthUserId: vi.fn(),
  findPlayerProfile: vi.fn(),
  updatePlayerProfile: vi.fn(),
}));

import * as repo from "@repositories/player.repository";
import { readProfile, writeProfile } from "@services/player.service";

const playerId = "0198f200-0000-7000-8000-000000000001";

describe("readProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the stored profile", async () => {
    vi.mocked(repo.findPlayerProfile).mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    await expect(readProfile(playerId)).resolves.toEqual({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });
  });
});

describe("writeProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the given profile and returns it", async () => {
    const next = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    vi.mocked(repo.updatePlayerProfile).mockResolvedValue(next);

    const result = await writeProfile(playerId, next);

    expect(result).toEqual({ ok: true, data: next });
    expect(repo.updatePlayerProfile).toHaveBeenCalledWith({}, playerId, next);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/services/player.service.test.ts
```

Expected: FAIL — `readProfile`/`writeProfile` are not exported from `@services/player.service`.

- [ ] **Step 4: Implement the service functions**

Replace the full contents of `app/src/services/player.service.ts` with:

```ts
import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import {
  findPlayerProfile,
  updatePlayerProfile,
  upsertPlayerByAuthUserId,
} from "@repositories/player.repository";
import type { ProvisionedPlayer } from "@repositories/interfaces";
import type { PlayerProfile, ServiceResult } from "./types";

/**
 * Provisions an application player profile for the authenticated user.
 * displayName resolution (D76): caller passes request-or-claim value; 'Player' is the final fallback.
 */
export async function provisionPlayer(
  authUserId: string,
  displayName?: string,
): Promise<ProvisionedPlayer> {
  const db = getDb();
  return upsertPlayerByAuthUserId(
    db,
    authUserId,
    generateId(),
    displayName ?? "Player",
  );
}

/** The caller's display name and darts equipment. */
export async function readProfile(playerId: string): Promise<PlayerProfile> {
  const db = getDb();
  return findPlayerProfile(db, playerId);
}

/**
 * Replaces the caller's display name and darts equipment in one write.
 * Always succeeds — request-shape validation (non-empty name, weight bounds)
 * already happened against the Zod schema before this is called.
 */
export async function writeProfile(
  playerId: string,
  next: PlayerProfile,
): Promise<ServiceResult<PlayerProfile>> {
  const db = getDb();
  const stored = await updatePlayerProfile(db, playerId, next);
  return { ok: true, data: stored };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/services/player.service.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/services/types.ts app/src/services/player.service.ts app/tests/services/player.service.test.ts
git commit -m "Add player profile service functions"
```

---

### Task 4: API route + contract docs

**Files:**
- Modify: `app/src/pages/api/players/types.ts`
- Create: `app/src/pages/api/players/me/index.ts`
- Test: `app/tests/pages/api/players/me/index.test.ts`
- Modify: `docs/architecture/06-API/00-Overview.md`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`

**Interfaces:**
- Consumes: `readProfile`, `writeProfile` (Task 3); `ok`, `fail` (`@server/envelope`); `parseAndValidateBody` (`@server/parse-json-body`).
- Produces: `UpdatePlayerProfileRequest`/`PlayerProfileResponse` Zod schemas + `UpdatePlayerProfileInput`/`PlayerProfileResponseData` types, all re-exported through `@routes/types`; route handlers `GET`/`PATCH` at `@routes/players/me/index`, live at `GET`/`PATCH /api/players/me`.

- [ ] **Step 1: Add the request/response schemas**

In `app/src/pages/api/players/types.ts`, append (after the existing `PlayerSettingsResponseData` type export):

```ts
/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Profile. */
export const UpdatePlayerProfileRequest = z.object({
  displayName: z.string().min(1),
  dartsDescription: z.string().min(1).nullable(),
  dartsWeightGrams: z.number().int().min(1).max(100).nullable(),
});

export const PlayerProfileResponse = z.object({
  displayName: z.string(),
  dartsDescription: z.string().nullable(),
  dartsWeightGrams: z.number().nullable(),
});

export type UpdatePlayerProfileInput = z.infer<
  typeof UpdatePlayerProfileRequest
>;
export type PlayerProfileResponseData = z.infer<typeof PlayerProfileResponse>;
```

- [ ] **Step 2: Write the failing route tests**

Create `app/tests/pages/api/players/me/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/player.service", () => ({
  readProfile: vi.fn(),
  writeProfile: vi.fn(),
}));

import { readProfile, writeProfile } from "@services/player.service";
import { GET, PATCH } from "@routes/players/me/index";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function patchRequest(body: unknown): Request {
  return new Request("https://example.test/api/players/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/players/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the caller's profile", async () => {
    vi.mocked(readProfile).mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    const response = await GET({ locals } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });
    expect(readProfile).toHaveBeenCalledWith("player-1");
  });
});

describe("PATCH /api/players/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the requested profile", async () => {
    const next = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    vi.mocked(writeProfile).mockResolvedValue({ ok: true, data: next });

    const response = await PATCH({
      locals,
      request: patchRequest(next),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(next);
    expect(writeProfile).toHaveBeenCalledWith("player-1", next);
  });

  it("rejects a blank display name without calling the service", async () => {
    const response = await PATCH({
      locals,
      request: patchRequest({
        displayName: "",
        dartsDescription: null,
        dartsWeightGrams: null,
      }),
    } as never);

    expect(response.status).toBe(422);
    expect(writeProfile).not.toHaveBeenCalled();
  });

  it("rejects a weight outside 1-100 without calling the service", async () => {
    const response = await PATCH({
      locals,
      request: patchRequest({
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: 500,
      }),
    } as never);

    expect(response.status).toBe(422);
    expect(writeProfile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/pages/api/players/me/index.test.ts
```

Expected: FAIL — `app/src/pages/api/players/me/index.ts` does not exist yet.

- [ ] **Step 4: Implement the route**

Create `app/src/pages/api/players/me/index.ts`:

```ts
import type { APIRoute } from "astro";
import { UpdatePlayerProfileRequest } from "@routes/types";
import { readProfile, writeProfile } from "@services/player.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

/**
 * Returns the caller's display name and darts equipment. Middleware
 * guarantees `playerId`.
 */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const profile = await readProfile(auth.playerId!);
  return ok(profile, locals.requestId);
};

/**
 * Replaces the caller's display name and darts equipment. No partial
 * update — all three fields are always sent together.
 */
export const PATCH: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;

  const parsed = await parseAndValidateBody(
    UpdatePlayerProfileRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await writeProfile(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/pages/api/players/me/index.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Update API contract docs**

In `docs/architecture/06-API/00-Overview.md`:

Change front-matter `updated: 2026-08-08` to `updated: 2026-08-15`.

Change the version line:

```markdown
> **Version:** 1.6.0 (`GET`/`PATCH /api/players/me/settings` routed, 2026-08-08; prior 1.5.0 — same-origin `/api/auth/*` proxy for Neon Auth traffic, D172, 2026-07-29)
```

to:

```markdown
> **Version:** 1.7.0 (`GET`/`PATCH /api/players/me` routed, 2026-08-15; prior 1.6.0 — `GET`/`PATCH /api/players/me/settings` routed, 2026-08-08)
```

In the "### Players" section, change:

```markdown
- `POST /api/players/provision` <!-- 2026-07-10 -->
- `GET /api/players/me/settings` <!-- 2026-08-08 -->
- `PATCH /api/players/me/settings` <!-- 2026-08-08 -->

Provision is idempotent; it creates the `players` row for a JWT-valid user. The settings pair reads through `v_player_settings` and writes `player_settings`, carrying the caller's default capture/input mode; `PATCH` refuses a mode pair no ruleset version declares (`VALIDATION_FAILED`). Full contracts in `04-Endpoint-Contracts.md`.
```

to:

```markdown
- `POST /api/players/provision` <!-- 2026-07-10 -->
- `GET /api/players/me/settings` <!-- 2026-08-08 -->
- `PATCH /api/players/me/settings` <!-- 2026-08-08 -->
- `GET /api/players/me` <!-- 2026-08-15 -->
- `PATCH /api/players/me` <!-- 2026-08-15 -->

Provision is idempotent; it creates the `players` row for a JWT-valid user. The settings pair reads through `v_player_settings` and writes `player_settings`, carrying the caller's default capture/input mode; `PATCH` refuses a mode pair no ruleset version declares (`VALIDATION_FAILED`). `GET`/`PATCH /api/players/me` reads through `v_player_profile` and writes `players`, carrying display name and darts equipment; `PATCH` replaces all three fields, no partial update. Full contracts in `04-Endpoint-Contracts.md`.
```

In the "## Read Contract" table, add a row after the settings row:

```markdown
| `GET /api/players/me`                    | `v_player_profile`    |
```

Change the "v1 implementation status" note to append a clause:

```markdown
> **v1 implementation status (2026-07-22):** the Score Training first-deploy implements `POST /api/sessions`, `GET /api/sessions/active`, `PATCH /api/sessions/:id`, `POST /api/sessions/:id/events/batch`, `GET /api/configuration-templates`, and `POST /api/players/provision`; `GET`/`PATCH /api/players/me/settings` were added 2026-08-08; `GET`/`PATCH /api/players/me` were added 2026-08-15. The remaining frozen read endpoints (`GET /api/sessions` list, `GET /api/sessions/:id`, `/replay`, `/darts`) are contract-defined but implemented after the first engine — not a contract change. (S1)
```

In `docs/architecture/06-API/04-Endpoint-Contracts.md`:

Change the version line:

```markdown
> **Version:** 1.3.0 (`GET`/`PATCH /api/players/me/settings`, 2026-08-08; prior 1.2.0 — `SESSION_ALREADY_ACTIVE` on `POST /api/sessions`, 2026-07-22)
```

to:

```markdown
> **Version:** 1.4.0 (`GET`/`PATCH /api/players/me`, 2026-08-15; prior 1.3.0 — `GET`/`PATCH /api/players/me/settings`, 2026-08-08)
```

Insert a new section immediately after the "## Player Settings" section's closing content (after the `PlayerSettingsResponse` code block and its trailing sentence, before `## Configuration Presets`):

```markdown
---

## Player Profile — `GET` / `PATCH /api/players/me`

The caller's display name and darts equipment (free-text darts description + weight in grams). Shipped 2026-08-15, closing the rename-endpoint gap `03-Player-Layer.md` flagged as deferred when `display_name` shipped. <!-- 2026-08-15 -->

**Auth:** standard protected route class — JWT-verified, player resolved by middleware. `me` is always the authenticated player; no player id travels in the path.

### `GET /api/players/me`

Read-only, backed by `v_player_profile` (migration `0022`). Every provisioned player has exactly one row — this is a plain projection over `players`, not a sparse join.

Success → `200` with the standard `ok()` envelope carrying `PlayerProfileResponse`.

### `PATCH /api/players/me`

Replaces all three fields; there is no partial update, matching `/me/settings`'s convention.

- A blank `displayName`, or `dartsWeightGrams` outside `1`-`100` → `422 VALIDATION_FAILED` from the shared request-parsing helper (the schema mirrors `chk_players_display_name_not_empty`/`chk_players_darts_description_not_empty`/`chk_players_darts_weight_grams_range`).
- Success → `200` with the standard `ok()` envelope carrying the stored `PlayerProfileResponse` (the request echoed back).

No new error codes are introduced; `VALIDATION_FAILED` is reused from the registry in `03-Shared-Conventions.md`.

```typescript
const UpdatePlayerProfileRequest = z.object({
  displayName: z.string().min(1),
  dartsDescription: z.string().min(1).nullable(),   // NULL clears it
  dartsWeightGrams: z.number().int().min(1).max(100).nullable(), // NULL clears it
});
type UpdatePlayerProfileRequest = z.infer<typeof UpdatePlayerProfileRequest>;

const PlayerProfileResponse = z.object({   // v_player_profile — GET and PATCH result
  displayName: z.string(),
  dartsDescription: z.string().nullable(),
  dartsWeightGrams: z.number().nullable(),
});
```

`player_id` and `updated_at` are view columns and are deliberately not echoed: the caller is `me`, and no client reads the timestamp.
```

In the "## Read Contracts" table (near the end of the file), add a row after the settings row:

```markdown
| `GET /api/players/me` | `v_player_profile` | `PlayerProfileResponse` | 2026-08-15 |
```

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/api/players/types.ts app/src/pages/api/players/me/index.ts \
  app/tests/pages/api/players/me/index.test.ts \
  docs/architecture/06-API/00-Overview.md docs/architecture/06-API/04-Endpoint-Contracts.md
git commit -m "Add GET/PATCH /api/players/me profile endpoint"
```

---

### Task 5: Client API

**Files:**
- Modify: `app/src/lib/client/api/types.ts`
- Create: `app/src/lib/client/api/profile.ts`
- Test: `app/tests/lib/client/api/profile.test.ts`

**Interfaces:**
- Consumes: `apiRequest` (`@client/api/client`); `UpdatePlayerProfileRequest`, `UpdatePlayerProfileInput`, `PlayerProfileResponseData` (Task 4, re-exported).
- Produces: `fetchProfile(): Promise<PlayerProfileResponseData>`, `saveProfile(next: UpdatePlayerProfileInput): Promise<PlayerProfileResponseData>`, `class ProfileApiError extends Error { code: string }`.

- [ ] **Step 1: Re-export the new schemas/types for the client barrel**

In `app/src/lib/client/api/types.ts`, change the `@routes/types` re-export block from:

```ts
export {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
  type ErrorCode,
  CreateSessionRequest,
  type CreateSessionRequestInput,
  type CreateSessionResponseData,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  // fallow-ignore-next-line unused-type -- two-barrel Worker/browser convention (03-Shared-Conventions.md); kept for a future browser consumer of PATCH session status
  type UpdateSessionRequestInput,
  type SessionActiveData,
  type ConfigurationPresetData,
  UpdatePlayerSettingsRequest,
  type UpdatePlayerSettingsInput,
  type PlayerSettingsResponseData,
} from "@routes/types";
```

to:

```ts
export {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
  type ErrorCode,
  CreateSessionRequest,
  type CreateSessionRequestInput,
  type CreateSessionResponseData,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  // fallow-ignore-next-line unused-type -- two-barrel Worker/browser convention (03-Shared-Conventions.md); kept for a future browser consumer of PATCH session status
  type UpdateSessionRequestInput,
  type SessionActiveData,
  type ConfigurationPresetData,
  UpdatePlayerSettingsRequest,
  type UpdatePlayerSettingsInput,
  type PlayerSettingsResponseData,
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
} from "@routes/types";
```

- [ ] **Step 2: Write the failing client tests**

Create `app/tests/lib/client/api/profile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchProfile,
  saveProfile,
  ProfileApiError,
} from "@client/api/profile";

describe("fetchProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed profile on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        displayName: "The Power",
        dartsDescription: "Winmau Pro-Series 23g",
        dartsWeightGrams: 23,
      },
    });
    const result = await fetchProfile();
    expect(result.displayName).toBe("The Power");
    expect(apiRequest).toHaveBeenCalledWith("/api/players/me");
  });

  it("throws ProfileApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchProfile()).rejects.toBeInstanceOf(ProfileApiError);
  });
});

describe("saveProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("PATCHes the new profile and returns the stored result", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: null,
      },
    });
    const result = await saveProfile({
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    });
    expect(result.displayName).toBe("Levi");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/players/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Levi",
          dartsDescription: null,
          dartsWeightGrams: null,
        }),
      }),
    );
  });

  it("throws ProfileApiError with the server's error code on a failed request", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "VALIDATION_FAILED",
        message: "invalid profile",
        retryable: false,
      },
    });
    await expect(
      saveProfile({
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: 23,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/client/api/profile.test.ts
```

Expected: FAIL — `app/src/lib/client/api/profile.ts` does not exist yet.

- [ ] **Step 4: Implement the client module**

Create `app/src/lib/client/api/profile.ts`:

```ts
import { apiRequest } from "./client";
import {
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
} from "./types";

export class ProfileApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProfileApiError";
  }
}

export async function fetchProfile(): Promise<PlayerProfileResponseData> {
  const result = await apiRequest<PlayerProfileResponseData>(
    "/api/players/me",
  );
  if (!result.ok)
    throw new ProfileApiError(result.error.code, result.error.message);
  return result.data;
}

export async function saveProfile(
  next: UpdatePlayerProfileInput,
): Promise<PlayerProfileResponseData> {
  const payload = UpdatePlayerProfileRequest.parse(next);
  const result = await apiRequest<PlayerProfileResponseData>(
    "/api/players/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  if (!result.ok)
    throw new ProfileApiError(result.error.code, result.error.message);
  return result.data;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/client/api/profile.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/client/api/types.ts app/src/lib/client/api/profile.ts app/tests/lib/client/api/profile.test.ts
git commit -m "Add profile client API module"
```

---

### Task 6: Alpine store

**Files:**
- Create: `app/src/stores/profile.store.ts`
- Modify: `app/src/lib/client/alpine/register-stores.ts`
- Test: `app/tests/stores/profile.store.test.ts`

**Interfaces:**
- Consumes: `fetchProfile`, `saveProfile` (Task 5).
- Produces: `profileStore()` returning `{ displayName: string; dartsDescription: string | null; dartsWeightGrams: number | null; loading: boolean; error: string | null; init(): Promise<void>; load(): Promise<void>; save(): Promise<void> }`; registered as `Alpine.store("profile", profileStore())`.

- [ ] **Step 1: Write the failing store tests**

Create `app/tests/stores/profile.store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProfile = vi.fn();
const saveProfile = vi.fn();

vi.mock("@client/api/profile", () => ({
  fetchProfile: () => fetchProfile(),
  saveProfile: (next: unknown) => saveProfile(next),
}));

const { profileStore } = await import("@stores/profile.store");

beforeEach(() => {
  fetchProfile.mockReset();
  saveProfile.mockReset();
});

describe("profileStore", () => {
  it("loads the stored profile", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("The Power");
    expect(store.dartsDescription).toBe("Winmau Pro-Series 23g");
    expect(store.dartsWeightGrams).toBe(23);
    expect(store.loading).toBe(false);
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: null,
      dartsWeightGrams: null,
    });

    const store = profileStore();
    await store.init();

    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(store.displayName).toBe("The Power");
  });

  it("keeps the previous values when the load fails", async () => {
    fetchProfile.mockRejectedValue(new Error("offline"));

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("");
    expect(store.error).not.toBeNull();
  });

  it("saves the current fields and adopts the stored result", async () => {
    saveProfile.mockResolvedValue({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    store.displayName = "Levi";
    store.dartsDescription = "Target Agora 23g";
    store.dartsWeightGrams = 23;
    await store.save();

    expect(saveProfile).toHaveBeenCalledWith({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });
    expect(store.displayName).toBe("Levi");
  });

  it("leaves the previous values in place when the save fails", async () => {
    saveProfile.mockRejectedValue(new Error("rejected"));

    const store = profileStore();
    store.displayName = "Levi";
    await store.save();

    expect(store.displayName).toBe("Levi");
    expect(store.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/stores/profile.store.test.ts
```

Expected: FAIL — `app/src/stores/profile.store.ts` does not exist yet.

- [ ] **Step 3: Implement the store**

Create `app/src/stores/profile.store.ts`:

```ts
import { fetchProfile, saveProfile } from "@client/api/profile";

/**
 * The player's display name and darts equipment. Empty/null until a load
 * succeeds, so a failed or slow call leaves the form blank rather than
 * showing a stale or wrong value.
 *
 * Registered through `Alpine.store("profile", profileStore())`, so Alpine
 * calls `init()` once its interceptors resolve — that is the sanctioned
 * hydration hook, `x-init` being forbidden repo-wide.
 */
export function profileStore() {
  return {
    displayName: "",
    dartsDescription: null as string | null,
    dartsWeightGrams: null as number | null,
    loading: false,
    error: null as string | null,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const profile = await fetchProfile();
        this.displayName = profile.displayName;
        this.dartsDescription = profile.dartsDescription;
        this.dartsWeightGrams = profile.dartsWeightGrams;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },

    async save() {
      this.loading = true;
      this.error = null;
      try {
        const profile = await saveProfile({
          displayName: this.displayName,
          dartsDescription: this.dartsDescription,
          dartsWeightGrams: this.dartsWeightGrams,
        });
        this.displayName = profile.displayName;
        this.dartsDescription = profile.dartsDescription;
        this.dartsWeightGrams = profile.dartsWeightGrams;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "save failed";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/stores/profile.store.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Register the store**

Replace the full contents of `app/src/lib/client/alpine/register-stores.ts` with:

```ts
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { authStore } from "@stores/auth.store";
import { boardInputStore } from "@stores/board-input.store";
import { gameStore } from "@stores/game.store";
import { profileStore } from "@stores/profile.store";
import { settingsStore } from "@stores/settings.store";

export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  Alpine.store("settings", settingsStore());
  Alpine.store("profile", profileStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("boardInput", boardInputStore(persist));
}
```

- [ ] **Step 6: Commit**

```bash
git add app/src/stores/profile.store.ts app/src/lib/client/alpine/register-stores.ts app/tests/stores/profile.store.test.ts
git commit -m "Add profile Alpine store"
```

---

### Task 7: Profile page components

**Files:**
- Create: `app/src/components/forms/DisplayNameForm.astro`
- Create: `app/src/components/forms/DartsConfigForm.astro`
- Modify: `app/src/pages/profile/index.astro`

**Interfaces:**
- Consumes: `$store.profile.*` (Task 6); `InfoSection` (`@components/ui/InfoSection.astro`), `Input`/`Button` (`@components/forms/*`); `cn` (`@client/cn`).
- Produces: two new profile-page sections.

No unit test for this task — `.astro` markup/branching logic is not unit-tested in this project (D101, `app/CLAUDE.md`).

- [ ] **Step 1: Create the display name form**

Create `app/src/components/forms/DisplayNameForm.astro`:

```astro
---
/**
 * Display name editor. Reads/writes `$store.profile.displayName`; Save
 * PATCHes the full profile (darts fields travel along unchanged), the same
 * "replace, no partial update" contract `/api/players/me/settings` uses.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp, ...props }: Props = Astro.props;

// Components
import InfoSection from "@components/ui/InfoSection.astro";
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("space-y-4", classNameProp);
---

<section
  class={className}
  aria-labelledby="display-name-heading"
  {...props}
>
  <InfoSection
    id="display-name-heading"
    title="Display name"
    description="Your nickname, shown in place of your account name. For example Levi or The Power."
  />

  <form
    class="flex items-end gap-2"
    @submit.prevent="$store.profile.save()"
  >
    <div class="flex-1">
      <label
        for="displayName"
        class="sr-only"
      >
        Display name
      </label>
      <Input
        id="displayName"
        name="displayName"
        type="text"
        placeholder="Display name"
        required
        x-model="$store.profile.displayName"
        :disabled="$store.profile.loading"
      />
    </div>
    <Button
      type="submit"
      :disabled="$store.profile.loading"
      loadingExpr="$store.profile.loading"
    >
      Save
    </Button>
  </form>

  <p
    class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.profile.error"
    x-text="$store.profile.error"
    x-cloak
  >
  </p>
</section>
```

- [ ] **Step 2: Create the darts config form**

Create `app/src/components/forms/DartsConfigForm.astro`:

```astro
---
/**
 * Darts equipment editor: free-text darts description and weight in grams.
 * Reads/writes `$store.profile.dartsDescription`/`dartsWeightGrams`; Save
 * PATCHes the full profile (display name travels along unchanged), the same
 * "replace, no partial update" contract `/api/players/me/settings` uses.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp, ...props }: Props = Astro.props;

// Components
import InfoSection from "@components/ui/InfoSection.astro";
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("space-y-4", classNameProp);
const labelClass = "text-xs text-muted-foreground px-4 py-0 italic";
---

<section
  class={className}
  aria-labelledby="darts-config-heading"
  {...props}
>
  <InfoSection
    id="darts-config-heading"
    title="Darts"
    description="The darts you play with and their weight, in grams."
  />

  <form
    class="space-y-3"
    @submit.prevent="$store.profile.save()"
  >
    <div>
      <label
        for="dartsDescription"
        class={labelClass}
      >
        Darts
      </label>
      <Input
        id="dartsDescription"
        name="dartsDescription"
        type="text"
        placeholder="e.g. Winmau Pro-Series 23g"
        x-model="$store.profile.dartsDescription"
        :disabled="$store.profile.loading"
      />
    </div>
    <div>
      <label
        for="dartsWeightGrams"
        class={labelClass}
      >
        Weight (g)
      </label>
      <Input
        id="dartsWeightGrams"
        name="dartsWeightGrams"
        type="text"
        inputmode="numeric"
        placeholder="Weight in grams"
        x-model.number="$store.profile.dartsWeightGrams"
        :disabled="$store.profile.loading"
      />
    </div>
    <Button
      type="submit"
      :disabled="$store.profile.loading"
      loadingExpr="$store.profile.loading"
    >
      Save
    </Button>
  </form>

  <p
    class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.profile.error"
    x-text="$store.profile.error"
    x-cloak
  >
  </p>
</section>
```

- [ ] **Step 3: Wire both forms into the profile page**

Replace the full contents of `app/src/pages/profile/index.astro` with:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import AppModeForm from "@components/forms/AppModeForm.astro";
import HandednessForm from "@components/forms/HandednessForm.astro";
import DisplayNameForm from "@components/forms/DisplayNameForm.astro";
import DartsConfigForm from "@components/forms/DartsConfigForm.astro";
---

<AppLayout title="Profile">
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-semibold text-foreground">Profile</h1>
    <DisplayNameForm />
    <AppModeForm />
    <HandednessForm />
    <DartsConfigForm />
  </div>
</AppLayout>
```

- [ ] **Step 4: Format and typecheck**

```bash
cd app && npm run format && npx astro check
```

Expected: format makes no further changes (or auto-fixes are re-added to the commit below); `astro check` reports 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/forms/DisplayNameForm.astro app/src/components/forms/DartsConfigForm.astro app/src/pages/profile/index.astro
git commit -m "Add display name and darts config forms to the profile page"
```

---

### Task 8: Full validation, context maintenance, push

**Files:** none new — validation and doc-maintenance pass over everything Tasks 1-7 touched.

- [ ] **Step 1: Run the full test suite**

```bash
cd app && npm test
```

Expected: PASS, full suite green, no regressions.

- [ ] **Step 2: Run the repo's structural gates and app validation**

Invoke the `run-all-gates` skill (dispatches the right `check-*.sh` scripts and the `validate:app` checklist for files changed under `app/`, `database/`, `docs/`). Resolve anything it reports red.

If `run-all-gates` is unavailable in the executing session, run manually:

```bash
cd app && npm run validate:app
cd .. && bash scripts/check-file-locations.sh && bash scripts/check-agent-mirrors.sh \
  && bash scripts/check-astro-class-composition.sh && bash scripts/check-astro-conventions.sh \
  && bash scripts/check-game-engines.sh && bash scripts/check-refinement-coverage.sh \
  && bash scripts/check-type-barrels.sh && bash scripts/check-alias-sync.sh \
  && bash scripts/check-constraint-mirror.sh && bash scripts/check-no-inline-comments.sh \
  && bash scripts/check-style-tokens.sh && bash scripts/check-context-map.sh \
  && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh
```

`npm run validate:app`'s `db:status`/`db:migrate`/`db:introspect` steps and the `database/verification/0022_player_profile_checks.sql` script cannot run in this container (no `DATABASE_URL`, D193) — flag this explicitly rather than claiming they ran; note it for the operator to run against the real Neon database before merge (same as every other verification script in this repo).

- [ ] **Step 3: Format check**

```bash
cd app && npm run format:check
```

Expected: clean. If not, run `npm run format`, review the diff, and fold it into the affected task's commit (or a small follow-up commit here).

- [ ] **Step 4: Context maintenance**

Invoke the `context-maintenance` skill. It registers the new/changed files (migration `0022`, verification script, `v_player_profile`, repository/service/route/client/store/component additions) in `docs/architecture/00-Context-Map.md`'s File Inventory and version changelog, confirms `CLAUDE.md`/`AGENT.md` mirrors are unaffected, and judges whether a `decisions/**` entry is warranted (this branch mechanically extends the already-established `players`/`player_settings` read-model and replace-on-PATCH patterns — likely no new decision, but let the skill's own gate decide).

- [ ] **Step 5: Manual browser smoke test (best-effort)**

```bash
cd app && astro dev --background
```

Visit `/profile`, confirm the display name and darts/weight cards render, and that Save round-trips. This requires a real Neon `DATABASE_URL`/JWT session — if this container has neither (per the established D193 precedent seen throughout this repo's history), flag that the manual smoke test could not run here rather than claiming it passed.

- [ ] **Step 6: Commit any remaining doc/gate fixes and push**

```bash
git add -A
git status
git commit -m "Context maintenance for profile display name + darts config"
git push -u origin claude/profile-display-darts-config-cn8jdo
```

(Skip the commit if `git status` shows nothing to add — every substantive change was already committed per-task.)
