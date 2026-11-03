# Changelog

All notable changes to ship will be tracked here.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-11-03

Rewrite: one skill plus one agent. Breaking: seven agents, the evals, the lessons files and the JSON return contracts are gone.

### Why

Measured over 45 runs (May to September 2026):
- The four-reviewer panel was the weakest component. Four consecutive runs passed a green panel and then lost 15, 15, 6 and 5 real defects to an external `/code-review` at max effort (P1-T12, P1-T20, P3-T1, P3-T5). Sonnet reviewers plus an evidence-required filter cut recall; the built-in review at high or max is what actually caught the defects.
- The haiku verifier became redundant the moment v2.5.0 added "the lead runs the gates itself". In a five-phase run where every phase was green first try, it added latency and caught nothing.
- The verdict-delivery failures (ADR-M128, five cases) were an artifact of the experimental teammate mode. A foreground subagent's report returns to the caller on its own.
- Both work-loss incidents (ADR-M97) were two writers in one tree, now prevented by one rule rather than a protocol.
- The lessons memory saturated: 607 lines, six of seven files at the 100-line cap, two entries duplicated across roles, and nothing read them once runs stopped. Claude Code's `memory: user` on the agent replaces the retro agent, the per-role files, the cap, the pruning and the expiry.
- The one measured win, the refuted-premises clause (7 refutations in 7 phases, two prevented regressions), is a paragraph of text and survives unchanged.

### Added
- `hooks/verify-phase.sh`: a `Stop` hook on `ship-implementer` that reads the `Verification:` line from the most recent `phase <N>:` commit, runs it, and blocks the agent while the tree is dirty or the command is red (at most twice, then it lets the lead decide). A final message starting with `BLOCKER:` passes. The lead records the run's base in `git config ship.baseRef`, so the hook only reads phase commits in `<base>..HEAD`; its retry counter lives in the git dir.
- `memory: user` on `ship-implementer`; `memory/MEMORY.seed.md` carries the v2 lessons distilled to stack-agnostic rules, and `install.sh` seeds it once.
- The implementer brief now requires a minimalism pass (grep for an existing helper before writing one, read the whole flow first), the fix from the July ponytail review that had never been applied.

### Removed
- Agents `ship-verifier`, `ship-code-review`, `ship-security`, `ship-performance`, `ship-design`, `ship-debugger`, `ship-retro`.
- `evals/`: it tested a 91-line re-implementation of the rules, not the skill, and never caught any of the invariants that actually broke.
- JSON return schemas, rubrics, `currentMode` / livelock detection, `lessonConflicts`, `userCorrections`, the delivery paragraph, the shared-worktree protocol, the `LESSONS_ROOT` resolution, the `SHIP_BASE_REF` / `git config ship.baseRef` precedence (the `base:<branch>` token and the repo default remain).

### Changed
- Review is `/code-review high <base>...<branch>` (max for auth, payments, schema or large diffs), `/security-review` on the same triggers as before, `visual-check` on UI diffs with a dev server.
- Debugging a stuck phase is the `diagnose` skill run by the lead, after one fix respawn.
- Planning: `grill-me` and `grill-with-docs` are marked user-invoked only in their frontmatter, so the lead never calls them; the interview is inline, or the `grilling` skill if installed.
- Resume is unchanged in mechanism (git-only) and a quarter of the length.
- Fix-commit subjects use a colon separator (`fix: phase 2 verifier: topic`) instead of an em-dash.

### Migration
- Run `./install.sh`: it removes the seven agent symlinks and adds the hook symlink and the memory seed.
- The v2 lessons files are not read by anything; archive or mine them by hand.
- Interrupted v2 branches resume as before: `phase <N>:` commits are read the same way.

## [2.5.0] - 2026-08-10

Shipped as commit `09d167c`; this entry was written retroactively in 3.0.0. Remediation of three failure classes measured in a 7-phase production run (ADR-M97, ADR-M128).

### Added
- **Refuted-premises clause** in the implementer spawn template. The implementer must name every stated fact, count, path or mechanism in its brief that its own measurement refuted. Measured 7-for-7 in the run that introduced it; two refutations prevented shipped regressions.
- **Verdict delivery paragraph** ("DELIVERY IS PART OF THE JOB") in all five reporting agents: the last action must be a `SendMessage` to the lead. Five agents in one run finished evidence-backed work and went idle without sending.
- **Shared-worktree ownership protocol** in the lead's hard rules: the lead stages by explicit path only while an agent runs, does not test or commit until the agent says "the tree is yours-done", and neither side reverts a file it did not modify. Both directions had destroyed work once.
- **Lead runs the gates itself.** Verifier and reviewer verdicts are advisory; the lead re-runs the phase's verification command and reads destination state before closing a phase.
- **Acknowledge-receipt rule** for lead and agent messages, after four crossed messages in one run.

### Docs
- `mobile-check` references renamed to `visual-check` (README, CHANGELOG 2.2.0 entry, `ship-design`).

## [2.4.0] - 2026-07-08

Remediation of a 60-agent external audit (5 review dimensions, adversarial verification). No workflow-shape change.

### Added
- **`LICENSE` file** with the full MIT text. The README claimed MIT but shipped no license file, so GitHub reported the repo as unlicensed.
- **Six new Class D eval cases (D07-D12)** covering the three previously untested rule functions: `capOk` (100-line lessons cap, inclusive boundary), `retryUnderCap` (cap-2 arithmetic), `sameDefect` (livelock detector, including the no-prior-mode negative). Class D is now 12/12.

### Fixed
- **Panel same-defect detector was dead wiring.** The 4a/4b spawn templates never passed a previous failure mode, so panel agents could only ever emit `previousMode: null` and the Step 4c livelock detector could never fire (runs degraded to the cap-2 backstop). Both templates now carry a `Previous failure mode` line, mirroring the verifier's 3b template.
- **`ship-design` now emits `verdict`.** Its REQUIRED return JSON omitted the top-level `verdict` field the lead's panel gate aggregates on (the other three panel agents got this fix in v2.2.1; design was missed).
- **Design screenshot dir contract was unsatisfiable.** The agent required a `Run ID` input the lead's spawn template never provided, and SKILL.md/agent disagreed on who deletes the dir. The agent now creates its own temp dir (`mktemp -d /tmp/ship-design-XXXX`) and owns cleanup: everything except finding-referenced screenshots is deleted before returning.
- **`mkfixture.sh` no longer hides missing fixtures.** `cp ... || true` silently "succeeded" into an empty repo for J/T cases whose base/head trees were never authored; it now exits with an error naming the missing trees.

### Changed
- **`LESSONS_ROOT` personal default removed.** The published skill hardcoded the maintainer's private Obsidian path as the default lessons root (a wrong default and a path leak for every downstream install). It is now resolved by precedence: `$SHIP_LESSONS_ROOT` → `git config ship.lessonsRoot` (local, then global) → empty (no lessons). Set once with `git config --global ship.lessonsRoot <dir>`.

### Docs
- Retroactive **2.3.0 changelog entry** (the base-ref override shipped undocumented).
- README: documented the `/ship base:<branch>` invocation form and the `SHIP_BASE_REF` / `ship.baseRef` pins.
- ARCHITECTURE: removed the stale "does NOT override the PR base branch" claim (contradicted the shipped v2.3.0 feature) and added the base-ref resolution to Key properties; eval-invariant table extended with D07-D12; honest-coverage note updated (J/T fixtures are specs, not yet materialized).
- Git tags introduced: shipped versions are now tagged (`v2.3.0`, `v2.4.0`).

## [2.3.0] - 2026-07-01

Shipped as commit `8d3d051`; this entry was written retroactively in 2.4.0.

### Added
- **General base-ref override.** The PR base branch is resolved by precedence: inline `base:<branch>` token (first whitespace-delimited word of the invocation), `$SHIP_BASE_REF`, `git config ship.baseRef`, repo default branch. The resolved ref is validated (`git rev-parse --verify`) and announced with its source before any branch/PR action; diff scope, resume scan, and `gh pr create --base` all consume the single resolved value.

## [2.2.1] — 2026-07-01

Coherence + trim pass from an adversarial self-review of v2.2.0.

### Fixed
- **Panel agents now emit `verdict`.** `ship-code-review`, `ship-security`, and `ship-performance` omitted the `verdict` field from their required return JSON, yet the lead gates the panel on it — a latent bug since v2.0. Added the field.
- **`blocked` verdict fully wired.** Added `blocked` to the verifier's return enum (Step 3b) and gave `ship-security` a `blocked` path for environment failures (e.g. `pnpm audit` when deps aren't installed), which previously mis-routed into a code verdict. Step 4c now handles panel `blocked` from design OR security.
- **Resume no longer overclaims.** Step 1.5 dropped the "reconstructed plan (committed + remaining)" wording — git can only recover committed phases, so resume relies on the user to restate any remaining plan tail.
- **Trigger/eval drift.** `raw SQL` (not a valid file glob) replaced with `*.sql` in the security trigger, and added to `evals/lib/ship_rules.mjs` so the D-suite actually guards it.

### Removed
- **The `ship: panel green` sentinel commit.** It leaked an empty commit into every PR. Resume now re-runs the idempotent (read-only) panel when all phases are committed, instead of reading a marker commit.

### Changed
- **grill-with-docs writes are committed, not suppressed.** grill-with-docs runs in the lead's own context and writes `CONTEXT.md`/ADRs inline; the previous "do not let it write" instruction was unenforceable. `/ship` now commits those doc changes as a `docs:` commit before phase 1 (clean tree, not swept into a phase). Added a both-missing griller fallback (lead runs the interview inline) so the README's fallback claim holds.
- **Trimmed the Hard-rules section** — compressed the auto-debug / same-defect restatements that duplicated the step bodies.

## [2.2.0] — 2026-07-01

Feature wave from the /ship self-audit remediation: resume, auto-debug, portable lessons, doc-grounded planning, correction mining, and an eval harness. New agent: `ship-debugger`.

### Added
- **Resume-after-interruption.** Re-invoking `/ship` on an existing ship branch reconstructs the plan + completed-phase set from git history (`phase <N>:` / `fix:` commits plus an empty `ship: panel green` sentinel commit) and resumes at the right point, after re-posting the recovered plan for a `go`. No on-disk state — recovery is git-only. (`SKILL.md` Step 1.5, `ARCHITECTURE.md`)
- **Auto-debug pass + `ship-debugger` agent (sonnet).** When the per-phase or panel fix-loop is exhausted (same failure mode twice, or cap-2 hit), a one-shot debugger runs the diagnose discipline before escalating to the user — instead of another blind respawn. Fires at most once per phase / once per run; returns `blocked` with ranked hypotheses if it cannot build a reproduction loop.
- **Eval harness (`evals/`).** Regression guard for the workflow itself: Class D (scriptable pure-rule assertions via `node evals/lib/run-d.mjs`, 6 cases green), Class J (per-agent JSON conformance vs `expected.json`), Class T (golden-transcript checklists). ~20-case index; 3 sample cases authored to clone. This is the first executable code in the repo (a small Node runner + `ship_rules.mjs` reference logic).
- **User-correction mining in retro.** The lead captures the user's overrides/redirects during the run and forwards them to `ship-retro` as highest-priority "Mistakes" lessons (retro is a haiku subagent and cannot see the transcript). Retro also returns a run-scoped `whatDidntWork` summary, surfaced in the handoff (not persisted).

### Changed
- **Planner is now `grill-with-docs`** (falls back to `grill-me` if unavailable). It grounds the plan in the repo's domain model and sharpens terminology; any `CONTEXT.md`/ADR update it proposes is folded into a phase commit, never written to the working tree inline (preserves the "only phase commits touch the repo" invariant).
- **Portable lessons path.** The hardcoded `~/Documents/AL Obsidian/...` path is gone from all 8 agent/install files. The lead injects a single configurable `LESSONS_ROOT` at each spawn, and `no root = no priors` (never an error). Set it once in `SKILL.md`.
- **Verifier carved out of the shared reviewer contract** (`ARCHITECTURE.md`): it is a test-runner with its own schema, not a review-panel agent, so it is documented separately.
- **Provenance notes** on `ship-security` / `ship-design` and Step 6 explaining why they stay self-contained (spawned subagents cannot invoke skills; the canonical `security-audit` / `visual-check` / github tools are not bundled) rather than delegating.

## [2.1.0] — 2026-06-27

Maintenance pass: token economy, ecosystem fit, and de-scoping. No change to the workflow shape.

### Changed
- **`ship-performance` model `opus` → `sonnet`.** The always-on perf review no longer pays opus on every run; coverage is unchanged. (The implementer stays opus.)
- **`ship-security` coverage broadened** to match the standalone security agent: added `pnpm audit` (CVE scan), security headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP) and CORS/credentials checks, plus a `headers` rubric dimension.
- **Stack-specific guardrails moved out of `ship-code-review`** (Payload migrations, CSS token redefines, Storyblok preview, API env docs). The reviewer is now stack-agnostic; these live as learned entries in `code-review-lessons.md`, seeded from the old static block.

### Removed
- **`ship-machine` visualiser + telemetry.** Deleted the `ship-machine/` Next.js app and the ~40-line Telemetry section from `SKILL.md`. It was optional plumbing, not needed to run the skill, and it bloated the always-loaded orchestrator prompt.
- **Orphaned v1 lesson files** (`reviewer-lessons.md`, `visual-qa-lessons.md`): dead memory for agents retired in v2.

### Fixed
- **Panel finding dedup never fired across agents.** The dedup key was `(rubric_dimension, location_hash)`, but the four panel agents share no rubric-dimension vocabulary, so two agents flagging the same line carried different dimensions and were never merged (the same defect entered the fix-loop twice). Dedup now keys on `location_hash` alone and merges evidence from both. (`SKILL.md`, `ARCHITECTURE.md`)
- **Environment failures no longer poison the fix-loop.** New `blocked` verdict (no dev server, no browser MCP, missing deps, verification timeout) routes to the user with a concrete setup action instead of respawning the implementer to "fix" something it cannot. (`ship-verifier`, `ship-design`, `SKILL.md`, `ARCHITECTURE.md`)
- **`lessonConflicts` now reach retro.** Step 5 explicitly aggregates every agent's `lessonConflicts` and forwards them, so stale lessons actually get expired (previously the spawn spec omitted this and expiry never fired). (`SKILL.md`)
- **Retro lessons surfaced for audit + deterministic prune.** `ship-retro` returns the verbatim Trigger/Correction of every lesson written or expired and the handoff lists them, so the ungated auto-write is at least visible. Prune/expiry given a deterministic tag-parse + rewrite recipe. (`ship-retro`, `SKILL.md`)

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
