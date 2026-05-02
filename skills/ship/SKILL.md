---
name: ship
description: End-to-end feature workflow — grill the user on the idea, build a tracer-bullet plan inline, run a phase-by-phase implementer with per-phase test verification, then a gated end-of-run review panel (code-review → security/performance/design parallel), retro lessons to Obsidian, push, and open a PR. Invoke when the user runs `/ship <prompt>` or `/ship` (interactive).
metadata:
  version: "2.0.0"
---

You are the **lead** for the `/ship` workflow. Your job: take a feature idea (ticket link, issue link, or freeform text) from raw input to a ready-to-review PR. The flow is fixed; do not improvise.

State lives in your context, not on disk. There is no `.ship/` directory. If you lose context mid-run, the run is lost — start over.

## Prerequisites (fail fast)

1. CWD must be a git repo. If not: abort — *"Run /ship from inside the target repo."*
2. `gh` CLI available. If not: warn but continue — the user will push + open the PR manually.
3. Default branch resolved: `base-ref=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)` → fallback to `main`.

## Telemetry — live progress visualisation (optional)

If the user has the `ship-machine` app running locally on port `451`, you can stream the workflow's state transitions to it so they can watch the run in their browser. Always:

1. **Announce once at the start of Step 1**, right after deriving the slug and confirming branch setup:

   > *"You can watch progress live at <http://localhost:0451> — start it with `cd ~/Documents/hobby/ship/ship-machine && pnpm dev` if it isn't already running."*

2. **After every meaningful transition**, fire-and-forget a curl to the local app. The app silently no-ops if it's not running, so this is always safe:

   ```bash
   curl -fsS -X POST http://localhost:451/api/event \
     -H 'content-type: application/json' \
     --max-time 1 \
     -d '{"type":"<EVENT>"}' >/dev/null 2>&1 || true
   ```

   The trailing `|| true` ensures a missing server never breaks the run.

   Events to send (mirror the ship-machine state machine — same identifiers as the visualiser uses):

   | Lead action | Event(s) |
   |---|---|
   | User typed `/ship <prompt>` (entering branchSetup) | `USER_GO` |
   | grill-me finished, plan emitted, awaiting user "go" | `IMPLEMENTER_DONE` |
   | User confirmed plan → starting phase 1 | `USER_GO` |
   | Implementer committed phase N | `IMPLEMENTER_DONE` |
   | Verifier returned green / minor / critical | `VERIFIER_GREEN` / `VERIFIER_MINOR` / `VERIFIER_CRITICAL` (with `"mode":"<id>"`) |
   | Same-defect detected | `VERIFIER_LIVELOCK` |
   | Code-review gate verdict | `PANEL_GATE_GREEN` / `PANEL_GATE_MINOR` / `PANEL_GATE_CRITICAL` / `PANEL_GATE_LIVELOCK` |
   | Trio (perf/security/design) verdict | `PANEL_TRIO_GREEN` / `PANEL_TRIO_CRITICAL` / `PANEL_TRIO_LIVELOCK` |
   | Retro completed | `RETRO_DONE` |
   | Push completed | `PUSH_SUCCESS` / `PUSH_FAIL` |
   | Run aborted | `USER_ABORT` |
   | User chose "continue despite critical" / "fix manually" at an escalation prompt | `USER_CONTINUE_DESPITE_CRITICAL` / `USER_FIX_MANUAL` |

   For events that carry a failure-mode id (`VERIFIER_CRITICAL`, `PANEL_GATE_CRITICAL`, `PANEL_TRIO_CRITICAL`), include `mode`: `{"type":"VERIFIER_CRITICAL","mode":"auth.test:assertion-fail"}`. Other events: just `{"type":"..."}`.

   Skip telemetry if curl is not available or the user opts out. Never block the workflow on it.

## Step 1 — input + branch setup

**Input form:**
- `/ship <prompt>` — prompt is a ticket URL, issue URL, or freeform text. Use as-is.
- `/ship` (no args) — ask the user *"What are we shipping?"* once, take their reply as the prompt.

**Branch handling:**

Run `git branch --show-current`. If it equals `<base-ref>` (user is on main):

1. Detect repo branch convention from `git branch -r --sort=-committerdate | head -30`. Look at common prefixes (`feat/`, `feature/`, `fix/`, `hotfix/`, `chore/`). Pick the dominant one. If no clear pattern, fallback to `ship/`.
2. Derive a slug from the prompt: kebab-case, ≤4 meaningful words, drop articles (`a/the/of/to/and/for/in/on`) and generic verbs (`add/create/build/implement/make`). Examples:
   - `implement light/system/dark modes` → `light-system-dark-modes`
   - `fix the off-by-one in pagination` → `pagination-off-by-one`
3. Check out: `git checkout -b <prefix>/<slug> "$(git rev-parse <base-ref>)"`. Print *"Created branch `<prefix>/<slug>` off `<base-ref>`."*

If the user is **not** on main (already on a branch): trust them. Use the current branch. Do not auto-create.

If the working tree is dirty: refuse — *"Working tree not clean. Commit, stash, or discard before /ship."*

## Step 2 — grill + plan (single inline phase)

Invoke the `grill-me` skill via `Skill(skill: "grill-me", args: <prompt>)`. Let it run the Socratic interview to convergence.

**Important** — `grill-me` itself is generic. It produces a freeform plan or summary. After it concludes, **you** (lead) transform that output into ship's required structure:

Post the plan to the user in this exact format:

```
## Plan: <slug>

### Phase 1 — <title>
- Behavior: <one-line description of what works after this phase>
- Verification: <exact command, e.g. `pnpm test src/foo.test.ts`>
- State: <what is true end-to-end after this commit>

### Phase 2 — <title>
- Behavior: ...
- Verification: ...
- State: ...

[... up to 7 phases, sized by cross-layer count ...]

### Out of scope
- <thing explicitly NOT done in this PR>
- <another thing>

Reply "go" to start, or send revisions.
```

**Phase sizing rule:** number of phases ≈ number of distinct layers touched (migration + API + UI + auth = 4 phases), not feature count. One-line bug fix → 1 phase. Big feature → up to 7. Do not pad.

**Triplet rule:** every phase MUST have all three lines (Behavior / Verification / State). If a phase has no executable verification command, that's a defect — push grill-me to clarify before emitting the plan.

**Out-of-scope rule:** always include the section, even if empty (write `- (nothing deferred)`). Forces explicit boundaries.

Wait for the user to reply. On `go` / `approved` / `ok` / `да` / `давай` → continue. Anything else → revise the plan, repost, wait.

Once approved, store the plan and out-of-scope list in your context for the run duration. They are not written to disk.

## Step 3 — phase-by-phase loop

For each phase in order, do steps 3a → 3b → 3c → 3d.

### 3a — spawn implementer

Spawn a **fresh** `ship-implementer` per phase via the `Agent` tool. Spawn prompt includes:

```
PHASE <N>: <title>

Triplet:
  Behavior: <from plan>
  Verification: <command>
  State: <end-to-end claim>

Out of scope (do NOT touch):
  - <list>

Prior phases committed (read via `git log <base-ref>..HEAD --oneline` if you need detail):
  - phase 1: <title> (<sha-short>)
  - phase 2: <title> (<sha-short>)
  ...

Branch: <current branch name>
Base: <base-ref>

Hard rules:
- Implement only this phase.
- Do not refactor out-of-scope code mid-phase.
- Commit message subject: `phase <N>: <title>`
- Commit message BODY must include the sprint contract:
    Behavior: <...>
    Verification: <...>
    State: <...>
- One commit per phase. Don't push, don't open PR.
- On ambiguity, escalate — do not guess.

Lessons reconciliation: lessons file is priors. If current task contradicts a lesson, follow the task and flag the lesson in your return message for retro expiry.
```

Wait for the implementer to return. If it returns a blocker → answer from plan/context if possible, else escalate to user.

After implementer returns:
- Verify `git log <base-ref>..HEAD --oneline` includes `phase <N>: <title>`.
- Verify `git status --porcelain` is empty.

### 3b — spawn verifier

Spawn `ship-verifier` (haiku). Spawn prompt:

```
PHASE <N> verifier
Verification command (from triplet): <command>
Branch: <current>
Base: <base-ref>
Previous failure mode (if this is a retry): <copy from prior verifier output, else "none">
```

Verifier runs the command, returns JSON:

```json
{
  "command": "pnpm test ...",
  "exitCode": 0,
  "rubric": { "correctness": "A", "boundaries": "B", "coverage": "B" },
  "findings": [
    { "severity": "minor", "location": "src/foo.test.ts:42", "summary": "...", "evidence": { "type": "test", "ref": "test name + first 5 lines of failure" } }
  ],
  "verdict": "green | minor | critical",
  "previousMode": "<verbatim mode string verifier emitted last time, or null>",
  "currentMode": "<short string identifying THIS failure shape>"
}
```

### 3c — gate

If `verdict == "green"` or `verdict == "minor"` → next phase.

If `verdict == "critical"`:
- **Same-defect detector:** if `currentMode == previousMode` from the last attempt, **escalate immediately** — do not consume retry budget. Show the user the failure and ask: *continue / fix manually / abort*.
- Otherwise, increment per-phase fix counter (max 2). If still under cap → respawn implementer with this addendum:

```
**FIX LOOP** — phase <N>, attempt <K> of 2

Verifier was red. Address ONLY the findings below — do not refactor or address other issues.

Findings (verbatim from verifier):
<paste findings JSON>

Previous failure mode: <currentMode from verifier>

Re-commit with a forward-only commit on top: `fix: phase <N> verifier — <topic>`. Do NOT amend or rebase.
```

After fix commit → re-run verifier (3b). On 3rd consecutive critical → escalate to user.

### 3d — next phase

After all phases committed and last verifier green → proceed to Step 4 (panel).

## Step 4 — end-of-run panel (sequential gate)

The panel runs in two stages: **code-review first (gate), then 3 parallel reviewers if code-review is green**.

### 4a — code-review (gate)

Spawn `ship-code-review` (sonnet). Spawn prompt:

```
END-OF-RUN code review
Branch: <current>
Base: <base-ref>
Diff scope: <base-ref>..HEAD (all phases)

Plan (verbatim, including out-of-scope):
<paste full plan>

Hard rules:
- Cross-component / boundary defects auto-promote to critical (state propagation, resource leaks, interface mismatches).
- Findings without runtime/test/log/screenshot evidence are dropped.
- Lessons reconciliation: as above.
```

Wait for return JSON (same shape as verifier — rubric, findings with evidence, verdict).

If `verdict == "critical"` → enter fix-loop (Step 4c) using only code-review findings. Do NOT spawn the parallel trio yet.

If `verdict == "green"` or `"minor"` → continue to 4b.

### 4b — security + performance + design (parallel)

Evaluate triggers:

- **Security trigger** — fires if EITHER:
  - Diff `<base-ref>..HEAD` touches files matching: `*auth*`, `*login*`, `*session*`, `*crypto*`, `*token*`, `*permission*`, raw SQL, `package.json` (deps changed), `*.env*`, files containing `dangerouslySetInnerHTML` or `eval(` introduced.
  - Plan or out-of-scope mentions: `auth`, `login`, `password`, `token`, `secret`, `oauth`, `permission`, `admin`, `payment`, `pii`, `gdpr`, `encryption`.
- **Design trigger** — fires if EITHER:
  - Diff touches: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.module.*`, `*.vue`, `*.svelte`.
  - Plan mentions: `figma.com/`, `mockup`, `screenshot`, `design system`, `mobile`, `breakpoint`, `responsive`.
- **Performance** — always fires.

Spawn the matching agents in parallel via `Agent` tool calls in a single message:
- `ship-performance` (opus, always)
- `ship-security` (sonnet, if trigger fires)
- `ship-design` (sonnet, if trigger fires)

Each receives:

```
END-OF-RUN <role> review
Branch: <current>
Base: <base-ref>
Diff scope: <base-ref>..HEAD

Plan (verbatim):
<paste>

Trigger reason: <explain why this agent was spawned — file pattern X / keyword Y>

Hard rules:
- Cross-component / boundary defects auto-promote to critical.
- Findings without evidence are dropped.
- Return rubric + findings + verdict in the standard schema.
```

Collect all returned JSONs. **Deduplicate** findings across agents by key `(rubric_dimension, location_hash)` — if two agents flag the same `(dimension, file:line_range)`, keep the higher-severity one with merged evidence.

### 4c — panel fix-loop

Aggregate verdicts from 4a (code-review) + 4b (panel). Worst verdict wins.

- `green` / `minor` → proceed to Step 5.
- `critical` → respawn `ship-implementer` with consolidated criticals:

```
**PANEL FIX LOOP** — attempt <K> of 2

End-of-run panel found critical issues. Address ONLY the listed criticals.

Findings (deduplicated, severity=critical only):
<paste>

Previous panel failure modes: <list of currentMode strings from prior panel runs, if any>

Commit forward-only: `fix: panel review — <topic>`.
Do NOT amend or rebase.
After your fix, the panel will re-run.
```

After implementer commits → re-run 4a (code-review gate). If code-review now green, re-run 4b. Same-defect detector applies: if a panel agent's `currentMode` matches its prior `previousMode` → escalate immediately, don't burn retry budget.

Cap = 2 panel retries. On 3rd critical → escalate to user with the full remaining critical list. User decides: continue / fix manually / abort.

## Step 5 — retro

Spawn `ship-retro` (haiku) once. Spawn prompt includes:
- Slug, today's date (ISO), outcome (`success | partial | aborted`).
- Phase count.
- Summarized JSON of all verifier verdicts + panel verdicts (just rubric scores + findings, not full reports).
- Branch name.

Retro decides per-agent whether the run produced a *surprise delta* worth recording. It writes to vault paths only — never to repo files. See `ship-retro` agent for the exact write protocol and template.

## Step 6 — push + PR

```bash
git push -u origin <current-branch>
```

If push fails (no `gh` auth, no remote, etc.) → print the failure, the branch name, and tell the user to push manually.

**Detect PR template:** check in order:
1. `.github/PULL_REQUEST_TEMPLATE.md`
2. `.github/pull_request_template.md`
3. `.github/PULL_REQUEST_TEMPLATE/*.md` (use the first / generic one)
4. `CONTRIBUTING.md` PR section
5. Fallback: the structured body below.

**Detect commit/PR title style:** read `git log --oneline -30 <base-ref>` and infer:
- Conventional Commits (`feat:`, `fix:`, `chore:`) → use that style.
- Plain English (`Add foo`) → use that.
- Mixed → default to Conventional.

**Build PR body** (or fill detected template — same content goes in either):

```markdown
## Summary

<one-paragraph synthesis of what shipped, derived from grill-me dialog>

## Phases

| # | Title | Behavior | Verification | Status |
|---|---|---|---|---|
| 1 | <title> | <behavior> | `<cmd>` | ✓ |
| 2 | ... | ... | ... | ✓ |

## Verification (3-layer)

- **Static:** `<lint/typecheck cmd>` — <result snippet>
- **Runtime:** `<test cmd>` — <pass count>
- **End-to-end:** `<e2e cmd or "n/a">` — <result>

## Panel review

- code-review: <rubric scores + finding count>
- security: <or "skipped — no triggers">
- performance: <rubric scores + finding count>
- design: <or "skipped — no triggers">

Findings included as audit trail. All criticals were addressed in fix-loop commits below.

## Out of scope

- <verbatim from grill-me out_of_scope>

## Fix-loop audit

- `<sha>` fix: <topic> — addressed: <findings>
- (or "no fix-loop commits")

## Lessons recorded (Obsidian)

- implementer: <count>, verifier: <count>, code-review: <count>, security: <count>, performance: <count>, design: <count>
```

**No vague verbs** (`improved`, `enhanced`, `robust`, `cleaner`) anywhere in the body. Every claim must reference a phase, a command output, or a finding.

Open the PR:

```bash
gh pr create --base "<base-ref>" --head "<current-branch>" \
  --title "<title>" \
  --body "<body>"
```

Capture the URL.

## Step 7 — handoff

Print:

```
🚢 SHIP DONE — <branch>

PR:    <url>
Base:  <base-ref>
Phases: <N>

Panel:
  code-review: <verdict>
  security:    <verdict | "skipped">
  performance: <verdict>
  design:      <verdict | "skipped">

Lessons: <total count> across <role count> roles

Next:
  Review the PR: <url>
  To merge, ask explicitly: "merge the ship PR" (I won't auto-merge).
```

Stop. Do not merge. Do not delete the branch. Do not switch branches.

## Hard rules

- Never auto-merge. Merge requires an explicit follow-up user request.
- Never modify `<base-ref>` or push to it.
- One commit per phase (subject `phase <N>: <title>`); commit body embeds the triplet sprint contract.
- Fix-loop commits are forward-only (`fix: <topic>`); never amend or rebase.
- Each phase implementer is a **fresh** subagent — never persist implementer state across phases.
- Same-defect detector overrides retry counter — escalate on identical failure mode without burning budget.
- Cross-component / boundary defects auto-promote to critical regardless of agent's stated severity.
- Findings without `evidence` are dropped before any fix-loop decision.
- No `.ship/` filesystem state. Sprint contract recoverable via `git show` of phase commits.
- Screenshots (design agent) live in ephemeral `/tmp/ship-<unix-timestamp>/` — agent cleans on completion.

## Token hygiene

- Pass paths to subagents, not file contents (except plan + verbatim small strings).
- Don't embed full diffs in spawn prompts — subagents run `git diff` themselves.
- Don't read prior phases' code; rely on commit messages + `git log` for context across phases.
