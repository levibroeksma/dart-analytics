#!/usr/bin/env bash
# Prints the decision index: ID | status | domain | title | path. Never committed.
# Usage: scripts/decision-index.sh [--domain <d>] [--tag <t>] [--status <s>]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec node scripts/decisions/index.mjs "$@"
