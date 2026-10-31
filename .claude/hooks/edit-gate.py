#!/usr/bin/env python3
import fnmatch
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter

CHECKS = [
    ("app/src/**/*.astro", "scripts/check-astro-conventions.sh"),
    ("app/src/**/*.astro", "scripts/check-astro-class-composition.sh"),
    ("app/src/**/*.astro", "scripts/check-style-tokens.sh"),
    ("app/src/**/*.ts", "scripts/check-no-inline-comments.sh"),
    ("app/src/**/*.ts", "scripts/check-file-locations.sh"),
]

MAX_LINES = 20


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def would_be(tool_name, tool_input, current):
    if tool_name == "Write":
        return tool_input.get("content", "")
    if tool_name == "Edit":
        old = tool_input.get("old_string", "")
        new = tool_input.get("new_string", "")
        if current is None or not old or old not in current:
            return None
        count = -1 if tool_input.get("replace_all") else 1
        return current.replace(old, new, count)
    return None


def violation_keys(output):
    keys = Counter()
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"(?<=[^\s:]):\d+(:\d+)?", "", line)
        line = re.sub(r"\bline \d+", "line", line)
        keys[line] += 1
    return keys


def run_check(script, check_root, relpath, timeout, root):
    proc = subprocess.run(
        ["bash", os.path.join(root, script), relpath],
        env={**os.environ, "CHECK_ROOT": check_root},
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=root,
    )
    if proc.returncode not in (0, 1):
        raise RuntimeError(f"{script} exited {proc.returncode}")
    return proc.stdout + proc.stderr


def project_root(file_path, override):
    if os.environ.get(override):
        return os.path.realpath(os.environ[override])
    d = os.path.dirname(os.path.realpath(file_path))
    while not os.path.isdir(d) and os.path.dirname(d) != d:
        d = os.path.dirname(d)
    try:
        proc = subprocess.run(
            ["git", "-C", d, "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=2,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return os.path.realpath(proc.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())


def main():
    payload = json.load(sys.stdin)
    tool_name = payload.get("tool_name")
    if tool_name not in ("Edit", "Write"):
        return
    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path")
    if not file_path:
        return

    root = project_root(file_path, "EDIT_GATE_ROOT")
    rel = os.path.relpath(os.path.realpath(file_path), root).replace(os.sep, "/")
    if rel.startswith("../") or rel == "..":
        return

    scripts = [s for g, s in CHECKS if fnmatch.fnmatchcase(rel, g)]
    if not scripts:
        return

    real = os.path.join(root, rel)
    current = None
    if os.path.isfile(real):
        with open(real, encoding="utf-8") as fh:
            current = fh.read()

    content = would_be(tool_name, tool_input, current)
    if content is None:
        return

    timeout = float(os.environ.get("EDIT_GATE_TIMEOUT") or 2)
    offending = []
    with tempfile.TemporaryDirectory() as shadow:
        target = os.path.join(shadow, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(content)
        for script in scripts:
            before = (
                violation_keys(run_check(script, root, rel, timeout, root))
                if current is not None
                else Counter()
            )
            after_out = run_check(script, shadow, rel, timeout, root)
            after = violation_keys(after_out)
            if not any(n > before[k] for k, n in after.items()):
                continue
            for line in after_out.splitlines():
                key = next(iter(violation_keys(line)), None)
                if key and after[key] > before[key] and line.strip() not in offending:
                    offending.append(line.strip())

    if offending:
        deny("\n".join(offending[:MAX_LINES]) + "\nEdit blocked by repo gate — fix and retry.")


try:
    main()
except Exception:
    sys.exit(0)
