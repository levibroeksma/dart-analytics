# Single-Source Consolidation Design — Validation Procedure & DB Connection Contract

> **Date:** 2026-07-14
> **Status:** proposed design (autonomous architecture review — awaiting user approval)
> **Scope:** collapse the two worst "every rule lives in exactly one place" violations found by the 2026-07-14 review: the app validation procedure (3 divergent definitions) and the database connection-string contract (5 contradictory sources).
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Problem

The root `CLAUDE.md` router promises "every rule lives in exactly one place; this file tells you where." Two load-bearing rules break that promise:

**A. Validation procedure — three variants:**

| Source | Steps | Differences |
| ------ | ----- | ----------- |
| `app/CLAUDE.md` ("sole definition") | 6 | includes graphify refresh; no `db:seed` |
| `05-Database/10-Database-Agent-Guide.md` §Application Validation Procedure | 5 | no graphify |
| `05-Database/03-Migrations.md` §Migration Execution + `11-Neon-Integration.md` §Migration Workflow | 6 | adds `npm run db:seed`; no graphify |
| `app/package.json` `validate:app` | 5 | no graphify, no seed |

An agent loading the DB context pack never sees the graphify step; an agent following `03-Migrations.md` runs seeds that the "sole definition" omits. Whether seeding is part of standard validation is currently undefined.

**B. DB connection variables — five contradictory sources:**

| Source | Claim |
| ------ | ----- |
| `app/.env.example` | `DATABASE_URL` = **direct** (no `-pooler`); `DATABASE_URL_POOLED` = pooled |
| `app/src/db/CLAUDE.md` | `DATABASE_URL` (direct) for runtime; `DATABASE_URL_POOLED` for tooling |
| `05-Database/11-Neon-Integration.md` | `DATABASE_URL` is Neon-pulled (whose value is **pooled** — "copy the pooled `DATABASE_URL` into `DATABASE_URL_POOLED`"); `DATABASE_URL_UNPOOLED` "not used" |
| `05-Database/03-Migrations.md` | "Required environment settings: `DATABASE_URL=<pooled connection string>`" for dbmate |
| `app/src/db/client.ts` | runtime **prefers `DATABASE_URL_UNPOOLED`** (`databaseUrlUnpooled ?? databaseUrl`) — a variable `.env.example` doesn't define and 11-Neon declares unused |

Depending on which document an agent (or the developer) trusts, the Worker runtime connects through the pooler or not, and dbmate is pointed at the wrong variable name. This is exactly the class of silent misconfiguration the context system exists to prevent.

---

## Decision 1 — One validation procedure, owned by `package.json`

**Decision:** the executable definition is the `validate:app` npm script; prose documents only reference it.

1. Extend `validate:app` to the full gate: `db:status → db:migrate → db:introspect → npx fallow → astro check`, then `graphify extract . --update --code-only` guarded so a missing graphify CLI **warns instead of failing** (mirrors the root `CLAUDE.md` "say so in the completion report" rule).
2. `app/CLAUDE.md` keeps ownership of the *procedure semantics* (when to run, what a failure means) but its step list becomes: "run `npm run validate:app`; stage `graphify-out/graph.json` if it changed."
3. `10-Database-Agent-Guide.md`, `03-Migrations.md`, and `11-Neon-Integration.md` replace their step lists with one line: "run the Validation Standard Procedure — `app/CLAUDE.md`."
4. Seeding: `npm run db:seed` is **not** part of standard validation (it mutates shared dev data); it is documented in `11-Neon-Integration.md` as an environment-provisioning step only. This resolves the currently undefined seed question in favour of the "sole definition".

Alternative considered: keep the list in `app/CLAUDE.md` prose only (no script change). Rejected — prose lists drift (this review is the proof); a script is testable and CI-runnable.

---

## Decision 2 — One connection-string contract, owned by `11-Neon-Integration.md`

**Decision:** `11-Neon-Integration.md` §Connection String Rules becomes the sole owner. Target contract (matching current `.env.example` + `package.json` reality):

| Variable | Meaning | Consumers |
| -------- | ------- | --------- |
| `DATABASE_URL` | direct (non-pooler) connection | Worker runtime `getDb()` via `@neondatabase/serverless` |
| `DATABASE_URL_POOLED` | pooled connection | dbmate scripts, seeds, `drizzle-kit introspect` |
| `DATABASE_URL_UNPOOLED` | not part of the contract | none — remove from code paths |

Edits:

1. `11-Neon-Integration.md`: resolve the internal contradiction — state explicitly which value Neon CLI writes into `DATABASE_URL` and that the committed contract is *direct-for-runtime / pooled-for-tooling*; drop the "copy the pooled `DATABASE_URL`" wording if it no longer matches the Neon CLI behaviour actually observed, or correct `.env.example` if it does. (Verification step: run `neon env pull` once and record the ground truth in the doc.)
2. `05-Database/03-Migrations.md`: fix "Required environment settings" to `DATABASE_URL_POOLED` and note the dirs are supplied by `package.json` script flags (`--migrations-dir`), with `DBMATE_*` env as optional overrides only.
3. `app/src/db/client.ts`: drop the `databaseUrlUnpooled ??` preference — use `databaseUrl` per the contract (or, if Neon's pulled env makes `DATABASE_URL` pooled in practice, keep the fallback chain but then document it; the doc decides, the code follows).
4. `app/src/db/CLAUDE.md`: keep its two bullet rules but add "authority: `11-Neon-Integration.md` §Connection String Rules".

The unresolved factual question (what exactly `neon env pull` writes) is called out as the first implementation task; both docs and code align to the observed answer.

---

## Success criteria

1. `grep -r "db:status" architecture/ app/CLAUDE.md` finds one step list (in `app/CLAUDE.md`) and references elsewhere.
2. No document tells dbmate to read `DATABASE_URL`; no code path reads `DATABASE_URL_UNPOOLED` (or it is documented).
3. `npm run validate:app` executes the full gate including the guarded graphify refresh.
