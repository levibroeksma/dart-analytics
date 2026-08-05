#!/usr/bin/env bash
# Canonical knowledge-graph refresh — the ONLY sanctioned way to rebuild
# graphify-out/graph.json. Built AST-only (no LLM keys). graphifyy>=0.9.15
# with the [sql] extra. Wired into `npm run validate:app` and git hooks.
#
# Default (GRAPH_REFRESH_STRICT unset): warn and exit 0 on a missing CLI
# or missing [sql] extra — local/agent runs degrade gracefully rather than
# blocking on a per-clone manual install.
# GRAPH_REFRESH_STRICT=1: both conditions become hard failures (exit 1).
# This is what CI sets (.github/workflows/graph.yml), which is now the
# primary refresh path; a local install is optional.
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

STRICT="${GRAPH_REFRESH_STRICT:-0}"

# Warn and skip locally; fail loudly in CI. A silent no-op in CI would
# reproduce the exact staleness this mode exists to prevent, while looking
# like a passing job.
soft_or_fail() {
  echo "$1" >&2
  if [ "$STRICT" = "1" ]; then
    echo "FAIL: GRAPH_REFRESH_STRICT=1 — refusing to exit 0 without refreshing the graph." >&2
    exit 1
  fi
  exit 0
}

if ! command -v graphify >/dev/null 2>&1; then
  soft_or_fail "WARN: graphify CLI not installed — knowledge graph not refreshed (see app/CLAUDE.md setup)"
fi
if ! python3 -c "import tree_sitter_sql" 2>/dev/null; then
  soft_or_fail "WARN: graphifyy[sql] extra missing — refusing to rebuild (SQL files would vanish, see spec 2026-07-14)"
fi
graphify update .   # canonical command — empirically determined in Task 2 (see note above); do not swap back to `graphify extract . --update`, it demands an LLM API key
echo "graph refreshed: graphify-out/graph.json (nothing to stage — freshness is CI-owned, D185)"
