# Context Summary — Prompts 72–74

**Handoff note:** This phase advances **doc sync** using a new delivery format: **complete file replacements** instead of fragmented nested-markdown edits. Rewrites `05-Database/00-Overview`, `01-Naming-Conventions`, and `02-Design-Rules` aligned with frozen migrations `0001`–`0009`. Builds on `001_context.md` through `016_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/00-OVERVIEW.md`, `01-Naming-Conventions.md`, and `02-Design-Rules.md` already exist in the repo. Do **not** regenerate; validate against this summary and `000_master_context.md`.

---

## Phase Objective

Synchronize the first three database handbook documents with implemented schema and frozen architectural decisions — in copy-paste-ready full documents.

---

## Process Change (Prompt 72)

**User feedback:** Prior doc-review responses used markdown-in-markdown nesting, making changes impossible to extract reliably.

**Frozen workflow for doc reviews:**

| Before | After |
|--------|-------|
| Incremental nested suggestions | **Single complete replacement document** per file |
| Partial diffs across nested fences | One copy-paste-ready `md` block replacing the entire file |

Applies to all subsequent `05-Database/` doc sync (`03`–`09`, `10-Database-Agent-Guide`).

---

## `00-Overview.md` — Complete Rewrite (Prompt 72)

Replaces prior incremental review (Prompts 66–67 nine targeted fixes) with one authoritative document.

### Key content frozen

| Section | Decision |
|---------|----------|
| **Five layers** | Reference → Template → Runtime → **Read Model** → Analytics |
| **Runtime event model** | Session → Stage → Turn → Dart; dart stores intended/hit target + zone + score |
| **Identifier strategy** | Domain entities UUIDv7; reference entities SMALLINT (`dart_zones`, statuses, etc.) |
| **Auth ownership** | DB never stores credentials; external auth ID only |
| **Mutability** | Active runtime mutable during play; completed runtime immutable |
| **Configuration chain** | Template → Snapshot → Runtime; sessions reference exact **ruleset version** at start |
| **Rulesets** | Immutable after publication; changes = new version |
| **Views** | API consumes views, not raw tables — stable read contracts |
| **Query workloads** | Transactional (writes, active state) vs analytical (views, future MVs when justified) |
| **Schema organization** | Single `public` schema; split only when ownership/security/deployment require it |
| **Anti-goals** | No UI state, workflow engine, analytics cache as second truth, derivable stats as columns |
| **Responsibility split** | DB = reality; API = application behaviour and business workflows; frontend = interaction |

### Status

Document intended as **frozen** after replacement. Next in sequence: `01-Naming-Conventions.md`.

---

## `01-Naming-Conventions.md` — Complete Rewrite (Prompt 73)

Aligned with hybrid ID strategy and implemented naming in migrations `0001`–`0009`.

### Key conventions frozen

| Topic | Rule |
|-------|------|
| **Formatting** | lowercase `snake_case`; plural table names |
| **Primary keys** | Always `id` (not `player_id` on same table) |
| **Foreign keys** | `<referenced_table_singular>_id` |
| **Domain IDs** | UUID columns suffixed `_id` |
| **Reference IDs** | `id SMALLINT` on lookup tables |
| **Implementation keys** | `implementation_key TEXT NOT NULL UNIQUE`; immutable after publication; API/frontend contract |
| **Display names** | `name` column; may change unlike `implementation_key` |
| **Booleans** | Prefix `is_`, `has_`, `can_`, `should_` |
| **Timestamps** | `TIMESTAMPTZ`; `created_at`, `updated_at`, lifecycle `started_at`/`completed_at` |
| **Status** | `status_id` → reference table; avoid `status TEXT` or lone `is_finished` when multiple states |
| **JSONB** | Purposeful names (`configuration`); avoid generic `data`/`payload`/`object` |
| **Views** | `v_<purpose>` (e.g. `v_active_sessions`, `v_dart_analytics`) |
| **Indexes** | `idx_<table>_<columns>`; partial indexes same pattern |
| **Constraints** | `fk_`, `uq_`, `chk_` prefixes |
| **Enums** | **No PostgreSQL enums** for domain — use reference tables |
| **Migrations** | `0001_<description>.sql`; sequential; one responsibility |
| **Seeds** | `0001_<description>.sql`; deterministic stable IDs |
| **Column order** | `id` → FKs → domain → config → timestamps |

---

## `02-Design-Rules.md` — Complete Rewrite (Prompt 74)

Governing rule set for migrations, views, and AI-assisted DB changes.

### Core rules frozen

| Rule | Detail |
|------|--------|
| **Relational-first** | Normalize first; denormalize only with evidence |
| **Single source of truth** | Auth → provider; gameplay → runtime; stats → views |
| **Facts vs derived** | Store intended/hit zone facts; derive accuracy, miss direction, averages in views |
| **Controlled denormalisation** | `turn.total_score` allowed; must document source of truth, update owner, reason |
| **Runtime immutability** | Completed gameplay never overwritten; corrections explicit |
| **Configuration snapshots** | Historical sessions must not depend on mutable templates or latest ruleset |
| **Ruleset versioning** | Published rulesets frozen; v2 for changes; sessions keep v1 reference |
| **JSONB scope** | OK for `exercise_configurations.configuration`; not for relationships, core entities, hot-query fields |
| **Views** | Preferred API read interface; hide schema complexity |
| **Indexes** | Query-pattern driven; not every FK/column |
| **Constraints** | DB prevents invalid states; app validation complements, does not replace |
| **Migrations** | One responsibility; deterministic; never modify deployed migrations |
| **Seeds** | Reference data only; no user/runtime data |
| **Schema evolution** | Five questions before new table (domain concept?, owner?, persistent?, derivable?, existing entity?) |
| **AI development** | Same standards as human; review entities, ownership, fact vs derived before changes |

---

## Change Log vs 016_context.md

| Earlier (016) | Revised (72–74) |
|---------------|-----------------|
| `00-Overview` 9 targeted fixes pending | **`00-Overview` full rewrite — intended frozen** |
| Doc sync planned for `01`–`09` | **`01-Naming` and `02-Design-Rules` rewritten** |
| Incremental doc review | **Full-document replacement workflow** adopted |
| Controlled denormalisation in migrations only | **Documented in `02-Design-Rules`** |
| View prefix `v_*` in SQL | **Formalized in `01-Naming`** |

---

## Open at End of Phase

- Validate `00-OVERVIEW.md`, `01-Naming-Conventions.md`, `02-Design-Rules.md` against repo (do not regenerate)
- Continue full-document rewrites: **`03-Migrations.md`** next (per Prompt 65 sync plan)
- Then `04-Indexes`, `05-Views`, `06-Data-Model`, `07-Data-Model-Review`, `08-Physical-Schema-Mapping`, `09-Pre-Implementation-Review`
- Draft `10-Database-Agent-Guide.md`
- `database/README.md`; final requirements traceability review

---

## Next Phase (agreed)

1. Full rewrite `03-Migrations.md` (actual `0001`–`0009` order + seeds section)
2. Continue doc-by-doc through `09`
3. API architecture (`06-API/`)
