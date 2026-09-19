#!/usr/bin/env bash
# fallow gate wrapper — runs `npx fallow` and, when it fails, names the
# functions that actually breached the health thresholds.
#
# Why this wrapper exists (#292): fallow's own summary line
#
#   Failed: dupes (N clone groups), health (M above threshold): start with <file>
#
# reads as though <file> is the file holding the M violations. It is not.
# "start with" names entry 1 of the `Refactoring targets` quick-win list —
# a ROI-ranked *suggestion* that is ranked independently of the threshold
# gate, so it routinely names a file with no violation at all. Reproduced
# on 2026-09-19: a single cognitive-16 function in
# src/modules/game/<probe>.module.ts failed the gate while the line said
# "start with src/modules/stats/visit-stats.module.ts" (pri 15.7), which
# breached nothing. Chasing that filename is how #292 was discovered, at
# the cost of an extended session spent refactoring the wrong files.
#
# `npx fallow health --format json` carries the authoritative list in its
# `findings` array (path, function name, line, which threshold, the
# numbers). This script prints that array on any failure, so the true
# violator is on screen next to the misleading line rather than behind a
# second command nobody knows to run.
#
# The wrapper never changes the verdict: fallow's own stdout/stderr is
# passed through unmodified and its exit code is the script's exit code.
# The extra `health` run happens only on failure, and its own non-zero
# exit is expected and ignored.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)/app" || exit 1

TMP="$(mktemp -t fallow-gate)"
trap 'rm -f "$TMP" "$TMP.json"' EXIT

npx fallow 2>&1 | tee "$TMP"
STATUS="${PIPESTATUS[0]}"

[ "$STATUS" = "0" ] && exit 0

npx fallow health --format json >"$TMP.json" 2>/dev/null || true

node - "$TMP.json" <<'NODE'
const fs = require('node:fs');
let report;
try {
  report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
} catch {
  console.error('\nfallow-gate: could not read `fallow health --format json` — the "start with" file above is a refactoring suggestion, not the violator (#292).');
  process.exit(0);
}
const findings = Array.isArray(report.findings) ? report.findings : [];
if (findings.length === 0) {
  console.error('\nfallow-gate: no health-threshold violations — the failure above is a different gate (dead code, dependencies). The "start with" file is a refactoring suggestion, not a violator (#292).');
  process.exit(0);
}
console.error(`\n── health gate: ${findings.length} function(s) above threshold ──`);
console.error('The "start with" file on the Failed: line above is fallow\'s top');
console.error('refactoring suggestion, NOT the violator (#292). These are the violators:\n');
for (const f of findings) {
  const metrics = [
    ['cognitive', f.cognitive],
    ['cyclomatic', f.cyclomatic],
    ['CRAP', f.crap],
    ['params', f.param_count],
    ['lines', f.line_count],
  ]
    .filter(([, value]) => typeof value === 'number')
    .map(([label, value]) => `${label} ${value}`)
    .join(', ');
  console.error(`  ${f.path}:${f.line ?? '?'}  ${f.name ?? '?'}`);
  console.error(`    exceeded ${f.exceeded ?? '?'} (${f.severity ?? '?'}) — ${metrics}`);
}
const t = report.summary ?? {};
console.error(
  `\nthresholds: cognitive ${t.max_cognitive_threshold}, cyclomatic ${t.max_cyclomatic_threshold}, CRAP ${t.max_crap_threshold}, unit size ${t.max_unit_size_threshold}`,
);
NODE

exit "$STATUS"
