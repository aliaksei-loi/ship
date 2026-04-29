# Changelog

All notable changes to ship will be tracked here.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `--here` flag: `/ship --here <idea>` runs in the main checkout instead of a worktree. Refuses on dirty tree or live-worktree collision for the same slug. Useful when you want ship to operate on the same checkout already open in your editor.
- Step 0 sweep extended to clean orphan `<repo-root>/.ship/<slug>/` state dirs left behind by `--here` runs whose branch is `[gone]` or merged to base.
- Step 2 mode detection: resumes infer worktree vs `--here` from on-disk state and ignore the flag on this invocation. Cross-mode collisions (state for both modes for the same slug) are refused.

### Changed
- Hard rule "Always use a worktree" → "Default to a worktree; `--here` is available with safety guards (dirty-tree refusal, live-worktree collision refusal, HEAD-vs-`ship/<slug>` precondition before each phase commit)."
- Step 9 handoff text is mode-aware (worktree path vs "you are on" line; "next /ship sweeps this worktree" vs "...the .ship/<slug>/ state dir").

## [1.0.0] — 2026-04-27

Initial release. Workflow validated end-to-end on a Next.js + Payload CMS site (belcreation) — first run produced a merged PR adding a tri-state (light/system/dark) theme toggle.

### Added
- `/ship` skill — orchestrator that runs `grill-me` → context.md → `prd-to-plan` → human plan-approval gate → phase-by-phase agent team → retro → push + PR
- 5 specialist subagents:
  - `ship-implementer` (opus) — codes one phase per spawn, commits as `phase <n>: <title>`, escalates ambiguity
  - `ship-verifier` (haiku) — runs tests, emits JSON verdict
  - `ship-reviewer` (sonnet) — diff vs plan + bug/security review + stack-specific guardrails (Payload schema-without-migration, CSS token-redefine consumers, Storyblok schema/preview drift)
  - `ship-visual-qa` (sonnet, conditional spawn) — screenshots at 4 breakpoints, Figma compare; fires only on UI signals
  - `ship-retro` (haiku) — auto-writes max 1 lesson per role to Obsidian with provenance tags `<!-- ship/<slug> YYYY-MM-DD -->`
- Worktree-based isolation; sweep stale `ship/*` worktrees on entry
- Resume detection (state markers in `.ship/<slug>/`)
- Phase-by-phase auto-continue with gate-on-failure (max 2 fix loops per phase)
- Slug auto-derivation (≤4 meaningful words, kebab-case, drops generic verbs)
- Auto push + open PR at end (merge stays human-only)
- Mermaid architecture diagrams in `docs/architecture.md`

### Design rationale
- One human gate (plan approval), not multi-step approval. Phase reports auto-continue on green.
- Visual-qa is conditional — avoids spawning a sonnet subagent when phases only change server code.
- Retro auto-writes (no human gate) with provenance tags — pruning happens in Obsidian later if quality drops.
- Branch off local `<base-ref>`, not `origin/<base>` — captures unpushed housekeeping commits.

### Known limitations (untested in v1)
- Visual-qa as a subagent never actually fired in the validation run (lead-pass workaround all 3 phases due to mid-session tool-allowlist patch). Should work on a fresh Claude Code session — to be confirmed in run 2.
- Resume detection logic is in SKILL.md but never exercised.
- Fix-loop on `critical` finding never triggered.
- Worktree sweep on entry never run against a real merged worktree (this WAS the first run).
- Lessons-file READ at agent start: implementation is in each agent prompt, but files were empty in v1 — value materializes on run 2-3.
