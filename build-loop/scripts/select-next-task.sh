#!/usr/bin/env bash
# select-next-task.sh
# Picks the next eligible task from build-loop/queue.yml:
#   - all preconditions are merged (a merged PR carries the task's label "id:<ID>")
#   - the task's lane is free (no other open loop PR in that lane; schema is serial)
# Outputs task_id / branch / lane / auto_merge to $GITHUB_OUTPUT.
# Honors FORCE_TASK_ID to override selection.
# Requires: gh CLI (authenticated via GH_TOKEN), python3.
set -euo pipefail

QUEUE="build-loop/queue.yml"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

python3 - "$QUEUE" "${FORCE_TASK_ID:-}" <<'PY' > /tmp/selected.env
import sys, subprocess, json, shutil

queue_path, force = sys.argv[1], sys.argv[2]

# --- tiny YAML loader (PyYAML if present, else pip install) ---
try:
    import yaml
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyyaml"], check=True)
    import yaml

with open(queue_path) as f:
    tasks = yaml.safe_load(f)["tasks"]

def gh_json(args):
    out = subprocess.run(["gh"] + args, capture_output=True, text=True)
    return json.loads(out.stdout) if out.stdout.strip() else []

# Merged PRs -> which task ids are done (label "id:<ID>")
merged = gh_json(["pr", "list", "--state", "merged", "--limit", "200",
                  "--json", "labels"])
done = set()
for pr in merged:
    for lab in pr.get("labels", []):
        n = lab.get("name", "")
        if n.startswith("id:"):
            done.add(n[3:])

# Open loop PRs -> which lanes are busy (label "lane:<lane>")
open_prs = gh_json(["pr", "list", "--state", "open", "--limit", "200",
                    "--label", "loop", "--json", "labels"])
busy_lanes = set()
for pr in open_prs:
    for lab in pr.get("labels", []):
        n = lab.get("name", "")
        if n.startswith("lane:"):
            busy_lanes.add(n[5:])

def eligible(t):
    if t["id"] in done:
        return False
    if not all(p in done for p in t.get("preconditions", [])):
        return False
    if t["lane"] in busy_lanes:   # lane occupied (schema is serial by nature)
        return False
    return True

chosen = None
if force:
    chosen = next((t for t in tasks if t["id"] == force), None)
else:
    chosen = next((t for t in tasks if eligible(t)), None)

if not chosen:
    print("task_id=")
else:
    print(f"task_id={chosen['id']}")
    print(f"branch={chosen['branch']}")
    print(f"lane={chosen['lane']}")
    print("auto_merge=" + ("true" if chosen.get("merge") == "auto" else "false"))
PY

cat /tmp/selected.env >> "$OUT"
cat /tmp/selected.env   # echo for the logs
