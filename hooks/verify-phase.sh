#!/usr/bin/env bash
# ship v3: Stop hook for ship-implementer.
#
# Runs the phase's Verification command (read from the newest commit in this run that carries a
# `Verification:` line: the phase commit, or a forward-only fix commit restating the contract) and
# blocks the implementer from finishing while it is red.
# Replaces the v2 ship-verifier agent: deterministic, zero tokens, no delivery step.
#
# Input: hook JSON on stdin (cwd, agent_id, last_assistant_message, stop_hook_active).
# Exit 0 = let the agent finish. Exit 2 = block; stderr goes back to the agent.
# Every block counts toward one cap of two per agent; after that the agent is let through so the
# lead can decide. Recovery is always a forward-only commit; phase commits are never amended.
#
# Trust model: the command comes from a commit body in the checkout, so running it extends the
# same trust as running the repo's own test script (package.json scripts are repo-controlled
# shell too), and the lead and the implementer run the same line by design. Only run /ship on
# branches whose `phase <N>:` commits you trust; the resume step lists them before you say go.
set -u

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // "noagent"' 2>/dev/null)"
last_msg="$(printf '%s' "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null)"

[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# An escalation is a legitimate stop: the implementer asks the lead instead of guessing.
case "$last_msg" in *BLOCKER:*) exit 0 ;; esac

# Scope: the lead records the run's base ref in `git config ship.baseRef` at run start, so only
# this run's commits (<base>..HEAD) are searched. Without it, fall back to the last 30 commits.
base="$(git config --get ship.baseRef 2>/dev/null || true)"
if [ -n "$base" ] && git rev-parse --verify --quiet "$base" >/dev/null; then
  range="$base..HEAD"
else
  range="-30"
fi

# No ship phase in range: nothing to verify.
git log $range --format='%s' 2>/dev/null | grep -q '^phase [0-9][0-9]*:' || exit 0

# Block at most twice per agent, then let it finish so the lead can decide.
# The counter lives in the repo's git dir (user-owned, never world-writable); the id is sanitised
# and the write never follows a symlink.
safe_id="$(printf '%s' "$agent_id" | tr -c 'A-Za-z0-9_-' '_')"
counter="$(git rev-parse --git-dir)/ship-verify-${safe_id}.count"
[ -L "$counter" ] && exit 0
n="$(cat "$counter" 2>/dev/null || echo 0)"
case "$n" in ''|*[!0-9]*) n=0 ;; esac
if [ "$n" -ge 2 ]; then rm -f "$counter"; exit 0; fi

block() {  # block <message...>: count the block, send the message to the agent, exit 2
  echo $((n + 1)) > "$counter"
  printf '%s\n' "$@" >&2
  echo "Attempt $((n + 1)) of 2. After the second block, finish and report the problem with this output verbatim." >&2
  exit 2
}

# The newest commit in range whose body carries a Verification line wins, so a forward-only fix
# commit can restate or correct the contract without touching the phase commit.
cmd=""
while read -r sha; do
  line="$(git log -1 --format=%B "$sha" | sed -n 's/^Verification: *//p' | head -1 | sed 's/^`//; s/`$//')"
  if [ -n "$line" ]; then cmd="$line"; break; fi
done < <(git log $range --format='%H' 2>/dev/null)

if [ -z "$cmd" ]; then
  block "ship: no 'Verification:' line in any commit of this run ($range). The phase commit body must carry the Behavior / Verification / State triplet." \
        "Recover forward-only: commit 'fix: phase <N> verifier: add contract' with the three triplet lines in the body (git commit --allow-empty is fine). Never amend a phase commit."
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  block "ship: working tree is dirty. One commit per phase: commit your work (phase <N>: <title>, triplet in body) or discard it, then finish. If you are stuck, start your final message with 'BLOCKER:' and say what you need."
fi

out="$(bash -c "$cmd" 2>&1)"
rc=$?
if [ "$rc" -ne 0 ]; then
  block "ship: verification is RED (exit $rc): $cmd" \
        "$(printf '%s\n' "$out" | tail -40)" \
        "" \
        "Fix the cause and commit forward-only as 'fix: phase <N> verifier: <topic>' (no amend, no rebase), then finish again."
fi

rm -f "$counter"
exit 0
