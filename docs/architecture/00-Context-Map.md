<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-08-19
-->
# Context Map

> The router: which files a task loads, and which document wins when two
> disagree. Kept small on purpose — it is read at the start of every task.
>
> - Pack lacks the answer? Escalate to `00-File-Inventory.md`.
> - Why was something decided? `DECISIONS.md` routes to `decisions/**`.
> - Provenance and version history? `00-Context-Map-History.md` (never
>   loaded by a task).
> - Noticed something the task didn't ask you to change? Log it in
>   `FINDINGS.md`; never fix it in the same pass.

---

# Context Packs

Load exactly the pack for your task type. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks the answer. (Root `CLAUDE.md` invariants are always in effect and are not repeated in the packs.)

| Task type | Load exactly | ~Budget |
| --------- | ------------ | ------- |
| New table / column / constraint | `05-Database/10-Database-Agent-Guide.md`, relevant `05-Database/06-Spec/` chapter, `05-Database/03-Migrations.md` | ~7.7k |
| New view / analytics query | `05-Database/05-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.1k |
| New seed data | `database/seeds/0001` or `0002` (match id ranges); `0003`/`0004` for game-type and preset-realignment precedent, `05-Database/06-Spec/01-Reference-Layer.md` | ~2.2k |
| Neon environment / tooling | `05-Database/11-Neon-Integration.md`, `app/CLAUDE.md` | ~4.6k |
| New API endpoint | `06-API/00-Overview.md`, `06-API/04-Endpoint-Contracts.md`, `app/CLAUDE.md` | ~12.3k |
| API middleware / layering change | `06-API/02-Middleware-And-Layering.md`, `06-API/03-Shared-Conventions.md`, `app/CLAUDE.md` | ~9.8k |
| Frontend page / component work | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/05-Astro-Components.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~14.6k |
| Frontend gameplay / session features | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~17.7k |
| Frontend new route / rendering | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `app/CLAUDE.md` | ~12.7k |
| Frontend architecture / new pattern | `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/05-Astro-Components.md`, `04-Architecture-patterns.md`, `01-Principles.md` | ~17.5k |
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~12.1k |
| New test / test-strategy question | `07-Frontend/06-Test-Strategy.md`, `app/CLAUDE.md` | ~3.6k |
| New game type | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `06-Spec/01-Reference-Layer.md`, `06-Spec/02-Template-Layer.md`, seeds | ~6.4k |
| New game engine | `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", the game's `docs/game-rules/rulesets/` doc | ~8.5k |
| Architecture question / new pattern | `01-Principles.md`, `04-Architecture-patterns.md` | ~8.6k |
| Workflow / process question | `03-Engineering-Workflow.md` | ~2.2k |
| "Why was X decided?" | `DECISIONS.md` (router — Source key, routing table, Deferred list, how-to-add-a-decision); then load only the domain file(s) your task needs from its routing table, e.g. `decisions/database.md`; deeper lineage: git history. Actual per-task total varies with domain (router + testing.md, the smallest, runs ~2.3k; router + game-engine.md, the largest, runs ~5.8k) — the single figure in the last column below prices only the router + the one example file named above. | ~4.0k |
| Bug in migration chain | `05-Database/03-Migrations.md`, full chain `database/migrations/0001`–`0024`; never patch applied files | ~5.1k |
| Issue-driven UI polish | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/07-Style-Guide.md`, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~10.3k |
| New game (full stack) | `07-Frontend/09-Adding-A-Game.md` (the touch list, the two shapes to reuse, the two opt-outs), `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~12.6k |

Paths are relative to `docs/architecture/` unless they start with `docs/`, `database/`, or `app/`.

For "New game type" tasks, also check `docs/game-rules/rulesets/<game>.md` if a raw ruleset note exists for that game — optional human-authored input, not part of the fixed budget above. See "Non-Canonical Source Material" below.

---

---

# Authority Order (single source)

When documents conflict, higher wins; correct the lower one:

1. User instructions in the current task
2. `01-Principles.md`
3. `02-System-Architecture.md`
4. `04-Architecture-patterns.md`
5. `05-Database/06-Database-Specification.md` (+ its `06-Spec/` chapters)
6. `06-API/00-Overview.md`
7. `03-Engineering-Workflow.md`
8. SQL migrations `0001`–`0024` and seeds
9. Application code in `app/`

If code contradicts architecture docs, the docs win unless the user explicitly directs otherwise. Git history (the retired master context) and the decision ledger (`DECISIONS.md` the router, `decisions/**` the domain files it routes to) are context, never authority — they explain *why*, they never state *what is*, and rank below every numbered item above.

---

---

# Non-Canonical Source Material

`docs/game-rules/` holds raw, pre-spec, human-authored game/routine/trivia rule descriptions — entry point `docs/game-rules/README.md` (2026-07-16). This tree is deliberately **not** registered in the File Inventory above and carries no `status:` front-matter requirement: `scripts/check-context-map.sh` only enforces those rules for `docs/architecture/` and `database/`. See `docs/game-rules/README.md` for the per-subfolder translation targets.

---

---

# Maintenance Protocol

This map is kept correct by the mandatory Context Maintenance rules in the root `CLAUDE.md`. Since the split (D213) the three files are maintained separately: every new, moved, renamed, or deleted doc is registered in `00-File-Inventory.md` — not here — and the per-task version entry is appended to `00-Context-Map-History.md`, never to this file, which stays small because every task reads it. `scripts/check-context-map.sh` must pass, as must the context-integrity guards `scripts/check-doc-links.sh` (canonical doc links + path-like refs) and `scripts/check-context-budget.sh` (per-file `~tokens` drift from the inventory, per-pack from this map) before any task is claimed done. (2026-07-23; split 2026-08-19)
