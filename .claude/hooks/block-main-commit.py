#!/usr/bin/env python3
import json
import re
import subprocess
import sys


def current_branch():
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except Exception:
        return ""


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if payload.get("tool_name") != "Bash":
    sys.exit(0)

command = payload.get("tool_input", {}).get("command", "")
if not command:
    sys.exit(0)

branch = current_branch()
on_main = branch in ("main", "master")

# Anchored to a command boundary (string start or a shell separator) so the
# hook reads actual git invocations, not prose mentioning "git commit" or
# "git push" inside a commit message body passed via heredoc/quoted string.
BOUNDARY = r"(?:\A|[;&|]\s*)"
is_commit = re.search(BOUNDARY + r"git\s+commit\b", command) is not None
is_merge = re.search(BOUNDARY + r"git\s+merge\b", command) is not None
is_push = re.search(BOUNDARY + r"git\s+push\b", command) is not None
pushes_to_main = is_push and re.search(r"(^|[\s:])(main|master)(\s|$)", command) is not None

if is_commit and on_main:
    deny(f"Blocked: current branch is '{branch}'. Never commit directly to main "
         "(CLAUDE.md Hard Invariant). Create a task branch first.")
elif is_merge and on_main:
    deny(f"Blocked: current branch is '{branch}'. Never merge into main directly. Open a PR instead.")
elif is_push and (on_main or pushes_to_main):
    deny("Blocked: pushing to main/master is not allowed. Push to a task branch and open a PR.")

sys.exit(0)
