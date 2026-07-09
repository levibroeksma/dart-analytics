# Validation Blockers Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock `npm run validate:app` by converting all 12 SQL migrations to dbmate format and clearing fallow violations.

**Architecture:** Migration SQL in `architecture/docs/database/migrations/` remains schema source of truth; files gain `-- migrate:up` / `-- migrate:down` markers and lose explicit `BEGIN`/`COMMIT` (dbmate wraps each section). Fallow passes via component fixes plus `app/.fallowrc.jsonc` entry points and targeted ignores for generated schema.

**Tech Stack:** dbmate, PostgreSQL (Neon dev branch), Drizzle Kit (introspect), fallow, Astro.

**Worktree:** `/Users/levi/Development/dart-analytics/.worktrees/neon-db-integration`

**Spec:** `docs/superpowers/specs/2026-07-09-validation-blockers-design.md`

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `architecture/docs/database/migrations/0001–0012.sql` | Schema migrations in dbmate format |
| `architecture/docs/architecture/05-Database/03-Migrations.md` | dbmate format spec + revised atomicity guidance |
| `architecture/docs/architecture/05-Database/11-Neon-Integration.md` | Cross-reference dbmate markers in workflow |
| `architecture/docs/database/README.md` | Note dbmate marker requirement |
| `app/src/layouts/BaseLayout.astro` | Accept optional `title` prop override |
| `app/src/layouts/AppLayout.astro` | Pass `title` to `BaseLayout`; remove unused props |
| `app/src/components/layout/NavBtn.astro` | Use optional `class` prop |
| `app/src/components/ui/Btn.astro` | Delete (empty, unused) |
| `app/.fallowrc.jsonc` | Entry points + dependency/duplicate ignores |

---

## Prerequisite Check

- [ ] **Step 1: Confirm worktree and env**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
git branch --show-current
test -f .env && grep -q DATABASE_URL_POOLED .env && echo "env ok"
```

Expected: branch `neon-db-integration-sdd` (or equivalent); `.env` contains `DATABASE_URL_POOLED`.

- [ ] **Step 2: Confirm migrate currently fails (baseline)**

```bash
npm run db:migrate 2>&1 | head -5
```

Expected: error containing `requires each migration to define an up block with '-- migrate:up'`.

---

### Task 1: Convert Migrations 0001–0004

**Files:**
- Modify: `architecture/docs/database/migrations/0001_extensions.sql`
- Modify: `architecture/docs/database/migrations/0002_reference_tables.sql`
- Modify: `architecture/docs/database/migrations/0003_players.sql`
- Modify: `architecture/docs/database/migrations/0004_templates.sql`

**Conversion rule (all tasks):**
1. Keep header comments unchanged.
2. Delete `BEGIN;` and `COMMIT;`.
3. Insert `-- migrate:up` immediately before the first DDL statement.
4. Append `-- migrate:down` section with structural reverse DDL below.

- [ ] **Step 1: Replace `0001_extensions.sql` entirely**

```sql
-- ============================================================
-- Migration: 0001_extensions.sql
--
-- Purpose:
-- Enable PostgreSQL extensions required by the application.
--
-- UUID generation happens in the application layer.
-- IDs are generated using UUIDv7 before persistence.
--
-- ============================================================

-- migrate:up
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- migrate:down
DROP EXTENSION IF EXISTS pg_stat_statements;
```

- [ ] **Step 2: Convert `0002_reference_tables.sql`**

Keep all existing `CREATE TABLE` / `COMMENT` statements between header and former `COMMIT`. Remove `BEGIN;` / `COMMIT;`. Add markers:

```sql
-- migrate:up
<all existing CREATE TABLE and COMMENT statements, unchanged>

-- migrate:down
DROP TABLE IF EXISTS game_type_features;
DROP TABLE IF EXISTS ruleset_versions;
DROP TABLE IF EXISTS game_types;
DROP TABLE IF EXISTS game_features;
DROP TABLE IF EXISTS game_statuses;
DROP TABLE IF EXISTS capture_modes;
DROP TABLE IF EXISTS input_modes;
DROP TABLE IF EXISTS duration_types;
DROP TABLE IF EXISTS participant_types;
DROP TABLE IF EXISTS dart_zones;
```

- [ ] **Step 3: Convert `0003_players.sql`**

```sql
-- migrate:up
<all existing CREATE TABLE and COMMENT statements for players and player_settings, unchanged>

-- migrate:down
DROP TABLE IF EXISTS player_settings;
DROP TABLE IF EXISTS players;
```

- [ ] **Step 4: Convert `0004_templates.sql`**

```sql
-- migrate:up
<all existing CREATE TABLE and COMMENT statements, unchanged>

-- migrate:down
DROP TABLE IF EXISTS routine_steps;
DROP TABLE IF EXISTS routine_templates;
DROP TABLE IF EXISTS exercise_templates;
```

- [ ] **Step 5: Verify dbmate accepts format (dry parse)**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npm run db:status 2>&1 | head -20
```

Expected: lists migrations (no format error). May show pending/applied depending on DB state.

- [ ] **Step 6: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add architecture/docs/database/migrations/0001_extensions.sql \
        architecture/docs/database/migrations/0002_reference_tables.sql \
        architecture/docs/database/migrations/0003_players.sql \
        architecture/docs/database/migrations/0004_templates.sql
git commit -m "fix(db): convert migrations 0001-0004 to dbmate format"
```

---

### Task 2: Convert Migrations 0005–0008

**Files:**
- Modify: `architecture/docs/database/migrations/0005_runtime_core.sql`
- Modify: `architecture/docs/database/migrations/0006_runtime_events.sql`
- Modify: `architecture/docs/database/migrations/0007_constraints.sql`
- Modify: `architecture/docs/database/migrations/0008_indexes.sql`

- [ ] **Step 1: Convert `0005_runtime_core.sql`**

```sql
-- migrate:up
<all existing CREATE TABLE and COMMENT statements, unchanged>

-- migrate:down
DROP TABLE IF EXISTS exercise_stages;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS exercise_configurations;
DROP TABLE IF EXISTS exercise_sessions;
DROP TABLE IF EXISTS activities;
```

- [ ] **Step 2: Convert `0006_runtime_events.sql`**

```sql
-- migrate:up
<all existing CREATE TABLE statements for turns and darts, unchanged>

-- migrate:down
DROP TABLE IF EXISTS darts;
DROP TABLE IF EXISTS turns;
```

- [ ] **Step 3: Replace `0007_constraints.sql` entirely**

```sql
-- ============================================================
-- Migration: 0007_constraints.sql
--
-- Purpose:
-- Add database integrity constraints.
--
-- This migration protects domain rules that cannot
-- be guaranteed by table structure alone.
--
-- ============================================================

-- migrate:up
ALTER TABLE game_types
ADD CONSTRAINT chk_game_types_implementation_key_not_empty CHECK (length(trim(implementation_key)) > 0);

ALTER TABLE game_types
ADD CONSTRAINT chk_game_types_name_not_empty CHECK (length(trim(name)) > 0);

ALTER TABLE game_features
ADD CONSTRAINT chk_game_features_key_not_empty CHECK (length(trim(implementation_key)) > 0);

ALTER TABLE game_type_features
ADD CONSTRAINT uq_game_type_feature UNIQUE (game_type_id, game_feature_id);

ALTER TABLE ruleset_versions
ADD CONSTRAINT chk_ruleset_version_positive CHECK (version_number > 0);

ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (
        display_name IS NULL
        OR length(trim(display_name)) > 0
    );

ALTER TABLE activities
ADD CONSTRAINT chk_activity_completed_after_start CHECK (
        completed_at IS NULL
        OR completed_at >= started_at
    );

ALTER TABLE exercise_sessions
ADD CONSTRAINT chk_session_completed_after_start CHECK (
        completed_at IS NULL
        OR completed_at >= started_at
    );

ALTER TABLE exercise_configurations
ADD CONSTRAINT chk_configuration_not_empty CHECK (jsonb_typeof(configuration) = 'object');

ALTER TABLE participants
ADD CONSTRAINT chk_participant_identity CHECK (
        player_id IS NOT NULL
        OR display_name IS NOT NULL
    );

ALTER TABLE exercise_stages
ADD CONSTRAINT chk_stage_sequence_positive CHECK (sequence_number > 0);

ALTER TABLE exercise_stages
ADD CONSTRAINT chk_stage_not_self_parent CHECK (
        parent_stage_id IS NULL
        OR parent_stage_id <> id
    );

ALTER TABLE routine_steps
ADD CONSTRAINT chk_routine_step_sequence_positive CHECK (sequence_number > 0);

ALTER TABLE routine_steps
ADD CONSTRAINT chk_routine_duration_positive CHECK (duration_value > 0);

ALTER TABLE turns
ADD CONSTRAINT chk_turn_sequence_positive CHECK (sequence_number > 0);

ALTER TABLE turns
ADD CONSTRAINT chk_turn_completed_after_created CHECK (
        completed_at IS NULL
        OR completed_at >= created_at
    );

ALTER TABLE darts
ADD CONSTRAINT chk_dart_number_positive CHECK (dart_number > 0);

ALTER TABLE darts
ADD CONSTRAINT chk_dart_score_positive CHECK (score >= 0);

ALTER TABLE darts
ADD CONSTRAINT chk_dart_target_consistency CHECK (
        (
            intended_zone_id IS NULL
            AND intended_target_number IS NULL
        )
        OR (intended_zone_id IS NOT NULL)
    );

ALTER TABLE darts
ADD CONSTRAINT chk_hit_consistency CHECK (
        (
            hit_zone_id IS NULL
            AND hit_target_number IS NULL
        )
        OR (hit_zone_id IS NOT NULL)
    );

-- migrate:down
ALTER TABLE darts DROP CONSTRAINT IF EXISTS chk_hit_consistency;
ALTER TABLE darts DROP CONSTRAINT IF EXISTS chk_dart_target_consistency;
ALTER TABLE darts DROP CONSTRAINT IF EXISTS chk_dart_score_positive;
ALTER TABLE darts DROP CONSTRAINT IF EXISTS chk_dart_number_positive;
ALTER TABLE turns DROP CONSTRAINT IF EXISTS chk_turn_completed_after_created;
ALTER TABLE turns DROP CONSTRAINT IF EXISTS chk_turn_sequence_positive;
ALTER TABLE routine_steps DROP CONSTRAINT IF EXISTS chk_routine_duration_positive;
ALTER TABLE routine_steps DROP CONSTRAINT IF EXISTS chk_routine_step_sequence_positive;
ALTER TABLE exercise_stages DROP CONSTRAINT IF EXISTS chk_stage_not_self_parent;
ALTER TABLE exercise_stages DROP CONSTRAINT IF EXISTS chk_stage_sequence_positive;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS chk_participant_identity;
ALTER TABLE exercise_configurations DROP CONSTRAINT IF EXISTS chk_configuration_not_empty;
ALTER TABLE exercise_sessions DROP CONSTRAINT IF EXISTS chk_session_completed_after_start;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activity_completed_after_start;
ALTER TABLE players DROP CONSTRAINT IF EXISTS chk_players_display_name_not_empty;
ALTER TABLE ruleset_versions DROP CONSTRAINT IF EXISTS chk_ruleset_version_positive;
ALTER TABLE game_type_features DROP CONSTRAINT IF EXISTS uq_game_type_feature;
ALTER TABLE game_features DROP CONSTRAINT IF EXISTS chk_game_features_key_not_empty;
ALTER TABLE game_types DROP CONSTRAINT IF EXISTS chk_game_types_name_not_empty;
ALTER TABLE game_types DROP CONSTRAINT IF EXISTS chk_game_types_implementation_key_not_empty;
```

- [ ] **Step 4: Replace `0008_indexes.sql` entirely**

```sql
-- ============================================================
-- Migration: 0008_indexes.sql
--
-- Purpose:
-- Add performance indexes based on application
-- query patterns.
--
-- Index strategy:
-- - optimize reads
-- - avoid unnecessary write overhead
-- - support analytical queries
--
-- ============================================================

-- migrate:up
CREATE INDEX idx_game_types_published ON game_types (is_published)
WHERE is_published = TRUE;
CREATE INDEX idx_game_type_features_game_type ON game_type_features (game_type_id);
CREATE INDEX idx_routine_steps_template_sequence ON routine_steps (routine_template_id, sequence_number);
CREATE INDEX idx_exercise_templates_game_type ON exercise_templates (game_type_id);
CREATE INDEX idx_activities_player_status ON activities (player_id, status_id);
CREATE INDEX idx_sessions_player_created ON exercise_sessions (player_id, created_at DESC);
CREATE INDEX idx_sessions_player_completed ON exercise_sessions (player_id, completed_at DESC)
WHERE completed_at IS NOT NULL;
CREATE INDEX idx_sessions_active ON exercise_sessions (player_id, status_id)
WHERE completed_at IS NULL;
CREATE INDEX idx_sessions_activity ON exercise_sessions (activity_id);
CREATE INDEX idx_configuration_session ON exercise_configurations (exercise_session_id);
CREATE INDEX idx_participants_session ON participants (exercise_session_id);
CREATE INDEX idx_stages_session_sequence ON exercise_stages (exercise_session_id, sequence_number);
CREATE INDEX idx_stages_parent ON exercise_stages (parent_stage_id);
CREATE INDEX idx_turns_stage_sequence ON turns (exercise_stage_id, sequence_number);
CREATE INDEX idx_turns_participant ON turns (participant_id);
CREATE INDEX idx_darts_turn_number ON darts (turn_id, dart_number);
CREATE INDEX idx_darts_intended_target ON darts (
    intended_target_number,
    intended_zone_id
);
CREATE INDEX idx_darts_hit_target ON darts (hit_target_number, hit_zone_id);
CREATE INDEX idx_darts_zone_accuracy ON darts (intended_zone_id, hit_zone_id);

-- migrate:down
DROP INDEX IF EXISTS idx_darts_zone_accuracy;
DROP INDEX IF EXISTS idx_darts_hit_target;
DROP INDEX IF EXISTS idx_darts_intended_target;
DROP INDEX IF EXISTS idx_darts_turn_number;
DROP INDEX IF EXISTS idx_turns_participant;
DROP INDEX IF EXISTS idx_turns_stage_sequence;
DROP INDEX IF EXISTS idx_stages_parent;
DROP INDEX IF EXISTS idx_stages_session_sequence;
DROP INDEX IF EXISTS idx_participants_session;
DROP INDEX IF EXISTS idx_configuration_session;
DROP INDEX IF EXISTS idx_sessions_activity;
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_sessions_player_completed;
DROP INDEX IF EXISTS idx_sessions_player_created;
DROP INDEX IF EXISTS idx_activities_player_status;
DROP INDEX IF EXISTS idx_exercise_templates_game_type;
DROP INDEX IF EXISTS idx_routine_steps_template_sequence;
DROP INDEX IF EXISTS idx_game_type_features_game_type;
DROP INDEX IF EXISTS idx_game_types_published;
```

- [ ] **Step 5: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add architecture/docs/database/migrations/0005_runtime_core.sql \
        architecture/docs/database/migrations/0006_runtime_events.sql \
        architecture/docs/database/migrations/0007_constraints.sql \
        architecture/docs/database/migrations/0008_indexes.sql
git commit -m "fix(db): convert migrations 0005-0008 to dbmate format"
```

---

### Task 3: Convert Migrations 0009–0012

**Files:**
- Modify: `architecture/docs/database/migrations/0009_views.sql`
- Modify: `architecture/docs/database/migrations/0010_configuration_templates.sql`
- Modify: `architecture/docs/database/migrations/0011_ordering_and_uniqueness.sql`
- Modify: `architecture/docs/database/migrations/0012_session_write_idempotency.sql`

- [ ] **Step 1: Convert `0009_views.sql`**

Keep all five `CREATE VIEW` and `COMMENT ON VIEW` statements in `-- migrate:up`. Add down:

```sql
-- migrate:down
DROP VIEW IF EXISTS v_routine_execution;
DROP VIEW IF EXISTS v_dart_analytics;
DROP VIEW IF EXISTS v_game_replay;
DROP VIEW IF EXISTS v_session_overview;
DROP VIEW IF EXISTS v_active_sessions;
```

- [ ] **Step 2: Convert `0010_configuration_templates.sql`**

```sql
-- migrate:up
<all existing CREATE TABLE, COMMENT, and CREATE INDEX statements, unchanged>

-- migrate:down
DROP TABLE IF EXISTS configuration_templates;
```

- [ ] **Step 3: Replace `0011_ordering_and_uniqueness.sql` entirely**

```sql
-- ============================================================
-- Migration: 0011_ordering_and_uniqueness.sql
--
-- Purpose:
-- Enforce ordering uniqueness and the single-active-session
-- rule that were previously application-enforced only.
--
-- These constraints protect event ordering integrity:
-- replay depends on unambiguous sequence numbers.
--
-- ============================================================

-- migrate:up
ALTER TABLE routine_steps
ADD CONSTRAINT uq_routine_steps_sequence UNIQUE (routine_template_id, sequence_number);

CREATE UNIQUE INDEX uq_stages_sibling_sequence ON exercise_stages (
    exercise_session_id,
    parent_stage_id,
    sequence_number
)
WHERE parent_stage_id IS NOT NULL;

CREATE UNIQUE INDEX uq_stages_root_sequence ON exercise_stages (exercise_session_id, sequence_number)
WHERE parent_stage_id IS NULL;

ALTER TABLE turns
ADD CONSTRAINT uq_turns_stage_participant_sequence UNIQUE (
        exercise_stage_id,
        participant_id,
        sequence_number
    );

ALTER TABLE darts
ADD CONSTRAINT uq_darts_turn_number UNIQUE (turn_id, dart_number);

CREATE UNIQUE INDEX uq_sessions_single_active ON exercise_sessions (player_id, game_type_id)
WHERE completed_at IS NULL;

DROP INDEX IF EXISTS idx_routine_steps_template_sequence;
DROP INDEX IF EXISTS idx_darts_turn_number;

-- migrate:down
CREATE INDEX idx_routine_steps_template_sequence ON routine_steps (routine_template_id, sequence_number);
CREATE INDEX idx_darts_turn_number ON darts (turn_id, dart_number);

DROP INDEX IF EXISTS uq_sessions_single_active;
ALTER TABLE darts DROP CONSTRAINT IF EXISTS uq_darts_turn_number;
ALTER TABLE turns DROP CONSTRAINT IF EXISTS uq_turns_stage_participant_sequence;
DROP INDEX IF EXISTS uq_stages_root_sequence;
DROP INDEX IF EXISTS uq_stages_sibling_sequence;
ALTER TABLE routine_steps DROP CONSTRAINT IF EXISTS uq_routine_steps_sequence;
```

- [ ] **Step 4: Convert `0012_session_write_idempotency.sql`**

```sql
-- migrate:up
CREATE TABLE session_write_idempotency (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    normalized_payload_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_session_write_idempotency_session
        FOREIGN KEY (session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_session_write_idempotency_session_key
        UNIQUE (session_id, idempotency_key),

    CONSTRAINT chk_session_write_idempotency_result_is_object
        CHECK (jsonb_typeof(result) = 'object'
        )
);

COMMENT ON TABLE session_write_idempotency IS
    'Stores batch-write idempotency results for POST /api/sessions/:sessionId/events:batch.';

-- migrate:down
DROP TABLE IF EXISTS session_write_idempotency;
```

- [ ] **Step 5: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add architecture/docs/database/migrations/0009_views.sql \
        architecture/docs/database/migrations/0010_configuration_templates.sql \
        architecture/docs/database/migrations/0011_ordering_and_uniqueness.sql \
        architecture/docs/database/migrations/0012_session_write_idempotency.sql
git commit -m "fix(db): convert migrations 0009-0012 to dbmate format"
```

---

### Task 4: Verify Migrations End-to-End

**Files:**
- Test: terminal commands only

- [ ] **Step 1: Apply full migration chain**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npm run db:status
npm run db:migrate
```

Expected: `db:status` shows 12 applied; `db:migrate` exits 0 with no pending migrations.

- [ ] **Step 2: Smoke-test rollback and re-apply**

```bash
npm run db:rollback
npm run db:migrate
```

Expected: both exit 0; `0012_session_write_idempotency` rolls back and re-applies.

- [ ] **Step 3: Seed and introspect**

```bash
npm run db:seed
cp src/db/schema.ts /tmp/schema-before.ts
npm run db:introspect
diff -q /tmp/schema-before.ts src/db/schema.ts || echo "schema drift — review diff"
```

Expected: `db:seed` exits 0; `diff` reports no difference (or only whitespace).

- [ ] **Step 4: Commit introspect output if drifted**

Only if `diff` found meaningful changes:

```bash
git add src/db/schema.ts src/db/meta/
git commit -m "chore(db): refresh introspected schema after dbmate migrate"
```

---

### Task 5: Update Migration Documentation

**Files:**
- Modify: `architecture/docs/architecture/05-Database/03-Migrations.md`
- Modify: `architecture/docs/architecture/05-Database/11-Neon-Integration.md`
- Modify: `architecture/docs/database/README.md`

- [ ] **Step 1: Add dbmate format section to `03-Migrations.md`**

Insert after the `# Migration Structure` section (after the directory tree block):

```markdown
---

# dbmate Format

Migration files executed by `dbmate` must use section markers:

```sql
-- migrate:up
-- DDL statements (no explicit BEGIN/COMMIT)

-- migrate:down
-- structural reverse DDL
```

Rules:

- Every migration requires both `-- migrate:up` and `-- migrate:down`.
- Down blocks reverse structural DDL only (DROP TABLE/VIEW/INDEX/CONSTRAINT).
- Do not wrap sections in `BEGIN`/`COMMIT` — dbmate runs each section in a transaction.
- Header comments and inline documentation are preserved above the markers.

Example:

```sql
-- ============================================================
-- Migration: 0001_extensions.sql
-- ============================================================

-- migrate:up
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- migrate:down
DROP EXTENSION IF EXISTS pg_stat_statements;
```
```

- [ ] **Step 2: Replace `# Migration Atomicity` section in `03-Migrations.md`**

Replace the existing section with:

```markdown
# Migration Atomicity

dbmate wraps each `-- migrate:up` and `-- migrate:down` section in a transaction automatically.

Authors should **not** add explicit `BEGIN`/`COMMIT` inside migration files.

PostgreSQL supports transactional DDL, so a failed migration rolls back cleanly.

If a migration fails:

- changes should rollback
- database should remain consistent
```

- [ ] **Step 3: Update `11-Neon-Integration.md` Migration Workflow section**

After the line `Migrations remain in architecture/docs/database/migrations/ (0001–0012).` add:

```markdown
Migration files must use dbmate section markers (`-- migrate:up` / `-- migrate:down`). See [`03-Migrations.md`](03-Migrations.md#dbmate-format).
```

- [ ] **Step 4: Update `architecture/docs/database/README.md`**

After `- Migrations are applied with dbmate.` add:

```markdown
- Migration files must include `-- migrate:up` and `-- migrate:down` markers (see `03-Migrations.md`).
```

- [ ] **Step 5: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add architecture/docs/architecture/05-Database/03-Migrations.md \
        architecture/docs/architecture/05-Database/11-Neon-Integration.md \
        architecture/docs/database/README.md
git commit -m "docs(db): document dbmate migration format requirements"
```

---

### Task 6: Fallow Component Fixes

**Files:**
- Modify: `app/src/layouts/BaseLayout.astro`
- Modify: `app/src/layouts/AppLayout.astro`
- Modify: `app/src/components/layout/NavBtn.astro`
- Delete: `app/src/components/ui/Btn.astro`

- [ ] **Step 1: Update `BaseLayout.astro` frontmatter**

Replace the top of the file through `const title = ...` with:

```astro
---
import "@styles/global.css";

interface Props {
  title?: string;
}

const { title: titleProp } = Astro.props;
const url = Astro.url;

const title =
  titleProp ??
  (url.pathname === "/"
    ? "Dart Counter"
    : `${url.pathname.slice(1)} - Dart Counter`);
---
```

- [ ] **Step 2: Update `AppLayout.astro` entirely**

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import BottomNav from "@components/layout/BottomNav.astro";

interface Props {
  title?: string;
}

const { title } = Astro.props;
---

<BaseLayout title={title}>
  <div class="flex h-full min-h-0 flex-1 touch-manipulation flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <slot />
    </div>
    <BottomNav />
  </div>
</BaseLayout>
```

- [ ] **Step 3: Update `NavBtn.astro` prop usage**

Change line 9 from:

```astro
const { href, matchPrefix}: Props = Astro.props;
```

to:

```astro
const { href, matchPrefix, class: classNameProp }: Props = Astro.props;
```

Change the `className` assignment (lines 18-20) to:

```astro
const className = [
  baseClassName,
  active ? "text-primary" : "nav-link-inactive",
  classNameProp,
]
  .filter(Boolean)
  .join(" ");
```

- [ ] **Step 4: Delete empty `Btn.astro`**

```bash
rm /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app/src/components/ui/Btn.astro
```

- [ ] **Step 5: Verify Astro types**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
astro check
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add app/src/layouts/BaseLayout.astro \
        app/src/layouts/AppLayout.astro \
        app/src/components/layout/NavBtn.astro
git rm app/src/components/ui/Btn.astro 2>/dev/null || git add -u app/src/components/ui/Btn.astro
git commit -m "fix(app): resolve fallow unused prop and dead file findings"
```

---

### Task 7: Add Fallow Configuration

**Files:**
- Create: `app/.fallowrc.jsonc`

- [ ] **Step 1: Create `app/.fallowrc.jsonc`**

```jsonc
{
  "$schema": "https://fallow.tools/schema/config.json",
  "entry": [
    "neon.ts",
    "astro.config.mjs",
    "scripts/seed.ts"
  ],
  "ignoreDependencies": [
    "@astrojs/alpinejs",
    "@astrojs/cloudflare",
    "@tailwindcss/vite"
  ],
  "duplicates": {
    "ignore": ["src/db/schema.ts"]
  }
}
```

- [ ] **Step 2: Run fallow**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npx fallow 2>&1 | tail -15
```

Expected: no `Failed: dead-code` or `Failed: dupes` line. Exit 0.

- [ ] **Step 3: If `postgres` still flagged, add production boundary**

If output still contains `Dev dependencies used in production` for `postgres`, append to `.fallowrc.jsonc`:

```jsonc
  "ignoreDependencies": [
    "@astrojs/alpinejs",
    "@astrojs/cloudflare",
    "@tailwindcss/vite",
    "postgres"
  ],
```

Re-run `npx fallow` until dead-code and dupe failures are gone.

- [ ] **Step 4: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration
git add app/.fallowrc.jsonc
git commit -m "chore(app): add fallow config for neon and generated schema"
```

---

### Task 8: Full Validation Gate

**Files:**
- Test: `npm run validate:app`

- [ ] **Step 1: Run full validation chain**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/neon-db-integration/app
npm run validate:app
```

Expected: entire chain exits 0:
- `db:status`
- `db:migrate`
- `db:introspect`
- `npx fallow`
- `astro check`

- [ ] **Step 2: Update spec status (optional, in main repo)**

In `docs/superpowers/specs/2026-07-09-validation-blockers-design.md`, change status line to:

```markdown
> **Status:** Implemented (2026-07-09)
```

Only if implementing from main repo docs path; skip if worktree does not contain that file.

- [ ] **Step 3: Final commit if spec status updated**

```bash
cd /Users/levi/Development/dart-analytics
git add docs/superpowers/specs/2026-07-09-validation-blockers-design.md
git commit -m "docs: mark validation blockers spec as implemented"
```

---

## Self-Review Checklist

| Spec requirement | Task |
| --- | --- |
| Convert 12 migrations to dbmate format | Tasks 1–3 |
| Structural down blocks | Tasks 1–3 (full SQL for 0001, 0007, 0008, 0011, 0012) |
| Remove BEGIN/COMMIT | Tasks 1–3 |
| Migration docs update | Task 5 |
| Fallow component fixes | Task 6 |
| `.fallowrc.jsonc` | Task 7 |
| `validate:app` green | Task 8 |
| Empty dev branch assumption | Task 4 Step 1 |

No placeholders. All high-risk migrations include complete file content.
