#!/usr/bin/env bash
# Canonical knowledge-graph refresh — the ONLY sanctioned way to rebuild
# graphify-out/graph.json. Built AST-only (no LLM keys). graphifyy>=0.9.15
# with the [sql] extra. Wired into `npm run validate:app` and git hooks.
#
# Canonical command note (2026-07-14, Task 2 empirical determination):
# The plan's original guess of `graphify extract . --update` is NOT it —
# that subcommand tries to semantically re-embed changed .md/image files
# and hard-errors demanding an LLM API key the moment any doc file looks
# "changed" (confirmed empirically: 107 docs / 8 images triggered the
# error on a clean checkout with zero API keys set). The actual no-LLM
# path is the distinct top-level `graphify update <path>` subcommand
# ("re-extract code files and update the graph (no LLM needed)"), which
# empirically reproduced the committed corpus scope: 2450 nodes (vs 2388
# committed, within +2.6%) with .md, .sql, and .ts all present, and every
# md/sql node tagged `_origin: "ast"` — identical to the committed graph,
# confirming both are built AST-only with zero LLM cost. Verified to work
# even bootstrapping from a checkout with no pre-existing graphify-out/.
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
graphify update .   # canonical command — empirically determined in Task 2 (see note above); do not swap back to `graphify extract . --update`, it demands an LLM API key
echo "graph refreshed: graphify-out/graph.json (stage it if changed)"
