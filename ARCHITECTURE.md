# ship — Architecture (v2)

Three views, increasing in detail:

1. **Block scheme** — at-a-glance overview
2. **Phase loop** — what happens per phase
3. **End-of-run panel** — gated multi-aspect review

---

## Block scheme — at a glance

```mermaid
flowchart LR
    Idea([💡 idea / ticket URL / freeform]):::input

    subgraph Stage1["1️⃣ INPUT + GRILL  ·  human in the loop"]
        direction TB
        S1A[input parser<br/>+ branch setup]
        S1B[grill-with-docs / grill-me<br/>Socratic interview]
        S1C[lead emits plan<br/>tracer-bullet, triplet/phase<br/>+ out-of-scope list]
        S1D{👤 inline<br/>'go'?}:::gate
        S1A --> S1B --> S1C --> S1D
    end

    subgraph Stage2["2️⃣ PHASE LOOP  ·  per phase, fresh agents"]
        direction TB
        S2A[ship-implementer<br/>opus  ·  fresh per phase<br/>commits with sprint contract in body]
        S2B[ship-verifier<br/>haiku  ·  rubric + same-defect mode]
        S2C{verdict?}
        S2A --> S2B --> S2C
        S2C -->|green/minor| S2D([next phase])
        S2D --> S2A
        S2C -.critical.-> S2E[fix-loop forward-only<br/>max 2 + same-defect detector]:::stop
        S2E -.fix.-> S2A
    end

    subgraph Stage3["3️⃣ END-OF-RUN PANEL  ·  sequential gate"]
        direction TB
        S3A[ship-code-review<br/>sonnet  ·  GATE  ·  always]
        S3B{green?}
        S3A --> S3B
        S3B -->|yes| S3C[parallel:<br/>security  ·  performance  ·  design]
        S3B -.critical.-> S3E[fix-loop<br/>max 2]:::stop
        S3C --> S3D{aggregate?}
        S3D -->|all green/minor| S3F([panel done])
        S3D -.critical.-> S3E
        S3E -.fix.-> S3A
    end

    subgraph Stage4["4️⃣ WRAP  ·  finalize + share"]
        direction TB
        S4A[ship-retro<br/>haiku  ·  vault writes only<br/>structured template + cap]
        S4B[git push +<br/>gh pr create<br/>detected template + 3-layer evidence body]
        S4A --> S4B
    end

    Idea --> S1A
    S1D -.revise.-> S1C
    S1D -->|approved| S2A
    S2C -->|all phases done| S3A
    S3F --> S4A
    S4B --> Out([🚢 PR ready for human review])

    classDef input fill:#fff5e6,stroke:#e87600,stroke-width:2px
    classDef gate fill:#fdf6e3,stroke:#b58900,stroke-width:2px
    classDef stop fill:#f8e3e3,stroke:#dc322f,stroke-width:2px
```

**Key properties:**

- **Inline approval** at end of the griller (grill-with-docs, or grill-me). Plan shown in chat; user types `go`. No separate gate file, no `.ship/approved` marker.
- **Fresh implementer per phase.** Context resets; prior phases reachable via `git log`/`git show` (sprint contract is embedded in commit body).
- **Hybrid review.** Per-phase = tests only (mechanical). End-of-run = 1 + 3 reviewer panel.
- **Sequential gate.** code-review fires first; security/performance/design parallel only if code-review is green.
- **Two independent retry caps.** Per-phase verifier: max 2. End-of-run panel: max 2. Same-defect detector overrides both — an identical failure mode short-circuits the blind respawn loop into a one-shot auto-debug pass (ship-debugger, diagnose discipline, at most once per phase / once per run), which precedes user escalation. No budget burn.
- **Cross-component defects auto-critical.** State propagation, resource leaks, interface mismatches — all promoted regardless of agent's stated severity.
- **Findings need evidence.** Every finding carries `evidence: {type, ref}` (test/log/trace/screenshot). Findings without it are dropped before the lead reads them.
- **Bidirectional memory.** Each subagent reads its `<role>-lessons.md` from Obsidian vault at startup; retro auto-writes structured 4-field lessons (Trigger/Symptom/Correction/Expires-when) with file cap of 100 lines and provenance tags.
- **No filesystem state, but resumable.** No `.ship/` directory. Plan + decisions live in lead's context; sprint contract embedded in commit message bodies; screenshots ephemeral in a temp dir the design agent creates and cleans itself. On re-invocation on an existing ship branch, Step 1.5 reconstructs the completed-phase set from `git log`/`git show` of `phase <N>:` and `fix:` commits. Only committed phases are recoverable; a passed panel leaves no marker, so if all phases are committed the panel simply re-runs (it is read-only and idempotent). Resume always re-posts the recovered state and waits for `go` — never silent.
- **Worktree management out of scope.** /ship runs in whatever directory the user invoked it from. If on `<base-ref>`, auto-creates a branch using detected repo conventions. Otherwise, trusts the current branch.
- **Configurable base ref (v2.3).** Resolution precedence: inline `base:<branch>` token (first word of the invocation), `$SHIP_BASE_REF`, `git config ship.baseRef`, repo default branch. The resolved ref is validated (`git rev-parse --verify`) and announced before any branch/PR action; diff scope, resume scan, and `gh pr create --base` all use this single value.
- **End state is a PR.** Merge stays human-only.

---

## Phase loop (per phase)

```mermaid
flowchart TD
    Start([Phase N]) --> Imp[ship-implementer<br/>opus<br/>reads lessons + reconciles]
    Imp -->|ambiguity?| Esc[escalate to lead]
    Esc --> Imp
    Imp --> Commit[git commit<br/>subject: 'phase N: title'<br/>body: Behavior/Verification/State]
    Commit --> Ver[ship-verifier<br/>haiku<br/>flaky retry built-in]
    Ver --> Verdict{verdict +<br/>currentMode}
    Verdict -->|green/minor| Next([next phase])
    Verdict -->|critical, NEW mode| FixLoop[fix-loop counter++<br/>respawn implementer<br/>fix: phase N verifier — topic]
    FixLoop --> Commit
    Verdict -.critical, SAME mode<br/>as last attempt.-> Dbg
    Verdict -->|3rd critical| Dbg[ship-debugger<br/>sonnet · diagnose · one-shot]
    Dbg -->|fixed| Ver
    Dbg -.blocked / still red.-> Stop[ESCALATE: surface to user<br/>continue / fix manually / abort?]:::stop

    classDef stop fill:#f8e3e3,stroke:#dc322f,stroke-width:2px
    classDef green fill:#e3f2dc,stroke:#859900,stroke-width:2px
    class Next green
```

**Sprint contract** (the triplet — Behavior / Verification command / State) is the contract between lead and implementer. It travels in:
1. The implementer's spawn prompt.
2. The commit message body, recoverable forever via `git show <sha>`.

The verifier receives only the `Verification` command. No file paths. Independent of state-on-disk.

---

## End-of-run panel (sequential gate)

```mermaid
flowchart TD
    Start([all phases committed]) --> Gate[ship-code-review<br/>sonnet  ·  GATE]
    Gate --> GateV{verdict?}
    GateV -->|critical| GFix[fix-loop:<br/>respawn implementer<br/>cap = 2, same-defect detector]:::stop
    GFix --> Gate
    GateV -->|green/minor| TriggerEval[evaluate triggers]
    TriggerEval --> Triggers{which signals?}
    Triggers -->|always| Perf[ship-performance<br/>sonnet]
    Triggers -.security signals.-> Sec[ship-security<br/>sonnet]
    Triggers -.UI signals.-> Des[ship-design<br/>sonnet]

    Perf --> Aggr
    Sec --> Aggr
    Des --> Aggr[deduplicate findings<br/>by location_hash]
    Aggr --> AVerdict{worst verdict?}
    AVerdict -->|green/minor| Done([panel done])
    AVerdict -->|critical| AFix[fix-loop:<br/>cap = 2, same-defect detector]:::stop
    AFix --> Gate
    AFix -.cap hit / same-defect.-> PDbg[ship-debugger<br/>panel · one-shot]
    PDbg -->|fixed| Gate
    PDbg -.blocked / still critical.-> PStop[ESCALATE: surface to user]:::stop

    classDef stop fill:#f8e3e3,stroke:#dc322f,stroke-width:2px
    classDef green fill:#e3f2dc,stroke:#859900,stroke-width:2px
    class Done green
```

### Trigger evaluation

**Security trigger** (sonnet, conditional). Fires if EITHER:
- Diff `<base-ref>..HEAD` touches files matching: `*auth*`, `*login*`, `*session*`, `*crypto*`, `*token*`, `*permission*`, `*.sql`, `package.json`, `*.env*`, files introducing `dangerouslySetInnerHTML` or `eval(`.
- Plan or out-of-scope mentions: `auth`, `login`, `password`, `token`, `secret`, `oauth`, `permission`, `admin`, `payment`, `pii`, `gdpr`, `encryption`.

**Design trigger** (sonnet, conditional). Fires if EITHER:
- Diff touches: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.module.*`, `*.vue`, `*.svelte`.
- Plan mentions: `figma.com/`, `mockup`, `screenshot`, `design system`, `mobile`, `breakpoint`, `responsive`.

**Performance** (sonnet, always).

### Why sequential?

Code-review fires first as a cheap-signal gate. If the basic correctness layer is broken, spending sonnet tokens on the full performance/security/design trio is waste. Once code-review is green, the parallel trio runs concurrently.

### Deduplication

When two panel agents flag the same `location_hash` (file:line_range), the lead keeps the higher-severity one and merges the evidence from both. Dedup keys on location ONLY, not on `rubric_dimension`: the four panel agents share no dimension vocabulary (code-review `boundaries`/`quality`, security `injection`/`headers`, performance `render`/`db`, design `layout_*`), so a dimension-keyed match would never fire across agents. Reduces redundant fix-loop entries.

---

## Agent topology + memory

```mermaid
flowchart LR
    subgraph LeadCtx[/ship lead context]
        Lead[orchestrator<br/>plan in memory<br/>sprint contracts via git]
    end

    Lead --> Grill[grill-with-docs / grill-me]
    Lead --> Imp[ship-implementer<br/>opus]
    Lead --> Ver[ship-verifier<br/>haiku]
    Lead --> CR[ship-code-review<br/>sonnet  ·  gate]
    Lead --> Sec[ship-security<br/>sonnet  ·  cond]
    Lead --> Perf[ship-performance<br/>sonnet]
    Lead --> Des[ship-design<br/>sonnet  ·  cond]
    Lead --> Retro[ship-retro<br/>haiku]

    subgraph Vault["LESSONS_ROOT (personal lessons dir, e.g. Obsidian vault)"]
        IL[(implementer-lessons.md)]
        VL[(verifier-lessons.md)]
        CRL[(code-review-lessons.md)]
        SL[(security-lessons.md)]
        PL[(performance-lessons.md)]
        DL[(design-lessons.md)]
    end

    Imp -.reads at start.-> IL
    Ver -.reads at start.-> VL
    CR -.reads at start.-> CRL
    Sec -.reads at start.-> SL
    Perf -.reads at start.-> PL
    Des -.reads at start.-> DL

    Retro ==auto-writes==> IL
    Retro ==auto-writes==> VL
    Retro ==auto-writes==> CRL
    Retro ==auto-writes==> SL
    Retro ==auto-writes==> PL
    Retro ==auto-writes==> DL

    classDef agent fill:#e8eef7,stroke:#268bd2,stroke-width:1px
    classDef vault fill:#fdf6e3,stroke:#b58900,stroke-width:1px
    class Imp,Ver,CR,Sec,Perf,Des,Retro agent
    class IL,VL,CRL,SL,PL,DL vault
```

Each subagent reads its own lessons file at startup. **Reconciliation rule:** lessons are priors, current task is evidence; on conflict, follow task and emit `lessonConflicts` so retro can flag the lesson for expiry.

The lead also captures **user corrections** (overrides/redirects of an agent, the plan, or a gate) during the run and forwards them to retro alongside `lessonConflicts`; because retro is a haiku subagent with no conversation or transcript access, the lead is the sole capturer. Corrections convert to Mistakes lessons and take priority over inferred surprise-deltas within the 1-lesson-per-role cap. Retro additionally returns a run-scoped `whatDidntWork` list (dead-ends, abandoned approaches) surfaced in the handoff — not persisted to any lessons file.

Retro writes structured 4-field lessons with auto-prune at 100-line cap. Lessons live in the user's personal vault — never in the repo.

---

## Output return shape (review-panel agents)

This shape is the contract for the four **panel** agents only: `ship-code-review`, `ship-security`, `ship-performance`, `ship-design`. The verifier is a separate case (see below).

```json
{
  "agent": "<role>",
  "rubric": { "dimension1": "A-D", "dimension2": "A-D", ... },
  "findings": [
    {
      "severity": "critical | minor",
      "dimension": "<rubric key>",
      "location": "<file:line or route>",
      "summary": "<one-line>",
      "fix_hint": "<concrete suggestion>",
      "evidence": { "type": "test|log|trace|screenshot", "ref": "<verbatim or path>" }
    }
  ],
  "verdict": "green | minor | critical | blocked",
  "previousMode": "<from spawn, or null>",
  "currentMode": "<short stable id of THIS critical pattern>",
  "lessonConflicts": [{ "lesson": "...", "reason": "..." }]
}
```

`currentMode` enables the same-defect detector. `lessonConflicts` enables retro expiry. `blocked` marks an environment/setup failure (no dev server, missing deps, timeout) that the lead routes to the user, not into the implementer fix-loop. `ship-debugger` reuses the same `blocked` verdict when it cannot build a reproduction loop (`blockedReason: no-repro-loop`), which likewise escalates to the user.

### The verifier is not a panel agent

`ship-verifier` is a **test-runner**, not a review-panel agent, and does NOT conform to the shape above. It shares only the common verdict semantics (`green | minor | critical | blocked`), the same-defect fields (`previousMode` / `currentMode`), the `evidence` rule, and `lessonConflicts`. Its return adds test-runner fields (`command`, `exitCode`, `flakyRetried`, failure-mode tag) and uses a fixed rubric (`correctness` / `boundaries` / `coverage`); it does not emit `fix_hint` or a cross-agent `dimension` vocabulary. `ship-verifier.md` is authoritative for its schema. The location_hash dedup and cross-agent `dimension` merge apply to the panel agents only, never to the verifier.

---

## What `/ship` does NOT do

- **Manage worktrees.** No sweep, no create, no `--here` flag, no mode detection. User pre-creates if they want isolation.
- **Persist state to disk.** No `.ship/` directory. Resume across sessions IS supported, but only via git commit history, never via an on-disk state file or marker commit.
- **Auto-merge PRs.** Always stops at PR. Merge requires explicit follow-up user request.
- **Write to repo files via retro.** No CLAUDE.md edits. Lessons are personal cross-repo, vault only.
- **Auto-start dev servers.** Design agent reports critical if no dev server detected.
- **Push to `<base-ref>`.** Refuses if user is on main with a dirty tree; auto-branches if main is clean.

---

## Hard rules (never violate)

- One Gate only — inline `go` at end of the griller. Never auto-approve.
- One commit per phase, subject `phase <N>: <title>`, body embeds the sprint triplet.
- Fix-loop commits are forward-only (`fix: <topic>`). Never amend, never rebase.
- Per-phase verifier and end-of-run panel each have **independent** retry caps of 2.
- Same-defect detector (`previousMode == currentMode`) overrides retry counters.
- Cross-component / boundary defects auto-promote to critical.
- Findings without `evidence` are dropped.
- Lessons file cap = 100 lines. Retro prunes before write or skips.
- Push and open a PR at the end. Never merge.

---

## Evals

The deterministic contracts above are guarded by `evals/`. Each invariant maps to a case class:

| Invariant (source) | Case | Class |
|---|---|---|
| Dedup keys on `location` alone (§ Deduplication) | D04, D05 | D |
| Worst-of verdict rollup; `blocked` excluded (Step 4c) | D06 | D |
| Security/design trigger glob+keyword lists (Trigger evaluation) | D01–D03 | D |
| Retro lessons 100-line cap, retry cap of 2, same-defect detector (§ Hard rules) | D07-D12 | D |
| `blocked` verdict routes to user, not fix-loop (verifier/design) | J02, J03, J07, T05 | J/T |
| Cross-component auto-critical (§ Hard rules) | J04 | J |
| Findings without evidence dropped | J06 | J |
| Same-defect detector overrides retry cap → auto-debug then escalate (phase loop) | T04 | T |
| Sequential gate skips trio on red | T03 | T |
| Retro expiry via `lessonConflicts` | J09 | J |

Class D (`node evals/lib/run-d.mjs`) is a pure re-implementation of these rules in `evals/lib/ship_rules.mjs`; a failing D eval means either a regression OR an intentional rule change whose fixture was not updated. J and T are agent/human-scored and advisory per-edit. See `evals/README.md`.
