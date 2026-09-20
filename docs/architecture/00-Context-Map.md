<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-09-20
-->
# Context Map

> The router: which files a task loads, and which document wins when two
> disagree. Kept small on purpose — it is read at the start of every task.
>
> - Pack lacks the answer? Escalate to `00-File-Inventory.md`.
> - Why was something decided? `DECISIONS.md` routes to `decisions/**`.
> - Provenance and version history? `00-Context-Map-History.md` (never
>   loaded by a task).
> - Noticed something the task didn't ask you to change? Capture it as a
>   GitHub issue via the `capturing-discovered-work` skill; never fix it in
>   the same pass.

---

# Context Packs

Load exactly the pack for your task type. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks the answer. (Root `CLAUDE.md` invariants are always in effect and are not repeated in the packs.)

| Task type | Load exactly | ~Budget |
| --------- | ------------ | ------- |
| New table / column / constraint | `05-Database/10-Database-Agent-Guide.md`, relevant `05-Database/06-Spec/` chapter, `05-Database/03-Migrations.md` | ~12.1k |
| New view / analytics query | `05-Database/05-Views/00-Overview.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5.8k |
| New general (career-wide) stat view | `05-Database/05-Views/01-General-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~4.1k |
| New seed data | `database/seeds/0001` or `0002` (match id ranges); `0003`/`0004` for game-type and preset-realignment precedent, `05-Database/06-Spec/01-Reference-Layer.md` | ~2.2k |
| Neon environment / tooling | `05-Database/11-Neon-Integration.md`, `app/CLAUDE.md` | ~4.6k |
| New API endpoint | `06-API/00-Overview.md`, `06-API/04-Endpoint-Contracts.md`, `app/CLAUDE.md` | ~14.4k |
| API middleware / layering change | `06-API/02-Middleware-And-Layering.md`, `06-API/03-Shared-Conventions.md`, `app/CLAUDE.md` | ~9.2k |
| Frontend page / component work | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/05-Astro-Components.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~14.5k |
| Frontend gameplay / session features | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~18.5k |
| Frontend new route / rendering | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `app/CLAUDE.md` | ~12.7k |
| Frontend architecture / new pattern | `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/05-Astro-Components.md`, `04-Architecture-patterns.md`, `01-Principles.md` | ~17.5k |
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~12.7k |
| New test / test-strategy question | `07-Frontend/06-Test-Strategy.md`, `app/CLAUDE.md` | ~4.1k |
| New game type | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `06-Spec/01-Reference-Layer.md`, `06-Spec/02-Template-Layer.md`, seeds | ~9.9k |
| New game engine | `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", the game's `docs/game-rules/rulesets/` doc | ~12.4k |
| Architecture question / new pattern | `01-Principles.md`, `04-Architecture-patterns.md` | ~8.6k |
| Workflow / process question | `03-Engineering-Workflow.md` | ~2.2k |
| "Why was X decided?" | `DECISIONS.md` (router — Source key, routing table, Deferred list, how-to-add-a-decision); then load only the domain file(s) your task needs from its routing table, e.g. `decisions/database.md`; deeper lineage: git history. Actual per-task total varies with domain (router + testing.md, the smallest, runs ~2.3k; router + game-engine.md, the largest, runs ~5.8k) — the single figure in the last column below prices only the router + the one example file named above. | ~13.9k |
| Bug in migration chain | `05-Database/03-Migrations.md`, full chain `database/migrations/0001`–`0041`; never patch applied files | ~9.9k |
| Issue-driven UI polish | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/07-Style-Guide.md`, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~11.4k |
| New game (full stack) | `07-Frontend/09-Adding-A-Game.md` (the touch list, the two shapes to reuse, the two opt-outs), `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~17.1k |
| Authoring or amending game / exercise / routine / trivia rules | `authoring-game-rules` skill (its own `references/` file for the shape), the matching `docs/game-rules/templates/` template, and the existing rules file if there is one; `09-Training/01-Routines.md` for exercise and routine shapes | ~7.1k |
| New non-game client tool (Trivia) | `09-Training/00-Overview.md`, `09-Training/02-Trivia.md`, `07-Frontend/04-Modules-And-OOP.md` §Non-Game Client Tools, `07-Frontend/02-Folder-Structure.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `app/CLAUDE.md`, `docs/game-rules/training/trivia/README.md` | ~18.1k |

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
8. SQL migrations `0001`–`0041` and seeds
9. Application code in `app/`

If code contradicts architecture docs, the docs win unless the user explicitly directs otherwise. Git history (the retired master context) and the decision ledger (`DECISIONS.md` the router, `decisions/**` the domain files it routes to) are context, never authority — they explain *why*, they never state *what is*, and rank below every numbered item above.

---

---

# Non-Canonical Source Material

`docs/game-rules/` holds pre-spec, human-authored game/exercise/routine/trivia rule descriptions — entry point `docs/game-rules/README.md` (2026-07-16). This tree is deliberately **not** registered in the File Inventory above and carries no `status:` front-matter requirement: `scripts/check-context-map.sh` only enforces those rules for `docs/architecture/` and `database/`. See `docs/game-rules/README.md` for the per-subfolder translation targets.

It is non-canonical but **not disposable**: a rules file is the standing register of what a version deferred and why, revised when a later version ships rather than deleted once translated. It remains an input, never authority — it ranks with git history and the decision ledger. Authoring and amending run through the `authoring-game-rules` skill; `scripts/check-game-rules.sh` checks the result against its shape's template contract. (2026-09-19, D322)

`docs/superpowers/specs/` is non-canonical on the same terms: `superpowers:brainstorming` writes and commits a design doc there per its own default, and this repo does not intercept it. Specs are an input to a task, never authority — they rank with git history and the decision ledger. No File Inventory row is owed per spec, and no `status:` front matter is required; the gate scripts do not reach the tree. (2026-09-18, D312)

---

---

# Maintenance Protocol

This map is kept correct by the mandatory Context Maintenance rules in the root `CLAUDE.md`. Since the split (D213) the three files are maintained separately: every new, moved, renamed, or deleted doc is registered in `00-File-Inventory.md` — not here — and the per-task version entry is appended to `00-Context-Map-History.md`, never to this file, which stays small because every task reads it. `scripts/check-context-map.sh` must pass, as must the context-integrity guards `scripts/check-doc-links.sh` (canonical doc links + path-like refs) and `scripts/check-context-budget.sh` (per-file `~tokens` drift from the inventory, per-pack from this map) before any task is claimed done. (2026-07-23; split 2026-08-19)
