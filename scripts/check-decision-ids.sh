#!/usr/bin/env bash
# Decision-ledger gate: every decisions/<domain>/D####-<slug>.md record has
# valid MADR frontmatter and headings, ids are unique and match file names,
# supersedes/superseded-by point both ways, and every id in
# scripts/decisions/baseline-ids.txt still exists. Logic: scripts/decisions/check.mjs.
exec node scripts/decisions/check.mjs "$@"
