# Changelog

All notable changes to ship will be tracked here.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-02

Full pipeline redesign. Breaking — agents renamed, `.ship/` directory removed, plan-approval gate replaced by inline `go`.

### Added
- **End-of-run review panel** with sequential gate. `ship-code-review` runs first (gate); on green, `ship-security` (conditional) + `ship-performance` (always, opus) + `ship-design` (conditional) fan out in parallel.
- `ship-security` — sonnet, conditional. Triggers on auth/crypto/payment file patterns or plan keywords. OWASP top-10, secrets, input validation, dep hygiene.
- `ship-performance` — opus, always. N+1, render thrash, sync-in-async, algorithmic complexity, payload bloat.
- **Structured rubrics** in every reviewer return — A-D scores per dimension. Enables dedup across panel agents by `(rubric_dimension, location_hash)`.
- **Evidence requirement** on every finding — `evidence: {type: test|log|trace|screenshot, ref}`. Findings without evidence dropped before lead reads them.
- **Same-defect detector** — agents return `currentMode` (short failure shape ID); identical mode across attempts triggers immediate escalation without burning retry budget.
- **Sprint contract in commit body** — every phase commit embeds the Behavior/Verification/State triplet, recoverable via `git show <sha>`. Replaces filesystem state.
- **Cross-component / boundary defect auto-promotion** — state propagation, resource leaks, interface mismatches always critical.
- **Lesson reconciliation** — agents emit `lessonConflicts` when prior lessons contradict the current task; retro flags those lessons for expiry.
- **Structured 4-field lesson template** — Trigger / Symptom / Correction / Expires-when (no freeform). 100-line cap per role file with auto-prune by retro.
- **PR template detection** — `.github/PULL_REQUEST_TEMPLATE.md` → CONTRIBUTING.md → fallback. Commit/title style detected from `git log --oneline -30`.
- **Auto-branch on default branch** — if user invokes /ship while on `<base-ref>`, agent derives branch name from detected repo conventions (`feat/`, `fix/`, fallback `ship/<slug>`).

### Changed
- **Single inline approval** at end of grill-me — replaces separate plan-approval gate. User types `go` in chat; no `.ship/approved` marker.
- **Per-phase verifier and end-of-run panel each have independent retry caps of 2.** Same-defect detector overrides both.
- **Fix-loops are forward-only commits** (`fix: <topic>`) — no amend, no rebase.
- `ship-reviewer` → `ship-code-review` (renamed). Now merges bugs + code quality. Gate-first.
- `ship-visual-qa` → `ship-design` (renamed). Trusts user on dev server (reports critical if missing instead of auto-starting).
- Retro now writes **only to Obsidian vault**. No CLAUDE.md writes. Lessons are personal/cross-repo.
- PR body now uses 3-layer evidence block (static / runtime / e2e), explicit Out-of-scope section, fix-loop audit trail. No vague verbs allowed.

### Removed
- **Worktree management.** Step 0 sweep, `--here` flag, mode detection, branch refuse-on-dirty for non-main, `<worktree>/.ship/` paths. /ship runs in whatever directory the user invoked it from.
- **`.ship/` filesystem state.** No `context.md`, `plan.md`, `approved`, `phase-N.commit`, `phase-N-*.md`, `retro.done` markers. Plan + decisions live in lead context for the run; sprint contracts live in commit bodies; screenshots in ephemeral `/tmp/ship-<runId>/`.
- **Resume across sessions.** Without state on disk, an interrupted run is lost — re-run /ship from scratch.
- **`prd-to-plan` skill invocation.** grill-me alone produces the plan inline (lead transforms its output into ship's strict triplet+out-of-scope format).
- **Plan-approval gate as a separate step.** Folded into grill-me's natural conclusion.

### Migration notes
- Old agent symlinks (`ship-reviewer`, `ship-visual-qa`) are removed by `install.sh` automatically.
- Existing lesson files (`reviewer-lessons.md`, `visual-qa-lessons.md`) are not migrated — port them to `code-review-lessons.md` / `design-lessons.md` manually if you want continuity. New format is structured 4-field; freeform lessons from v1 won't fit cleanly.

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
