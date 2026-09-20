<!--
status: canonical
scope: frontend/test-strategy
read-when: writing or reviewing app/ tests, adding a shared mock
updated: 2026-09-20
-->

# Frontend Test Strategy

> **Version:** 0.1.0
>
> Ground rules for `app/` tests, beyond the command procedure in `app/CLAUDE.md` (the sole definition of *how* to run TDD). This doc covers *why* and the edge cases command lists don't.

---

# Purpose

`app/CLAUDE.md`'s Test-Driven Development section is the sole definition of the red→green→refactor command sequence (D99). This document adds the rules that sequence alone doesn't cover: when to share a mock instead of duplicating it, and what "done" means for a full test run.

---

# TDD Is Mandatory

Every `app/` behavior change follows red → green → refactor — see `app/CLAUDE.md` for the exact commands. This doc does not redefine that procedure; it exists so the *rationale* has a home instead of being re-explained inline in every task.

---

# Shared Mocks

A module mocked identically by 2+ test files is promoted into `app/tests/mocks/<name>.mock.ts` as an exported factory function, wired once via `app/tests/setup.ts` (registered in `vitest.config.ts`'s `setupFiles`). Individual tests still override return values per-case with `vi.mocked(x).mockResolvedValue(...)` / `.mockRejectedValue(...)` in their own `beforeEach` — identical to today's per-test pattern, just without re-declaring the mock's *shape* in every file that needs it.

**Promotion threshold:** 2+ test files mocking the same module. A single-use mock (e.g. one test file mocking `@client/api/client`) stays local to that file — promoting it would be premature abstraction for a consumer count of one.

**Example:** `authClient` (`@client/auth/client`) was mocked twice with two different, inconsistent shapes across `auth.store.test.ts` and `login.data.test.ts` before this rule existed. It is the first mock promoted into `app/tests/mocks/auth-client.mock.ts`.

---

# Full-Suite-Always-Runs Policy

`npm test` runs the complete suite — never `--bail`, never scoped to only the files touched by the current task — before any task is claimed done. This is enforced by convention, not tooling: `vitest.config.ts` has no `bail` setting and none should be added.

Pre-existing or out-of-scope failures are never silently dropped from a completion report. Name them explicitly ("N pre-existing failures, unrelated to this change: `<list>`"). They do not block completion **unless** the current change caused them — but discovering and reporting them is mandatory, not optional.

---

# Fallow Duplication Detection — Known Limitation

Investigated for F42: before the engine-duplication cleanup (`docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md`), the double-out bust/checkout rule was hand-duplicated 5 times across `five-oh-one.engine.module.ts`, `one-twenty-one.engine.module.ts`, and `tuod.engine.module.ts`; an `otherSeatsComplete`-shaped inline fold was duplicated 3 times across `tuod.engine.module.ts` and `score-training.engine.module.ts`. `npx fallow` (whose duplication gate has a working, non-zero threshold — it flagged a comparable clone once already, D232) never flagged either family on `main` beforehand.

Reproducing the pre-fix duplication on a throwaway branch and running `npx fallow dupes` (both default `mild` mode and `--near`, fallow's own near-miss mode) showed this is **not** a threshold/size gap — several of the reconstructed clones were well under the size of duplicates the gate already reports elsewhere in this codebase (6-12 lines vs. the 20-56+ line groups it normally lists), so raising `.fallowrc.jsonc`'s threshold would not have caught the smaller ones and isn't the fix. It caught an exact, same-file repeat (TUOD's own two `otherSeatsComplete`-shaped sites, identical variable names) and one closely-matching pair (`five-oh-one`/`one-twenty-one`'s bust-result wrapper), but never unified the *whole* clone family the spec describes into one reported group. The reason: each hand-copied site used its own local variable/field names (`hitZoneKey` vs. `lastZoneKey` vs. `resolved.zoneKey`; `seat.attempts` vs. `seat.turnCount`) and its own destructuring/wrapping shape around the shared rule, and that per-site renaming is enough to defeat token-based matching across files — even in `--near` mode, which is specifically meant to tolerate renamed identifiers.

**Known limitation:** `fallow`'s duplication gate (both modes) reliably catches copy-pasted blocks that keep the same identifiers, and can catch a renamed near-miss within the same file, but is not a substitute for reading two engine files side by side to spot a shared *rule* that was hand-copied with per-site renaming — that class of duplication is a code-review/audit responsibility (as this cleanup task itself was), not a gate one.

# Repository Tests — Rendered SQL, Not A Mocked Builder

Repository tests mock the drizzle query builder to assert control flow and return shape. That leaves the translation step — what drizzle actually emits — untested, and a statement Postgres rejects passes the whole suite (issue #397; the `exists()` defect it was found through, #400).

Every mutating repository function, plus the single-active session lookups, therefore also has a **rendered-statement** test:

- `app/tests/repositories/render-sql.ts` — `renderingDb(rows?)` returns a `drizzle-orm/pg-proxy` client that captures each statement instead of executing it, and `onlyStatement(statements)` reads the single statement a call rendered. No connection is involved, so this stays a unit test (D99, D104).
- Seed rows are **positional arrays** (`[["p1", "2026-01-01T00:00:00.000Z"]]`), not objects — pg-proxy maps driver rows by column order.
- A function that opens its own transaction (`upsertSettings`, `insertBatchRecords`) cannot be handed a client, so it gets one through `vi.mock("@db/client")` of `withTransaction`. That mock is module-scoped, so those tests live in their own files (`*.transaction.test.ts`, `*.batch.test.ts`).
- Expected statements are written out in full. A change to a table's columns, a predicate, or drizzle's SQL generation is meant to fail here and be re-read, not to pass silently.

Rationale and the bounded scope: **D303** (`decisions/testing.md`).

---

# A Wrapped Store Is Tested Through The Real Store

`gameStep()` (`app/src/lib/training/routines/game-step.data.ts`, renamed 2026-09-20 from `finishing-step.data.ts`'s `finishingStep()`, generalised over any routine-eligible game's own play store) wraps a play factory such as `tuodPlay()` so a GAME step's completion also advances the routine. A test that mocks the wrapped factory wholesale proves the wrapper's own contract, but never proves the inner store reaches the override — and that seam is where every Finishing-step dead-end has lived (#216, #357, #370).

So the step has two test files, deliberately:

- `app/tests/lib/training/routines/game-step.data.test.ts` — `vi.mock`s the wrapped play factory. Cheap, independent of the underlying game's rules, pins advance-on-success / hold-on-failure / exit-to-`/training`.
- `app/tests/lib/training/routines/finishing-step-seam.test.ts` — kept its pre-rename name; still exercises `gameStep(tuodPlay, …)` specifically — the **real** store and engine, with only `@client/api/sessions` and `SegmentTimer` mocked. Drives `recordDart` → `showFinishConfirm` → `confirmFinish` → the routine's advance.

The module-scope `vi.mock` of `tuodPlay` is why these cannot share a file.

The seam file's `$store` stub is `timerExpired: true` over a solo MINUTES config — under `durationSeatComplete` that makes the next dart which resolves a visit the session's last, which is the state the step hangs in.

Rationale: **D304** (`decisions/testing.md`).

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `app/CLAUDE.md` | TDD command procedure (sole definition) |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules, §11 cross-references this doc |
| `02-Folder-Structure.md` | Folder structure and file-location rules |
