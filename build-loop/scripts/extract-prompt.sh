#!/usr/bin/env bash
# extract-prompt.sh <TASK-ID> [--task-only]
# Pulls one task block out of build-loop/PROMPT_LIBRARY.md by its "## <ID>"
# heading and prints: shared preamble + the task block.
#   --task-only : skip the build preamble (used by the fix-pass, which sends
#                 ONLY the findings block — see 02_GOTCHAS.md "preamble conflicts").
#
# IMPORTANT: always run this against the copy of PROMPT_LIBRARY.md on MAIN.
# The build-loop / fix-pass workflows check out main, run this, THEN switch
# to the task branch. Reading the Library from an old branch loses FIX-* entries.
set -euo pipefail

TASK_ID="${1:?usage: extract-prompt.sh <TASK-ID> [--task-only]}"
MODE="${2:-}"
LIB="build-loop/PROMPT_LIBRARY.md"
PREAMBLE_FILE="build-loop/PREAMBLE.md"

if [ "$MODE" != "--task-only" ] && [ -f "$PREAMBLE_FILE" ]; then
  cat "$PREAMBLE_FILE"
  echo
  echo "---"
  echo
fi

# Print the lines from "## <TASK_ID> " up to (but not including) the next "## ".
awk -v id="$TASK_ID" '
  $0 ~ "^## " id "([ \t]|$)" { grab=1; print; next }
  grab && /^## / { grab=0 }
  grab { print }
' "$LIB" > /tmp/_block.txt

if [ ! -s /tmp/_block.txt ]; then
  echo "extract-prompt: FAILED — task block for \"$TASK_ID\" not found in $LIB" >&2
  echo "(Are you reading PROMPT_LIBRARY.md from main? See 02_GOTCHAS.md.)" >&2
  exit 1
fi

cat /tmp/_block.txt
