# Context Mapping Optimization — Implementation Plan

> **Date:** 2026-07-11
> **Status:** Proposed (plan only — no existing files were modified)
> **Goal:** Make it fast and cheap for a fresh agent session to find exactly the context it needs, and nothing more. Reduce tokens loaded per task while keeping architectural authority intact.

---

## 1. Measured Baseline (2026-07-11)

Token estimates use the standard ~4 bytes/token heuristic.

### 1.1 Repository documentation footprint

| Corpus | Size | ~Tokens | Share of all repo markdown |
| ------ | ---- | ------- | -------------------------- |
| `conversations/` (2 files) | 575 KB | ~140k | 30% |
| `original-conversation/` (21 prompt logs + 20 summaries) | 759 KB | ~190k | 39% |
| `docs/superpowers/` (specs/plans/handoffs) | 187 KB | ~47k | 10% |
| `architecture/docs/architecture/` (canonical docs) | 233 KB | ~58k | 12% |
| `architecture/docs/database/` (SQL + READMEs) | 61 KB | ~15k | 3% |
| Everything else (app README, skills, CLAUDE.md files) | ~131 KB | ~33k | 6% |

**~69% of all markdown is raw conversation history.** None of it is needed for implementation work, yet it sits in searchable paths, pollutes `Grep`/`Glob` results, and is explicitly referenced from the root `CLAUDE.md` as reading material.

### 1.2 Cost of the mandated read order (per fresh session)

| Reading tier | Files | Size | ~Tokens |
| ------------ | ----- | ---- | ------- |
| Auto-loaded root `CLAUDE.md` | 1 | 8.5 KB | ~2.1k |
| Base read order (README, 01, 02, 04) | 4 | 34 KB | ~8.5k |
| **DB task adds** (10-Guide, 06-Spec, 11-Neon) | 3 | 54.6 KB | ~13.6k |
| **API task adds** (06-API 00, 01, 02) | 3 | 23.3 KB | ~5.8k |
| **Frontend task adds** (07-Frontend 00, app/CLAUDE.md) | 2 | 9.8 KB | ~2.4k |
| Nested CLAUDE.md files (7 total, loaded on directory entry) | 7 | 15.1 KB | ~3.8k |

A database task therefore costs **~26k tokens of mandated context before the first line of task work** — and 10.5k of that is the monolithic `06-Database-Specification.md` even when the task touches one table.

### 1.3 Rule duplication (same rule maintained in N places)

| Rule | Copies | Locations |
| ---- | ------ | --------- |
| Authority/conflict order | 5 | root `CLAUDE.md`, `architecture/CLAUDE.md`, `architecture/docs/architecture/CLAUDE.md`, `app/CLAUDE.md`, `10-Database-Agent-Guide.md` |
| UUIDv7/SMALLINT ID strategy | 6 | root, `architecture/CLAUDE.md`, `docs/database/CLAUDE.md`, `10-Guide`, `06-Spec`, `app/CLAUDE.md` |
| 5-step validation sequence (`db:status` → `astro check`) | 4 | root, `app/`, `app/src/db/`, `app/src/pages/api/` CLAUDE.md files |
| ISO-date-on-docs-edit rule | 5 | root + all four `architecture/**` CLAUDE.md files |
| "Never modify applied migrations" | 6 | root (×2), `architecture/CLAUDE.md`, `docs/database/CLAUDE.md`, `10-Guide`, `03-Migrations.md` |

Duplication is not just token waste — it is a **drift engine**: every copy is an opportunity for contradiction, and drift has already happened (see 1.4).

### 1.4 Broken/stale pointers found (verified against the filesystem)

| # | Location | Problem |
| - | -------- | ------- |
| 1 | root `CLAUDE.md` Read Order item 1 | Says "This file (`AGENT.md`)" — the file is `CLAUDE.md`; no `AGENT.md` exists anywhere in the repo |
| 2 | root `CLAUDE.md` § Context Files | Points to `original-conversation/summarized-context/000_master_context.md` — does not exist; actual file is `architecture/000_master_context.md` |
| 3 | root `CLAUDE.md` § Context Files | Points to `architecture/CONVERSATION.md` / `CONVERSATION_PART_2.md` — actual location is `conversations/` |
| 4 | `app/CLAUDE.md` Authority Order item 6 | Points to `app/src/db/AGENT.md` and `app/src/pages/api/AGENT.md` — actual files are named `CLAUDE.md` |
| 5 | root `CLAUDE.md` Authority table row 6 | Says migrations `0001`–`0011`; the chain is `0001`–`0012` (stated correctly elsewhere in the same file) |
| 6 | `architecture/docs/architecture/README.md` lines 63 & 179 | Repository tree and doc table say `0001`–`0011`; line 129 of the same file says `0001`–`0012` |

Every broken pointer costs a fresh session a failed `Read` plus a search to find the real file — pure waste, repeated every session.

---

## 2. Design Principles for the Fix

1. **Root `CLAUDE.md` is a router, not a manual.** It is the only file auto-loaded in *every* session, so every byte in it is paid on every task — including tasks it doesn't apply to. It should route to context, not contain it.
2. **Each rule lives in exactly one file.** Nested `CLAUDE.md` files contain only *deltas* for their scope, never restatements. (Claude Code auto-loads nested `CLAUDE.md` files when working in a directory, so restated rules get double-loaded.)
3. **Context is loaded by task type, not by tier.** Replace the "read order" (linear, cumulative) with **context packs** (task-shaped, minimal).
4. **Reference docs must be entry-point addressable.** A 42 KB spec that must be read whole is an anti-pattern; an agent touching `turns` should load ~3k tokens, not ~10.5k.
5. **History is archived, not deleted.** Conversation logs stay in the repo but move out of the active search surface and are labeled so agents never read them by default.
6. **The map is machine-checkable.** Stale pointers happened because nothing verifies them. Add a script.

---

## 3. Target State

```
CLAUDE.md                          ← ≤3.5 KB router (invariants + context-pack table)
architecture/
├── DECISIONS.md                   ← NEW: one-page decision ledger (replaces reading history)
├── 000_master_context.md          ← kept, marked historical
└── docs/
    ├── architecture/
    │   ├── 00-Context-Map.md      ← NEW: full map w/ per-file purpose, status, ~tokens
    │   ├── 01…099 (unchanged content, + front-matter headers)
    │   ├── 05-Database/
    │   │   ├── 06-Database-Specification.md   ← becomes 2-page index + invariants
    │   │   └── 06-Spec/                        ← NEW: spec split by layer (see 4.3)
    │   │       ├── 01-Reference-Layer.md
    │   │       ├── 02-Template-Layer.md
    │   │       ├── 03-Runtime-Layer.md
    │   │       └── 04-Read-Model-Layer.md
    │   └── …
    └── database/ (unchanged)
archive/                           ← NEW: quarantined history
├── CLAUDE.md                      ← "historical; do not read unless doing decision archaeology"
├── conversations/                 ← moved from repo root
├── original-conversation/         ← moved from repo root
└── superpowers/                   ← completed plans/specs/handoffs from docs/superpowers/
```

### Per-task token budgets (before → after)

| Task type | Before | After | How |
| --------- | ------ | ----- | --- |
| Any session floor (auto-loaded) | ~2.1k | ~0.9k | Slim router CLAUDE.md |
| Small DB change (one table) | ~26k | ~7–9k | Pack = router + 10-Guide + one spec chapter + 03-Migrations §chain |
| New API endpoint | ~18k | ~7k | Pack = router + 06-API 00/04 + app/CLAUDE.md |
| Frontend page work | ~13k | ~5k | Pack = router + 07-Frontend 00 + app/CLAUDE.md |
| Architecture question | ~11k | ~6k | Pack = router + 01 + 04 |

---

## 4. Implementation Phases

Each phase is independently shippable, ordered by value-per-effort. Respect the existing rule: **targeted fixes only, never regenerate docs from scratch.** All phases follow the ISO-date rule for changed rows.

### Phase 0 — Fix broken pointers (≤30 min, zero risk, do first)

Fix the six defects in table 1.4:

1. Root `CLAUDE.md`: `AGENT.md` → `CLAUDE.md` (self-reference).
2. Root `CLAUDE.md` § Context Files: correct both paths (`architecture/000_master_context.md`, `conversations/CONVERSATION*.md`).
3. `app/CLAUDE.md`: `AGENT.md` → `CLAUDE.md` in Authority Order item 6.
4. Root `CLAUDE.md` authority row 6 and `architecture/docs/architecture/README.md` (lines 63, 179): `0001–0011` → `0001–0012`.

**Acceptance:** every path referenced from any `CLAUDE.md` or `README.md` resolves to an existing file (verified by the Phase 5 script, run manually here).

### Phase 1 — Rewrite root `CLAUDE.md` as a router (~1 h)

Target ≤3.5 KB. Keep only:

- Project one-liner + stack (3 lines).
- **Hard invariants** (~10 bullet lines): store-facts/derive-stats, immutability, UUIDv7/SMALLINT, no template FKs in runtime, never modify applied migrations, git-branch workflow, no commits unless asked.
- **Context-pack table** (see Phase 2) — the core of the file.
- Forbidden actions (kept, it's short and high-value).
- Pointer to `00-Context-Map.md` for everything else.

Move out of root `CLAUDE.md` (each to its single owner):

| Content | New single home |
| ------- | --------------- |
| Layer-responsibility table | `02-System-Architecture.md` (already there — delete the copy) |
| DB rule summaries | `05-Database/10-Database-Agent-Guide.md` (already there — delete the copy) |
| API/Frontend rule summaries | `06-API/00-Overview.md`, `07-Frontend/00-Overview.md` |
| Validation Standard Procedure | `app/CLAUDE.md` only (it is app-scoped; nested file auto-loads when working in `app/`) |
| Documentation map tree | `00-Context-Map.md` (new) |
| Current Implementation State table | `00-Context-Map.md` |
| Context Files section | `00-Context-Map.md` (as "historical sources" with do-not-read-by-default note) |

### Phase 2 — Create `00-Context-Map.md` with context packs (~2 h)

New file `architecture/docs/architecture/00-Context-Map.md`. Contents:

1. **File inventory table**: every canonical doc with one-line purpose, `status` (canonical / historical / generated), and approximate token cost, so an agent can budget before reading. Example row:

   | File | Purpose | Status | ~Tokens |
   | ---- | ------- | ------ | ------- |
   | `05-Database/06-Spec/03-Runtime-Layer.md` | Runtime chain entities: sessions, stages, turns, darts | canonical | ~3k |

2. **Context packs** — the replacement for the linear read order. One row per task type, listing the *complete and sufficient* file set:

   | Task | Load exactly | ~Budget |
   | ---- | ------------ | ------- |
   | New table/column | `10-Database-Agent-Guide.md`, relevant `06-Spec/` chapter, `03-Migrations.md` | ~7k |
   | New view / analytics | `05-Views.md`, `06-Spec/04-Read-Model-Layer.md` | ~5k |
   | New API endpoint | `06-API/00-Overview.md`, `06-API/04-Endpoint-Contracts.md` | ~5k |
   | API middleware/layering change | `06-API/02-Middleware-And-Layering.md`, `06-API/03-Shared-Conventions.md` | ~4k |
   | Frontend integration | `07-Frontend/00-Overview.md` | ~2k |
   | New game type | `10-Guide` §"Add a new game type", `06-Spec/01` + `02` chapters, seeds | ~6k |
   | Architecture question / new pattern | `01-Principles.md`, `04-Architecture-patterns.md` | ~5k |
   | "Why was X decided?" | `architecture/DECISIONS.md`; escalate to archive only if insufficient | ~1k |

   Rule printed above the table: *"Load the pack. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks an answer."*

3. **Authority order** — moved here as the single copy; all other files link to it instead of restating it.

### Phase 3 — Deduplicate nested `CLAUDE.md` files (~1–2 h)

For each of the 7 nested files, keep only scope-local deltas; replace restated global rules with a one-line pointer.

- `architecture/CLAUDE.md` (5.2 KB → ~2 KB): drop the authority order, read order, and DB/API baselines (all now in `00-Context-Map.md` or domain docs); keep task-routing rules for `architecture/` edits, historical-documents policy, SQL safety rules.
- `architecture/docs/CLAUDE.md` + `architecture/docs/architecture/CLAUDE.md`: merge into one (`architecture/docs/CLAUDE.md`); together they currently restate the same mission three levels deep. Keep: minimal-diff rule, ISO-date rule (single copy — delete from the other four files), terminology-stability rule, historical-records policy.
- `architecture/docs/database/CLAUDE.md` (keep, trim): hard constraints stay (this is the highest-risk directory); drop the must-read list (now a context pack) and the ID-strategy restatement (link to 10-Guide).
- `app/CLAUDE.md` (3 KB → ~2.2 KB): becomes the *only* home of the Validation Standard Procedure; drop the architecture authority restatement (link); keep Astro/dev-server/worktree specifics.
- `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`: drop the duplicated 5-step validation list (parent `app/CLAUDE.md` already auto-loads); keep only the genuinely local rules (pooled vs direct URL, generated-schema warning, thin-handler rules). Target ~0.4 KB each.

**Acceptance:** `grep -rl "npm run db:status" --include=CLAUDE.md` returns exactly one file; same single-source test for the authority order and ISO-date rule.

### Phase 4 — Split `06-Database-Specification.md` by layer (~3 h, highest single win)

The 42 KB spec already has clean seams (its own § "Database Layers" defines them):

| New chapter | Content (existing sections, moved verbatim) | ~Size |
| ----------- | ------------------------------------------- | ----- |
| `06-Spec/01-Reference-Layer.md` | Reference Layer + `game_types` … `ruleset_versions` lookup tables | ~9 KB |
| `06-Spec/02-Template-Layer.md` | Template Layer + `configuration_templates`, `exercise_configurations` | ~8 KB |
| `06-Spec/03-Runtime-Layer.md` | Runtime Layer + activities, sessions, stages, turns, darts, events | ~14 KB |
| `06-Spec/04-Read-Model-Layer.md` | Read Model Layer + view contracts | ~6 KB |

`06-Database-Specification.md` itself is **kept at its current path** (dozens of inbound links depend on it) and becomes a ~5 KB index: purpose, cross-layer invariants (ID strategy, timestamps, ownership, relationship philosophy), layer diagram, and a table linking to the four chapters. Version bump to v2.2.0 with a changelog row noting content moved, not changed.

This is a mechanical move-and-index operation — allowed under "targeted fixes", not "regeneration": no sentence is rewritten.

**Acceptance:** concatenating the four chapters + index covers 100% of the old file's sections (verify by diffing the heading outlines); all inbound references still resolve.

### Phase 5 — Quarantine history + decision ledger (~2 h)

1. Create `archive/` at repo root; move `conversations/`, `original-conversation/`, and *completed* `docs/superpowers/{plans,specs,handoffs}` entries into it (use `git mv` to preserve history).
2. Add `archive/CLAUDE.md` (~0.3 KB): *"Historical conversation logs and completed plans. Never read these by default; they are superseded by `architecture/DECISIONS.md` and the canonical docs. Read only when explicitly asked to research decision history."*
3. Create `architecture/DECISIONS.md`: an ADR-style ledger distilled from `000_master_context.md` and the summarized contexts — one line per decision: date, decision, rationale, superseded-by. Target ≤ 8 KB. This is what answers "why is it like this?" for ~1k tokens instead of ~140k.
4. Mark `architecture/000_master_context.md` and `05-Database/07–09` with a `status: historical` front-matter header (Phase 6 format).
5. Update the two references in root `CLAUDE.md` / `00-Context-Map.md` to the new archive paths.

**Effect:** the active search surface shrinks from ~1.95 MB to ~0.6 MB of markdown; `Grep` across the repo stops surfacing conversation-log hits for schema terms.

### Phase 6 — Front-matter headers + link checker (~2 h)

1. Add a 5-line HTML-comment header to every doc under `architecture/docs/` (comment syntax avoids disturbing rendered output):

   ```markdown
   <!--
   status: canonical | historical | generated
   scope: database/runtime-layer
   read-when: adding/changing runtime tables
   updated: 2026-07-11
   -->
   ```

   Agents (and the map) can then answer "should I read this?" from a `head -6`, ~40 tokens, instead of opening the file.

2. Add `scripts/check-context-map.sh` (or `.mjs`) that fails CI/pre-commit when:
   - any relative path mentioned in a `CLAUDE.md`, `README.md`, or `00-Context-Map.md` does not exist;
   - the migration range quoted in docs disagrees with the actual `ls architecture/docs/database/migrations/`;
   - a file under `architecture/docs/` lacks a front-matter header;
   - a canonical doc exists that is absent from `00-Context-Map.md`'s inventory.

3. Add one maintenance rule to root `CLAUDE.md`: *"New or moved docs must be registered in `00-Context-Map.md` in the same change."*

---

## 5. Rollout Order & Effort Summary

| Phase | Effort | Token savings driver | Risk |
| ----- | ------ | -------------------- | ---- |
| 0 — Fix pointers | 30 min | Eliminates failed reads/searches every session | none |
| 1 — Router CLAUDE.md | 1 h | −1.2k on *every* session | low |
| 2 — Context map + packs | 2 h | Replaces cumulative read order with minimal packs | low |
| 3 — Dedup nested CLAUDE.md | 1–2 h | −2k per in-scope session; stops rule drift | low |
| 4 — Split DB spec | 3 h | −7k per DB task (largest single win) | medium (inbound links — mitigated by keeping index at old path) |
| 5 — Archive + DECISIONS.md | 2 h | Cleans search surface; "why" questions 140k → 1k | low (git mv preserves history) |
| 6 — Front-matter + checker | 2 h | Prevents regression of everything above | low |

Total: ~1.5 working days. Phases 0–2 alone deliver most of the per-session benefit and can ship as a single PR; 3–4 as a second PR; 5–6 as a third.

## 6. Success Criteria

- [ ] Root `CLAUDE.md` ≤ 3.5 KB and contains no rule that exists in another file.
- [ ] Every task type in the routing table maps to a context pack ≤ 9k tokens.
- [ ] Zero broken relative paths in `CLAUDE.md`/`README.md`/context map (script-verified).
- [ ] Each global rule (authority order, ID strategy, validation sequence, ISO-date, migration immutability) greps to exactly one owning file.
- [ ] A one-table DB change session can be completed loading ≤ 9k tokens of docs (vs ~26k today).
- [ ] Conversation history is unreachable by default search paths and replaced by `DECISIONS.md` for intent questions.
