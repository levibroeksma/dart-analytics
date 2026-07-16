# Game Rules — Raw Source Material

This tree holds **non-canonical, pre-spec, human-authored** descriptions of dartboard games, training routines, and standalone practice tools. Nothing here has `status:` front-matter and nothing here is registered in `docs/architecture/00-Context-Map.md` — `scripts/check-context-map.sh` deliberately does not scan this folder, since it only enforces the canonical rules for `docs/architecture/` and `database/`.

| Subfolder | Contents | Lands in |
| --- | --- | --- |
| `rulesets/` | One file per dartboard game, in the `templates/GAME_ENGINE_TEMPLATE.md` shape | `docs/architecture/05-Database/10-Database-Agent-Guide.md` § "Add a new game type" |
| `routines/` | Training-routine outlines | The deferred `ROUTINE_RUN` entity / routine-run write path (D64, `DECISIONS.md`) |
| `trivia/` | Standalone practice-tool descriptions (e.g. checkout trivia) | **No pipeline yet** — open question, resolved via the normal engineering workflow (`docs/architecture/03-Engineering-Workflow.md`) when first implemented, not predetermined here |
| `templates/` | Authoring template(s) used to write files under `rulesets/` | N/A — meta-doc, stays in place |

**Translation mechanism:** when a ruleset or routine is ready to build, its raw-notes file here is the *input* to a `brainstorming` session. The output — a real spec under `docs/superpowers/specs/`, then the corresponding canonical doc/schema updates — is what becomes authoritative. The raw-notes file itself is disposable once translated; it is not a second source of truth alongside the spec.
