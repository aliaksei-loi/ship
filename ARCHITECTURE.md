# ship — Architecture

Three views: high-level flow, phase loop, agent topology.

---

## High-level flow

```mermaid
flowchart TD
    Idea([/ship idea/]) --> Sweep[sweep stale ship/* worktrees]
    Sweep --> Slug[derive slug<br/>≤4 words, drop generic verbs]
    Slug --> Wt[create worktree<br/>off LOCAL base-ref]
    Wt --> Grill[invoke grill-me skill]
    Grill --> Ctx[write .ship/slug/context.md]
    Ctx --> Plan[invoke prd-to-plan<br/>treats context as PRD]
    Plan --> PlanFile[.ship/slug/plan.md<br/>multi-phase tracer-bullet]
    PlanFile --> Gate{Gate 1<br/>human approves plan}
    Gate -->|revisions| Plan
    Gate -->|approved| Loop[phase-by-phase team loop]
    Loop --> Retro[ship-retro<br/>writes lessons to Obsidian<br/>with provenance tags]
    Retro --> Push[git push -u origin]
    Push --> PR[gh pr create<br/>structured body]
    PR --> Done([🚢 SHIP DONE<br/>handoff + PR URL])

    classDef gate fill:#fdf6e3,stroke:#b58900,stroke-width:2px
    class Gate gate
```

Single human gate. Everything else auto-continues on green; stops on critical findings.

---

## Phase loop (per phase)

```mermaid
flowchart TD
    Start([Phase N]) --> Imp[ship-implementer<br/>opus<br/>reads its lessons file]
    Imp -->|ambiguity?| Esc[escalate to lead]
    Esc --> Imp
    Imp --> Commit[git commit<br/>'phase n: title']
    Commit --> Sig{UI signals?<br/>figma.com / design keywords /<br/>commit touches .tsx/css/etc}
    Sig -->|yes| Trio[parallel:]
    Sig -->|no| Duo[parallel:]

    Trio --> Ver[ship-verifier<br/>haiku<br/>runs tests]
    Trio --> Rev[ship-reviewer<br/>sonnet<br/>diff vs plan + bugs + guardrails]
    Trio --> Vis[ship-visual-qa<br/>sonnet<br/>screenshots @ 375/390/428/1440]

    Duo --> Ver
    Duo --> Rev

    Ver --> Verdict{verdict?}
    Rev --> Verdict
    Vis --> Verdict

    Verdict -->|all green<br/>or only minor| Next([next phase])
    Verdict -->|any critical| Stop[STOP: surface to human<br/>continue / fix / abort?]
    Stop -->|fix| FixLoop[respawn implementer<br/>with critical findings JSON<br/>max 2 attempts]
    FixLoop --> Commit
    Stop -->|abort| AbortEnd([state on disk<br/>resumable])
    Stop -->|continue| Next

    classDef stop fill:#f8e3e3,stroke:#dc322f,stroke-width:2px
    classDef green fill:#e3f2dc,stroke:#859900,stroke-width:2px
    class Stop stop
    class Next green
```

The fix loop respawns `ship-implementer` with the consolidated critical findings (verifier failure JSON + reviewer + visual-qa criticals filtered to `severity == "critical"`). Max 2 retries per phase, then escalate. See SKILL.md Step 6d for the spawn-prompt template.

---

## Agent topology + memory

```mermaid
flowchart LR
    subgraph LeadCtx[/ship lead context]
        Lead[orchestrator<br/>opus 1M]
    end

    Lead --> Grill[grill-me skill]
    Lead --> P2P[prd-to-plan skill]
    Lead --> Imp[ship-implementer<br/>opus]
    Lead --> Ver[ship-verifier<br/>haiku]
    Lead --> Rev[ship-reviewer<br/>sonnet]
    Lead --> Vis[ship-visual-qa<br/>sonnet, conditional]
    Lead --> Retro[ship-retro<br/>haiku]

    subgraph Vault[Obsidian vault — Sessions/_agents/ship/]
        IL[(implementer-lessons.md)]
        VL[(verifier-lessons.md)]
        RL[(reviewer-lessons.md)]
        VQL[(visual-qa-lessons.md)]
    end

    Imp -.reads at start.-> IL
    Ver -.reads at start.-> VL
    Rev -.reads at start.-> RL
    Vis -.reads at start.-> VQL

    Retro ==auto-writes==> IL
    Retro ==auto-writes==> VL
    Retro ==auto-writes==> RL
    Retro ==auto-writes==> VQL

    classDef agent fill:#e8eef7,stroke:#268bd2,stroke-width:1px
    classDef vault fill:#fdf6e3,stroke:#b58900,stroke-width:1px
    class Imp,Ver,Rev,Vis,Retro agent
    class IL,VL,RL,VQL vault
```

Lessons memory is bidirectional: each agent reads its own file at startup; retro auto-writes (max 1 lesson per role per run, tagged for pruning). Lessons compound across runs.

---

## State files (per run)

`<worktree>/.ship/<slug>/` (gitignored):

| File | Written by | Meaning |
|---|---|---|
| `context.md` | lead, after grill-me | resolved decisions; PRD-equivalent |
| `plan.md` | lead, via prd-to-plan | multi-phase tracer-bullet plan |
| `approved` | lead, after Gate 1 | empty file marking human approval |
| `phase-N.commit` | lead, after implementer | empty file marking phase N committed |
| `phase-N-verifier.md` | ship-verifier | test command + counts + JSON verdict |
| `phase-N-reviewer.md` | ship-reviewer | findings table + JSON verdict |
| `phase-N-visual.md` | ship-visual-qa (if fired) | screenshots + findings + JSON verdict |
| `screenshots/phase-N/` | ship-visual-qa | only kept screenshots referenced in findings |
| `retro.done` | lead, after retro | empty file marking run complete |

Resume detection (Step 2) inspects which files exist to determine the next phase.

---

## Visual-qa signal detection

`ship-visual-qa` is conditional. It fires **only if any one** of:

- Plan or context contains `figma.com/`
- Plan or context mentions `mockup`, `screenshot`, `design system`, `mobile`, `breakpoint`, `responsive`
- Phase commit changes any file matching `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.module.*`, `*.vue`, `*.svelte`

This avoids spawning a sonnet subagent on phases that touch only backend code.

---

## Hard rules (never violate)

- Always use a worktree. Never work on the main checkout.
- One Gate only (plan approval). Never auto-approve.
- Never invent phases — execute what `plan.md` says.
- Never silently skip a phase. Failure → stop and ask.
- Push and open a PR at the end — but never **merge**. Merge stays human-only.
- Visual-qa fires conditionally. Never force-run on every phase.
- Never delete `.ship/<slug>/` mid-run. Resume needs it.

---

## Why these defaults?

| Choice | Rationale |
|---|---|
| Opus for implementer | reasoning-heavy code generation |
| Haiku for verifier | I/O-bound: run tests, parse output |
| Sonnet for reviewer | diff reasoning needs more than haiku, less than opus |
| Sonnet for visual-qa | vision capability + multi-step screenshot orchestration |
| Haiku for retro | summarization; cheap |
| One Gate (plan only) | grill-me already grills; prd-to-plan structures; reviewer post-hoc — adversarial pressure baked in |
| Auto-write retro | provenance tags make pruning trivial; human gate adds friction without proportional value |
| Branch off LOCAL ref | captures unpushed housekeeping (e.g. fresh gitignore) |
| Phase-by-phase, not full run | natural cut points for verify+review; deliberate pause if anything red |

---

## What's not (yet) covered

- **Bug fixes** — /ship is overkill for one-line fixes. Use direct edit + commit.
- **Multi-package monorepos** — untested at v1. Should work but coordination across packages may need extra prompts.
- **Cross-machine resume** — `.ship/` is local-only. Resume works on the same machine; a different laptop needs to start fresh.
- **Concurrent /ship runs** — different slugs can coexist (different worktrees). Same slug → resume kicks in.
