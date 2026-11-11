#!/usr/bin/env python3
"""PostToolUse (Edit|Write): says when an edit left a file under app/src with
more functions over 60 lines than it has at HEAD. It informs, never blocks;
the quality-benchmark gate is what fails CI. Any error exits 0 with no output.

UNIT_SIZE_ROOT replaces the repo root; UNIT_SIZE_COUNTS="<now>,<head>"
replaces the two fallow runs (fixtures).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

LIMIT = 60
TIMEOUT_SECONDS = 3


def long_functions(fallow, source, name):
    """Counts the functions over LIMIT lines in `source`, analysed alone."""
    work = tempfile.mkdtemp(prefix="unit-size-")
    try:
        with open(os.path.join(work, "package.json"), "w") as handle:
            handle.write('{"name":"unit-size-probe","private":true}')
        with open(os.path.join(work, name), "w") as handle:
            handle.write(source)
        out = subprocess.run(
            [fallow, "health", "--format", "json", "-q"],
            cwd=work,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        ).stdout
        report = json.loads(out)
        listed = report.get("large_functions")
        if listed is not None:
            return len(listed)
        per_k = report["vital_signs"]["functions_over_60_loc_per_k"]
        return round(per_k * report["summary"]["functions_analyzed"] / 1000)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    payload = json.load(sys.stdin)
    path = payload.get("tool_input", {}).get("file_path", "")
    root = os.environ.get("UNIT_SIZE_ROOT") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    rel = os.path.relpath(os.path.realpath(path), os.path.realpath(root))
    if not rel.startswith("app/src/") or not rel.endswith((".ts", ".astro")):
        return
    fallow = os.path.join(root, "app", "node_modules", ".bin", "fallow")
    if not os.path.exists(fallow) or not os.path.isfile(path):
        return

    fixed = os.environ.get("UNIT_SIZE_COUNTS")
    if fixed:
        now, before = (int(part) for part in fixed.split(","))
    else:
        name = os.path.basename(rel)
        with open(path) as handle:
            now = long_functions(fallow, handle.read(), name)
        head = subprocess.run(
            ["git", "show", f"HEAD:{rel}"],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        before = long_functions(fallow, head.stdout, name) if head.returncode == 0 else 0

    if now <= before:
        return
    noun = "function" if now == 1 else "functions"
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"{rel}: {now} {noun} over {LIMIT} lines after this edit ({before} before). "
                "Split before finishing: the quality-benchmark gate fails CI on it "
                "(checking-quality-benchmarks skill)."
            ),
        }
    }))


try:
    main()
except Exception:
    pass
sys.exit(0)
