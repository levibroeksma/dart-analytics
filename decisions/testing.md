<!--
status: canonical
scope: decisions/testing
read-when: why a test-strategy/TDD/mock/coverage choice was made
load-when: test, TDD, Vitest, mock, coverage, fixture, test location, red-green, suite
depends-on: decisions/architecture.md
related: decisions/game-engine.md
updated: 2026-08-02
-->

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D99 | 2026-07-15 | Mandatory TDD for all `app/` behavior: Vitest, colocated `*.test.ts`, red→green→ refactor; `npm test` in `validate:app` | Prevents untested client auth and API wiring; sole procedure in `app/CLAUDE.md` |
| D101 | 2026-07-15 | Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic | Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection |
| D104 | 2026-07-16 | Frontend test strategy formalized: new `06-Test-Strategy.md`, shared-mock convention (`tests/mocks/` + `setupFiles`), full-suite-always-runs completion policy | `authClient` was mocked twice with inconsistent shapes; codified the promotion threshold before it recurs |
| D148 | 2026-07-26 | Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a test-repointing rule: when a test's subject is removed or migrated, delete it or re-point it at the same guarantee, never at a different input just to keep it green; a green suite after a constraint is removed is a failure to detect, not evidence of safety | A `superRefine` bounding `duration_value` was lost during a schema consolidation and its two tests were quietly re-pointed at a different invalid input so the suite stayed green, letting the dropped constraint reach review undetected until fixed the same day (commit `511f24b`) |
| D166 | 2026-07-28 | TDD red→green→refactor procedure folded into the existing project-local `verification-before-completion` skill as a Dart-Analytics addendum; `app/CLAUDE.md`/`AGENT.md`'s TDD section keeps only the non-procedural rules (test location, Vitest-only mocks, `.astro` inline-logic exemption D101) | Same principle (evidence before claims) already lived in that skill; folding avoids a third near-duplicate procedure skill |
