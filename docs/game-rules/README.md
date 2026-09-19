# Game Rules — Raw Source Material

This tree holds **non-canonical, pre-spec, human-authored** descriptions of dartboard games, training routines, and standalone practice tools. Nothing here has `status:` front-matter and nothing here is registered in `docs/architecture/00-File-Inventory.md` — `scripts/check-context-map.sh` deliberately does not scan this folder, since it only enforces the canonical rules for `docs/architecture/` and `database/`.

| Subfolder | Contents | Lands in |
| --- | --- | --- |
| `rulesets/` | One file per dartboard game, in the `templates/GAME_RULESET_TEMPLATE.md` shape | `docs/architecture/05-Database/10-Database-Agent-Guide.md` § "Add a new game type" |
| `training/exercises/` | One file per exercise type (`WARM_UP`, `SWITCHING`, …), in the `templates/EXERCISE_TEMPLATE.md` shape | `docs/architecture/09-Training/01-Routines.md` §Exercise Type / the `ExerciseEngine` contract |
| `training/routines/` | Training-routine outlines, in the `templates/ROUTINE_TEMPLATE.md` shape — compositions only, no rules of their own | The deferred `ROUTINE_RUN` entity / routine-run write path (D64, `decisions/api.md`) |
| `training/trivia/` | Standalone practice-tool descriptions (e.g. checkout trivia), in the `templates/TRIVIA_TEMPLATE.md` shape | **No pipeline yet** — open question, resolved via the normal engineering workflow (`docs/architecture/03-Engineering-Workflow.md`) when first implemented, not predetermined here |
| `templates/` | The four authoring templates — game ruleset, exercise type, routine, trivia tool | N/A — meta-docs, stay in place |

`training/` mirrors the `lib/`/`modules/`/`components/layout/` source split (D308, 2026-09-17): the two subfolders that describe training-adjacent tools live there instead of directly under this root.

**Translation mechanism:** when a ruleset, exercise, routine or trivia tool is ready to build, its rules file here is the *input* to a `superpowers:brainstorming` session. The output — a real spec under `docs/superpowers/specs/`, then the corresponding canonical doc/schema updates — is what becomes authoritative. The rules file is never a second source of truth alongside the spec.

**Lifecycle:** a rules file is **permanent**, not disposable. It is the standing register of what a version deferred and why — the `Features` table's non-`V1` rows and their reasons exist precisely so a later version can pick them up without re-deriving the reasoning, and a `Dropped` row is what stops an idea being re-proposed. When a deferred feature is picked up, its row moves `V2+` → `V<n>` in the same PR; `Current version:` advances when that version ships. The file stays non-canonical — an input, never authority — but it is maintained. (2026-09-19, D322, supersedes the previous "disposable once translated" rule)

**Authoring and amending** are driven by the `authoring-game-rules` skill, which owns the V1 cut test, the version vocabulary, and the amend procedure. `scripts/check-game-rules.sh` checks the result against its shape's template contract.
