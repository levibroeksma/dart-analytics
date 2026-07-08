# Context Summary — Prompts 64–67

**Handoff note:** This phase completes the initial migration foundation (`0009_views`), plans synchronization of `05-Database/` docs with implementation, and begins doc-by-doc review starting with `00-Overview.md`. Builds on `001_context.md` through `014_context.md`.

**Formal outputs:** `architecture/docs/database/migrations/0009_views.sql` and updated `05-Database/` docs live in the repo. This file captures conversational decisions — not full view DDL or document text.

---

## Phase Objective

Finish **API read models** (views migration), **align architecture docs** with implemented schema, and **validate** `00-Overview.md` against frozen design.

---

## `0009_views.sql` (Prompt 64)

Final migration in initial database foundation. Establishes the **read model** layer.

### Principle (reaffirmed)

| Layer | Role |
|-------|------|
| Tables | Source of truth |
| Views | Application-facing read models |
| Materialized views | Future optimization only when proven necessary |

API consumes views — not raw table structures.

### Initial view set (5 views)

| View | Purpose | API use case |
|------|---------|--------------|
| `v_active_sessions` | Resume interrupted games | App startup / refresh recovery |
| `v_session_overview` | Completed session summaries | History list |
| `v_game_replay` | Chronological gameplay reconstruction | `GET /sessions/{id}/replay` |
| `v_dart_analytics` | Analytics-ready dart dataset (intended vs hit, zones, `exact_hit`) | Statistics endpoints |
| `v_routine_execution` | Ordered routine step definitions | Routine execution UI |

Views join reference `implementation_key` values (e.g. `game_type_key`, `capture_mode_key`) — not IDs alone.

### Architectural recommendation

Expose **both** UUID and `implementation_key` in API-facing data:

```json
{ "game_type_id": "uuid", "game_type_key": "501" }
```

UUID = DB identity; `implementation_key` = stable application contract.

### Views assume evolved dart model

`v_game_replay` and `v_dart_analytics` reference:

- `intended_target_number`, `hit_target_number`
- `intended_zone_id`, `hit_zone_id` → `dart_zones` lookup

Implies `0006`/`0007` were extended beyond the Prompt 63 draft (dart zones, intended/hit fields) before views were written. Not detailed in this file range.

### Foundation complete (Prompt 64)

```
0001_extensions → 0009_views  ✅
```

### Suggested next steps (chat)

1. Sync `05-Database/06`–`09` markdown with implementation
2. Create `database/README.md`
3. Final schema review vs original requirements (501, TUOD, singles, routines, analytics, replay, commercialization)
4. Move to API architecture, repository contracts, service boundaries

---

## Documentation Sync Plan (Prompt 65)

Migrations evolved design; markdown must reflect **frozen implementation** or AI agents follow stale assumptions.

Document-by-document change list (architect's spec — to be applied incrementally):

| Doc | Action |
|-----|--------|
| `00-Overview` | ADD database layers, read model layer; REMOVE API-queries-tables, config-in-game-tables |
| `01-Naming` | UPDATE UUID section (hybrid UUID/SMALLINT); ADD implementation keys |
| `02-Design-Rules` | ADD immutable runtime, facts vs derived, controlled denormalisation (`turn.total_score`) |
| `03-Migrations` | REPLACE with actual `0001`–`0009` order; ADD seeds section |
| `04-Indexes` | ADD FK-not-auto-indexed philosophy, partial indexes for active sessions |
| `05-Views` | REPLACE intro; ADD five current views with purposes |
| `06-Data-Model` | UPDATE entity list; ADD runtime hierarchy, dart intention+result model |
| `07-Data-Model-Review` | UPDATE final score 9.8/10; ADD improvements achieved |
| `08-Physical-Schema-Mapping` | ADD hybrid ID strategy, runtime event model |
| `09-Pre-Implementation-Review` | ADD completed foundation checklist |
| **`10-Database-Agent-Guide`** | **NEW** — recommended for AI agents (where to add tables, enums, views, migrations) |

Approach agreed: **one document at a time**, compare doc → implementation → fix only deviations.

---

## `00-Overview.md` Review (Prompts 66–67)

Client updated `00-Overview` per suggestions; architect reviewed against migrations `0001`–`0009`.

### Verdict

**9.5/10 — aligned; do not rewrite.** Targeted corrections only.

### Required changes

| # | Issue | Fix |
|---|-------|-----|
| 1 | Identifier section says "all UUIDv7" — contradicts Reference Layer (SMALLINT) | Split: domain entities → UUIDv7; reference entities → SMALLINT |
| 2 | Layer stack jumps Runtime → Analytics; earlier doc added Read Model Layer | Insert: Runtime → **Read Model** → Analytics |
| 3 | Future schema split wording too vague | Add criteria: unclear ownership, security isolation, deployment independence |
| 4 | "Runtime immutable after completion" too strict | Active sessions mutable during play; immutable only after completion |
| 5 | Configuration chain missing ruleset versions | Add: session references exact `ruleset_version` active at start |
| 6 | Missing Runtime Event Model section | ADD hierarchy Session → Stage → Turn → Dart; dart stores intended/actual target+zone |
| 7 | Auth ownership thin | ADD: DB never stores credentials; external auth ID only |
| 8 | Anti-goals incomplete | ADD: no transient UI state, no derivable statistics as stored columns |
| 9 | "API represents processes" ambiguous | Change to "application behaviour and business workflows" |

### Remove

Nothing — structure is sound.

### After corrections

Freeze `00-Overview.md`. Next: review `01-Naming-Conventions.md` same way.

---

## Implementation vs documentation gaps (noted in range)

| Topic | Implementation (by `0009`) | Docs still catching up |
|-------|------------------------------|------------------------|
| Dart model | `dart_zones`, intended/hit targets | `06-Data-Model`, `00-Overview` event section |
| View naming | `v_*` prefix in SQL | `05-Views.md` doc used `vw_*` in earlier design — align on actual `v_*` |
| `exercise_configurations` | May still be JSONB or evolved in `0007` | Physical mapping / data model |
| Read Model vs Analytics layers | Distinct in overview fix | Terminology unified in doc pass |

---

## Change Log vs 014_context.md

| Earlier (014) | Revised (64–67) |
|---------------|-----------------|
| `0007`–`0009` next | **`0009_views` drafted** — foundation complete |
| Dart model open before constraints | Views assume **extended dart + dart_zones** |
| Docs behind implementation | **Sync plan** for all `05-Database/` files |
| — | **`00-Overview` review** with 9 targeted fixes |
| — | Proposed **`10-Database-Agent-Guide.md`** |

---

## Open at End of Phase

- Apply `00-Overview` corrections and freeze
- Review `01`–`09` docs one-by-one (only `00` reviewed in this range)
- Draft `10-Database-Agent-Guide.md`
- `database/README.md` (execution order)
- Final requirements traceability review (501, TUOD, singles, routines, analytics, replay)
- API layer documentation (`06-API/`)

---

## Next Phase (agreed)

1. Finalize `00-Overview.md` with listed corrections
2. Review `01-Naming-Conventions.md` against implementation
3. Continue doc sync through `05-Database/` set, then API architecture
