# Graphify Signal Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the committed knowledge graph reproducible, scoped to the living codebase, and correctly documented.

**Architecture:** Fix the canonical build command first (it is currently non-reproducible: `--update --code-only` on graphifyy 0.9.15 collapses the committed 2,388-node graph to 263 nodes by dropping Markdown and, without the SQL extra, all SQL). Then scope the corpus via `.graphifyignore`, rebuild once, and encode the canonical command in a committed script that every other gate calls.

**Tech Stack:** graphifyy (PyPI, `graphify` CLI), bash, git.

**Spec:** `docs/superpowers/specs/2026-07-14-graphify-signal-hardening-design.md`

## Global Constraints

- **Execution order:** this plan runs FIRST (the repo-restructure plan depends on its `scripts/refresh-graph.sh`).
- Never commit a graph whose node count collapses relative to the committed one unless the shrink is explained by the intentional scope change (Decision 1) — the shrink signal is the defect being fixed.
- Graphify stays AST-only: never configure `GEMINI_API_KEY`/`GOOGLE_API_KEY`; no LLM cost.
- Context Maintenance protocol (root `CLAUDE.md`) applies: checker must pass, ISO dates on changed doc rows.
- Paths in this plan are PRE-restructure (this plan runs before the restructure plan).

---

### Task 1: Install graphify with SQL support and pin the environment

**Files:**
- Modify: `app/CLAUDE.md` (Knowledge Graph section, lines 19–31)

**Interfaces:**
- Produces: a working `graphify` CLI with `tree_sitter_sql`, required by Tasks 2–3.

- [ ] **Step 1: Install with the SQL extra**

```bash
pip install "graphifyy[sql]" --quiet --break-system-packages 2>/dev/null || pip install "graphifyy[sql]" --quiet
python3 -c "import tree_sitter_sql; print('sql parser ok')"
graphify --help | head -3
```

Expected: `sql parser ok` and the CLI usage text. If `tree_sitter_sql` import fails, stop — SQL files will silently contribute nothing (defect #1745).

- [ ] **Step 2: Promote the SQL extra from optional to required in `app/CLAUDE.md`**

Replace:

```
pip install "graphifyy[sql]" # SQL migration parsing (optional but recommended)
```

with:

```
pip install "graphifyy[sql]" # REQUIRED — without it all SQL migrations vanish from the graph
```

- [ ] **Step 3: Commit**

```bash
git add app/CLAUDE.md
git commit -m "docs(graphify): SQL extra is required, not optional — migrations vanish without it"
```

---

### Task 2: Determine the canonical build command empirically

**Files:**
- Create: `scripts/refresh-graph.sh`
- Test: manual corpus comparison (commands below)

**Interfaces:**
- Produces: `scripts/refresh-graph.sh` — always exits 0; refreshes `graphify-out/graph.json` when the CLI is present, prints `WARN: graphify CLI not installed — knowledge graph not refreshed` when absent. The single-source-consolidation plan wires `npm run validate:app` to this script; the restructure plan calls it for the post-move rebuild.

- [ ] **Step 1: Snapshot the committed corpus for comparison**

```bash
python3 - <<'EOF'
import json, collections
g = json.load(open('graphify-out/graph.json'))
files = sorted({n.get('source_file','?') for n in g['nodes']})
print('committed nodes:', len(g['nodes']))
print('committed source files:', len(files))
exts = collections.Counter(f.rsplit('.',1)[-1] for f in files)
print('by extension:', dict(exts))
open('/tmp/committed_files.txt','w').write('\n'.join(files))
EOF
```

Expected: ~2,388 nodes with `.md`, `.sql`, `.ts` files all present — proving the committed graph was built WITHOUT `--code-only`.

- [ ] **Step 2: Trial-build without `--code-only` into a scratch copy**

```bash
cp graphify-out/graph.json /tmp/graph_backup.json
graphify extract . --update 2>&1 | tail -6
python3 - <<'EOF'
import json
g = json.load(open('graphify-out/graph.json'))
files = {n.get('source_file','?') for n in g['nodes']}
print('nodes:', len(g['nodes']))
print('has md:', any(f.endswith('.md') for f in files))
print('has sql:', any(f.endswith('.sql') for f in files))
EOF
```

Expected: node count within ±20% of committed; `has md: True`, `has sql: True`. Decision rule: if this holds, the canonical command is `graphify extract . --update` (no `--code-only`); note that Markdown extraction ran AST-only with no API key, confirming zero LLM cost. If the run stalls asking for semantic extraction or drops Markdown, the canonical command falls back to `graphify extract . --update --code-only` and the docs must then say the graph covers code+SQL only — record whichever branch is taken in the Task 4 doc edit.

- [ ] **Step 3: Restore the committed graph (this task only decides the command; Task 3 does the real rebuild)**

```bash
cp /tmp/graph_backup.json graphify-out/graph.json
git status --short graphify-out/  # expect: clean
```

- [ ] **Step 4: Write `scripts/refresh-graph.sh` with the canonical command from Step 2**

```bash
#!/usr/bin/env bash
# Canonical knowledge-graph refresh — the ONLY sanctioned way to rebuild
# graphify-out/graph.json. Built AST-only (no LLM keys). graphifyy>=0.9.15
# with the [sql] extra. Wired into `npm run validate:app` and git hooks.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
if ! command -v graphify >/dev/null 2>&1; then
  echo "WARN: graphify CLI not installed — knowledge graph not refreshed (see app/CLAUDE.md setup)" >&2
  exit 0
fi
if ! python3 -c "import tree_sitter_sql" 2>/dev/null; then
  echo "WARN: graphifyy[sql] extra missing — refusing to rebuild (SQL files would vanish, see spec 2026-07-14)" >&2
  exit 0
fi
graphify extract . --update   # canonical flags — adjust here ONLY if Task 2 Step 2 chose the --code-only branch
echo "graph refreshed: graphify-out/graph.json (stage it if changed)"
```

```bash
chmod +x scripts/refresh-graph.sh
```

- [ ] **Step 5: Verify both script paths**

```bash
bash scripts/refresh-graph.sh          # CLI present: expect refresh + note
git checkout -- graphify-out/graph.json
PATH=/usr/bin:/bin bash scripts/refresh-graph.sh; echo "exit=$?"   # simulate missing CLI
```

Expected: second run prints the WARN line and `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/refresh-graph.sh
git commit -m "chore(graphify): canonical refresh script — reproducible command, loud degradation"
```

---

### Task 3: Scope the graph to the living codebase and rebuild

**Files:**
- Modify: `.graphifyignore`
- Modify: `graphify-out/graph.json` (rebuilt artifact)

**Interfaces:**
- Consumes: `scripts/refresh-graph.sh` (Task 2).

- [ ] **Step 1: Confirm the noise is present (failing check)**

```bash
python3 -c "
import json
g = json.load(open('graphify-out/graph.json'))
n = [x for x in g['nodes'] if x.get('source_file','').startswith(('docs/superpowers/','.claude/skills/'))]
print('noise nodes:', len(n))"
```

Expected: `noise nodes:` ~740 (fails the target of 0).

- [ ] **Step 2: Extend `.graphifyignore`**

Append after the `graphify-out/` block:

```
# historical + agent tooling — map the codebase, not its journal
docs/superpowers/
.claude/skills/
```

- [ ] **Step 3: Full rebuild (scope changed — not incremental)**

```bash
rm -f graphify-out/graph.json
bash scripts/refresh-graph.sh
```

Note: if `refresh-graph.sh`'s `--update` mode refuses on a missing graph, run the same command it contains without `--update` once, then re-run the script to confirm idempotence.

- [ ] **Step 4: Verify the rebuilt corpus**

```bash
python3 -c "
import json
g = json.load(open('graphify-out/graph.json'))
files = {n.get('source_file','') for n in g['nodes']}
assert not any(f.startswith(('docs/superpowers/','.claude/skills/')) for f in files), 'noise still present'
assert any(f.endswith('.sql') for f in files), 'SQL missing'
assert any('05-Database' in f for f in files), 'canonical docs missing'
print('nodes:', len(g['nodes']), '- scope OK')"
```

Expected: `scope OK`; node count roughly committed-minus-noise (~1,600), NOT ~263.

- [ ] **Step 5: Commit**

```bash
git add .graphifyignore graphify-out/graph.json
git commit -m "chore(graphify): scope graph to living codebase; rebuild with canonical command"
```

---

### Task 4: Fix naming and record the build configuration

**Files:**
- Modify: `CLAUDE.md` (root, Knowledge Graph section)
- Modify: `app/CLAUDE.md` (Knowledge Graph section)

- [ ] **Step 1: Root `CLAUDE.md` — fix the package/repo naming**

Replace:

```
A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built by `Graphify-Labs/graphify`).
```

with:

```
A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built with the `graphifyy` CLI — PyPI package `graphifyy`, repo `Graphify-Labs/graphify`).
```

- [ ] **Step 2: Root `CLAUDE.md` — point the gate at the canonical script**

In the Context Maintenance section, replace item 6's command text:

```
6. Refresh the knowledge graph: `graphify extract . --update --code-only`, then stage `graphify-out/graph.json` (AST-only — no API cost).
```

with:

```
6. Refresh the knowledge graph: `bash scripts/refresh-graph.sh`, then stage `graphify-out/graph.json` (AST-only — no API cost).
```

(keep the rest of item 6 unchanged). Make the same command substitution in `app/CLAUDE.md`'s validation step 6 and its Knowledge Graph section (`graphify hook install` line stays; add below it):

```
- Rebuilds go through `scripts/refresh-graph.sh` (canonical flags; warns instead of failing when the CLI is absent). Record graph-not-refreshed in the completion report when it warns.
```

- [ ] **Step 3: Verify + commit**

```bash
grep -rn "code-only" CLAUDE.md app/CLAUDE.md        # expect: no gate command hits remain (prose mentions OK if any)
bash scripts/check-context-map.sh                    # expect: OK
git add CLAUDE.md app/CLAUDE.md
git commit -m "docs(graphify): correct package naming; gate + validation call canonical refresh script"
```

---

## Final verification

- [ ] `bash scripts/check-context-map.sh` → OK
- [ ] `bash scripts/refresh-graph.sh` twice → second run leaves `git status graphify-out/` clean (idempotent)
- [ ] `git log --oneline -4` shows the four commits above
