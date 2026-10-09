# Agent Rules — `app/tests/`

Scope: the Vitest suite. Load the "New test / test-strategy question" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. The red→green→refactor procedure and the `npm test` commands are in `app/CLAUDE.md` §Test-Driven Development — that section is the sole definition (D99). (2026-09-18)

## Rules

- Mirror `app/src/`'s (and `app/scripts/`'s) directory structure. `app/src/lib/game/board-input.data.ts` is tested by `app/tests/lib/game/board-input.data.test.ts`. Never colocate a test beside the module under test.
- Test pure functions, stores, clients and utilities with Vitest mocks. **No real network or Neon calls in unit tests.**
- Suites that must run SQL against Postgres live in `app/tests/integration/*.itest.ts`, run only by `npm run test:integration` (`vitest.integration.config.ts`; needs `DATABASE_URL`) — in CI, by `.github/workflows/integration.yml` against a `postgres:16` service built from the migration chain; `db-rehearsal.yml` is schema-only. `npm test` never picks them up. Locally, point `DATABASE_URL` at any migrated + seeded Postgres — a container (`docker run -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=integration -p 5432:5432 postgres:16`, then `db:migrate:ci` → `db:seed:ci` → `db:migrate:ci` with `?sslmode=disable`) costs no Neon egress; run the suite itself with the URL **without** `sslmode` (postgres-js reads any `sslmode` value as "use SSL"). `statistics-sql.itest.ts` seeds its own fixture world (`tests/integration/fixtures/`) in a rolled-back transaction and asserts it is visible and never silently skipped before sweeping every section. (#653; D433, 2026-10-09)
- `.astro` markup is not unit-tested — there is no Astro-component test runner in this project. Keep variant/branching logic inline in the component's frontmatter and do **not** extract a helper file solely to make it testable (D101).
- A changed source file needs a changed covering test: `scripts/check-test-coverage.sh` fails any change set touching a runtime `.ts` under `app/src/` or `app/scripts/` without also touching a test that imports it. There is no per-file silencer — if a file has no covering test, write one (D224).
- Shared-mock promotion threshold and the full-suite-always-runs policy: `docs/architecture/07-Frontend/06-Test-Strategy.md`.
- Framework is **Vitest** (`vitest.config.ts` at `app/` root). Every alias in `tsconfig.json`'s `compilerOptions.paths` must also exist in `vitest.config.ts`'s `resolve.alias` — an alias used only inside `vi.mock(...)` factories can pass without ever resolving for real.
