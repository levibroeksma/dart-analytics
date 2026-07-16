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

**Promotion threshold:** 2+ test files mocking the same module (mirrors the `.data.ts` colocation-promotion threshold in `02-Folder-Structure.md`). A single-use mock (e.g. one test file mocking `@client/api/client`) stays local to that file — promoting it would be premature abstraction for a consumer count of one.

**Example:** `authClient` (`@client/auth/client`) was mocked twice with two different, inconsistent shapes across `auth.store.test.ts` and `login.data.test.ts` before this rule existed. It is the first mock promoted into `app/tests/mocks/auth-client.mock.ts`.

---

# Full-Suite-Always-Runs Policy

`npm test` runs the complete suite — never `--bail`, never scoped to only the files touched by the current task — before any task is claimed done. This is enforced by convention, not tooling: `vitest.config.ts` has no `bail` setting and none should be added.

Pre-existing or out-of-scope failures are never silently dropped from a completion report. Name them explicitly ("N pre-existing failures, unrelated to this change: `<list>`"). They do not block completion **unless** the current change caused them — but discovering and reporting them is mandatory, not optional.

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `app/CLAUDE.md` | TDD command procedure (sole definition) |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules, §11 cross-references this doc |
| `02-Folder-Structure.md` | Colocation/promotion threshold this doc's mock rule mirrors |
