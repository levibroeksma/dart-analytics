# Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` — two migrations, one seed fix, and a coordinated doc-contract pass that resolves all pre-frontend architecture findings.

**Architecture:** SQL-first: migrations `0015` (constraint fixes) and `0016` (read-model rebuild + preset view) extend the dbmate chain without touching `0001`–`0014`. All other changes are targeted edits to canonical architecture docs, the decision ledger, and the context map, in the spec's implementation order.

**Tech Stack:** PostgreSQL (Neon) via dbmate SQL migrations; Markdown architecture docs; `scripts/check-context-map.sh` as the consistency gate.

## Global Constraints

- Never modify applied migrations `0001`–`0014` or seeds' identifiers; new schema changes are `0015` and `0016` only.
- Migration files use `-- migrate:up` / `-- migrate:down` markers and contain **no** `BEGIN`/`COMMIT` (dbmate wraps sections). Seeds keep explicit `BEGIN`/`COMMIT`.
- Docs get minimal targeted diffs — never regenerate a document. Historical docs (`05-Database/07`–`09`, `architecture/000_master_context.md`) are untouched.
- Every added/changed docs statement that the Context Maintenance protocol covers carries an ISO date `<!-- 2026-07-13 -->` (or `(2026-07-13)` in tables).
- Naming prefixes stay `v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`. DTOs are camelCase Zod sketches with `type X = z.infer<typeof X>`.
- Branch: `claude/architecture-review-frontend-a3ya86`. Commit at the end of every task. Do not push until the final task passes `scripts/check-context-map.sh`.
- Database validation (`npm run db:migrate` etc.) requires Neon credentials; when the environment has no `DATABASE_URL_POOLED`, the SQL verification steps below (grep/structure checks) are the in-session gate and the migrate run is deferred to the next environment that has credentials. Note this in the final commit message if skipped.
- Doc version bumps in this pass: `06-API/00` → 1.3.0, `03` → 1.3.0, `04` → 1.1.0, `01` → 1.0.1, `02` → 1.1.0, `07-Frontend/00` → 0.2.0, `05-Views` → 1.2.0, `01-Naming` → 1.3.0, `03-Migrations` → 1.5.0, `10-Agent-Guide` → 1.2.0, `04-Architecture-patterns` → 1.2.1, spec chapters keep their shared v2.2.0 but update their `updated:` front-matter to 2026-07-13 when edited.

---

### Task 1: Migration `0015_time_semantics_constraints.sql`

**Files:**
- Create: `architecture/docs/database/migrations/0015_time_semantics_constraints.sql`

**Interfaces:**
- Consumes: constraints `chk_turn_completed_after_created`, `chk_players_display_name_not_empty` as defined in `0007_constraints.sql`.
- Produces: a `turns` table accepting client-observed `completed_at` earlier than `created_at`; a `players.display_name` check without the dead NULL arm. Tasks 4 and 10a document these semantics.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Migration: 0015_time_semantics_constraints.sql
--
-- Purpose:
-- Align time-related constraints with the batch write model.
--
-- created_at is row persistence time (server clock) on every
-- table. Gameplay chronology comes from sequence numbers and
-- client-observed timestamps (turns.completed_at), never from
-- created_at. Under batch upload at session completion, a
-- turn's client-observed completed_at legitimately predates
-- the row insert, so chk_turn_completed_after_created must go.
--
-- Also replaces the players display-name check: the
-- "display_name IS NULL" arm was dead code against a
-- NOT NULL column.
-- ============================================================

-- migrate:up
ALTER TABLE turns
DROP CONSTRAINT chk_turn_completed_after_created;

ALTER TABLE players
DROP CONSTRAINT chk_players_display_name_not_empty;

ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (length(trim(display_name)) > 0);

-- migrate:down
ALTER TABLE players
DROP CONSTRAINT chk_players_display_name_not_empty;

ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (
        display_name IS NULL
        OR length(trim(display_name)) > 0
    );

ALTER TABLE turns
ADD CONSTRAINT chk_turn_completed_after_created CHECK (
        completed_at IS NULL
        OR completed_at >= created_at
    );
```

- [ ] **Step 2: Verify structure**

Run: `grep -c 'migrate:up\|migrate:down' architecture/docs/database/migrations/0015_time_semantics_constraints.sql && grep -c 'BEGIN\|COMMIT' architecture/docs/database/migrations/0015_time_semantics_constraints.sql || true`
Expected: `2` for the markers; `0` for BEGIN/COMMIT (grep exits 1 — that is the pass condition).

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/database/migrations/0015_time_semantics_constraints.sql
git commit -m "feat(db): 0015 - drop turn completed_at/created_at check, fix display_name check"
```

---

### Task 2: Migration `0016_read_model_replay_and_presets.sql`

**Files:**
- Create: `architecture/docs/database/migrations/0016_read_model_replay_and_presets.sql`

**Interfaces:**
- Consumes: view definitions from `0013`/`0014` (the down block restores them verbatim).
- Produces: `v_game_replay` with `stage_id`, `parent_stage_id`, `turn_total_score`, LEFT-JOINed darts; `v_session_overview` with integer `duration_seconds`; new `v_configuration_presets` (`configuration_template_id`, `player_id`, `game_type_key`, `name`, `description`, `configuration`, `is_system_template`). Tasks 6, 7, and 10b document these exact columns.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Migration: 0016_read_model_replay_and_presets.sql
--
-- Purpose:
-- Rebuild the replay and overview read models and add the
-- configuration preset read model.
--
--   * v_game_replay: LEFT JOIN darts (turn-total-only turns
--     appear with NULL dart columns), expose turns.total_score
--     as turn_total_score, and expose stage_id/parent_stage_id
--     so consumers can reconstruct and order nested stages
--     (stage sequence_number is only unique per parent).
--   * v_session_overview: floor duration_seconds to an integer
--     to match the SessionOverview DTO contract.
--   * v_configuration_presets: backs
--     GET /api/configuration-templates (system + own presets).
--
-- Never edits 0009/0013/0014; this is a new migration.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_game_replay;
CREATE VIEW v_game_replay AS
SELECT es.id AS session_id,
    es.player_id,
    st.id                  AS stage_id,
    st.parent_stage_id,
    st.sequence_number     AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    t.sequence_number      AS turn_sequence,
    p.display_name         AS participant_name,
    t.total_score          AS turn_total_score,
    d.dart_number,
    d.intended_target_number,
    dz1.implementation_key AS intended_zone_key,
    d.hit_target_number,
    dz2.implementation_key AS hit_zone_key,
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id
    JOIN turns t            ON t.exercise_stage_id = st.id
    JOIN participants p     ON p.id = t.participant_id
    LEFT JOIN darts d        ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events at turn resolution (dart columns NULL for turn-total-only turns).';

DROP VIEW IF EXISTS v_session_overview;
CREATE VIEW v_session_overview AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    gs.implementation_key AS status_key,
    cm.implementation_key AS capture_mode_key,
    es.started_at,
    es.completed_at,
    FLOOR(
        EXTRACT(
            EPOCH
            FROM (
                    COALESCE(
                        es.completed_at,
                        now()
                    ) - es.started_at
                )
        )
    )::integer AS duration_seconds
FROM exercise_sessions es
    JOIN game_types gt    ON gt.id = es.game_type_id
    JOIN game_statuses gs ON gs.id = es.status_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id;
COMMENT ON VIEW v_session_overview IS 'High level gameplay history overview.';

CREATE VIEW v_configuration_presets AS
SELECT ct.id AS configuration_template_id,
    ct.player_id,
    gt.implementation_key AS game_type_key,
    ct.name,
    ct.description,
    ct.configuration,
    ct.is_system_template
FROM configuration_templates ct
    JOIN game_types gt ON gt.id = ct.game_type_id;
COMMENT ON VIEW v_configuration_presets IS 'Configuration presets per game type for GET /api/configuration-templates (system + own).';

-- migrate:down
DROP VIEW IF EXISTS v_configuration_presets;

DROP VIEW IF EXISTS v_session_overview;
CREATE VIEW v_session_overview AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    gs.implementation_key AS status_key,
    cm.implementation_key AS capture_mode_key,
    es.started_at,
    es.completed_at,
    EXTRACT(
        EPOCH
        FROM (
                COALESCE(
                    es.completed_at,
                    now()
                ) - es.started_at
            )
    ) AS duration_seconds
FROM exercise_sessions es
    JOIN game_types gt    ON gt.id = es.game_type_id
    JOIN game_statuses gs ON gs.id = es.status_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id;
COMMENT ON VIEW v_session_overview IS 'High level gameplay history overview.';

DROP VIEW IF EXISTS v_game_replay;
CREATE VIEW v_game_replay AS
SELECT es.id AS session_id,
    es.player_id,
    st.sequence_number     AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    t.sequence_number      AS turn_sequence,
    p.display_name         AS participant_name,
    d.dart_number,
    d.intended_target_number,
    dz1.implementation_key AS intended_zone_key,
    d.hit_target_number,
    dz2.implementation_key AS hit_zone_key,
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id
    JOIN turns t            ON t.exercise_stage_id = st.id
    JOIN participants p     ON p.id = t.participant_id
    JOIN darts d            ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events.';
```

- [ ] **Step 2: Verify structure**

Run: `grep -c 'CREATE VIEW' architecture/docs/database/migrations/0016_read_model_replay_and_presets.sql`
Expected: `5` (3 in up, 2 in down). Also run `grep -n 'LEFT JOIN darts' <file>` — expected 1 hit (up block only).

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/database/migrations/0016_read_model_replay_and_presets.sql
git commit -m "feat(db): 0016 - rebuild v_game_replay/v_session_overview, add v_configuration_presets"
```

---

### Task 3: Seed `0001` transaction fix

**Files:**
- Modify: `architecture/docs/database/seeds/0001_reference_data.sql:313` (the misplaced `COMMIT;`)

**Interfaces:**
- Produces: one transaction wrapping all reference inserts. No consumer changes — seed is idempotent.

- [ ] **Step 1: Move the COMMIT**

Delete the line `COMMIT;` that currently sits between the ruleset_versions insert and the `-- Participant types` banner (line 313), and append `COMMIT;` as the last line of the file (after the dart_zones insert's `ON CONFLICT (id) DO NOTHING;`).

- [ ] **Step 2: Verify**

Run: `grep -n 'BEGIN\|COMMIT' architecture/docs/database/seeds/0001_reference_data.sql`
Expected: exactly two hits — `BEGIN;` near the top (line ~13) and `COMMIT;` as the final line.

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/database/seeds/0001_reference_data.sql
git commit -m "fix(db): wrap all reference seed inserts in one transaction"
```

---

### Task 4: Migration-process docs (`03-Migrations.md`, `10-Database-Agent-Guide.md`)

**Files:**
- Modify: `architecture/docs/architecture/05-Database/03-Migrations.md`
- Modify: `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`

**Interfaces:**
- Consumes: migration files from Tasks 1–2.
- Produces: documented chain `0001`–`0016`; corrected transaction rules.

- [ ] **Step 1: Edit `03-Migrations.md`**

1. Version header `> **Version:** 1.4.0` → `> **Version:** 1.5.0`; front-matter `updated: 2026-07-12` → `updated: 2026-07-13`.
2. In the Migration Structure tree, after the `0014` line add:
```
│   ├── 0015_time_semantics_constraints.sql
│   └── 0016_read_model_replay_and_presets.sql
```
(and change the `0014` line's `└──` to `├──`).
3. After the `## 0014_dart_analytics_session_scope.sql` section, append:

```markdown
---

## 0015_time_semantics_constraints.sql

Purpose:

Align time constraints with the batch write model. <!-- 2026-07-13 -->

Contains:

- drop `chk_turn_completed_after_created` (client-observed `turns.completed_at` legitimately predates row insert under batch upload)
- replace `chk_players_display_name_not_empty` without the dead NULL arm

Doctrine: `created_at` is row persistence time (server clock); gameplay chronology comes from sequence numbers and client-observed timestamps.

---

## 0016_read_model_replay_and_presets.sql

Purpose:

Rebuild replay/overview read models; add the preset read model. <!-- 2026-07-13 -->

Contains:

- rewritten `v_game_replay` (LEFT JOIN darts, `turn_total_score`, `stage_id`/`parent_stage_id` for tree reconstruction)
- rewritten `v_session_overview` (`duration_seconds` floored to integer)
- new `v_configuration_presets` backing `GET /api/configuration-templates`

Never edits `0009`/`0013`/`0014`.
```

- [ ] **Step 2: Edit `10-Database-Agent-Guide.md`**

1. Version `1.1.0` → `1.2.0`; front-matter `updated:` → `2026-07-13`.
2. Rule 6 "Migrations": `Four-digit prefix: `0001`–`0014` current chain` → `Four-digit prefix: `0001`–`0016` current chain`; `**Never modify an applied migration** — create `0013_*` (or next) instead` → `**Never modify an applied migration** — create a migration with the next unused number instead`; `Always use `BEGIN` / `COMMIT` transactions` → `No `BEGIN`/`COMMIT` in migrations (dbmate wraps each section in a transaction); seeds keep explicit `BEGIN`/`COMMIT``.
3. Migration Checklist: `[ ] Numbered sequentially after 0011` → `[ ] Numbered sequentially after the current chain end (0016)`; `[ ] BEGIN/COMMIT transaction` → `[ ] No BEGIN/COMMIT (dbmate owns the transaction)`.
4. Rule 5 "Views are API contracts": `Five implemented views in `0009`; new views = new migration` → `Six implemented views (`0009` originals normalized by `0013`/`0014`; `0016` adds `v_configuration_presets` and rebuilds replay/overview); new views = new migration`.
5. "Safe Change Patterns → Add a column to runtime table" step 1: `New migration `0013_add_<column>.sql`` → `New migration with the next unused number (currently `0017_add_<column>.sql`)`.
6. File Locations block: `migrations/0001–0014.sql` → `migrations/0001–0016.sql`.
7. Quick Reference: `**Five views:** ...` → `**Six views:** `v_active_sessions`, `v_session_overview`, `v_game_replay`, `v_dart_analytics`, `v_routine_execution`, `v_configuration_presets``.

- [ ] **Step 3: Verify**

Run: `grep -rn '0001.–.0014\|0001`–`0014' architecture/docs/architecture/05-Database/03-Migrations.md architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`
Expected: no hits.

- [ ] **Step 4: Commit**

```bash
git add architecture/docs/architecture/05-Database/03-Migrations.md architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md
git commit -m "docs(db): register 0015/0016 in chain, fix transaction rules and stale numbering"
```

---

### Task 5: API baseline contract (`06-API/00-Overview.md`)

**Files:**
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`

**Interfaces:**
- Produces: amended route `/events/batch`, new configuration-templates route, 12-code error list, freeze definition, terminal-status rule. Tasks 6–9 reference these.

- [ ] **Step 1: Apply edits**

1. Header: `> **Version:** 1.2.0 (frozen v1 API baseline; response contracts 2026-07-12)` → `> **Version:** 1.3.0 (frozen v1 API baseline; hardening amendments 2026-07-13)`; front-matter `updated:` stays `2026-07-13`.
2. Replace both occurrences of `POST /api/sessions/:sessionId/events:batch` with `POST /api/sessions/:sessionId/events/batch` (Route Surface list and Write Contract heading). Append to the Write Contract rules list: `- Route amended from the earlier \`events:batch\` custom-method spelling; \`/events/batch\` is the public contract. <!-- 2026-07-13 -->`
3. After the `### Routines` block in Route Surface, insert:

```markdown
### Configuration Templates

- `GET /api/configuration-templates?gameType=<implementation_key>`

Lists configuration presets (system + the caller's own) for a game type; backed by `v_configuration_presets`. `templateRef` in `POST /api/sessions` is the preset UUID from this endpoint. Full contract in `04-Endpoint-Contracts.md`. <!-- 2026-07-13 -->
```

4. Read Contract table: add row `| \`GET /api/configuration-templates\` | \`v_configuration_presets\` |`.
5. Initial domain codes list — append:

```markdown
- `NOT_FOUND`
- `VALIDATION_FAILED`
- `INVALID_STATUS_TRANSITION`
- `SERVICE_UNAVAILABLE`
```

6. Retry semantics: replace `- Retryable: transient failures (\`503\`, \`504\`) with \`retryable: true\`, when idempotency key is provided.` with `- Retryable: \`503 SERVICE_UNAVAILABLE\` (transient failures) with \`retryable: true\`; batch writes retry only with the same idempotency key. <!-- 2026-07-13 -->`
7. Frozen Decisions — append three bullets:

```markdown
- Freeze semantics: the route surface and behavioral semantics are frozen; documents may take doc-only version bumps without violating the freeze. <!-- 2026-07-13 -->
- Session lifecycle (v1): every terminal transition (`COMPLETED`, `ABANDONED`) sets `completed_at` (server default `now()`); `ACTIVE` ⇔ `completed_at IS NULL` is a service-enforced invariant. <!-- 2026-07-13 -->
- Recovery model (v1): in-progress gameplay state is client-local (persisted Alpine stores); the server holds no mid-session gameplay. `GET /api/sessions/active` exists to resume-from-local or abandon. <!-- 2026-07-13 -->
```

8. In the same Frozen Decisions list, the stale claim `\`03-Shared-Conventions.md\` and \`04\` are frozen at 1.0.0` → `\`03-Shared-Conventions.md\` and \`04\` carry doc-version bumps under the freeze-semantics rule above`.

- [ ] **Step 2: Verify**

Run: `grep -n 'events:batch' architecture/docs/architecture/06-API/00-Overview.md`
Expected: at most the one historical-mention line added in edit 2; the route list and write contract show `/events/batch`.

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/architecture/06-API/00-Overview.md
git commit -m "docs(api): amend batch route, add preset endpoint, complete error codes, define freeze"
```

---

### Task 6: Shared conventions (`06-API/03-Shared-Conventions.md`)

**Files:**
- Modify: `architecture/docs/architecture/06-API/03-Shared-Conventions.md`

**Interfaces:**
- Produces: 12-row error registry; pagination key rule. Task 7 references both.

- [ ] **Step 1: Apply edits**

1. Version `1.2.0` → `1.3.0`; front-matter `updated:` stays `2026-07-13`.
2. Error-Code Registry table — append four rows:

```markdown
| `NOT_FOUND` | 404 | no | 2026-07-13 |
| `VALIDATION_FAILED` | 422 | no | 2026-07-13 |
| `INVALID_STATUS_TRANSITION` | 409 | no | 2026-07-13 |
| `SERVICE_UNAVAILABLE` | 503 | **yes** | 2026-07-13 |
```

3. After the registry table, add:

```markdown
`VALIDATION_FAILED` covers all input-schema, config, template-resolution, and ruleset validation failures; specifics travel in `error.details`, never as new codes. `SERVICE_UNAVAILABLE` is the only retryable code — it is what activates the client retry rule. The registry is closed for v1. <!-- 2026-07-13 -->
```

4. Pagination → Cursor semantics — add a third bullet:

```markdown
- **Ordering key:** the sessions list orders by `session_id DESC` (UUIDv7 is creation-time ordered, so the primary key doubles as the pagination key); the opaque cursor encodes the last-seen `session_id`. <!-- 2026-07-13 -->
```

5. Header Contract table `Idempotency-Key` row: `batch write only` stays; no change needed (URL not mentioned here).

- [ ] **Step 2: Verify**

Run: `grep -c '| .no\|yes. |' architecture/docs/architecture/06-API/03-Shared-Conventions.md` — informational; then `grep -n 'SERVICE_UNAVAILABLE' <file>` — expected 2 hits (table + prose).

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/architecture/06-API/03-Shared-Conventions.md
git commit -m "docs(api): complete error registry (4 codes), define pagination ordering key"
```

---

### Task 7: Endpoint contracts (`06-API/04-Endpoint-Contracts.md`)

**Files:**
- Modify: `architecture/docs/architecture/06-API/04-Endpoint-Contracts.md`

**Interfaces:**
- Consumes: view columns from Task 2; error codes from Task 6.
- Produces: `DartFact` (nullable intention pair), `ConfigurationPreset`, `ProvisionPlayerRequest`, `ReplayEntry` (with `stageId`/`turnTotalScore`), `templateRef` = UUID. The frontend layer builds against exactly these.

- [ ] **Step 1: Apply edits**

1. Version `1.0.0 (frozen v1)` → `1.1.0 (frozen v1; hardening amendments 2026-07-13)`; front-matter `updated:` → `2026-07-13`.
2. Global: replace every `events:batch` with `events/batch` (section heading `## Write Path — POST /api/sessions/:sessionId/events:batch`, the `BatchWriteResponse` comment).
3. Purpose paragraph: `the client sends no persistence UUIDs (the Worker generates UUIDv7)` → `the client sends no persistence UUIDs in runtime-write payloads (the Worker generates UUIDv7); referencing an entity obtained from a read endpoint (e.g. \`templateRef\`) is normal REST addressing. <!-- 2026-07-13 -->`
4. Write-path rules — replace the two capture-mode bullets:
   - `- Recreational mode: \`darts: []\` (score observed only).` → `- \`RECREATIONAL\` + \`QUICK_SCORE\`: \`darts: []\` (turn totals only). \`RECREATIONAL\` + \`DETAILED_DARTS\`: hit-only dart rows (intention pair null). <!-- 2026-07-13 -->`
   - `- Analytics mode: Full dart observations (intended + hit zone, coordinates mapped to server zones).` → `- \`ANALYTICS\` capture: intention required on every dart (service-validated). <!-- 2026-07-13 -->`
   Also in the same list, add: `- \`clientKey\`/\`parentClientKey\` resolve references within this single payload only; there is no cross-batch reconciliation (local-first recovery model). <!-- 2026-07-13 -->`
5. Replace the `DartFact` schema block with:

```typescript
const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string().nullable(),      // nullable pair with intendedTargetNumber (both null or both set)
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),                      // required on any dart row; MISS covers misses
  score: z.number().int(),
});
```

6. Session Creation — config input bullet: `\`source: "template"\`: resolve the template by \`templateRef\` (implementation_key), apply optional \`overrides\`…` → `\`source: "template"\`: resolve the preset by \`templateRef\` (the configuration template UUID from \`GET /api/configuration-templates\`), apply optional \`overrides\`… <!-- 2026-07-13 -->`. In the `ConfigInput` sketch, update the comment on `templateRef: z.string()` to `// configuration template UUID from GET /api/configuration-templates`.
7. Session Lifecycle (PATCH) — after the first paragraph, add:

```markdown
Terminal transitions: both `COMPLETED` and `ABANDONED` set `completed_at` — the server defaults it to `now()` when the request omits `completedAt`. `completed_at` means "when the session ended"; `ACTIVE` ⇔ `completed_at IS NULL` is a service-enforced invariant (it is what the `uq_sessions_single_active` index keys on). Invalid transitions → `409 INVALID_STATUS_TRANSITION`; unknown session → `404 NOT_FOUND`. <!-- 2026-07-13 -->
```

   And replace `invalid transitions are rejected using a registered error code from \`03-Shared-Conventions.md\`` → `invalid transitions are rejected with \`INVALID_STATUS_TRANSITION\``.
8. Player Provisioning — add a request sketch above the response:

```typescript
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),   // fallback: JWT `name` claim, else 'Player'
});
```

   With one sentence: `The server resolves the stored display_name as: request displayName → JWT \`name\` claim (when present) → literal 'Player'. players.display_name is NOT NULL. <!-- 2026-07-13 -->`
9. New section after Player Provisioning:

```markdown
---

## Configuration Presets — `GET /api/configuration-templates?gameType=<key>`

Lists the configuration presets available to the caller for one game type: system presets plus the caller's own. Backed 1:1 by `v_configuration_presets` (migration `0016`), player-scoped in the repository (`player_id IS NULL OR player_id = caller`). The returned `configurationTemplateId` is what `POST /api/sessions` accepts as `templateRef`. Preset CRUD is deferred post-v1; v1 presets are the read-only system seeds. <!-- 2026-07-13 -->

```typescript
const ConfigurationPreset = z.object({
  configurationTemplateId: z.string(),   // UUID — becomes templateRef
  gameTypeKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  configuration: z.record(z.unknown()),  // JSONB preset, ruleset-defined shape
  isSystemTemplate: z.boolean(),
});
```

Missing/unknown `gameType` → `422 VALIDATION_FAILED`.
```

10. Read Contracts table — add row: `| \`GET /api/configuration-templates\` | \`v_configuration_presets\` | \`ConfigurationPreset[]\` | 2026-07-13 |`
11. Pagination paragraph — append: `The sessions list orders by \`session_id DESC\` (UUIDv7 creation-ordered; the cursor encodes the last-seen \`session_id\`). <!-- 2026-07-13 -->`
12. Replace the `ReplayEntry` schema block with:

```typescript
const ReplayEntry = z.object({              // v_game_replay — GET /sessions/:id/replay → ReplayEntry[]
  stageId: z.string(),                       // structural identity for tree reconstruction
  parentStageId: z.string().nullable(),
  stageSequence: z.number().int(), stageTypeKey: z.string(),
  turnSequence: z.number().int(), participantName: z.string(),
  turnTotalScore: z.number().int(),
  dartNumber: z.number().int().nullable(),   // NULL for turn-total-only rows
  intendedTargetNumber: z.number().int().nullable(), intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int().nullable(),        // NULL when no dart row
});
```

13. `GET /api/sessions/:sessionId/darts` analytics-only note stays valid — no change.

- [ ] **Step 2: Verify**

Run: `grep -n 'events:batch\|implementation_key)' architecture/docs/architecture/06-API/04-Endpoint-Contracts.md`
Expected: no `events:batch` hits; no `templateRef (implementation_key)` remnant.

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
git commit -m "docs(api): preset endpoint, nullable dart intention, PATCH lifecycle, provision request, replay DTO"
```

---

### Task 8: Implementation docs (`01-Implementation-Strategy.md`, `02-Middleware-And-Layering.md`)

**Files:**
- Modify: `architecture/docs/architecture/06-API/01-Implementation-Strategy.md`
- Modify: `architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`

**Interfaces:**
- Produces: one authoritative folder tree (top-level areas, `lib/server/` for envelope/errors).

- [ ] **Step 1: Edit `01-Implementation-Strategy.md`**

1. Version `1.0.0 (frozen v1)` → `1.0.1 (frozen v1; layout reconciliation 2026-07-13)`.
2. Replace `POST /api/sessions/:sessionId/events:batch` (two occurrences: rationale §3 and Cloudflare/Neon section) with `POST /api/sessions/:sessionId/events/batch`.
3. Recommended Request Flow diagram: `src/lib/services/**  (orchestration, transactions, UUIDv7)` → `src/services/**  (orchestration, transactions, UUIDv7)` and `src/lib/repositories/**  (SQL against views and runtime tables)` → `src/repositories/**  (SQL against views and runtime tables)`.

- [ ] **Step 2: Edit `02-Middleware-And-Layering.md`**

1. Version `1.0.0 (frozen v1)` → `1.1.0 (layout reconciliation 2026-07-13)`.
2. Layer Architecture diagram: `src/lib/services/**` → `src/services/**`; `src/lib/repositories/**` → `src/repositories/**`. Same fix in the Controller/Service/Repository headings (`## Service (\`src/lib/services/\`)` → `## Service (\`src/services/\`)`, `## Repository (\`src/lib/repositories/\`)` → `## Repository (\`src/repositories/\`)`).
3. Folder structure tree: under `lib/`, rename the `api/` node to `server/` with the same children (`envelope.ts`, `errors.ts`) and comment `# server-side response helpers (ok/error, registry mapping)`; leave `auth/` unchanged. Change `events/ └── batch.ts # POST (maps to events:batch contract)` comment to `# POST /api/sessions/:sessionId/events/batch`.
4. Route file mapping note — replace the whole paragraph with:

```markdown
The public batch route is `POST /api/sessions/:sessionId/events/batch` (amended 2026-07-13 from the earlier `events:batch` custom-method spelling), served natively by the `events/batch.ts` route file. No rewrite machinery exists or is permitted.
```

5. Shared Library Modules: heading `## \`lib/api/envelope.ts\`` → `## \`lib/server/envelope.ts\``; heading `## \`lib/api/errors.ts\`` → `## \`lib/server/errors.ts\``. Add one sentence under the first: `\`lib/api/\` is reserved for the browser-facing API client (see \`../07-Frontend/00-Overview.md\`, D41); browser and Worker code never share a folder. <!-- 2026-07-13 -->`

- [ ] **Step 3: Verify**

Run: `grep -rn 'lib/services\|lib/repositories\|events:batch' architecture/docs/architecture/06-API/01-Implementation-Strategy.md architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`
Expected: only the deliberate historical mention in 02's route-mapping note (contains `events:batch` once); no `lib/services`/`lib/repositories` hits.

- [ ] **Step 4: Commit**

```bash
git add architecture/docs/architecture/06-API/01-Implementation-Strategy.md architecture/docs/architecture/06-API/02-Middleware-And-Layering.md
git commit -m "docs(api): reconcile folder tree (top-level areas, lib/server), amend batch URL"
```

---

### Task 9: Frontend doc (`07-Frontend/00-Overview.md`)

**Files:**
- Modify: `architecture/docs/architecture/07-Frontend/00-Overview.md`

**Interfaces:**
- Consumes: recovery model (D67), batch URL, preset endpoint.
- Produces: the frontend-facing statement of the local-first model that frontend specs build on.

- [ ] **Step 1: Apply edits**

1. Version `0.1.1` → `0.2.0`; front-matter `updated:` → `2026-07-13`.
2. State Model → Temporary state: replace `This state is lost on page refresh unless recovered via \`GET /api/sessions/active\` and replay reconstruction.` with:

```markdown
Temporary state is held in Alpine stores using the `$persist` plugin (localStorage), so it survives page refreshes and browser restarts on the same device. Recovery is client-local: on load, the client checks `GET /api/sessions/active` for an orphaned active session and offers **resume** (rehydrating from the persisted store) or **abandon** (`PATCH` → `ABANDONED`). The server holds no mid-session gameplay; losing the device (or clearing storage) loses the in-progress session. <!-- 2026-07-13 -->
```

3. Write flow diagram: `Session complete (or sync boundary)` → `Session complete`; `POST /api/sessions/:sessionId/events:batch` → `POST /api/sessions/:sessionId/events/batch`. Under Rules: `- batch upload at session boundary — not per-dart API calls` stays; delete `(or at defined sync boundaries)` from the Persistent state sentence above it.
4. Example call: the fenced block already uses `events/batch` — update only the comment sentence after it: `The exact payload shape is defined per domain in future \`06-API/\` endpoint docs.` → `The payload shape is \`EventsBatchRequest\` in \`../06-API/04-Endpoint-Contracts.md\`.`
5. Recommended Client Structure: in the tree, add `│   ├── configuration-templates.ts` under `api/` after `routines.ts`. Add below the v1 note: `Server-side response helpers live in \`lib/server/\` — \`lib/api/\` is browser code only (see \`../06-API/02-Middleware-And-Layering.md\`). <!-- 2026-07-13 -->`
6. Frontend Must Not table — add row: `| Rely on the server for mid-session recovery | in-progress state is client-local (persisted Alpine store) |`
7. Related Documents table: update the `../06-API/00-Overview.md` row description to `Frozen API contract (v1.3.0)`.

- [ ] **Step 2: Verify**

Run: `grep -n 'sync boundary\|events:batch\|replay reconstruction' architecture/docs/architecture/07-Frontend/00-Overview.md`
Expected: no hits.

- [ ] **Step 3: Commit**

```bash
git add architecture/docs/architecture/07-Frontend/00-Overview.md
git commit -m "docs(frontend): local-first recovery model, batch URL, client structure"
```

---

### Task 10a: Database spec chapters — runtime, reference, player

**Files:**
- Modify: `architecture/docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`
- Modify: `architecture/docs/architecture/05-Database/06-Spec/01-Reference-Layer.md`
- Modify: `architecture/docs/architecture/05-Database/06-Spec/03-Player-Layer.md`
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`

**Interfaces:**
- Consumes: decisions D67–D69, D73, D76–D77 semantics.
- Produces: canonical spec text matching migrations `0015`/`0016`.

- [ ] **Step 1: Edit `06-Spec/04-Runtime-Layer.md`** (front-matter `updated:` → `2026-07-13`)

1. `# activities` → Lifecycle: `Supports browser refresh recovery and abandoned session detection.` → `Terminal transitions (COMPLETED/ABANDONED) set completed_at. In-progress recovery is client-local (persisted frontend state); the abandon flow is client-driven. <!-- 2026-07-13 -->`
2. `# exercise_sessions` → after the Rules line add: `Terminal statuses (COMPLETED, ABANDONED) always set completed_at ("when the session ended"); ACTIVE ⇔ completed_at IS NULL is a service-enforced invariant that uq_sessions_single_active keys on. <!-- 2026-07-13 -->`
3. `# participants` → Constraints: add `- The PLAYER player_id-presence and DartBot display-name rules are DB CHECK constraints keyed on seeded ids 1/3 (migration 0005); the GUEST naming rule is application-enforced. <!-- 2026-07-13 -->`
4. `# turns` → Lifecycle: replace `` `completed_at` NULL means the turn was interrupted mid-visit — this is how resumable games recover position.`` with `` `completed_at` is the client-observed end of the visit (from `TurnFact.completedAt`); NULL means the visit never completed. It may legitimately precede `created_at` (persistence time) under batch upload — migration `0015` removed the old ordering check. <!-- 2026-07-13 -->``
5. `# darts` → Rules: replace the two capture bullets with:

```markdown
- RECREATIONAL + QUICK_SCORE — dart rows omitted entirely (turn totals only)
- RECREATIONAL + DETAILED_DARTS — hit-only dart rows (intention pair NULL) <!-- 2026-07-13 -->
- ANALYTICS — every dart stores full intention and result
```

- [ ] **Step 2: Edit `06-Spec/01-Reference-Layer.md`** (front-matter `updated:` → `2026-07-13`)

In `# capture_modes` → Design Rationale, append:

```markdown
Capture mode × input mode matrix: RECREATIONAL + QUICK_SCORE stores turn totals with no dart rows; RECREATIONAL + DETAILED_DARTS stores hit-only dart rows (no intention); ANALYTICS requires full intention + result on every dart regardless of input mode. <!-- 2026-07-13 -->
```

- [ ] **Step 3: Edit `06-Spec/03-Player-Layer.md`** (front-matter `updated:` → `2026-07-13`)

1. `# players` → Key Columns: `- display_name` → `- display_name (NOT NULL; set at provisioning: request displayName → JWT name claim → 'Player')`. In Design Rationale, after the display_name paragraph add: `Initial value comes from POST /api/players/provision; a rename endpoint is deferred post-v1. <!-- 2026-07-13 -->`
2. `# player_settings` → after the Lifecycle paragraph add: `**v1 status:** deferred — no settings endpoints ship in v1; the client persists last-used capture/input modes locally and sends them on session creation (D60). The table remains for post-v1. <!-- 2026-07-13 -->`

- [ ] **Step 4: Edit `06-Database-Specification.md`**

In `# Timestamp Strategy`, after the `TIMESTAMPTZ` rule add:

```markdown
`created_at` is always row persistence time (server clock). Gameplay chronology is derived from sequence numbers and client-observed lifecycle timestamps (`turns.completed_at`), never from `created_at`. <!-- 2026-07-13 -->
```

Front-matter `updated:` → `2026-07-13`.

- [ ] **Step 5: Verify**

Run: `grep -rn 'recover position\|browser refresh recovery' architecture/docs/architecture/05-Database/06-Spec/`
Expected: no hits.

- [ ] **Step 6: Commit**

```bash
git add architecture/docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md architecture/docs/architecture/05-Database/06-Spec/01-Reference-Layer.md architecture/docs/architecture/05-Database/06-Spec/03-Player-Layer.md architecture/docs/architecture/05-Database/06-Database-Specification.md
git commit -m "docs(db-spec): time doctrine, lifecycle invariant, capture matrix, player-layer v1 status"
```

---

### Task 10b: Read-model docs, views handbook, naming, patterns

**Files:**
- Modify: `architecture/docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `architecture/docs/architecture/05-Database/05-Views.md`
- Modify: `architecture/docs/architecture/05-Database/01-Naming-Conventions.md`
- Modify: `architecture/docs/architecture/04-Architecture-patterns.md`

**Interfaces:**
- Consumes: `0016` view definitions from Task 2.
- Produces: read-model docs matching the six-view state.

- [ ] **Step 1: Edit `06-Spec/05-Read-Model-Layer.md`** (front-matter `updated:` → `2026-07-13`)

1. Intro paragraph: `Migration \`0009\` delivers the initial five views. Migration \`0013\` normalizes…` — append: `Migration \`0016\` rebuilds \`v_game_replay\` and \`v_session_overview\` and adds \`v_configuration_presets\`. <!-- 2026-07-13 -->`
2. `# v_game_replay` → Sources: `- darts` → `- darts (LEFT JOIN — turn-total-only turns appear with NULL dart columns)`. Exposes: replace with `Stage identity (stage_id, parent_stage_id) for tree reconstruction, stage sequence and stage type key, turn sequence, participant name, turn total score, dart number, intended target + zone key, hit target + zone key, score. <!-- 2026-07-13 -->`. Design Rationale: append `Stage sequence numbers are only unique per parent, so consumers order and nest via stage_id/parent_stage_id. Recreational sessions replay at turn resolution via turn_total_score. <!-- 2026-07-13 -->`
3. `# v_session_overview` → Exposes: `…and a computed \`duration_seconds\`` → `…and a computed integer \`duration_seconds\` (floored; migration \`0016\`)`.
3a. `# v_active_sessions` → Purpose: `Used by application startup and browser refresh recovery.` → `Used by application startup to detect an orphaned active session and offer resume (from client-local state) or abandon; the view itself does not reconstruct gameplay state. <!-- 2026-07-13 -->` (gap identified during Task 10a's implementation — this line implied server-side recovery, contradicting the local-first recovery model D67 established elsewhere).
4. New section before the Summary:

```markdown
# v_configuration_presets

## Category

API Read Model

## Purpose

Lists configuration presets (system + player-owned) per game type for game setup. Backs `GET /api/configuration-templates`. <!-- 2026-07-13 -->

## Sources

- configuration_templates
- game_types

## Exposes

`configuration_template_id` (the UUID the API accepts as `templateRef`), `player_id` (scoping), game type key, name, description, configuration JSONB, `is_system_template`.

## Design Rationale

The only template-layer read model: presets must be discoverable before session creation, and referencing an entity obtained from a read endpoint is normal REST addressing. Runtime still never references templates — the snapshot copy rule is untouched.
```

5. Summary table — add row `| Game setup | v_configuration_presets |`.

- [ ] **Step 2: Edit `05-Views.md`**

1. Version `1.1.0` → `1.2.0`; front-matter `updated:` → `2026-07-13`.
2. Implemented Views table: retitle heading `# Implemented Views (migration 0009)` → `# Implemented Views (migrations 0009–0016)`; add row `| \`v_configuration_presets\` | API Read Model | Preset discovery for game setup (2026-07-13) |`.
3. Filtering Rules example: replace the `WHERE completed_at IS NULL` snippet's surrounding sentence with: `with a filter on the ACTIVE status key — equivalent to \`completed_at IS NULL\` under the terminal-status invariant (terminal statuses always set \`completed_at\`). <!-- 2026-07-13 -->` (keep the snippet, add the equivalence sentence).

- [ ] **Step 3: Edit `01-Naming-Conventions.md`**

1. Version `1.2.0` → `1.3.0`; front-matter `updated:` → `2026-07-13`.
2. §View Column Key And Label Naming, third bullet: `Keep only the entity UUIDs a client must address in a later request: \`session_id\`, \`routine_id\`, \`exercise_template_id\`, and \`player_id\` (for player-scoping).` → `Keep entity UUIDs for two purposes only: ids a client addresses in a later request (\`session_id\`, \`routine_id\`, \`exercise_template_id\`, \`configuration_template_id\`, \`player_id\` for scoping) and structural identity needed to reconstruct hierarchies (\`stage_id\`, \`parent_stage_id\`). <!-- 2026-07-13 -->`
3. Check-constraint example: `chk_darts_score_positive` → `chk_dart_score_positive`.
4. Implementation Keys example line `implementation_key TEXT NOT NULL UNIQUE` — append after the code block: `Uniqueness may be composite where the key is scoped (e.g. \`ruleset_versions\` is unique per \`(game_type_id, implementation_key)\`). <!-- 2026-07-13 -->`

- [ ] **Step 4: Edit `04-Architecture-patterns.md`**

1. Version `1.2.0` → `1.2.1`; front-matter `updated:` → `2026-07-13`.
2. Pattern 9 "Store:" block — delete the `timestamp` line (dart-level timestamps are deferred; `created_at` is persistence time).
3. Pattern 8 baseline bullet: `batch write endpoint (\`POST /api/sessions/:sessionId/events:batch\`)` → `batch write endpoint (\`POST /api/sessions/:sessionId/events/batch\`)`.

- [ ] **Step 5: Verify**

Run: `grep -rn 'events:batch' architecture/docs/architecture/04-Architecture-patterns.md architecture/docs/architecture/05-Database/`
Expected: hits only in `06-Spec/04-Runtime-Layer.md` (`session_write_idempotency` purpose — update it too if present: change to `events/batch`) and none elsewhere. If the runtime-layer hit exists, fix it in this step and amend the Task 10a commit scope note.

- [ ] **Step 6: Commit**

```bash
git add architecture/docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md architecture/docs/architecture/05-Database/05-Views.md architecture/docs/architecture/05-Database/01-Naming-Conventions.md architecture/docs/architecture/04-Architecture-patterns.md architecture/docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md
git commit -m "docs(db-spec): 0016 read models, view naming amendments, pattern hygiene"
```

---

### Task 11: Decision ledger (`architecture/DECISIONS.md`)

**Files:**
- Modify: `architecture/DECISIONS.md`

**Interfaces:**
- Produces: D67–D78 entries; updated deferred list. The context map (Task 12) references this state.

- [ ] **Step 1: Apply edits** (front-matter `updated:` → `2026-07-13`)

1. Under the **API** table, append:

```markdown
| D67 | 2026-07-13 | Local-first recovery: in-progress state in persisted Alpine stores (`$persist`); one batch at session completion; `clientKey` payload-internal only; no server mid-session recovery or cross-batch reconciliation | Resolves recovery-vs-batch contradiction with zero schema cost |
| D68 | 2026-07-13 | `created_at` = row persistence time everywhere; chronology from sequence numbers + client timestamps; migration `0015` drops `chk_turn_completed_after_created` | Batch upload makes client `completedAt` predate insert |
| D69 | 2026-07-13 | Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default `now()`); `ACTIVE` ⇔ `completed_at IS NULL` invariant | Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow |
| D70 | 2026-07-13 | Error registry completed with `NOT_FOUND`/`VALIDATION_FAILED`/`INVALID_STATUS_TRANSITION`/`SERVICE_UNAVAILABLE` (only retryable code); registry closed for v1 | Registry must cover its own frozen surface |
| D71 | 2026-07-13 | `GET /api/configuration-templates` backed by `v_configuration_presets` (migration `0016`); `templateRef` = preset UUID; "no persistence UUIDs" scoped to runtime-write payloads | Game setup needs preset discovery; presets have no implementation_key by design |
| D72 | 2026-07-13 | Batch route amended to `POST /api/sessions/:sessionId/events/batch` | Astro file routing serves it natively; `:batch` spelling was unservable |
| D73 | 2026-07-13 | `DartFact` intention is a nullable pair; ANALYTICS capture ⇒ intention required (service-validated); RECREATIONAL + DETAILED_DARTS = hit-only dart rows | Contract must express what the schema models |
| D75 | 2026-07-13 | Sessions list pagination orders by `session_id DESC` (UUIDv7 creation-ordered); cursor encodes last-seen `session_id` | PK doubles as pagination key; no new index |
| D76 | 2026-07-13 | Provision accepts optional `displayName`; fallback JWT `name` claim → `'Player'`; rename endpoint deferred | `players.display_name` NOT NULL needs a source at provisioning |
| D78 | 2026-07-13 | Authoritative `app/src` tree: top-level `services`/`repositories`/`db` areas; `lib/api/` = browser client (D41); `lib/server/` = envelope/error helpers | Frozen docs contradicted each other on layout |
```

2. Under the **Database platform & process** table, append:

```markdown
| D74 | 2026-07-13 | Migration `0016` rebuilds `v_game_replay` (LEFT JOIN darts, `turn_total_score`, `stage_id`/`parent_stage_id`) and floors `v_session_overview.duration_seconds` | Recreational + nested-stage replay; integer DTO contract |
```

3. Under the **Frontend** table, append:

```markdown
| D77 | 2026-07-13 | `player_settings` deferred post-v1: no endpoints; client persists last-used modes and sends them per D60 | Table was unreachable; local persistence covers the need |
```

4. Deferred list — append to the paragraph: ` · player_settings endpoints (2026-07-13) · configuration-preset CRUD (2026-07-13) · PATCH /api/players/me rename (2026-07-13) · per-dart thrown_at timestamp (2026-07-13)`.
5. D66 row — append to its Decision cell: ` (\`03\` later 1.2.0/1.3.0 under the freeze-semantics rule, 2026-07-13)`.

- [ ] **Step 2: Verify**

Run: `grep -c 'D6[7-9]\|D7[0-8]' architecture/DECISIONS.md`
Expected: ≥ 12.

- [ ] **Step 3: Commit**

```bash
git add architecture/DECISIONS.md
git commit -m "docs(ledger): record D67-D78 architecture hardening decisions"
```

---

### Task 12: Context map, root routers, final consistency gate

**Files:**
- Modify: `architecture/docs/architecture/00-Context-Map.md`
- Modify: `CLAUDE.md` (repo root)
- Modify: `architecture/docs/database/CLAUDE.md`
- Modify: `architecture/CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: consistent routing state; `scripts/check-context-map.sh` green.

- [ ] **Step 1: Edit `00-Context-Map.md`**

1. Version `1.0.5 (2026-07-13)` → `1.1.0 (2026-07-13)`.
2. Context Packs: `full chain \`database/migrations/0001\`–\`0014\`` → `\`0001\`–\`0016\``.
3. Inventory SQL table: `migrations/0001–0014` → `migrations/0001–0016`.
4. Database handbook row for `03-Migrations.md`: `chain \`0001\`–\`0014\`` → `chain \`0001\`–\`0016\``.
5. Current Implementation State: Migrations row → `\`0001\`–\`0016\` complete; \`0015\` time-semantics constraints, \`0016\` replay/overview rebuild + \`v_configuration_presets\` (2026-07-13)`; API docs row → append `; hardening amendments \`00\`→1.3.0, \`03\`→1.3.0, \`04\`→1.1.0 (2026-07-13)`; Frontend docs row → `\`07-Frontend/00-Overview.md\` 0.2.0 — local-first recovery model (2026-07-13)`.

- [ ] **Step 2: Edit the three routers**

1. Root `CLAUDE.md`: `Never modify applied migrations (\`0001\`–\`0014\`)` → `(\`0001\`–\`0016\`)`; `reads via views... gameplay is uploaded in batches` unchanged.
2. `architecture/docs/database/CLAUDE.md`: `Migration numbering contiguous (\`0001\`–\`0014\` applied)` → `(\`0001\`–\`0016\` applied)`; `Never modify applied migrations` unchanged.
3. `architecture/CLAUDE.md`: `new schema change = new numbered migration` context — update the scope line `migration/seed chain (\`0001\`–\`0014\`)` if present, and the "No contradiction between architecture docs and the migration/seed chain (\`0001\`–\`0014\`)" line in `architecture/docs/CLAUDE.md` → `0016`. (Run `grep -rln '0014' CLAUDE.md architecture/CLAUDE.md architecture/docs/CLAUDE.md architecture/docs/database/CLAUDE.md` and update every chain-range hit.)

- [ ] **Step 3: Repo-wide staleness sweep**

Run: `grep -rn 'events:batch' --include='*.md' architecture/ app/ | grep -v '05-Database/0[7-9]\|000_master_context\|superpowers'`
Expected: only deliberate historical mentions (00-Overview amendment note, 02 route-mapping note). Fix any stragglers (e.g. `06-Spec/04-Runtime-Layer.md` idempotency purpose line, `03-Migrations.md` 0012 section) to `events/batch`.

Run: `grep -rn '0001.–.0014\|0001`–`0014' --include='*.md' . | grep -v '05-Database/0[7-9]\|000_master_context\|superpowers/specs\|superpowers/plans'`
Expected: no hits.

- [ ] **Step 4: Run the consistency gate**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.` — must pass. If it flags anything, fix and re-run.

- [ ] **Step 5: Database validation (environment-permitting)**

If `DATABASE_URL_POOLED` is available: from `app/` run `npm run db:status && npm run db:migrate && npm run db:seed`, expect `0015`/`0016` applied cleanly. Otherwise note the deferral in the commit body.

- [ ] **Step 6: Commit and push**

```bash
git add architecture/docs/architecture/00-Context-Map.md CLAUDE.md architecture/CLAUDE.md architecture/docs/CLAUDE.md architecture/docs/database/CLAUDE.md
git commit -m "docs(context): update chain ranges to 0016, implementation state, router files"
git push -u origin claude/architecture-review-frontend-a3ya86
```

---

## Task Order & Dependencies

1 → 2 → 3 (SQL) → 4 (migration docs) → 5 → 6 → 7 (API contract, in authority order) → 8 → 9 (implementation/frontend docs) → 10a → 10b (spec chapters/handbook) → 11 (ledger) → 12 (context map + gate). Tasks 5–11 only depend on 1–2 for column/route names; they may not be reordered past 12, which validates everything.
