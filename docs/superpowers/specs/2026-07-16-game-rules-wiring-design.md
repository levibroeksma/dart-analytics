# Game Rules Folder Wiring — Design

> **Date:** 2026-07-16
> **Status:** approved (brainstorming consensus)
> **Scope:** Wire the user-created `docs/game-rules/` folder (raw, pre-spec, human-authored descriptions of dartboard games, training routines, and standalone trivia tools) into the agent-facing documentation system, so agents can discover it exists, understand it is deliberately non-canonical, and know where each subfolder's content eventually lands. Reference/discoverability plumbing only.
> **Out of scope:** Any change to the content of `docs/game-rules/rulesets/*.md`, `routines/README.md`'s routine outlines, `trivia/checkouts.md`, or `templates/GAME_ENGINE_TEMPLATE.md`. Translating any specific ruleset (501, cricket, etc.) into a real spec or implementation. Deciding trivia's eventual architecture (explicitly left open). Modifying `scripts/check-context-map.sh` (confirmed unnecessary — the script only scans `docs/architecture/*.md` and `database/*.md`, so `docs/game-rules/` is already exempt from its status-header and registration rules).
>
> **Added mid-design (user-directed, standing rule):** every `CLAUDE.md` edit in this task gets its `AGENT.md` mirror updated identically, and this stops being discipline-only going forward — a new `scripts/check-agent-mirrors.sh` mechanically enforces every `CLAUDE.md`/`AGENT.md` pair stays byte-identical, wired into the Context Maintenance gate and CI the same way `check-file-locations.sh` was (D105).

---

## Context

The user moved several existing personal files into a new `docs/game-rules/` folder, organized into four subfolders discovered during exploration:

- `rulesets/` — one file per dartboard game (`501.md`, `cricket.md`, `bobs-27.md`, …) plus a `README.md` ("raw description of rulesets... starting point for developing game engines later on"). Each follows the shape defined in `templates/GAME_ENGINE_TEMPLATE.md` (Features/Identity/Objective/Config/How-to-play/Later-versions/Glossary/Open-questions), which itself states: "These files are **descriptive human rules** — the source for later engine specifications, not the specs themselves."
- `routines/` — currently just a `README.md` describing training-routine outlines ("structure 'routine' to improve over time").
- `trivia/` — currently just `checkouts.md`, describing a standalone checkout-practice flashcard tool. No `README.md`.
- `templates/` — `GAME_ENGINE_TEMPLATE.md`, the authoring template itself (meta-doc, not translatable content).

None of this is registered anywhere agents look. Root `CLAUDE.md`'s Context Loading Protocol only ever points at `docs/architecture/00-Context-Map.md`, and that map's packs don't mention `docs/game-rules/` at all — so an agent asked to add a new game type, build a routine feature, or scope out the trivia tool has no path to discovering this raw material exists, let alone that it's the intended starting point.

Three of the four subfolders map to different places in the existing system, discovered during brainstorming:

- `rulesets/` → the already-documented "Add a new game type" procedure (`05-Database/10-Database-Agent-Guide.md`), which ends in a frontend game engine module (`04-Modules-And-OOP.md`'s `*.engine.module.ts` pattern).
- `routines/` → the already-deferred `ROUTINE_RUN` entity / routine-run write path (D64, `DECISIONS.md`'s "Deferred (open, not rejected)" list).
- `trivia/` → **nothing existing**. Checkout trivia isn't a `game_types` row (it's not played on the board with the standard turn/scoring model) and isn't mentioned anywhere in the architecture docs. This is a genuine open question, not something this task should decide.
- `templates/` → not content to translate; it's the tool used to write `rulesets/` entries.

The design keeps these distinct rather than writing one generic "raw notes, translate later" pointer for all four, so nobody later assumes trivia has a home it doesn't.

---

## Design

### 1. New entry point: `docs/game-rules/README.md`

The single doc an agent (or human) lands on first. Content:

- States plainly: this tree is **non-canonical, pre-spec, human-authored source material** — not architecture, not a spec, not registered in `00-Context-Map.md`, not subject to the `status:` front-matter or registration rules that govern `docs/architecture/`.
- One short table mapping subfolder → what it is → where it lands:

  | Subfolder | Contents | Lands in |
  | --- | --- | --- |
  | `rulesets/` | One file per dartboard game, `GAME_ENGINE_TEMPLATE.md` shape | `05-Database/10-Database-Agent-Guide.md` § "Add a new game type" |
  | `routines/` | Training-routine outlines | Deferred `ROUTINE_RUN` entity (D64, `DECISIONS.md`) |
  | `trivia/` | Standalone practice-tool descriptions (e.g. checkout trivia) | **No pipeline yet** — open question; resolve via the normal engineering workflow (`03-Engineering-Workflow.md`) when first implemented, not assumed here |
  | `templates/` | Authoring template(s) for the other folders | N/A — meta-doc, stays in place |

- One line on the translation mechanism: when a ruleset/routine is ready to build, its raw-notes file is the input to a `brainstorming` session; the output (a real spec under `docs/superpowers/specs/`, then canonical doc/schema updates) is what's authoritative — the raw notes file itself is disposable once translated, not a second source of truth.

### 2. Per-subfolder landing-spot notes

- `docs/game-rules/rulesets/README.md`: append one line — "Translation target: `docs/architecture/05-Database/10-Database-Agent-Guide.md` § 'Add a new game type'."
- `docs/game-rules/routines/README.md`: append one line — "Translation target: the deferred `ROUTINE_RUN` entity / routine-run write path (D64, `DECISIONS.md`)."
- `docs/game-rules/trivia/README.md` (**new file** — none exists today): states what the folder holds and explicitly: "No existing architecture pipeline covers this yet. When the first trivia tool is implemented, its target (standalone route vs. some other model) is an open engineering-workflow decision, not predetermined here — see `docs/superpowers/specs/` and `DECISIONS.md` once that work starts."

### 3. Discovery wiring into the existing agent-facing system

Four small, targeted edits so an agent doing relevant work actually finds `docs/game-rules/README.md` without it being force-loaded on every task (root `CLAUDE.md`'s protocol: "Do not preload anything else"):

- **Root `CLAUDE.md`** — one new row in the "Where Everything Lives" table:
  `| Raw, pre-spec game/routine/trivia rule notes (non-canonical) | \`docs/game-rules/README.md\` |`

- **`00-Context-Map.md`** — two additions:
  - A short new section, "Non-Canonical Source Material," placed after the File Inventory tables and before "Current Implementation State," briefly describing `docs/game-rules/` and linking to its `README.md`. This is deliberately *not* a File Inventory row — those all carry a canonical/historical/generated status, which doesn't apply here.
  - One footnote line directly under the Context Packs table (after the existing "Paths are relative to..." line): "For 'New game type' tasks, also check `docs/game-rules/rulesets/<game>.md` if a raw ruleset note exists for that game — optional human-authored input, not part of the fixed budget above."

- **`05-Database/10-Database-Agent-Guide.md`** — one new line immediately under the "## Add a new game type" heading, before its existing numbered steps 1–7 (steps themselves unchanged, no renumbering):
  "Optional input: `docs/game-rules/rulesets/<game>.md` — a human-authored, non-canonical description of how the game is played, if one exists. Translate it into the steps below via a `brainstorming` session; it is not itself part of this procedure's output."

- **`docs/CLAUDE.md`** — one sentence added to the existing scope line, giving `docs/game-rules/` the same carve-out already granted to `docs/superpowers/`:
  Current: "...`docs/superpowers/` is historical..."
  New: "...`docs/superpowers/` is historical, `docs/game-rules/` is non-canonical pre-spec source material (see `docs/game-rules/README.md`)..."

Every one of the above edits lands in a `CLAUDE.md` that has a sibling `AGENT.md` (root and `docs/`) — both files in each pair are edited identically in the same commit (§4 makes this mechanically enforced, not just done once here).

### 4. AGENT.md mirroring — from documented fact to enforced rule

The Context Map's File Inventory already documents that `AGENT.md` files are an "exact mirror of the sibling `CLAUDE.md` in the same directory... edit both together (2026-07-15)" — but nothing has ever failed if they drift. Per explicit user direction, this becomes a standing, enforced rule:

- **Root `CLAUDE.md` Context Maintenance protocol, step 1** — amended from:
  "1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it."
  to:
  "1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it — **and its `AGENT.md` mirror in the same directory, if one exists, kept byte-for-byte identical** (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`)."
  (Mirrored into `AGENT.md` itself per the rule it now states.)

- **New `scripts/check-agent-mirrors.sh`**: for every `CLAUDE.md` tracked in git, if a sibling `AGENT.md` exists in the same directory, `diff -q` them and fail if they differ.

  ```bash
  #!/usr/bin/env bash
  # AGENT.md mirror checker — every CLAUDE.md must have a byte-identical
  # AGENT.md sibling (Context Map: "exact mirror... edit both together").
  set -u
  cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

  FAIL=0
  for claude in $(git ls-files '*CLAUDE.md'); do
    dir=$(dirname "$claude")
    agent="$dir/AGENT.md"
    if [ -f "$agent" ]; then
      diff -q "$claude" "$agent" >/dev/null 2>&1 \
        || { echo "FAIL: $claude and $agent have diverged" >&2; FAIL=1; }
    fi
  done

  [ $FAIL -eq 0 ] && echo "OK: every CLAUDE.md/AGENT.md pair is identical."
  exit $FAIL
  ```

- **Wired in two places**, mirroring exactly how `check-file-locations.sh` was wired in for D105:
  - Root `CLAUDE.md` Context Maintenance step 5 ("Run `scripts/check-context-map.sh` and `scripts/check-file-locations.sh`") gains a third script: `scripts/check-agent-mirrors.sh`.
  - `.github/workflows/checks.yml`'s `structure` job gets a third step, `AGENT.md mirror gate`, running the new script alongside the existing two.

### 5. `DECISIONS.md`

- Append a pointer to the existing deferred-items line: `ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12)` → `ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12; raw notes: docs/game-rules/routines/)`.
- New entry, **D109**: "`docs/game-rules/` introduced as the non-canonical home for pre-spec, human-authored game/routine/trivia rule descriptions (rulesets, routines, trivia, authoring templates); wired into root `CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, and `docs/CLAUDE.md` for agent discoverability; deliberately exempt from the canonical status/registration rules `check-context-map.sh` enforces for `docs/architecture/`" — Rationale: "Raw domain material existed with no discovery path for agents; wiring it in without promoting it to canonical status keeps architecture-first authority intact while making the input to future game-type/routine work findable."
- New entry, **D110**: "`CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context Map, 2026-07-15), made an explicit Context Maintenance protocol step and mechanically enforced via new `scripts/check-agent-mirrors.sh` (local + CI, alongside `check-context-map.sh`/`check-file-locations.sh`)" — Rationale: "User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones."

---

## Testing

No application code changes — pure documentation plus one new shell script. Verification:

- `bash scripts/check-context-map.sh` must still pass after every new backtick-wrapped path reference is added (root `CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, `docs/CLAUDE.md`, and the new `docs/game-rules/README.md`/`trivia/README.md` themselves, since they also match the script's `*README.md` routing-file pattern and get scanned for their own references). Every path referenced must resolve; the script's resolution bases do not include `docs/game-rules/` as an implicit prefix, so all cross-references to it must be written as the full `docs/game-rules/...` path, not a bare filename.
- `bash scripts/check-agent-mirrors.sh` must pass, both against a deliberately-broken pair (temporarily edit one side, confirm the script fails with the diverged-pair message, revert) and against the real, fully-synced tree (confirm it passes) — this is the one piece of this task with actual pass/fail logic worth exercising both ways before trusting it.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol: `00-Context-Map.md` gets the new "Non-Canonical Source Material" section and Context Packs footnote (no File Inventory row — out of scope for that table by design); `DECISIONS.md` gets D109 and D110 plus the `ROUTINE_RUN` line pointer; `scripts/check-context-map.sh` and the new `scripts/check-agent-mirrors.sh` must both pass; no schema/graph-relevant code changed, but `bash scripts/refresh-graph.sh` still runs per the standing protocol since new `.md`/`.sh` files are added. Work continues on a new branch (`docs/wire-game-rules-folder`), checked out directly (no worktree); PR to `main` at completion.
