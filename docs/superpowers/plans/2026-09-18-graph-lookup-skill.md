# Graph Lookup Skill (F4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a 678-line build manual that fires on almost any question with a short lookup skill that fires on the question it actually answers, and remove the two invitations to load the 7.7 MB graph whole.

**Architecture:** `.claude/skills/graphify/` is deleted and `.claude/skills/graph-lookup/` replaces it — a ~40-line `SKILL.md` carrying one tested query recipe, plus `references/building.md` holding what this repo genuinely needs about rebuilding. The rename is the load-bearing part: the skill's `description:` is its trigger, and the current one is the broadest in the set. Root `CLAUDE.md` and `app/CLAUDE.md` are trimmed to match. With `graphify/SKILL.md` gone, this branch also completes the link-gate widening plan 1 deliberately left short.

**Tech Stack:** Markdown skill definitions, Bash, Python 3.

**Spec:** `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` — Branch 2.

**Branch:** `refactor/graph-lookup-skill`, off latest `origin/main` **after plan 1's PR has merged** (this plan edits `scripts/check-doc-links.sh`, which plan 1 also edits).

**Decision id:** D315 (reserved; re-derive at Task 5).

---

## Global Constraints

- **Branch first.** `git fetch origin && git switch -c refactor/graph-lookup-skill origin/main`. Never commit on `main`.
- **Never `--no-verify`.**
- **Extreme concision in commit messages.**
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **PR body ends with:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Decisions are append-only.** New block at the end of the domain file.
- **Discovered work → GitHub issue**, never fixed in this pass.
- **Context Maintenance is mandatory** before claiming done (Task 5).
- **Do not touch `graphify-out/graph.json`.** Freshness is CI-owned (D185, D287). A local graph commit only creates a conflict against the `chore/graph-refresh` PR.
- **The `graphify` *CLI* and the `graphify-out/` *directory* keep their names.** Only the *skill* is renamed. Every reference to `graphify-out/graph.json`, `graphifyy`, `scripts/refresh-graph.sh` and `.github/workflows/graph.yml` stays exactly as it is.
- **No runtime code, no migrations.** Do not run `npm test` or `validate:app` and do not claim them.

---

## Why the 678 lines have no consumer here

Worth knowing before deleting anything: `.github/workflows/graph.yml` rebuilds the graph with `pip install 'graphifyy[sql]>=0.9.32,<0.10'` followed by `bash scripts/refresh-graph.sh` (lines 36–43 and 302–309). It never reads `.claude/skills/graphify/SKILL.md`. Neither does `scripts/refresh-graph.sh`, which hardcodes the one canonical command (`graphify update .`). The skill's nine-step pipeline — chunked subagent extraction, community labelling, Neo4j/FalkorDB/GraphML exports, Obsidian vaults, video transcription — describes the upstream tool's full surface, none of which this repo runs. Deleting it removes a manual nothing invokes, not a capability.

---

## File Structure

| File | Created / modified / deleted | Responsibility |
| --- | --- | --- |
| `.claude/skills/graph-lookup/SKILL.md` | create | The narrow trigger + one tested lookup recipe |
| `.claude/skills/graph-lookup/references/building.md` | create | How the graph is built and refreshed here — loaded only when asked |
| `.claude/skills/graphify/SKILL.md` | delete | 678 lines with no consumer in this repo |
| `CLAUDE.md:65-66` | modify | Drop "or read it directly"; repoint the install pointer |
| `app/CLAUDE.md:21-35` | modify | Graphify section → two-line pointer |
| `scripts/check-doc-links.sh` | modify | Widen scan set to `.claude/skills/**/*.md` |
| `docs/architecture/00-File-Inventory.md` | modify | Replace the graphify skill row with two rows |
| `docs/architecture/00-Context-Map-History.md` | modify | Version entry + Task Records row |
| `decisions/context-system.md` | modify | D315 |

---

### Task 1: The `graph-lookup` skill

**Files:**
- Create: `.claude/skills/graph-lookup/SKILL.md`
- Create: `.claude/skills/graph-lookup/references/building.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the directory `.claude/skills/graph-lookup/` with a `references/building.md` that Task 2's `app/CLAUDE.md` pointer and Task 4's inventory rows both name by path. The exact path string `.claude/skills/graph-lookup/references/building.md` is used verbatim in Tasks 2 and 5.

**The recipe below is tested, not invented.** `graphify-out/graph.json` is a node-link JSON: `nodes[]` carry `id`, `label`, `norm_label`, `source_file`, `source_location`, `community_name`, `file_type`; `links[]` carry `source`, `target`, `relation`, `source_file`, `source_location`, `confidence`. 5,528 nodes and 13,195 links at time of writing. Running the recipe on `resolveCheckoutAttempt` returns `app/src/modules/game/checkout-bust.module.ts L12` plus 15 references — verify you get the same before committing.

- [ ] **Step 1: Create the skill**

```bash
mkdir -p .claude/skills/graph-lookup/references
```

Write `.claude/skills/graph-lookup/SKILL.md` with exactly this content:

````markdown
---
name: graph-lookup
description: Use to locate a named entity in THIS repository — which file defines a symbol, what calls or imports it, how app code, SQL migrations and docs connect — when you would otherwise start a broad grep or directory sweep. Queries the committed graphify-out/graph.json. Not for building, rebuilding or exporting the graph.
---

# Graph Lookup

`graphify-out/graph.json` is a committed AST-only knowledge graph over this repo's TypeScript, SQL and Markdown. Use it to find where something lives, then read that file. The graph is a map, not authority: on any conflict the authority order in `docs/architecture/00-Context-Map.md` wins, so verify what the graph says against the file it names.

## Never read the file whole

It is 7.7 MB — roughly 1.9M tokens. `Read` on it is denied in `.claude/settings.json` (D314). Query it instead; the queries below return a handful of lines.

## Find a symbol and everything that touches it

```bash
python3 - <<'PY'
import json
NAME = "resolveCheckoutAttempt"   # substitute the symbol you are looking for
g = json.load(open("graphify-out/graph.json"))
hits = [n for n in g["nodes"] if NAME.lower() in n["norm_label"]]
for n in hits:
    print(f'{n["label"]:40} {n["source_file"]}:{n["source_location"]}')
ids = {n["id"] for n in hits}
for l in g["links"]:
    if l["source"] in ids or l["target"] in ids:
        print(f'  {l["relation"]:12} {l["source_file"]}:{l["source_location"]}')
PY
```

Widen by substring, not by exact name — `norm_label` is lowercased. A search for a common fragment returns a lot; narrow it before widening it.

## Scope caveats

- `.astro` files are only partially parsed (no tree-sitter grammar). TypeScript, JavaScript, SQL and Markdown are fully covered.
- The graph lags `main` by at most one merge — CI rebuilds it on every merge and opens a PR with the delta.
- Nothing about a `.astro` component's markup is in here. For frontend work, the context pack in `00-Context-Map.md` is the right starting point, not this skill.

## Building or refreshing the graph

Not this skill's job, and not a local task — freshness is CI-owned. See `references/building.md`.
````

- [ ] **Step 2: Create the building reference**

Write `.claude/skills/graph-lookup/references/building.md` with exactly this content:

````markdown
# Building and refreshing the knowledge graph

Read this only when the question is about how the graph is produced. Looking something *up* needs none of it — see the sibling `SKILL.md`.

## Freshness is CI-owned

`.github/workflows/graph.yml` installs `graphifyy[sql]`, runs `bash scripts/refresh-graph.sh` with `GRAPH_REFRESH_STRICT=1`, commits the result to `chore/graph-refresh` and opens a PR with the node/link delta. That PR's commit is unsigned and `main`'s ruleset requires verified signatures, so only a bypass actor can merge it — landing a refresh is one deliberate human merge (D289). If the PR cannot be opened at all, the workflow files a `graph: refresh PR could not be opened` issue rather than passing silently (D287).

None of this is a local completion-report item. Do not stage `graphify-out/graph.json` yourself: a local graph commit only creates a conflict against the open refresh PR (D185, D287).

## Optional local install

Only useful for querying with the CLI instead of the Python recipe in `SKILL.md`. Nothing in this repo depends on it.

```
uv tool install graphifyy    # or: pipx install graphifyy
pip install "graphifyy[sql]" # REQUIRED — without it all SQL migrations vanish from the graph
```

With the CLI present, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<entity>"` are a nicer interface to the same committed file.

`graphify hook install` adds an AST-only rebuild on commit. If you install it, still do not stage the output — see above.

## Rebuild rules

- Rebuilds go through `scripts/refresh-graph.sh`, which holds the canonical flags. It warns instead of failing when the CLI is absent locally; CI sets `GRAPH_REFRESH_STRICT=1`, where the same conditions are hard failures.
- The canonical command is `graphify update .`, empirically determined — not `graphify extract . --update`, which demands an LLM API key.
- Extraction is AST-only. Never configure an LLM API key for graphify: it keeps the build free and deterministic.
- `graphify-out/graph.json` is committed; `graphify-out/graph.html` and the regenerable report are gitignored.
````

- [ ] **Step 3: Verify the recipe actually works**

```bash
cd .claude/skills/graph-lookup && sed -n '/^```bash$/,/^```$/p' SKILL.md | sed '1d;$d' > /tmp/recipe.sh && cd - >/dev/null && bash /tmp/recipe.sh
```

Expected: `resolveCheckoutAttempt()` located at `app/src/modules/game/checkout-bust.module.ts:L12`, followed by ~15 `calls` lines naming `five-oh-one.engine.module.ts`, `one-twenty-one.engine.module.ts` and their tests. If the output is empty, the recipe is broken — fix it before committing, do not ship an untested recipe.

- [ ] **Step 4: Verify the description is genuinely narrower**

```bash
grep -m1 'description:' .claude/skills/graph-lookup/SKILL.md
```

Expected: a description that names *this repository*, names the triggering situation (about to grep broadly), and explicitly excludes building. The old one read "any question about a codebase, its architecture, file relationships, or project content" — if the new one could still match a routine question with no lookup in it, tighten it.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/graph-lookup/
git commit -m "$(cat <<'EOF'
feat: add graph-lookup skill — narrow trigger, tested query recipe

Replaces graphify's catch-all description ("any question about a
codebase...") with one that fires only when a lookup is actually wanted.
Query recipe verified against resolveCheckoutAttempt: 1 definition,
15 references.

Build/refresh detail moved to references/building.md, loaded on demand.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Delete the old skill and trim the two CLAUDE.md invitations

**Files:**
- Delete: `.claude/skills/graphify/SKILL.md`
- Modify: `CLAUDE.md:65-66`
- Modify: `app/CLAUDE.md:21-35`

**Interfaces:**
- Consumes: `.claude/skills/graph-lookup/references/building.md` from Task 1 — `app/CLAUDE.md`'s new pointer names that exact path, and `check-context-map.sh` check 1 scans every `*CLAUDE.md` for backticked `.md` refs, so the path must already exist or this task fails its own gate.
- Produces: an `app/CLAUDE.md` of ~133 lines (from 145), which plan 3 reduces further.

- [ ] **Step 1: Delete the old skill**

```bash
git rm -r .claude/skills/graphify/
```

- [ ] **Step 2: Fix root `CLAUDE.md`'s first bullet**

`CLAUDE.md:65` currently ends `— grep it for an entity, or read it directly. Use it to orient…`. That clause invites a ~1.9M-token read. Replace the whole bullet with:

```markdown
- **Consult the committed file before broad grep/exploration.** `graphify-out/graph.json` is in the repo and queryable with the tools every session already has — grep it for an entity, or use the `graph-lookup` skill's recipe. Never read it whole: 7.7 MB is roughly 1.9M tokens, and `.claude/settings.json` denies the read (D314). Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
```

- [ ] **Step 3: Repoint root `CLAUDE.md`'s install pointer**

`CLAUDE.md:66` ends `— see \`app/CLAUDE.md\` for a local install.` The install block is moving out of `app/CLAUDE.md` in Step 4, so replace that trailing clause with:

```
— see `.claude/skills/graph-lookup/references/building.md` for a local install.
```

- [ ] **Step 4: Replace `app/CLAUDE.md`'s graphify section with a pointer**

Delete lines 21–35 in full — the `## Knowledge Graph (graphify)` heading, the CI-ownership paragraph, the three-line install block and the five bullets. In their place, put exactly two lines:

```markdown
## Knowledge Graph (graphify)

Freshness is CI-owned; nothing here is a local task. Looking something up: the `graph-lookup` skill. Building, refreshing, optional local install: `.claude/skills/graph-lookup/references/building.md`.
```

Everything deleted is preserved in `references/building.md` except the two bullets that were pure restatement of root `CLAUDE.md` (the "query the graph to orient" pointer and the `--code-only` note, which `scripts/refresh-graph.sh` already owns as a hardcoded flag).

- [ ] **Step 5: Confirm the line count moved as expected**

```bash
wc -l app/CLAUDE.md
```

Expected: `133` (±2). If it is much lower, something app-wide was deleted by accident — `git diff app/CLAUDE.md` and check.

- [ ] **Step 6: Confirm no dangling references to the deleted skill**

```bash
git grep -n 'skills/graphify' -- ':!docs/superpowers' ':!docs/architecture/00-Context-Map-History.md' ':!decisions'
```

Expected: exactly one hit — `docs/architecture/00-File-Inventory.md`, which Task 4 fixes. Historical trees (`docs/superpowers/**`, the history file, `decisions/**`) are append-only provenance and are deliberately left as written.

- [ ] **Step 7: Confirm the *tool* references are untouched**

```bash
git grep -c 'graphify-out\|graphifyy\|refresh-graph' -- README.md app/README.md .github/workflows/graph.yml scripts/refresh-graph.sh
```

Expected: non-zero for every one of them. Renaming the skill must not have touched the CLI, the output directory, the workflow or the refresh script.

- [ ] **Step 8: Run the two gates this task can break**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
```

Expected: `OK:` from both. `check-context-map.sh` check 1 scans every `*CLAUDE.md` for backticked `.md` refs, so it is the gate that proves `references/building.md` resolves from `app/CLAUDE.md`.

- [ ] **Step 9: Commit**

```bash
git add -A .claude/skills CLAUDE.md app/CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor: delete the graphify skill, drop the read-it-whole invitations

678 lines with no consumer: graph.yml rebuilds via pip + refresh-graph.sh
and never reads the skill. Its pipeline describes the upstream tool's
full surface, none of which this repo runs.

Root CLAUDE.md loses "or read it directly" — a ~1.9M-token invitation.
Grep stays; it is what the manual actually wants. app/CLAUDE.md's install
block moves to references/building.md behind a two-line pointer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Complete the link-gate widening plan 1 left short

**Files:**
- Modify: `scripts/check-doc-links.sh` (the block plan 1 added after line 86)

**Interfaces:**
- Consumes: plan 1's `rules_dir` block, which this task replaces; and Task 2's deletion of `graphify/SKILL.md`, without which this task fails.
- Produces: `.claude/skills/**/*.md` inside the doc-link gate's scan set.

**Why here and not in plan 1:** widening over `.claude/skills/**` was measured on `main` before plan 1 was written — exactly 8 failures, every one a `references/*.md` path in `graphify/SKILL.md` that never existed in this repo (the fork copied `SKILL.md` without upstream's `references/` directory). Task 2 deleted that file. The widening is now free.

- [ ] **Step 1: Replace plan 1's rules-only block**

In `scripts/check-doc-links.sh`, find the block plan 1 inserted after `files.extend(sorted(Path("decisions").rglob("*.md")))` and replace it in full with:

```python
    # .claude/skills/**/*.md and .claude/rules/*.md carry path pointers into
    # the doc tree and are reachable from no other gate's scan set. Both are
    # guarded with is_dir(): .claude/rules/ does not exist until the
    # path-scoped-rules branch creates it, and the widening must be inert
    # rather than fatal until then.
    for extra in (Path(".claude/skills"), Path(".claude/rules")):
        if extra.is_dir():
            files.extend(sorted(extra.rglob("*.md")))
```

- [ ] **Step 2: Run the gate — must be green**

```bash
bash scripts/check-doc-links.sh
```

Expected: `OK: doc links and path-like references resolve (N files scanned).` `N` is up by 2 over plan 1's figure — the new `SKILL.md` and `references/building.md`.

If any `FAIL` names `.claude/skills/`, a reference in one of the six skills is genuinely broken. Fix the reference; do not narrow the gate.

- [ ] **Step 3: Prove it reaches a skills file**

```bash
printf '\nSee `references/not-a-real-file.md`.\n' >> .claude/skills/graph-lookup/SKILL.md
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `FAIL: .claude/skills/graph-lookup/SKILL.md: unresolved path-like reference \`references/not-a-real-file.md\`` and `exit=1`.

- [ ] **Step 4: Revert the fixture and confirm green**

```bash
git checkout -- .claude/skills/graph-lookup/SKILL.md
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: the `OK:` line and `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-doc-links.sh
git commit -m "$(cat <<'EOF'
feat: scan .claude/skills/**/*.md for doc-link integrity

The 8 dangling references/*.md pointers that blocked this went with the
graphify skill in the previous commit. Proven to bite on a fixture.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Context maintenance, D315, and the PR

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md` — replace the graphify skill row with two rows
- Modify: `docs/architecture/00-Context-Map-History.md` — version entry + Task Records row
- Modify: `decisions/context-system.md` — append D315

**Interfaces:**
- Consumes: every file touched in Tasks 1–3.
- Produces: the inventory rows that `check-skill-pointers.sh` (plan 1, Task 2) requires. **This task is not optional and cannot be deferred** — the gate fails the commit until the `graph-lookup` row exists, and it runs in `.husky/pre-commit`.

- [ ] **Step 1: Replace the graphify skill row in the File Inventory**

In `docs/architecture/00-File-Inventory.md` §Context & history, delete:

```markdown
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
```

and put in its place:

```markdown
| `.claude/skills/graph-lookup/SKILL.md` | Locate a named entity in this repo via `graphify-out/graph.json` — one tested Python recipe, narrow trigger. Replaces the 678-line `graphify` skill, whose catch-all description fired on routine questions and whose build pipeline no path in this repo invoked (2026-09-18, D315) | canonical |
| `.claude/skills/graph-lookup/references/building.md` | How the graph is built and refreshed here: CI ownership, the `graphify update .` canonical command, optional local install; loaded only when the question is about building (2026-09-18, D315) | canonical |
```

The registration string `check-skill-pointers.sh` matches is the backticked path, so `references/building.md` does **not** need a row for that gate — only `*/SKILL.md` is asserted. It gets one anyway because the Context Maintenance protocol registers every new doc.

- [ ] **Step 2: Refresh the `app/CLAUDE.md` inventory row's date list**

Append `; graphify section moved to the graph-lookup skill 2026-09-18` inside that row's existing trailing parenthetical.

- [ ] **Step 3: Append the version entry**

Directly under `# Version History`, above `1.84.0`:

```markdown
> **Version:** 1.85.0 (2026-09-18 — graph-lookup: the 678-line `.claude/skills/graphify/SKILL.md` is deleted and replaced by `.claude/skills/graph-lookup/` — a ~40-line `SKILL.md` with one tested query recipe plus `references/building.md`. The rename is the point: the old `description:` read "any question about a codebase, its architecture, file relationships, or project content", the broadest trigger in the set, so it injected a build manual into routine questions. Nothing in this repo ever invoked that manual — `graph.yml` rebuilds via `pip install graphifyy[sql]` and `scripts/refresh-graph.sh`, which hardcodes the canonical command. Root `CLAUDE.md` loses "or read it directly" (7.7 MB ≈ 1.9M tokens; grep stays) and repoints its install pointer; `app/CLAUDE.md`'s graphify section becomes two lines, 145 → ~133. `check-doc-links.sh` now scans `.claude/skills/**/*.md`, which the 8 dangling `references/*.md` pointers in the deleted file had blocked. D315.)
>
```

- [ ] **Step 4: Derive the id and append D315**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected `314` (plan 1 landed D314), so the next id is `D315`. At the end of `decisions/context-system.md`:

```markdown
### D315 — The knowledge-graph skill is a lookup skill, and the graph is never read whole
Status: Accepted · Date: 2026-09-18
Decision: `.claude/skills/graphify/SKILL.md` (678 lines) is deleted and replaced by `.claude/skills/graph-lookup/SKILL.md` (~40 lines, one tested query recipe) plus `.claude/skills/graph-lookup/references/building.md`. The new `description:` triggers only on locating a named entity in this repository and explicitly excludes building. Root `CLAUDE.md`'s "or read it directly" clause is removed and its install pointer moves from `app/CLAUDE.md` to `references/building.md`; `app/CLAUDE.md`'s §Knowledge Graph becomes a two-line pointer, 145 lines → ~133. `check-doc-links.sh` gains `.claude/skills/**/*.md`.
Reason: a skill's `description:` is its trigger, and this one — "any question about a codebase, its architecture, file relationships, or project content" — was the broadest in the repo, so a nine-step build pipeline loaded on routine questions. It was also unused: `.github/workflows/graph.yml` installs `graphifyy[sql]` and runs `scripts/refresh-graph.sh`, which hardcodes `graphify update .`; no path in this repo reads the skill. The deleted text described the upstream tool's full surface — chunked subagent extraction, Neo4j/FalkorDB/GraphML exports, Obsidian vaults, video transcription — none of which this repo runs. Separately, "or read it directly" invited a whole-file read of 7.7 MB, roughly 1.9M tokens; grep and the Python recipe return a handful of lines from the same file, which is what the instruction was always reaching for.
Consequences: the skill no longer documents how to *build* a graph from scratch, only how to query the one that exists — correct here, where builds are CI's, and a real loss for anyone wanting to point graphify at an unrelated folder, who should install the upstream plugin rather than read a repo skill. The rename shadows nothing: `graphify` the CLI, `graphifyy` the package, `graphify-out/` the directory, `scripts/refresh-graph.sh` and `.github/workflows/graph.yml` all keep their names, and only the skill moved. Mentions of the old skill path inside `docs/superpowers/**`, `00-Context-Map-History.md` and `decisions/**` are left as written, being provenance rather than live pointers — the same carve-out D311 made. Deleting the file also unblocked `check-doc-links.sh` over `.claude/skills/**`: its 8 `references/*.md` pointers named files this repo never had, inherited from a fork that copied `SKILL.md` without upstream's `references/` directory, and they were the only thing the widened gate failed on.
```

- [ ] **Step 5: Register this plan in Task Records**

```markdown
| `docs/superpowers/plans/2026-09-18-graph-lookup-skill.md` | The 4-task plan for branch 2 (F4): the `graph-lookup` skill + `references/building.md` with a recipe verified against `resolveCheckoutAttempt` (Task 1), deletion of the 678-line graphify skill plus the root/`app` CLAUDE.md trims (Task 2), `check-doc-links.sh` widened to `.claude/skills/**/*.md` (Task 3), context maintenance + D315 (Task 4) (2026-09-18) | historical |
```

- [ ] **Step 6: Run every applicable gate and report each result**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-test-coverage.sh
bash scripts/check-decision-ids.sh
```

Expected: eight `OK:` lines. State each result explicitly.

`check-context-budget.sh` is worth watching here: `app/CLAUDE.md` shrank by ~12 lines and 11 pack rows in `00-Context-Map.md` price it. Per-pack tolerance is 30%, and `app/CLAUDE.md` is a small fraction of each pack, so the packs should stay inside tolerance — but if any row fails, recompute that row rather than reverting the trim. Plan 3 recomputes all 11 regardless.

- [ ] **Step 7: Commit**

```bash
git add docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md decisions/context-system.md
git commit -m "$(cat <<'EOF'
docs: register graph-lookup — inventory, history 1.85.0, D315

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill. Option 2, no menu.

PR body must state: the recipe's verified output, that CI never read the deleted file, and the `wc -l app/CLAUDE.md` before/after.

---

## What this branch does not prove

Whether the narrower `description:` actually stops the skill firing on routine questions is not observable from CI. The honest measure is whether `graph-lookup` shows up in `/context` on a session that had no lookup in it. That is an observation, not a test.
