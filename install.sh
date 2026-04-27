#!/bin/bash
# claude-ship installer — symlinks repo skill + agents into ~/.agents and ~/.claude.
# Idempotent. Safe to re-run.

set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
echo "Installing claude-ship from: $REPO"

# Ensure target dirs exist
mkdir -p "$HOME/.agents/skills"
mkdir -p "$HOME/.claude/skills"
mkdir -p "$HOME/.claude/agents"

# Skill source: ~/.agents/skills/ship → repo/skills/ship
SKILL_SRC="$HOME/.agents/skills/ship"
if [ -L "$SKILL_SRC" ]; then
  echo "  symlink exists: $SKILL_SRC → $(readlink "$SKILL_SRC")"
elif [ -e "$SKILL_SRC" ]; then
  echo "  WARN: $SKILL_SRC exists and is not a symlink. Move or remove it, then re-run."
  exit 1
else
  ln -s "$REPO/skills/ship" "$SKILL_SRC"
  echo "  created: $SKILL_SRC → $REPO/skills/ship"
fi

# Skill discovery symlink: ~/.claude/skills/ship → ../../.agents/skills/ship
SKILL_LIVE="$HOME/.claude/skills/ship"
if [ -L "$SKILL_LIVE" ]; then
  echo "  symlink exists: $SKILL_LIVE → $(readlink "$SKILL_LIVE")"
elif [ -e "$SKILL_LIVE" ]; then
  echo "  WARN: $SKILL_LIVE exists and is not a symlink. Move or remove it, then re-run."
  exit 1
else
  ln -s "../../.agents/skills/ship" "$SKILL_LIVE"
  echo "  created: $SKILL_LIVE → ../../.agents/skills/ship"
fi

# 5 agent files: ~/.claude/agents/ship-<role>.md → repo/agents/ship-<role>.md
for role in implementer verifier reviewer visual-qa retro; do
  AGENT_LIVE="$HOME/.claude/agents/ship-$role.md"
  AGENT_SRC="$REPO/agents/ship-$role.md"
  if [ ! -f "$AGENT_SRC" ]; then
    echo "  ERROR: $AGENT_SRC missing in repo"
    exit 1
  fi
  if [ -L "$AGENT_LIVE" ]; then
    echo "  symlink exists: $AGENT_LIVE → $(readlink "$AGENT_LIVE")"
  elif [ -e "$AGENT_LIVE" ]; then
    echo "  WARN: $AGENT_LIVE exists and is not a symlink. Move or remove it, then re-run."
    exit 1
  else
    ln -s "$AGENT_SRC" "$AGENT_LIVE"
    echo "  created: $AGENT_LIVE → $AGENT_SRC"
  fi
done

echo
echo "Install complete."
echo
echo "Next steps:"
echo "  1. Start a new Claude Code session (agent definitions are session-cached)."
echo "  2. Verify: /ship --help (or just type /ship and let the harness suggest the skill)."
echo "  3. Optional: ensure 'gh' CLI is authenticated (gh auth status)."
echo
echo "Lessons will accumulate at:"
echo "  ~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship/<role>-lessons.md"
echo
echo "If you don't use Obsidian or want a different lessons dir, edit the path"
echo "in $REPO/agents/ship-retro.md and the corresponding spawn prompts in SKILL.md."
