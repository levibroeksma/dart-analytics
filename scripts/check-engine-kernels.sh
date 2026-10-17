#!/usr/bin/env bash
# Rule-kernel family gate (Pattern 18 §Rule-kernel families; D467).
# Every *.engine.module.ts under app/src/modules/game and
# app/src/modules/training/exercises is listed exactly once in
# scripts/engine-kernels.txt, and its row is true of the code and the docs:
#   KERNEL_BOUND  -> the file imports ./<kernel>-kernel.module
#   PENDING       -> the file imports no *-kernel.module (else the row is stale)
#   HAND_WRITTEN  -> kernel column HAND_WRITTEN, imports no *-kernel.module
#   rules file    -> '-' or a file whose 'Kernel:' header equals the kernel
# ENGINE_KERNELS_ROOT / ENGINE_KERNELS_FILE override paths for fixtures.
#
# WHAT THIS CANNOT CATCH: that a KERNEL_BOUND engine routes its rules through
# the kernel rather than merely importing it; the oracle and goldens own that.
set -u
ROOT="${ENGINE_KERNELS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
REG="${ENGINE_KERNELS_FILE:-$ROOT/scripts/engine-kernels.txt}"
cd "$ROOT"
FAIL=0
KERNELS="TRACK CHECKOUT VISIT_POINTS MARKS ELIMINATION HAND_WRITTEN"

fail() { echo "FAIL: $1" >&2; FAIL=1; }
trim() { sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<< "$1"; }

[ -f "$REG" ] || { echo "FAIL: registry $REG not found" >&2; exit 1; }
ROWS="$(grep -vE '^[[:space:]]*(#|$)' "$REG" || true)"
LISTED="$(cut -d'|' -f1 <<< "$ROWS" | sed -E 's/[[:space:]]+$//')"

for file in $(find app/src/modules/game app/src/modules/training/exercises -maxdepth 1 -name '*.engine.module.ts' 2>/dev/null | sort); do
  grep -qxF "$file" <<< "$LISTED" || fail "$file is not listed in $REG"
done

COUNT=0
while IFS='|' read -r path kernel status rules reason; do
  path="$(trim "$path")"; kernel="$(trim "$kernel")"; status="$(trim "$status")"
  rules="$(trim "$rules")"; reason="$(trim "$reason")"
  [ -n "$path" ] || continue
  COUNT=$((COUNT + 1))
  [ -f "$path" ] || { fail "$path does not exist (registry row is stale)"; continue; }
  grep -qw -- "$kernel" <<< "$KERNELS" || { fail "$path: unknown kernel $kernel"; continue; }
  imports_kernel=0
  grep -qE "from \"\./[a-z-]+-kernel\.module\"" "$path" && imports_kernel=1
  case "$status" in
    KERNEL_BOUND)
      slug="$(tr 'A-Z_' 'a-z-' <<< "$kernel")"
      grep -qF "from \"./${slug}-kernel.module\"" "$path" || fail "$path is KERNEL_BOUND but does not import ./${slug}-kernel.module" ;;
    PENDING)
      [ -n "$reason" ] || fail "$path: PENDING needs a reason"
      [ "$imports_kernel" -eq 0 ] || fail "$path imports a kernel but is marked PENDING; flip it to KERNEL_BOUND" ;;
    HAND_WRITTEN)
      [ "$kernel" = HAND_WRITTEN ] || fail "$path: HAND_WRITTEN status needs kernel HAND_WRITTEN"
      [ -n "$reason" ] || fail "$path: HAND_WRITTEN needs a reason"
      [ "$imports_kernel" -eq 0 ] || fail "$path is HAND_WRITTEN but imports a kernel" ;;
    *) fail "$path: unknown status $status" ;;
  esac
  if [ "$rules" != "-" ]; then
    if [ ! -f "$rules" ]; then
      fail "$path: rules file $rules does not exist"
    else
      declared="$(grep -m1 '^Kernel:' "$rules" | sed 's/^Kernel: //')"
      [ "$declared" = "$kernel" ] || fail "$path: registry says $kernel but $rules says Kernel: ${declared:-<none>}"
    fi
  fi
done <<< "$ROWS"

[ "$FAIL" -eq 0 ] && echo "OK: engine kernels — $COUNT engine(s) match $REG, their imports and their rules files."
exit $FAIL
