#!/bin/bash
# ship v3 installer: symlinks the skill, the agent and the Stop hook into ~/.agents and ~/.claude,
# removes v1/v2 agent symlinks, and seeds the implementer's memory. Idempotent. Safe to re-run.

set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
echo "Installing ship v3 from: $REPO"

mkdir -p "$HOME/.agents/skills" "$HOME/.claude/skills" "$HOME/.claude/agents" \
         "$HOME/.claude/hooks" "$HOME/.claude/agent-memory/ship-implementer"

# link <target> <linkpath>: create, repoint, or refuse to clobber a real file.
link() {
  local target="$1" link="$2"
  if [ -L "$link" ]; then
    if [ "$(readlink "$link")" = "$target" ]; then
      echo "  ok: $link"
    else
      ln -sfn "$target" "$link"
      echo "  repointed: $link -> $target"
    fi
  elif [ -e "$link" ]; then
    echo "  WARN: $link exists and is not a symlink. Move or remove it, then re-run."
    exit 1
  else
    ln -s "$target" "$link"
    echo "  created: $link -> $target"
  fi
}

chmod +x "$REPO/hooks/verify-phase.sh"

link "$REPO/skills/ship"                "$HOME/.agents/skills/ship"
link "../../.agents/skills/ship"        "$HOME/.claude/skills/ship"
link "$REPO/agents/ship-implementer.md" "$HOME/.claude/agents/ship-implementer.md"
link "$REPO/hooks/verify-phase.sh"      "$HOME/.claude/hooks/ship-verify-phase.sh"

# Retired agents (v1: reviewer, visual-qa; v2: the panel, verifier, debugger, retro).
for stale in reviewer visual-qa verifier code-review security performance design debugger retro; do
  l="$HOME/.claude/agents/ship-$stale.md"
  if [ -L "$l" ]; then
    rm "$l"
    echo "  removed retired agent symlink: $l"
  fi
done

MEM="$HOME/.claude/agent-memory/ship-implementer/MEMORY.md"
if [ ! -s "$MEM" ]; then
  cp "$REPO/memory/MEMORY.seed.md" "$MEM"
  echo "  seeded: $MEM"
else
  echo "  kept existing: $MEM"
fi

command -v jq >/dev/null 2>&1 || echo "  WARN: jq not found on PATH; the Stop hook needs it (brew install jq)."
command -v gh >/dev/null 2>&1 || echo "  note: gh not found; /ship will ask you to push and open the PR by hand."

echo
echo "Done. Restart Claude Code so it reloads the skill and agent, then run /ship from inside a git repo."
