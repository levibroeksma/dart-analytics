# Context Summary — Prompts 41–45

**Handoff note:** This phase corrects documentation process drift, freezes the doc hierarchy, and drafts the first four foundation architecture documents sequentially. Builds on `001_context.md` through `007_context.md`.

**Formal outputs:** `architecture/docs/architecture/00-README.md` through `04-Architecture-patterns.md` (and subfolders) live in the repo. This file captures conversational decisions — not the full document text.

---

## Phase Objective

Establish **strict sequential documentation discipline**, freeze the handbook structure, and draft foundation docs `01`–`03` before database/SQL work. Polish pass deferred until all drafts exist.

---

## Process Correction (Prompt 41)

Client flagged inconsistency: architect proposed one doc tree but wrote documents out of order and merged lifecycle + decision framework without formal revision.

**Violation acknowledged:** improvised instead of following the documented workflow — the same drift the project aims to prevent.

### Formal structure revision (before continuing)

Merged into single file:

```
03-Development-Lifecycle.md + 04-Decision-Making-Framework.md
    → 03-Engineering-Workflow.md
```

Renumbered: **`04-Architecture-Patterns.md`** (recipe catalog).

### Frozen documentation hierarchy

```
architecture/
  00-README.md
  01-Principles.md
  02-System-Architecture.md
  03-Engineering-Workflow.md
  04-Architecture-Patterns.md
  05-Database/   (00-Overview … 05-Views)
  06-API/        (00-Overview … 04-Transactions)
  07-Frontend/   (00-Overview … 04-Performance)
  08-AI/         (00-Agent-Guide … 02-Code-Review)
  09-ADR/
```

**New rule:** Documentation hierarchy is immutable during implementation. Structural changes require deliberate review and an ADR — same bar as schema changes.

### Strict execution order

1. Complete and freeze `00`–`04` foundation docs
2. Then `05-Database/` subdocs
3. Then SQL migrations

No jumping ahead.

---

## Draft Strategy (Prompt 42)

Client agreed: **draft all core documents first**, then a refinement pass to raise 9.x → 10/10. Avoid polishing one doc in isolation before others exist (enterprise pattern: draft → freeze v1 → holistic review → improve → freeze).

---

## `01-Principles.md` (Prompt 42)

Positioned as the **project constitution** — technology-independent (valid if Astro/Neon replaced). Answers "why is it implemented this way?"

### Six core values

Correctness → Simplicity → Consistency → Maintainability → Extensibility → Performance (decision priority order when tradeoffs arise).

### Principle categories drafted

- **Architectural:** architecture first, single source of truth, separation of concerns, cohesion, loose coupling, progressive architecture
- **Data:** database first, immutable runtime, replayability, derived statistics, normalize first, constraints over app logic
- **API:** expose domain, don't become second database
- **Frontend:** UX owner, not primary business logic owner
- **Documentation:** part of software; outdated docs = defect
- **AI:** same standards as humans; never invent architecture

### Self-review gap (deferred to polish pass)

Proposed **Architectural Axioms** section — six non-negotiable invariants stronger than principles:

1. Database is authoritative domain truth
2. Completed gameplay is immutable
3. Every statistic reproducible from recorded gameplay
4. Every layer has single responsibility
5. Significant arch changes require ADR
6. Architecture documentation takes precedence over implementation

Rated 9.8/10 pending axioms.

---

## `02-System-Architecture.md` (Prompt 43)

Answers **how the system is organized** — still technology-agnostic (Frontend / PostgreSQL, not Astro / Neon).

### Four system layers

```
Presentation → Application → Persistence → Storage
```

| Layer | Responsibility |
|-------|----------------|
| Presentation | UI, rendering, temporary state, UX |
| Application | Workflows, auth, validation, transactions, repositories |
| Persistence | SQL, views, constraints, modelling |
| Storage | Physical DB, indexes, backups |

Frontend never talks to PostgreSQL; API is sole gateway.

### Four domain areas (data architecture)

```
Reference → Templates → Runtime → Analytics
```

Aligns with frozen DB layer model from earlier prompts.

### Data flows

**Write:** User → Frontend (client state) → session complete → **single API transaction** → DB.

**Read:** PostgreSQL → Views → Repository → API → Frontend. Statistics from views, not app code duplication.

### Ownership table (frozen)

| Responsibility | Owner |
|----------------|-------|
| Persistent data, referential integrity | PostgreSQL |
| Orchestration, auth, validation | API |
| UI, temporary state | Frontend |
| Architecture | Documentation |

Adjacent-layer communication only. Replay depends solely on immutable runtime data, never current templates.

### Self-review gap (deferred)

Missing **Runtime Lifecycle** section — activity → exercise → config snapshot → stages → turns → darts → completion. Identified as fundamental, not implementation detail. To add in refinement pass.

Rated 9.9/10.

---

## `03-Engineering-Workflow.md` (Prompt 44)

Merged lifecycle + decision framework. Scope expanded to full **engineering lifecycle** (design, reviews, docs, AI, releases) — not just coding steps.

### Ten phases

```
Request → Discovery → Analysis → Architecture → Design → Review
    → Implementation → Validation → Documentation → Release
```

No phase skipped. Major arch changes require ADR before implementation.

### Decision framework sections

Problem understanding → existing functionality reuse → architecture ownership → database (schema, replay, immutability) → API → frontend → documentation.

### AI workflow

Same phases as humans. Before code: verify context, architecture, existing patterns. Request clarification when insufficient. Never invent architecture.

### Definition of done

Working code alone insufficient — requires validation, docs, migrations reviewed, API verified, arch consistency.

Rated 9.9/10.

### Insight for `04-Architecture-Patterns.md`

Repeated quality themes (replayability, ownership, cohesion, immutability, normalization) are **quality gates**, not workflow steps. Proposed **Architecture Review Matrix** (ATAM-inspired) for doc 04:

| Attribute | Example gate |
|-----------|--------------|
| Single Responsibility | One reason to change per component? |
| Replayability | Session still replayable exactly? |
| Historical Integrity | Runtime immutable? |
| Normalization | Unnecessary duplication? |
| Extensibility | Extend without redesign? |
| Performance | Evidence-based optimization? |
| Consistency | Follows existing patterns? |

Doc 04 to combine **recipe patterns** (add game type, endpoint, view, etc.) with this matrix.

---

## Status at End of File

| Document | Status in chat |
|----------|----------------|
| `00-README.md` | Drafted earlier (Prompt 39–40) |
| `01-Principles.md` | Drafted (Prompt 42) |
| `02-System-Architecture.md` | Drafted (Prompt 43) |
| `03-Engineering-Workflow.md` | Drafted (Prompt 44) |
| `04-Architecture-Patterns.md` | **Next** — matrix + recipes proposed, not yet drafted |
| `05-Database/` | After foundation freeze |
| SQL migrations | After database docs |

Prompt 45 content is not present in the source file; phase ends with `03` drafted and `04` scoped.

---

## Change Log vs 007_context.md

| Earlier (007) | Revised (41–44) |
|---------------|-----------------|
| Doc structure proposed loosely | **Frozen hierarchy** with merge of lifecycle + decision framework |
| Jumped to SQL / patterns early | **Sequential discipline** enforced; client correction |
| `03-Engineering-Workflow` drafted once | Expanded 10-phase lifecycle draft |
| Principles / system arch implied | Full drafts of `01` and `02` |
| Patterns doc mentioned | Scoped as patterns + ATAM review matrix |
| Polish as you go | **Draft all → holistic refine → freeze v1.0** |

---

## Open at End of Phase

- Draft `04-Architecture-Patterns.md` (recipes + review matrix)
- Refinement pass: axioms in `01`, runtime lifecycle in `02`, elevate all to 10/10
- `05-Database/` subdocuments
- `000_extensions.sql` and migration chain (deferred until foundation docs frozen)
- `06-API/`, `07-Frontend/`, `08-AI/` — planned, not started in this range

---

## Next Phase (agreed)

1. Draft `04-Architecture-Patterns.md`
2. Holistic review of `00`–`04`
3. `05-Database/` documentation, then migrations one-by-one
