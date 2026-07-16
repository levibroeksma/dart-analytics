#!/usr/bin/env bash
# File-location gate (docs/architecture/07-Frontend/02-Folder-Structure.md):
# no .ts files directly under components/ or pages/, except pages/api/**.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

VIOLATIONS=$(find app/src/components app/src/pages -name "*.ts" 2>/dev/null | grep -v '^app/src/pages/api/')
if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: .ts files found outside lib/ (must live under app/src/lib/<domain>/):" >&2
  echo "$VIOLATIONS" >&2
  exit 1
fi
echo "OK: no stray .ts files under components/ or pages/ (excluding pages/api/)."
