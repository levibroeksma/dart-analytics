<!--
status: canonical
scope: frontend/test-strategy
read-when: writing or reviewing app/ tests, adding a shared mock
updated: 2026-07-16
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

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `app/CLAUDE.md` | TDD command procedure (sole definition) |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules, §11 cross-references this doc |
| `02-Folder-Structure.md` | Folder structure and file-location rules |
