# Frontend Architecture Handbook 0.1.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` — five new `07-Frontend/` handbook chapters, integration-overview amendment, Pattern 17, and full Context Maintenance pass.

**Architecture:** Documentation-only change set under `architecture/docs/`. No `app/src/` folders or runtime code. Handbook 0.1.0 is a first draft (not API v1 freeze). Spec decisions are authoritative; child docs expand them without contradicting frozen `06-API/` or DB migrations.

**Tech Stack:** Markdown architecture docs; `scripts/check-context-map.sh` as consistency gate. Reference patterns: `05-Database/10-Database-Agent-Guide.md` (agent guide format), `06-API/02-Middleware-And-Layering.md` (layering doc format).

## Global Constraints

- **Scope:** `architecture/` docs + `app/CLAUDE.md` cross-ref only — no other `app/` files.
- **Spec authority:** `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (revised 2026-07-14).
- **Handbook version:** `07-Frontend/01`–`04` and `10` ship at **0.1.0**; `07-Frontend/00-Overview.md` bumps to **0.3.0**.
- **Rendering term:** **prerender-default** (`output: 'server'` + `export const prerender = true` per route) — never document global `output: 'static'`.
- **Alpine entry:** `alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })` — document target; do not edit `app/astro.config.mjs` in this pass.
- **Alpine bindings:** no `x-init`; always `x-data="componentState()"`; stores registered as `Alpine.store('name', storeFactory(persist))`.
- **Recovery UX:** auto-cleanup — amends D67 wording (no manual abandon dialog).
- **Docs style:** minimal targeted diffs; never regenerate documents; ISO date `2026-07-14` on new/changed inventory rows and `updated:` front-matter.
- **Historical docs:** do not edit `000_master_context.md`, `05-Database/07`–`09`.
- **Commits:** only when the user explicitly requests (per repo user rules).

---

## File Map (locked)

| File | Action | Responsibility |
| ---- | ------ | -------------- |
| `architecture/docs/architecture/07-Frontend/01-Rendering-Strategy.md` | Create | Prerender-default, middleware gate, route classes, SSR opt-in |
| `architecture/docs/architecture/07-Frontend/02-Folder-Structure.md` | Create | Tree, aliases, suffixes, import direction |
| `architecture/docs/architecture/07-Frontend/03-Alpine-Patterns.md` | Create | `app.factory`, stores/forms/data, `$persist`, bindings |
| `architecture/docs/architecture/07-Frontend/04-Modules-And-OOP.md` | Create | OOP boundary, portable UI kit, engine/payload modules |
| `architecture/docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` | Create | Condensed agent rules + checklist |
| `architecture/docs/architecture/07-Frontend/00-Overview.md` | Modify | v0.3.0 index, recovery amendment, dedupe to `02` |
| `architecture/docs/architecture/04-Architecture-patterns.md` | Modify | Pattern 17 — Frontend Layering |
| `architecture/docs/architecture/README.md` | Modify | Hierarchy + document index |
| `architecture/docs/architecture/00-Context-Map.md` | Modify | Tiered packs + inventory |
| `architecture/DECISIONS.md` | Modify | D79–D89 + D67 footnote |
| `architecture/CLAUDE.md` | Modify | Frontend handbook routing |
| `architecture/docs/CLAUDE.md` | Modify | `07-Frontend/01`–`04` editing targets |
| `app/CLAUDE.md` | Modify | Frontend rules + tiered pack pointer |

---

### Task 1: `01-Rendering-Strategy.md`

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/01-Rendering-Strategy.md`

**Interfaces:**
- Consumes: spec Decisions 1, 1b, 2, I19; existing `07-Frontend/00-Overview.md` skeleton-first pattern.
- Produces: canonical rendering rules referenced by `03`, `10`, and amended `00`.

- [ ] **Step 1: Create the document with required sections**

Write the file with this structure (fill prose from spec; tables must match spec verbatim):

```markdown
<!--
status: canonical
scope: frontend/rendering
read-when: new routes, prerender vs SSR decisions
updated: 2026-07-14
-->

# Frontend Rendering Strategy

> **Version:** 0.1.0
>
> Prerender-default rendering on Cloudflare Workers. API integration remains in `00-Overview.md`.

---

# Purpose

…

# Prerender-Default Model

| Setting | Value |
| ------- | ----- |
| Astro `output` | `'server'` (`@astrojs/cloudflare`) |
| Default per page | `export const prerender = true` |
| API routes | `pages/api/**` — never prerender |

# Middleware + Prerender

(Request → middleware → redirect OR prerendered shell → client fetch diagram)

Prerender does not bypass middleware.

# Route Classification (v1)

## Public routes
| Path | Notes |
| ---- | ----- |
| `/login` | Only public HTML route in v1; list extensible |

## Protected prefixes
| Prefix | Notes |
| ------ | ----- |
| `/games` | … |
| `/profile` | … |
| `/statistics` | Post-v1 placeholder shell (no API calls until stats endpoints ship) |
| `/` | Home — protected |

Rule: new routes must be added to public or protected list in this doc.

# Route-Class Rendering Table
(copy from spec Decision 1)

# SSR Opt-In (Closed List)
1. Server-only env/secrets in HTML (never JWT, never gameplay)
2. Per-request headers materially affect markup
3. Explicit exception listed here

# Server Islands
(criteria — exceptional, not default pattern)

# Anti-Patterns
| Anti-pattern | Reason |
| ------------ | ------ |
| Server-rendering gameplay state | D67 local-first |
| SSR for JWT-protected data injection | No server session; client fetch |
| Assuming prerender = public | Middleware still runs |

# Related Documents
```

- [ ] **Step 2: Verify file exists and version header**

Run: `grep -E 'Version:.*0\.1\.0|updated: 2026-07-14|prerender-default|/login' architecture/docs/architecture/07-Frontend/01-Rendering-Strategy.md | head -20`
Expected: all four patterns match at least once.

- [ ] **Step 3: Commit** (only if user requested)

---

### Task 2: `02-Folder-Structure.md`

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/02-Folder-Structure.md`

**Interfaces:**
- Consumes: spec Decisions 6, 7, 8, 10, 15; `06-API/02-Middleware-And-Layering.md` server tree.
- Produces: folder/alias/suffix authority for `03`, `04`, `10`.

- [ ] **Step 1: Create the document**

Include these mandatory tables:

**Tree** (from spec Decision 6 — full `app/src/` frontend + server areas with note that `services/`/`repositories/` are Worker-only).

**Alias table:**

| Alias | Maps to |
| ----- | ------- |
| `@client/*` | `src/lib/client/*` |
| `@stores/*` | `src/stores/*` |
| `@forms/*` | `src/forms/*` |
| `@modules/*` | `src/modules/*` |
| `@types/*` | `src/types/*` |
| `@utils/*` | `src/utils/*` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@pages/*` | `src/pages/*` |
| `@services/*` | `src/services/*` |
| `@repositories/*` | `src/repositories/*` |
| `@routes/*` | `src/pages/api/*` |
| `@db/*` | `src/db/*` |

**Suffix table** (Decision 8): `.store.ts`, `.form.ts`, `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts`, `.astro`.

**Import direction** (Decision 10) — modules never import `@client/api`.

**Barrel rule:** types via `@<area>/types` only (cross-ref `06-API/03-Shared-Conventions.md`).

**Deprecation note:** browser code migrates from `@lib/api` → `@client/api` (document target; app migration out of scope).

- [ ] **Step 2: Verify**

Run: `grep -c '@client' architecture/docs/architecture/07-Frontend/02-Folder-Structure.md && grep -c 'engine.module' architecture/docs/architecture/07-Frontend/02-Folder-Structure.md && grep -c 'Worker-only' architecture/docs/architecture/07-Frontend/02-Folder-Structure.md`
Expected: each count ≥ 1.

---

### Task 3: `03-Alpine-Patterns.md`

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/03-Alpine-Patterns.md`

**Interfaces:**
- Consumes: spec Decisions 9, 14; `02-Folder-Structure.md` suffix rules.
- Produces: Alpine patterns referenced by `04`, `10`, amended `00`.

- [ ] **Step 1: Create the document with code sketches**

Include **`app.factory.ts` sketch** (from spec Decision 9):

```typescript
"use strict";

import persist from "@alpinejs/persist";
import type { Alpine } from "alpinejs";
import { registerStores } from "./register-stores";
import { registerUiData } from "./register-ui-data";
import { registerRouteData } from "./register-route-data";

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);
  registerStores(Alpine);
  registerUiData(Alpine);
  registerRouteData(Alpine);
};
```

Include **binding rules table:**

| Rule | Detail |
| ---- | ------ |
| No `x-init` | Forbidden |
| `x-data` | Always `x-data="componentState()"` |
| Stores | `Alpine.store('game', gameStore(persist))` |

Include **recovery auto-cleanup** (Decision 4) — resume only when local + server IDs align; else silent `PATCH` → `ABANDONED`.

Include **`$persist` scope** — stores/forms only; timer state lives in `game.store.ts`.

Include **forms = D77 substitute** for `player_settings`.

- [ ] **Step 2: Verify**

Run: `grep -E 'x-init|componentState\(\)|app\.factory|auto-abandon|player_settings' architecture/docs/architecture/07-Frontend/03-Alpine-Patterns.md`
Expected: each pattern matches.

---

### Task 4: `04-Modules-And-OOP.md`

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/04-Modules-And-OOP.md`

**Interfaces:**
- Consumes: spec Decisions 12, 13; `03-Alpine-Patterns.md`.
- Produces: module/OOP rules for `10` and Pattern 17.

- [ ] **Step 1: Create the document**

Mandatory content:

**OOP boundary table** — classes only in `modules/ui/` and `modules/game/*.engine.module.ts`.

**Timer example sketch** — `Timer` class with `start/stop/destroy`; instantiated in Alpine `init()` of `Timer.astro`; authoritative timer fields in `game.store.ts`.

**Portable UI kit** — pairing rule; zero app imports; Chart peer-dependency note.

**`*.engine.module.ts` vs `*.payload.module.ts`** — engines own turn flow + `clientKey`; payloads assemble `EventsBatchRequest` types from `@types/api`.

**Validation boundary** — client assembles/predicts; API validates (D73, ruleset limits).

**Anti-patterns:** classes in stores; `@client/api` in modules; Alpine in `modules/`.

- [ ] **Step 2: Verify**

Run: `grep -E 'payload\.module|engine\.module|peer.dep|clientKey|idempotency' architecture/docs/architecture/07-Frontend/04-Modules-And-OOP.md`
Expected: each matches.

---

### Task 5: `10-Frontend-Agent-Guide.md`

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`

**Interfaces:**
- Consumes: `01`–`04` (distillation); `05-Database/10-Database-Agent-Guide.md` format.
- Produces: agent quick-reference; context-pack target.

- [ ] **Step 1: Create condensed guide (~2k tokens max)**

Sections:

1. **Load packs** (tiered — copy from spec Decision 16)
2. **Non-negotiables** (suffixes, aliases, no `x-init`, `foo()`, prerender-default, middleware classify)
3. **Import direction** (one ASCII diagram)
4. **`$persist` allowed/forbidden**
5. **Recovery** (auto-cleanup one paragraph)
6. **Forbidden patterns** (bullets from spec)
7. **Pre-completion checklist:**
   - [ ] Suffix matches role
   - [ ] No `x-init`
   - [ ] New route classified in `01`
   - [ ] No `@client/api` import in `modules/`
   - [ ] Recovery text consistent with `00-Overview`
   - [ ] `scripts/check-context-map.sh` passes

- [ ] **Step 2: Verify token budget**

Run: `wc -w architecture/docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
Expected: ≤ 2500 words (approximate ~2k token ceiling).

---

### Task 6: Amend `00-Overview.md` → v0.3.0

**Files:**
- Modify: `architecture/docs/architecture/07-Frontend/00-Overview.md`

**Interfaces:**
- Consumes: Tasks 1–5; spec `00-Overview` modification list.
- Produces: integration entry point with handbook index; recovery text aligned with Decision 4.

- [ ] **Step 1: Bump version and add handbook index**

Change version `0.2.0` → `0.3.0`; `updated: 2026-07-14`.

Add after Purpose:

```markdown
# Handbook Index

| Doc | Answers |
| --- | ------- |
| `01-Rendering-Strategy.md` | Prerender-default, middleware, route classes |
| `02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes |
| `03-Alpine-Patterns.md` | `app.factory`, stores, forms, `$persist` |
| `04-Modules-And-OOP.md` | Modules, portable UI kit, validation boundary |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
```

- [ ] **Step 2: Amend recovery paragraph (State Model → Temporary state)**

Replace manual resume/abandon UX with:

> Recovery is client-local. On load, when local persisted state and `GET /api/sessions/active` agree on `sessionId`, the client resumes from the store. When local state is missing or `sessionId` mismatches, the client **automatically** `PATCH`es the server session to `ABANDONED` — no user prompt. Client-side orphans are the client's responsibility; server-side DB orphan sweeps are deferred server responsibility. <!-- 2026-07-14 -->

- [ ] **Step 3: Replace detailed client tree with summary**

Replace `# Recommended Client Structure` tree with:

```markdown
# Client Structure

Browser code uses `@client/` (API client, auth, Alpine factory), top-level `stores/`, `forms/`, `modules/`, and `types/`. Full tree, aliases, and suffix rules: `02-Folder-Structure.md`.
```

Update remaining `lib/api` references → `@client/api`. Update `lib/server/` cross-ref unchanged.

- [ ] **Step 4: Verify no contradicting recovery text**

Run: `grep -E 'offers.*resume|abandon.*or|resume or abandon' architecture/docs/architecture/07-Frontend/00-Overview.md || echo 'PASS: old UX wording gone'`
Expected: `PASS` (no matches).

Run: `grep -c 'automatically' architecture/docs/architecture/07-Frontend/00-Overview.md`
Expected: ≥ 1.

---

### Task 7: Pattern 17 + `README.md`

**Files:**
- Modify: `architecture/docs/architecture/04-Architecture-patterns.md`
- Modify: `architecture/docs/architecture/README.md`

**Interfaces:**
- Consumes: Tasks 1–5 summaries.
- Produces: cross-layer pattern reference; updated doc hierarchy.

- [ ] **Step 1: Add Pattern 17 to `04-Architecture-patterns.md`**

After Pattern 16, add:

```markdown
# Pattern 17 — Frontend Layering

## Principle

The frontend uses Alpine-native layering with prerender-default shells, not API-style controllers.

## Pattern

```
Astro page (prerender + middleware)
    ↓
Alpine.data (*.data.ts) — x-data="componentState()"
    ↓
Alpine.store / form (*.store.ts, *.form.ts)
    ↓
Module (*.module.ts, *.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ (orchestrated by pages/forms/stores only)
```

## Rule

- Alpine boots only via `lib/client/alpine/app.factory.ts`.
- No `x-init`. Modules never import `@client/api`.
- Detail: `07-Frontend/01`–`04`, `10-Frontend-Agent-Guide.md`.
```

Bump patterns doc version in header (e.g. `1.2.1` → `1.3.0`); `updated: 2026-07-14`.

- [ ] **Step 2: Update `README.md` hierarchy**

Under `07-Frontend/`, list `00`–`04` and `10` with one-line descriptions. Bump README version minor (e.g. `1.4.0` → `1.5.0`).

- [ ] **Step 3: Verify**

Run: `grep -c 'Pattern 17' architecture/docs/architecture/04-Architecture-patterns.md && grep -c '10-Frontend-Agent-Guide' architecture/docs/architecture/README.md`
Expected: each ≥ 1.

---

### Task 8: Context Maintenance — `00-Context-Map.md` + `DECISIONS.md`

**Files:**
- Modify: `architecture/docs/architecture/00-Context-Map.md`
- Modify: `architecture/DECISIONS.md`

**Interfaces:**
- Consumes: all prior tasks; spec Context Maintenance section.
- Produces: routing + ledger entries D79–D89.

- [ ] **Step 1: Update context packs in `00-Context-Map.md`**

Replace single frontend page row with tiered packs (from spec Decision 16). Add file inventory rows:

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `07-Frontend/01-Rendering-Strategy.md` | Prerender-default, middleware, route classes | canonical | ~2k |
| `07-Frontend/02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes | canonical | ~2k |
| `07-Frontend/03-Alpine-Patterns.md` | Alpine factory, stores, forms, `$persist` | canonical | ~2.5k |
| `07-Frontend/04-Modules-And-OOP.md` | OOP boundary, portable UI kit | canonical | ~2k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules | canonical | ~2k |

Update `07-Frontend/00-Overview.md` inventory row to v0.3.0.

Update **Current Implementation State** → Frontend docs: handbook 0.1.0 (`01`–`04`, `10`) + overview 0.3.0 `(2026-07-14)`.

Register spec in historical docs: `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md`.

Bump Context Map version/date in header.

- [ ] **Step 2: Add D79–D89 to `DECISIONS.md`**

Add Frontend section table rows (copy rationale from spec). Add footnote on D67 row:

> UX (2026-07-14): auto-cleanup on mismatch — no manual abandon prompt (D88).

- [ ] **Step 3: Verify ledger IDs**

Run: `grep -c '| D8[0-9] |' architecture/DECISIONS.md`
Expected: ≥ 10 (D80–D89).

---

### Task 9: CLAUDE.md cross-refs

**Files:**
- Modify: `architecture/CLAUDE.md`
- Modify: `architecture/docs/CLAUDE.md`
- Modify: `app/CLAUDE.md`

**Interfaces:**
- Consumes: Task 8 context packs; `10-Frontend-Agent-Guide.md`.
- Produces: agent routing for frontend handbook work.

- [ ] **Step 1: `architecture/CLAUDE.md`**

Add task-routing row:

```markdown
- **Frontend handbook:** `07-Frontend/01`–`04` + `10-Frontend-Agent-Guide.md`; amend `00-Overview.md` for integration changes.
```

- [ ] **Step 2: `architecture/docs/CLAUDE.md`**

Add to editing workflow targets: `07-Frontend/01-Rendering-Strategy.md` through `04-Modules-And-OOP.md`.

- [ ] **Step 3: `app/CLAUDE.md`**

Add section:

```markdown
## Frontend Rules

For page/component/session work, load `architecture/docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` and the tiered pack from `00-Context-Map.md`.

Non-negotiables (handbook 0.1.0): file suffix conventions (`.store.ts`, `.form.ts`, `.data.ts`, `*.module.ts`); no `x-init`; `x-data="factory()"`; modules never import `@client/api`; `$persist` only in stores/forms.
```

Do not duplicate full handbook content.

---

### Task 10: Final validation

**Files:**
- Verify: all files from File Map

**Interfaces:**
- Produces: pass/fail gate for claiming task done.

- [ ] **Step 1: Run context map check**

Run: `bash scripts/check-context-map.sh`
Expected: exit 0.

- [ ] **Step 2: Cross-link spot check**

Run: `grep -r '07-Frontend/01' architecture/docs/architecture/07-Frontend/00-Overview.md architecture/docs/architecture/README.md app/CLAUDE.md | wc -l`
Expected: ≥ 3.

- [ ] **Step 3: Contradiction spot check**

Run: `grep -r 'resume or abandon\|x-init\|static-default\|lib/api/' architecture/docs/architecture/07-Frontend/ | grep -v '@client/api\|deprecated\|never\|Forbidden\|Do not' || echo 'PASS'`
Expected: `PASS` or only negation contexts.

- [ ] **Step 4: Spec coverage self-check**

Confirm each spec Decision 1–16 has a home:

| Decision | Doc |
| -------- | --- |
| 1, 1b, 2 | `01` |
| 6–8, 10, 15 | `02` |
| 9, 14 | `03` |
| 12, 13 | `04` |
| All | `10` |
| 4, integration | `00` |
| Summary | Pattern 17 |
| Packs + D79–89 | Context map + DECISIONS |

- [ ] **Step 5: Commit** (only if user requested)

```bash
git add architecture/ app/CLAUDE.md docs/superpowers/plans/2026-07-14-frontend-architecture-handbook.md
git commit -m "docs: add frontend architecture handbook 0.1.0"
```

---

## Plan Self-Review

| Check | Result |
| ----- | ------ |
| Spec coverage | Tasks 1–10 map to all deliverables and Decisions 1–16 |
| Placeholder scan | No TBD steps; verification commands are concrete |
| Type consistency | `.data.ts` used throughout (not `.page.ts`); `@client` not `@lib` for browser |
| Out of scope respected | No `app/src/` implementation, no astro.config edits |
| User commit rule | Global constraint + per-task commit marked optional |

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-07-14-frontend-architecture-handbook.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
