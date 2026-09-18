# Agent Rules — `app/tests/`

Scope: the Vitest suite. Load the "New test / test-strategy question" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. The red→green→refactor procedure and the `npm test` commands are in `app/CLAUDE.md` §Test-Driven Development — that section is the sole definition (D99). (2026-09-18)

## Rules

- Mirror `app/src/`'s (and `app/scripts/`'s) directory structure. `app/src/lib/game/board-input.data.ts` is tested by `app/tests/lib/game/board-input.data.test.ts`. Never colocate a test beside the module under test.
- Test pure functions, stores, clients and utilities with Vitest mocks. **No real network or Neon calls in unit tests.**
- `.astro` markup is not unit-tested — there is no Astro-component test runner in this project. Keep variant/branching logic inline in the component's frontmatter and do **not** extract a helper file solely to make it testable (D101).
- A changed source file needs a changed covering test: `scripts/check-test-coverage.sh` fails any change set touching a runtime `.ts` under `app/src/` or `app/scripts/` without also touching a test that imports it. There is no per-file silencer — if a file has no covering test, write one (D224).
- Shared-mock promotion threshold and the full-suite-always-runs policy: `docs/architecture/07-Frontend/06-Test-Strategy.md`.
- Framework is **Vitest** (`vitest.config.ts` at `app/` root). Every alias in `tsconfig.json`'s `compilerOptions.paths` must also exist in `vitest.config.ts`'s `resolve.alias` — an alias used only inside `vi.mock(...)` factories can pass without ever resolving for real.
