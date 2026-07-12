# v1 API Freeze Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the decisions D1–D8 from `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` to the `06-API/` docs (plus frontend, ledger, and context map) so the v1 API surface can be frozen with every DB-required field given an input path and every read endpoint view-backed.

**Architecture:** This is a **documentation-only** change set across five canonical docs plus the decision ledger and context map. There is no `app/` code, no migration, no seed, and no view definition. Because there are no unit tests, each task's "test" is a concrete `grep`/`rg` assertion (or the `scripts/check-context-map.sh` gate) with exact expected output — the edit is verified by observing the doc's new state, then committed.

**Tech Stack:** Markdown docs under `architecture/docs/architecture/`; Bash verification via `rg` and `scripts/check-context-map.sh`; git.

## Global Constraints

- Edit only these files: `architecture/docs/architecture/06-API/00-Overview.md`, `.../06-API/02-Middleware-And-Layering.md`, `.../06-API/04-Endpoint-Contracts.md`, `.../07-Frontend/00-Overview.md`, `architecture/DECISIONS.md`, `.../00-Context-Map.md`. No `app/` code, migrations, seeds, or view SQL.
- Every newly added or changed table row / bullet in an edited doc carries an ISO date `2026-07-12` (use the `<!-- 2026-07-12 -->` marker as the surrounding docs already do).
- Minimal diffs. Do not regenerate docs; targeted edits only. Preserve existing numbering and heading structure.
- Authority order: `00-Overview.md` is the frozen contract authority; `02`/`03`/`04` are subordinate and must never contradict it. After all edits, `00-Overview.md` and `04-Endpoint-Contracts.md` must list an identical read/write surface.
- `DECISIONS.md` is a ledger (context, never authority): append dated rows; amend the superseded `D36` line in place with a pointer, do not delete it.
- Commit after each task with `git config user.email noreply@anthropic.com && git config user.name Claude` already set. Commit messages end with the Co-Authored-By / Claude-Session trailers used on this branch.
- Branch: `claude/v1-api-freeze-bjus0o`. Push with `git push -u origin claude/v1-api-freeze-bjus0o` only after the final task.
- Final gate: `scripts/check-context-map.sh` must print `OK: ...` before the work is claimed done.

---

## File responsibilities

| File | Responsibility in this change |
| ---- | ----------------------------- |
| `06-API/00-Overview.md` | Authority contract: move statistics to Deferred, reconcile Read Contract table with `04`, add participant/mode + activity notes to Frozen Decisions, version bump. |
| `06-API/02-Middleware-And-Layering.md` | Add the third route class (authenticated-unprovisioned) + updated middleware flow so provisioning is reachable. |
| `06-API/04-Endpoint-Contracts.md` | Session-creation contract: `captureModeKey`/`inputModeKey`, single-`PLAYER` participant + response ref, `participantRef` resolution; reads section: stats deferred, routine-list aggregation, darts analytics-only. |
| `07-Frontend/00-Overview.md` | Note statistics reads are post-v1. |
| `architecture/DECISIONS.md` | Ledger rows D60–D64; amend D36; update Deferred line. |
| `00-Context-Map.md` | Update map date/version and the "Current Implementation State" API row. |

Task order follows authority (contract doc first), then the subordinate docs, then the ledger/map + full consistency gate last.

---

### Task 1: `00-Overview.md` — statistics deferral, read-table reconciliation, frozen decisions

**Files:**
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the authoritative v1 read/write surface that Task 3 (`04`) must match exactly — Read Contract table rows for `GET /api/sessions/:sessionId`, `GET /api/routines`, `GET /api/routines/:routineId`; statistics listed only under Deferred.

- [ ] **Step 1: Update the front-matter date**

Replace the header comment's date line:

```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```

- [ ] **Step 2: Bump the version line**

Replace:
```
> **Version:** 1.0.0 (frozen v1 API baseline)
```
with:
```
> **Version:** 1.1.0 (frozen v1 API baseline; validation reconciliation 2026-07-12)
```

- [ ] **Step 3: Add creation-input note under the Sessions route list**

Immediately after the Sessions bullet list (the line `- \`GET /api/sessions/:sessionId/darts\``), before `### Routines`, insert:

```
`POST /api/sessions` requires `captureModeKey` and `inputModeKey` and creates a single `PLAYER` participant; full request/response shape in `04-Endpoint-Contracts.md`. <!-- 2026-07-12 -->
```

- [ ] **Step 4: Move statistics to Deferred**

Replace this block:
```
### Statistics (v1)

- `GET /api/statistics/overview`

Deferred (post-v1):

- `GET /api/statistics/trends`
- `GET /api/statistics/checkouts`
```
with:
```
### Statistics

Deferred (post-v1) — no statistics endpoints ship in v1:

- `GET /api/statistics/overview`
- `GET /api/statistics/trends`
- `GET /api/statistics/checkouts`

v1 captures the dart/turn/session facts statistics are derived from; the aggregated read endpoints are added post-v1 and must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`). <!-- 2026-07-12 -->
```

- [ ] **Step 5: Reconcile the Read Contract table**

Replace the entire Read Contract table:
```
| Endpoint                                 | Source                |
| ---------------------------------------- | --------------------- |
| `GET /api/sessions/active`               | `v_active_sessions`   |
| `GET /api/sessions?limit=&cursor=`       | `v_session_overview`  |
| `GET /api/sessions/:sessionId/replay`    | `v_game_replay`       |
| `GET /api/sessions/:sessionId/darts`     | `v_dart_analytics`    |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` |
```
with:
```
| Endpoint                                 | Source                |
| ---------------------------------------- | --------------------- |
| `GET /api/sessions/active`               | `v_active_sessions`   |
| `GET /api/sessions?limit=&cursor=`       | `v_session_overview`  |
| `GET /api/sessions/:sessionId`           | `v_session_overview`  |
| `GET /api/sessions/:sessionId/replay`    | `v_game_replay`       |
| `GET /api/sessions/:sessionId/darts`     | `v_dart_analytics`    |
| `GET /api/routines`                      | `v_routine_execution` |
| `GET /api/routines/:routineId`           | `v_routine_execution` |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` |
```

- [ ] **Step 6: Extend the read Policy bullets**

Replace this Policy block:
```
Policy:

- replay/analytics endpoints stay close to 1:1 view contracts
- list/overview endpoints may wrap view output for stable API response shape and pagination
```
with:
```
Policy:

- replay/analytics endpoints stay close to 1:1 view contracts
- list/overview endpoints may wrap view output for stable API response shape and pagination
- `GET /api/sessions/:sessionId/darts` is analytics-only: `v_dart_analytics` includes only darts with complete intention data, so it returns an empty array for recreational sessions <!-- 2026-07-12 -->
- `GET /api/routines` projects `v_routine_execution` to one summary row per routine; the routine detail endpoints return the full ordered step set <!-- 2026-07-12 -->
```

- [ ] **Step 7: Update Frozen Decisions**

Replace this line:
```
- Statistics scope (v1): `GET /api/statistics/overview` only; `trends` and `checkouts` are deferred.
```
with:
```
- Statistics scope (v1): no statistics endpoints; `overview`, `trends`, and `checkouts` are all deferred post-v1 and must be view-backed when built. <!-- 2026-07-12 -->
- Session participants (v1): a session has a single server-derived `PLAYER` participant; guest/DartBot play is deferred post-v1. <!-- 2026-07-12 -->
- Activity grouping (v1): one activity per session, server-managed; multi-session activities and routine-run writes are deferred post-v1. <!-- 2026-07-12 -->
```

- [ ] **Step 8: Verify the edits landed and are internally consistent**

Run:
```bash
rg -n "1.1.0 \(frozen|### Statistics\b|GET /api/sessions/:sessionId\` +\| \`v_session_overview|Session participants \(v1\)|Activity grouping \(v1\)" architecture/docs/architecture/06-API/00-Overview.md
rg -n "statistics/overview" architecture/docs/architecture/06-API/00-Overview.md
```
Expected: the first command prints the version line, the `### Statistics` heading, the new `:sessionId` read-table row, and both new Frozen-Decisions lines. The second command shows `GET /api/statistics/overview` appearing **only** inside the Deferred list (one occurrence, under "Deferred (post-v1)"). No occurrence of a `### Statistics (v1)` active section remains — confirm with:
```bash
rg -n "Statistics \(v1\)" architecture/docs/architecture/06-API/00-Overview.md || echo "OK: no active v1 statistics section"
```
Expected: prints `OK: no active v1 statistics section`.

- [ ] **Step 9: Commit**

```bash
git add architecture/docs/architecture/06-API/00-Overview.md
git commit -m "$(cat <<'EOF'
docs(api): defer statistics; reconcile read surface in 00-Overview (v1 freeze)

Move overview/trends/checkouts to Deferred (post-v1, must be view-backed);
add GET /api/sessions/:sessionId and routine list/detail to the Read
Contract table so 00 and 04 agree; note single-PLAYER participant,
capture/input mode on creation, and one-activity-per-session in Frozen
Decisions. Version 1.1.0.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DwZqSzmfG7qJVVZxynmTA5
EOF
)"
```

---

### Task 2: `02-Middleware-And-Layering.md` — provision-exempt route class

**Files:**
- Modify: `architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the three-class route model (`Public` / `Protected` / `Authenticated-unprovisioned`) that Task 3 references when describing the provisioning endpoint's reachability.

- [ ] **Step 1: Update the front-matter date and version**

Replace:
```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```
and replace:
```
> **Version:** 0.1.0
```
with:
```
> **Version:** 0.2.0
```

- [ ] **Step 2: Rename the route-classification row in the ownership table**

Replace:
```
| Route classification (public vs protected)  | Yes                    | —                       |
```
with:
```
| Route classification (public / protected / provision-exempt) | Yes    | —                       |
```

- [ ] **Step 3: Add the Route Classes subsection**

Immediately after the `## Auth responsibility split` table (the row ending `| Service layer | domain authorization (\`SESSION_OWNERSHIP_MISMATCH\`, etc.) |`) and before `## \`locals.auth\` contract`, insert:

```
## Route classes

Middleware classifies every request into exactly one class:

| Class | JWT verified | Player resolved | Members |
| ----- | ------------ | --------------- | ------- |
| Public | No | No | unauthenticated routes (if any) |
| Protected | Yes | Yes — missing player → `403 PLAYER_NOT_PROVISIONED` | all domain routes (sessions, routines) |
| Authenticated-unprovisioned | Yes | Skipped | `POST /api/players/provision` only |

The **authenticated-unprovisioned** class exists because `POST /api/players/provision` must be reachable by a JWT-valid user who has no `players` row yet — precisely the state it resolves. For this class, middleware verifies the JWT and sets `locals.auth.authUserId` from `sub`, but does **not** run player resolution and never returns `PLAYER_NOT_PROVISIONED`. The handler creates or returns the player row. <!-- 2026-07-12 -->

```

- [ ] **Step 4: Update the Middleware Flow diagram**

Replace this block inside the `# Middleware Flow (Conceptual)` fenced diagram:
```
    ├─ verify JWT (sub, exp)
    │   └─ failed → 401 UNAUTHORIZED
    │
    ├─ resolve player from auth_user_id
    │   └─ not found → 403 PLAYER_NOT_PROVISIONED
```
with:
```
    ├─ verify JWT (sub, exp)
    │   └─ failed → 401 UNAUTHORIZED
    │
    ├─ provision-exempt route? → set locals.auth (authUserId only) → next()
    │
    ├─ resolve player from auth_user_id
    │   └─ not found → 403 PLAYER_NOT_PROVISIONED
```

- [ ] **Step 5: Verify the edits landed**

Run:
```bash
rg -n "Route classes|Authenticated-unprovisioned|provision-exempt route\?" architecture/docs/architecture/06-API/02-Middleware-And-Layering.md
```
Expected: prints the `## Route classes` heading, the `Authenticated-unprovisioned` table row + explanatory sentence, and the new `provision-exempt route?` branch in the flow diagram (at least 3 matches).

- [ ] **Step 6: Commit**

```bash
git add architecture/docs/architecture/06-API/02-Middleware-And-Layering.md
git commit -m "$(cat <<'EOF'
docs(api): add provision-exempt route class to middleware layering

Introduce the authenticated-unprovisioned route class (JWT verified,
player resolution skipped) so POST /api/players/provision is reachable by
a JWT-valid user with no players row. Update the middleware flow diagram
and ownership table. Version 0.2.0.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DwZqSzmfG7qJVVZxynmTA5
EOF
)"
```

---

### Task 3: `04-Endpoint-Contracts.md` — creation contract + reads reconciliation

**Files:**
- Modify: `architecture/docs/architecture/06-API/04-Endpoint-Contracts.md`

**Interfaces:**
- Consumes: the Read Contract surface frozen in Task 1 (must match), and the provision route class from Task 2.
- Produces: `CreateSessionRequest` with `captureModeKey`, `inputModeKey`; `CreateSessionResponse` with `participants: ParticipantRef[]`; the `participantRef` → creation-ref resolution rule on the write path.

- [ ] **Step 1: Update the front-matter date and version**

Replace:
```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```
and replace:
```
> **Version:** 0.1.0 (draft)
```
with:
```
> **Version:** 0.2.0 (draft)
```

- [ ] **Step 2: Add the `participantRef` resolution rule to the write path**

In the Write Path `**Rules:**` list, replace:
```
- Referential failures (`clientKey` lookup, `parentClientKey` tree breaks) → `BATCH_INCONSISTENT_ORDERING` or `BATCH_REFERENCE_MISSING`.
```
with:
```
- Referential failures (`clientKey` lookup, `parentClientKey` tree breaks) → `BATCH_INCONSISTENT_ORDERING` or `BATCH_REFERENCE_MISSING`.
- `TurnFact.participantRef` must match a participant `ref` returned by `POST /api/sessions`; an unmatched ref → `BATCH_REFERENCE_MISSING`. In v1 there is exactly one (the `PLAYER`). <!-- 2026-07-12 -->
```

- [ ] **Step 3: Update the session-creation Zod sketch**

Replace this block:
```
const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),                   // game_types.implementation_key
  rulesetVersionKey: z.string(),             // ruleset_versions.implementation_key
  config: ConfigInput,
});
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

const CreateSessionResponse = z.object({
  sessionId: z.string(),                     // server-generated UUIDv7
});
type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;
```
with:
```
const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),                   // game_types.implementation_key
  rulesetVersionKey: z.string(),             // ruleset_versions.implementation_key
  captureModeKey: z.string(),                // capture_modes.implementation_key (RECREATIONAL | ANALYTICS)
  inputModeKey: z.string(),                  // input_modes.implementation_key (QUICK_SCORE | DETAILED_DARTS)
  config: ConfigInput,
});
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

// v1: the server derives a single PLAYER participant; the response returns its
// ref so the client can populate TurnFact.participantRef on the batch write.
const ParticipantRef = z.object({
  ref: z.string(),                           // referenced by TurnFact.participantRef
  participantTypeKey: z.string(),            // participant_types.implementation_key (v1: always PLAYER)
  displayName: z.string(),                   // copied from players.display_name
});
const CreateSessionResponse = z.object({
  sessionId: z.string(),                     // server-generated UUIDv7
  participants: z.array(ParticipantRef),     // v1: exactly one (PLAYER)
});
type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;
```

- [ ] **Step 4: Update the creation Outcomes bullets**

Replace this block:
```
**Outcomes:**

- Server creates activity / exercise session / config snapshot row / participant references.
- Config is **always** copied (materialized as an `exercise_configurations` snapshot), never referenced.
- Returns server-generated `sessionId` (UUIDv7), enclosed in standard `ok()` envelope.
- Template resolution or config validation failure → error using an appropriate code from the error-code registry in `03-Shared-Conventions.md` (do not introduce ad-hoc codes here).
```
with:
```
**Outcomes:**

- Server creates activity / exercise session / config snapshot row / participant(s).
- `captureModeKey` and `inputModeKey` are required and stored on the session (self-describing runtime record); both are validated against the ruleset (a ruleset may require `ANALYTICS` / `DETAILED_DARTS`). <!-- 2026-07-12 -->
- **Participants (v1):** the server derives exactly one participant of type `PLAYER` for the authenticated player, `displayName` copied from `players.display_name`, and returns its `ref`. Guest/DartBot participants are deferred post-v1 (added later as an optional `participants[]` input — additive, non-breaking). <!-- 2026-07-12 -->
- **Activity (v1):** the session's activity is created and managed server-side, one activity per session; multi-session activities and routine-run writes are deferred post-v1. <!-- 2026-07-12 -->
- Config is **always** copied (materialized as an `exercise_configurations` snapshot), never referenced.
- Returns server-generated `sessionId` (UUIDv7) and participant ref(s), enclosed in standard `ok()` envelope.
- Template resolution or config validation failure → error using an appropriate code from the error-code registry in `03-Shared-Conventions.md` (do not introduce ad-hoc codes here).
```

- [ ] **Step 5: Remove the statistics row from the Read Contracts table and add a deferral note**

Replace this table row (delete it entirely):
```
| `GET /api/statistics/overview` | overview aggregation | object | 2026-07-10 |
```
so the table ends at the routine `execution` row. Then, immediately after the read-contracts table and before the line beginning `` `v_routine_execution` backs both ``, insert:

```
**Deferred (post-v1):** `GET /api/statistics/overview`, `GET /api/statistics/trends`, `GET /api/statistics/checkouts`. Statistics endpoints do not ship in v1; when built they must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`) per the view-backed-reads rule. v1 stores all dart/turn/session facts these derive from. <!-- 2026-07-12 -->

```

- [ ] **Step 6: Strengthen the routine-list aggregation note**

Replace:
```
`v_routine_execution` backs both the routine list and the single-routine execution detail; the list projects summary columns and the detail returns the full execution definition.
```
with:
```
`v_routine_execution` is step-level; it backs both the routine list and the single-routine execution detail. The list **aggregates step rows to one summary row per routine** (distinct on routine identity) for `RoutineSummary`; the detail returns the full ordered step set. A dedicated `v_routine_summary` view may be introduced later if service-layer aggregation proves awkward; it is not required for v1. <!-- 2026-07-12 -->
```

- [ ] **Step 7: Add the darts analytics-only note**

Replace the Authorization line at the end of the Read Contracts section:
```
**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.
```
with:
```
**Analytics-only darts:** `GET /api/sessions/:sessionId/darts` (`v_dart_analytics`) includes only darts with complete intention data and returns an empty array for recreational sessions — expected behaviour, not an error. <!-- 2026-07-12 -->

**Authorization:** All reads are player-scoped; filters applied at view level or service layer ensure only the requesting player's data is returned.
```

- [ ] **Step 8: Verify the edits landed and match Task 1**

Run:
```bash
rg -n "captureModeKey|inputModeKey|ParticipantRef|participants: z.array|participantRef must match|Deferred \(post-v1\):|aggregates step rows|Analytics-only darts" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
rg -n "overview aggregation" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md || echo "OK: no viewless statistics read remains"
```
Expected: the first command prints all eight anchors (creation fields, `ParticipantRef`, response array, write-path rule, deferral note, aggregation note, darts note). The second prints `OK: no viewless statistics read remains` (the `overview aggregation` source row is gone).

Then confirm `00` and `04` agree on the active read surface:
```bash
rg -n "statistics/overview" architecture/docs/architecture/06-API/00-Overview.md architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
```
Expected: every match is inside a "Deferred" context in both files; neither file lists `statistics/overview` as an active endpoint.

- [ ] **Step 9: Commit**

```bash
git add architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
git commit -m "$(cat <<'EOF'
docs(api): close creation-contract gaps and defer stats in 04-Endpoint-Contracts

CreateSessionRequest gains captureModeKey + inputModeKey; response returns
the server-derived single PLAYER participant ref; add participantRef
resolution rule on the batch write. Defer statistics endpoints, document
routine-list aggregation and analytics-only darts. Version 0.2.0.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DwZqSzmfG7qJVVZxynmTA5
EOF
)"
```

---

### Task 4: `07-Frontend/00-Overview.md` — statistics reads are post-v1

**Files:**
- Modify: `architecture/docs/architecture/07-Frontend/00-Overview.md`

**Interfaces:**
- Consumes: the statistics-deferral decision from Tasks 1 and 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update the front-matter date and version**

Replace:
```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```
and replace:
```
> **Version:** 0.1.0
```
with:
```
> **Version:** 0.1.1
```

- [ ] **Step 2: Add the v1 statistics note to the client structure section**

Immediately after the fenced `Recommended Client Structure` code block (the block ending with the `token.ts` line and its closing ```` ``` ````), before `## Client wrapper responsibilities`, insert:

```
> **v1 note:** statistics API endpoints are deferred post-v1 (see `../06-API/00-Overview.md`), so `lib/api/statistics.ts` and any statistics page are post-v1 additions. v1 focuses on capturing gameplay facts and the session/routine reads. <!-- 2026-07-12 -->

```

- [ ] **Step 3: Verify the edit landed**

Run:
```bash
rg -n "v1 note:.*statistics API endpoints are deferred|0.1.1" architecture/docs/architecture/07-Frontend/00-Overview.md
```
Expected: prints the version line `0.1.1` and the new `> **v1 note:**` line.

- [ ] **Step 4: Commit**

```bash
git add architecture/docs/architecture/07-Frontend/00-Overview.md
git commit -m "$(cat <<'EOF'
docs(frontend): note statistics reads are post-v1

Statistics API endpoints are deferred (see 06-API/00-Overview); mark
lib/api/statistics.ts and any statistics page as post-v1 additions.
Version 0.1.1.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DwZqSzmfG7qJVVZxynmTA5
EOF
)"
```

---

### Task 5: `DECISIONS.md` + `00-Context-Map.md` — ledger, map, and full consistency gate

**Files:**
- Modify: `architecture/DECISIONS.md`
- Modify: `architecture/docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: all prior edits (records them and gates the whole change set).
- Produces: passing `scripts/check-context-map.sh`.

- [ ] **Step 1: Amend the superseded D36 line in `DECISIONS.md`**

Replace:
```
| D36 | 2026-07-08 | Statistics v1 scope = `GET /api/statistics/overview` only; trends/checkouts deferred | Scope control |
```
with:
```
| D36 | 2026-07-08 | Statistics v1 scope = `GET /api/statistics/overview` only; trends/checkouts deferred (superseded by D63, 2026-07-12: overview also deferred) | Scope control |
```

- [ ] **Step 2: Append the new API decision rows**

In the `## API (v1 baseline frozen 2026-07-08)` table, after the `D37` row, add:
```
| D60 | 2026-07-12 | `POST /api/sessions` requires `captureModeKey` + `inputModeKey`; every session self-describes its capture/input mode | `exercise_sessions` NOT-NULL mode columns need an input path |
| D61 | 2026-07-12 | v1 session is single-participant (server-derived `PLAYER`); guest/DartBot deferred as additive `participants[]` | Close participant gap without multiplayer scope |
| D62 | 2026-07-12 | Provision-exempt route class: `POST /api/players/provision` is JWT-verified but skips player resolution | Endpoint must be reachable by an unprovisioned user |
| D63 | 2026-07-12 | Statistics endpoints (overview/trends/checkouts) fully deferred post-v1; each must be view-backed when built | No viewless read at freeze; acquire the data first |
| D64 | 2026-07-12 | v1 = one activity per session, server-managed; multi-session activities + routine-run writes deferred | Defer, not contradict, the activities-group-sessions model |
```

- [ ] **Step 3: Update the Deferred line in `DECISIONS.md`**

Replace:
```
ROUTINE_RUN entity (P25) · `board_segments` lookup (P37) · dart coordinates `location_x/y` (P67, until UI capture) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics trends/checkouts endpoints (post-v1) · JSONB config key vocabulary review against game engines.
```
with:
```
ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12) · multi-session activities (2026-07-12) · guest/DartBot participants (2026-07-12) · `board_segments` lookup (P37) · dart coordinates `location_x/y` (P67, until UI capture) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics endpoints overview/trends/checkouts + `v_statistics_overview` view (post-v1, 2026-07-12) · JSONB config key vocabulary review against game engines.
```

- [ ] **Step 4: Update the `DECISIONS.md` front-matter date**

Replace:
```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```

- [ ] **Step 5: Update `00-Context-Map.md` front-matter, version, and API state row**

Replace:
```
updated: 2026-07-11
```
with:
```
updated: 2026-07-12
```
Replace:
```
> **Version:** 1.0.0 (2026-07-11)
```
with:
```
> **Version:** 1.0.1 (2026-07-12)
```
Replace this Current Implementation State row:
```
| API docs | v1 baseline frozen; contracts `00`–`04` (2026-07-10) |
```
with:
```
| API docs | v1 baseline frozen; contracts `00`–`04`; freeze validation reconciliation (2026-07-12) |
```

- [ ] **Step 6: Run the context-map consistency gate**

Run:
```bash
bash scripts/check-context-map.sh
```
Expected: prints `OK: context map, references, migration ranges, and front-matter are consistent.` and exits 0. If it prints any `FAIL:` line, fix the referenced file (most likely a mistyped path or a missing front-matter date) and re-run until it prints `OK`.

- [ ] **Step 7: Full cross-document consistency check**

Run:
```bash
rg -n "statistics/overview" architecture/docs/architecture/06-API/00-Overview.md architecture/docs/architecture/06-API/04-Endpoint-Contracts.md architecture/docs/architecture/07-Frontend/00-Overview.md
rg -n "D60|D61|D62|D63|D64" architecture/DECISIONS.md
```
Expected: first command shows `statistics/overview` only in Deferred contexts across the three docs (no active endpoint anywhere); second command prints all five new ledger rows.

- [ ] **Step 8: Commit**

```bash
git add architecture/DECISIONS.md architecture/docs/architecture/00-Context-Map.md
git commit -m "$(cat <<'EOF'
docs(context): record v1 freeze validation decisions (D60-D64); update map

Append D60-D64 for capture/input mode, single-participant v1, provision
route class, statistics deferral, and one-activity-per-session; mark D36
superseded; refresh the Deferred list. Bump context map to 1.0.1 and note
the 2026-07-12 reconciliation. check-context-map.sh passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DwZqSzmfG7qJVVZxynmTA5
EOF
)"
```

- [ ] **Step 9: Push the branch**

```bash
git push -u origin claude/v1-api-freeze-bjus0o
```
Expected: push succeeds. Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) only on network failure.

---

## Notes for the implementer

- This plan touches only docs; there is no build or test suite to run. The verification steps ARE the tests — run each `rg`/`bash` command and confirm the stated expected output before committing.
- If any "replace X with Y" block does not match verbatim (a doc drifted since 2026-07-12), stop and re-read the current file section rather than force a fuzzy edit — the surrounding docs use exact table formatting that must be preserved.
- Do not add any endpoint, field, or view beyond what is listed. Deferred items are named as future work only.
