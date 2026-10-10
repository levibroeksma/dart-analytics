#!/usr/bin/env bash
# SessionStart: install the superpowers plugin in cloud sessions (D311).
#
# settings.json declares the marketplace and enables the plugin, but a fresh
# cloud container has nothing installed, so the superpowers: skills the
# router depends on are missing. Local sessions already have it; skip them.
# Idempotent: re-running on an installed plugin is a no-op.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

PLUGIN="superpowers@claude-plugins-official"

if claude plugin list 2>/dev/null | grep -q "$PLUGIN"; then
  exit 0
fi

claude plugin marketplace add anthropics/claude-plugins-official >/dev/null 2>&1 || true
claude plugin install "$PLUGIN" >&2
