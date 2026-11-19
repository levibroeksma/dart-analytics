---
id: D0101
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [testing, test, Vitest, coverage]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction

## Context and Problem Statement
Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection. Before this record, 2 documented conventions applied. Tests were colocated beside their module (tied to D99). `.astro` variant logic was extracted into a colocated `.ts` helper so it stayed unit-testable, and `button-variants.ts` was the sole example. The spec says the user decided to reverse both.

## Decision Drivers
* Tests live in a dedicated tree, matching more conventional test layouts.
* `Button.astro`'s variant map is trivial, so a separate file for it is unwarranted.

## Considered Options
* Keep colocated tests and the extracted variant helper (the conventions in force before this record).
* Move tests to a mirrored `app/tests/` tree and inline variant logic in the `.astro` frontmatter (chosen).

## Decision Outcome
Chosen option: "Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic", because Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection.

### Consequences
* Good, because tests move to a mirrored `app/tests/` tree that matches conventional test layouts.
* Bad, because Vitest no longer covers the `Button.astro` variant logic. The project has no Astro-component test runner. The spec calls this an accepted trade-off.
* Neutral, because 10 test files relocate with import rewrites: 9 to alias imports, and `seed-dev-auth.test.ts` to a relative path because `scripts/` has no alias. Also `button-variants.test.ts` is deleted (35 → 34 tests). `vitest.config.ts` includes `tests/**/*.test.ts` and gains an `@components` alias.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Every relocated test passes after its import rewrite. `npm test` picks up all tests through the `tests/**/*.test.ts` include glob and none from the old locations. `app/CLAUDE.md` and the Frontend Agent Guide state the new rules.

## Pros and Cons of the Options
### Keep colocated tests and the extracted variant helper
Rationale unknown — no source found. The spec calls these conventions deliberate and documented, but does not restate the reasons.

### Mirrored test tree with inline variant logic
* Good, because a mirrored test tree matches conventional test-layout expectations.
* Good, because inlined variant logic is simple enough that a dedicated testable helper is not warranted.
* Bad, because the variant logic loses its Vitest coverage.

## Evidence / More Information
Decided: 2026-07-15

* `docs/superpowers/specs/2026-07-15-test-and-variant-conventions-design.md` (Context, § 1–4, Testing): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-15-test-and-variant-conventions.md` (the `app/CLAUDE.md`, Frontend Agent Guide and `DECISIONS.md` steps): rebuilt Confirmation.
* Commit `777e8cf2` (2026-07-15, adds the D101 row): confirmed the doc edits named in Confirmation.
* Applied in: `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 7.3), `docs/superpowers/plans/2026-07-16-frontend-conventions-hardening.md`.
