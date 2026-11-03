#!/usr/bin/env bash
# ship v3: Stop hook for ship-implementer.
#
# Runs the phase's Verification command (read from the most recent `phase <N>:`
# commit body) and blocks the implementer from finishing while it is red.
# Replaces the v2 ship-verifier agent: deterministic, zero tokens, no delivery step.
#
# Input: hook JSON on stdin (cwd, agent_id, last_assistant_message, stop_hook_active).
# Exit 0 = let the agent finish. Exit 2 = block; stderr goes back to the agent.
set -u

input="$(cat)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"
agent_id="$(printf '%s' "$input" | jq -r '.agent_id // "noagent"' 2>/dev/null)"
last_msg="$(printf '%s' "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null)"

[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# An escalation is a legitimate stop: the implementer asks the lead instead of guessing.
case "$last_msg" in *BLOCKER:*) exit 0 ;; esac

# Find the most recent phase commit; a `fix:` commit on top inherits its command.
phase_sha=""
while read -r sha subject; do
  case "$subject" in phase\ [0-9]*:*) phase_sha="$sha"; break ;; esac
done < <(git log -30 --format='%H %s' 2>/dev/null)
[ -z "$phase_sha" ] && exit 0   # no ship phase on this branch: nothing to verify

cmd="$(git log -1 --format=%B "$phase_sha" | sed -n 's/^Verification: *//p' | head -1 | sed 's/^`//; s/`$//')"
if [ -z "$cmd" ]; then
  echo "ship: phase commit ${phase_sha:0:7} has no 'Verification:' line in its body. The commit body must carry the Behavior / Verification / State triplet. Fix with: git commit --amend (only for your own uncommitted-then-committed phase, never a prior phase)." >&2
  exit 2
fi

# Block at most twice per agent, then let it finish so the lead can decide.
counter="${TMPDIR:-/tmp}/ship-verify-${agent_id}.count"
n="$(cat "$counter" 2>/dev/null || echo 0)"
if [ "$n" -ge 2 ]; then rm -f "$counter"; exit 0; fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo $((n + 1)) > "$counter"
  echo "ship: working tree is dirty. One commit per phase: commit your work (phase <N>: <title>, triplet in body) or discard it, then finish. If you are stuck, start your final message with 'BLOCKER:' and say what you need." >&2
  exit 2
fi

out="$(bash -c "$cmd" 2>&1)"
rc=$?
if [ "$rc" -ne 0 ]; then
  echo $((n + 1)) > "$counter"
  {
    echo "ship: verification is RED (exit $rc): $cmd"
    printf '%s\n' "$out" | tail -40
    echo
    echo "Fix the cause, commit forward-only as 'fix: phase <N> verifier: <topic>' (no amend, no rebase), and finish again. Attempt $((n + 1)) of 2. After the second red, finish and report the failure with this output verbatim."
  } >&2
  exit 2
fi

rm -f "$counter"
exit 0
