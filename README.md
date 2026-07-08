# ship

End-to-end feature workflow for [Claude Code](https://docs.anthropic.com/claude/claude-code) — `/ship <prompt>` takes a feature idea (ticket URL, issue link, or freeform) from raw input to a ready-to-review PR via an 8-agent team with a sequential review panel.

## How it works

```mermaid
flowchart LR
    Idea([💡 ticket / idea]):::input

    subgraph Input["📥 INPUT + GRILL"]
        direction TB
        Brn[branch setup<br/>auto-create on main]
        Grill[grill-with-docs / grill-me<br/>Socratic interview]
        Plan[lead emits plan<br/>tracer-bullet, triplet/phase<br/>+ out-of-scope]
        Gate{👤 inline 'go'?}
        Brn --> Grill --> Plan --> Gate
    end

    subgraph Loop["🔁 PHASE LOOP"]
        direction TB
        Imp[ship-implementer<br/>opus  ·  fresh per phase]
        Ver[ship-verifier<br/>haiku  ·  rubric + same-defect mode]
        Imp --> Ver
        Ver -->|critical| FixP[fix-loop max 2<br/>livelock detector]
        FixP --> Imp
        FixP -.exhausted / same-defect.-> Dbg[ship-debugger<br/>sonnet · one-shot]
        Dbg --> Ver
    end

    subgraph Panel["🔍 END-OF-RUN PANEL — sequential gate"]
        direction TB
        CR[ship-code-review<br/>sonnet  ·  GATE  ·  always]
        CR -->|green| Trio[parallel:<br/>security · performance · design]
        CR -->|critical| FixC[fix-loop max 2]
        FixC --> CR
        Trio -->|critical| FixC
    end

    subgraph Wrap["🚢 WRAP"]
        direction TB
        Retro[ship-retro<br/>haiku  ·  vault writes only]
        PR[git push +<br/>gh pr create]
        Retro --> PR
    end

    Idea --> Brn
    Gate -.revise.-> Plan
    Gate -->|approved| Imp
    Ver -->|all phases done| CR
    Trio -->|all green| Retro
    PR --> Out([✅ PR ready for review])

    classDef input fill:#fff5e6,stroke:#e87600,stroke-width:2px
```

**One human gate** — inline `go` at the end of the griller. After that the team runs autonomously. The end-of-run panel uses a **sequential gate**: code-review fires first; security/performance/design only run if code-review is green (skips the trio on broken code).

**Each agent reads its own `<role>-lessons.md` on startup** from a lessons root the lead injects (a configurable `LESSONS_ROOT`, or none for no priors), applies the rules, and reports any `lessonConflicts` for retro to flag for expiry. Retro auto-writes structured 4-field lessons (Trigger / Symptom / Correction / Expires-when) with a 100-line cap per file; user corrections captured by the lead during the run become highest-priority Mistakes lessons, and retro also returns a run-scoped what-didn't-work summary for the handoff.

**No filesystem state, but resumable.** No `.ship/` directory. Sprint contracts (the per-phase Behavior / Verification / State triplet) live in commit message bodies, recoverable via `git show`. Re-invoke `/ship` on an interrupted ship branch and it reconstructs the completed phases from git history, re-posts the recovered state, and resumes on `go` (a passed panel leaves no marker — it just re-runs, idempotently). Screenshots are ephemeral in a temp dir the design agent creates and cleans itself.

## What changed in v2 (vs v1)

- **Worktree management out of scope.** No sweep, no `--here` flag, no auto-worktree-create. /ship runs in whatever directory you invoke it from. If on the default branch with a clean tree, auto-creates a branch using detected repo conventions (`feat/`, `fix/`, etc.).
- **Single inline approval** instead of a separate plan-approval gate. The griller ends with the plan in chat; you reply `go`.
- **Hybrid review.** Per-phase = tests only. End-of-run panel = sequential code-review gate, then security + performance + design in parallel.
- **Structured rubrics + evidence-required findings.** Every reviewer agent returns A-D scores per dimension; findings without runtime/test/log/screenshot evidence are dropped.
- **Same-defect detector** alongside retry caps. Identical failure mode twice → a one-shot auto-debug pass (`ship-debugger`), then escalation if still red — never a blind third respawn.
- **Cross-component defects auto-critical.** State propagation, resource leaks, interface mismatches promoted regardless of stated severity.
- **Sprint contracts** (Behavior/Verification/State triplet per phase) embedded in commit message bodies. Recoverable forever via `git show`.
- **No `.ship/` filesystem state.** Lead context + git is the source of truth. Resume across sessions supported via git-history reconstruction (no state file).
- **Retro to vault only.** No CLAUDE.md writes; lessons are personal/cross-repo.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for full diagrams.

## Install

Requires:
- [Claude Code](https://docs.anthropic.com/claude/claude-code) CLI
- [`gh`](https://cli.github.com/) (auto-PR; manual fallback if missing)
- A git repo to ship into
- (Optional) [grill-with-docs](https://github.com/anthropics/skills) (preferred for coding) or [grill-me](https://github.com/anthropics/skills) — the Step-2 planner; `/ship` falls back gracefully if neither is installed
- (Optional) Obsidian vault for retro lessons (the lead injects the vault root per run; no root = no priors — see Customizing)
- No other skills required: `ship-security` and `ship-design` are fully self-contained (they do not depend on any external `security-audit` / `mobile-check` skill)
- (Optional, for evals) Node 18+ to run `evals/lib/run-d.mjs`

```bash
git clone https://github.com/<YOUR-USER>/ship.git ~/Documents/hobby/ship
cd ~/Documents/hobby/ship
./install.sh
```

`install.sh` symlinks the skill + 8 agents into your `~/.claude/` and `~/.agents/` paths, and removes any v1 stale symlinks (`ship-reviewer`, `ship-visual-qa`). Edit either side; both stay live.

After install, restart Claude Code so it picks up the new skill + agents.

## Usage

From inside any git repo:

```
/ship <prompt>            # ticket URL, issue URL, or freeform
/ship                     # interactive — asks "what are we shipping?"
/ship base:<branch> <prompt>   # pin the PR base branch for this run
```

The base branch can also be pinned via `SHIP_BASE_REF` (environment) or `git config ship.baseRef` (precedence: inline `base:` token, env var, git config, repo default). The resolved base is validated and announced before any branch or PR action.

Examples:
- `/ship implement light/system/dark modes`
- `/ship https://github.com/myorg/myrepo/issues/42`
- `/ship` then describe the task in chat

The skill takes you through the griller, posts the plan inline, runs the team phase-by-phase, fires the end-of-run panel, and ends with a live PR URL.

To merge: ask explicitly afterward (`merge the ship PR`). /ship never auto-merges.

## Structure

```
ship/
├── skills/ship/SKILL.md         # the orchestrator skill
├── agents/                      # 8 specialist subagents
│   ├── ship-implementer.md      # opus — codes one phase, embeds sprint contract
│   ├── ship-verifier.md         # haiku — runs tests, rubric + same-defect mode
│   ├── ship-code-review.md      # sonnet — end-of-run GATE; bugs + quality merged
│   ├── ship-security.md         # sonnet — conditional, OWASP focus
│   ├── ship-performance.md      # sonnet — always-on perf review
│   ├── ship-design.md           # sonnet — conditional, screenshots + Figma
│   ├── ship-debugger.md         # sonnet — one-shot auto-debug when fix-loop exhausted
│   └── ship-retro.md            # haiku — structured 4-field lessons → vault
├── evals/                       # regression harness for the workflow itself
│   ├── README.md                # case classes (D/J/T) + case index
│   ├── RUNNING.md               # how to run each class
│   ├── lib/                     # ship_rules.mjs (reference logic) + runners
│   ├── graders/rubric.md        # J field-asserts + T checklists
│   └── cases/                   # case folders (D*/J*/T*)
├── ARCHITECTURE.md              # detailed flow + mermaid diagrams
├── install.sh                   # symlink setup
├── README.md
└── CHANGELOG.md
```

## Customizing

The agents and skill are plain Markdown. Edit them in this repo (the symlinks make changes live). Common tweaks:

- **Add stack-specific guardrails** as lessons in `code-review-lessons.md` (e.g. block any commit touching `payload.config.ts` without sibling migration) — `ship-code-review` is stack-agnostic and applies them from there.
- **Adjust security/design triggers** in `skills/ship/SKILL.md` Step 4b.
- **Tune model tiers** by editing `model:` in agent frontmatter (opus/sonnet/haiku).
- **Move lessons location** with `git config --global ship.lessonsRoot <dir>` or `SHIP_LESSONS_ROOT` (unset = run without lessons).

## Evals

`/ship` is LLM-driven, so its regression suite tests the **deterministic contracts** the agents must honor, not end-to-end output. Three case classes: **D** (pure rule functions — trigger-eval, dedup, verdict-rollup — asserted by `node evals/lib/run-d.mjs` with no LLM), **J** (one agent's JSON return vs `expected.json` on load-bearing fields), **T** (multi-step lead routing scored against a golden transcript). Run `evals/lib/run-d.mjs` before merging ANY change to `skills/ship/SKILL.md` or `agents/*.md`; run the J/T cases whose surface you touched. See [`evals/README.md`](evals/README.md).

## License

MIT. See [LICENSE](LICENSE).
