# Agent Rules — `app/src/stores/`

Scope: Alpine stores. Load the "Frontend gameplay / session features" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Rules

- File suffix is `.store.ts`. Stores live here and nowhere else.
- `$persist` is used **only** in stores — never in a component or a module.
- `PersistFactory` is created once per field (D120). Never reuse one `persist()` across store fields.
- Modules never import `@client/api`; a store is the boundary that talks to the client layer.
- Tests live at `app/tests/stores/`, mirroring this directory — never colocated.
