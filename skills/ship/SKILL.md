---
name: ship
description: End-to-end feature workflow — grill the user on the idea, build a tracer-bullet plan inline, run a phase-by-phase implementer with per-phase test verification, then a gated end-of-run review panel (code-review → security/performance/design parallel), retro lessons to Obsidian, push, and open a PR. Invoke when the user runs `/ship <prompt>` or `/ship` (interactive).
metadata:
  version: "2.3.0"
---

You are the **lead** for the `/ship` workflow. Your job: take a feature idea (ticket link, issue link, or freeform text) from raw input to a ready-to-review PR. The flow is fixed; do not improvise.

State lives in your context, not on disk. There is no `.ship/` directory. If you lose context mid-run, do NOT assume the run is lost: on re-invocation, Step 1.5 reconstructs the plan and completed-phase set from the phase/fix commit history and resumes at the correct point. Git is the only persistence layer; nothing is written to disk beyond commits.

## Prerequisites (fail fast)

1. CWD must be a git repo. If not: abort — *"Run /ship from inside the target repo."*
2. `gh` CLI available. If not: warn but continue — the user will push + open the PR manually.
3. **Base ref resolved by precedence** (first non-empty wins), then validated + announced:
   1. inline `base:<branch>` token — **only when it is the first whitespace-delimited word** of the invocation (see Step 1 input form); a `base:` elsewhere is part of the prompt, not an override. Strip the leading token before using the prompt,
   2. `$SHIP_BASE_REF` (environment variable),
   3. `git config ship.baseRef` (repo-local; visible across worktrees unless `extensions.worktreeConfig` is enabled),
   4. `gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null` → else `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`) → else `main`.

   Lower-precedence sources are ignored (not merged) once a higher one is set. Validate the resolved ref exists (`git rev-parse --verify "<base-ref>"`); abort if not. **Announce** it and its source before any branch/PR action — e.g. *"Base branch: `develop` (source: git config ship.baseRef)."* — so a wrong base is caught before you branch or open a PR. With nothing set, this resolves to the same repo default branch as before (now with an added existence check + announce line). Everything downstream (`base-ref..HEAD` diff scope, resume scan, `gh pr create --base`) uses this single resolved value.

## Lessons memory (portable)

Cross-run lessons live **outside** the repo, in a personal directory — configured in ONE place (here), never hardcoded in the agents.

- `LESSONS_ROOT` = `~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship` — the maintainer's default. **Set this to your own directory, or leave it empty to run without lessons.**
- At every spawn, the lead injects the agent's file as a `Lessons file: <LESSONS_ROOT>/<role>-lessons.md` line in the prompt. If `LESSONS_ROOT` is empty, inject `Lessons file: none`.
- `Lessons file: none` is normal on a fresh machine — the agent runs with no priors. It is never an error, and agents never fall back to a hardcoded path.

## Step 1 — input + branch setup

**Input form:**
- `/ship <prompt>` — prompt is a ticket URL, issue URL, or freeform text. Use as-is.
- `/ship` (no args) — ask the user *"What are we shipping?"* once, take their reply as the prompt.
- `/ship base:<branch> <prompt>` — an optional `base:<branch>` token, **only when it is the first whitespace-delimited word** of the invocation, pins the base branch for this run (highest precedence in Prerequisites #3). A `base:` appearing anywhere else is part of the prompt, not an override. Strip the leading token before using the remainder as the feature prompt.

**Branch handling:**

Run `git branch --show-current`. If it equals `<base-ref>` (user is on the base branch — which, with an override set, is the integration branch, not necessarily main):

1. Detect repo branch convention from `git branch -r --sort=-committerdate | head -30`. Look at common prefixes (`feat/`, `feature/`, `fix/`, `hotfix/`, `chore/`). Pick the dominant one. If no clear pattern, fallback to `ship/`.
2. Derive a slug from the prompt: kebab-case, ≤4 meaningful words, drop articles (`a/the/of/to/and/for/in/on`) and generic verbs (`add/create/build/implement/make`). Examples:
   - `implement light/system/dark modes` → `light-system-dark-modes`
   - `fix the off-by-one in pagination` → `pagination-off-by-one`
3. Check out: `git checkout -b <prefix>/<slug> "$(git rev-parse <base-ref>)"`. Print *"Created branch `<prefix>/<slug>` off `<base-ref>`."*

If the current branch is **not** `<base-ref>` (you are on some other branch, or a branch was passed as an arg): do NOT assume a fresh run. Use the current branch and go to **Step 1.5 — resume detection** before doing anything else. Only if Step 1.5 finds no prior `phase <N>:` commits do you fall through to a normal fresh run on this branch.

Dirty working tree:
- **Fresh start on `<base-ref>`** (auto-branch case above): refuse — *"Working tree not clean. Commit, stash, or discard before /ship."*
- **On a branch (resume case):** do NOT refuse. An interrupted run can leave uncommitted mid-phase work. Report it (`git status --short`) and hand the choice to Step 1.5.

## Step 1.5 — resume detection (only when starting on an existing branch)

Reached only from Step 1's "on a branch" case. Goal: recover an interrupted run from git alone. No `.ship/` file is ever created or read.

**1. Scan for phase commits.**

```bash
git log <base-ref>..HEAD --oneline --reverse
```

Parse subjects. A run is resumable iff at least one subject matches `^phase (\d+): `. If NONE match, this is a fresh run on a pre-existing branch → skip the rest of Step 1.5, go to Step 2.

**2. Reconstruct the plan from commit bodies.** For each `phase <N>:` commit (lowest N to highest), run `git show -s --format=%B <sha>` and parse the body triplet the implementer embedded:

```
Behavior: <...>
Verification: <...>
State: <...>
```

Build the completed-phase set = `{ N : (title, triplet, sha) }`. If two commits share the same N (a phase re-committed — should not happen, since fix-loops use `fix:` subjects, but guard anyway) keep the latest by log order and note it.

**3. Classify non-phase commits.** Subjects matching `^fix: phase (\d+) verifier — `, `^fix: panel review — `, `^fix: phase (\d+) debug — `, or `^fix: panel debug — ` are forward-only fix-loop commits (the literal separator is an em-dash — match it verbatim); a `^docs: ` subject is the grill-with-docs planning-capture commit (Step 2). NONE of these are phases — they do not add to the phase set. A phase with a trailing `fix:` commit is still "done" for resume, and a `fix: panel …` commit is evidence the panel already ran at least once.

**4. Detect a completed run.** A clean panel leaves no git trace, so there is no "panel passed" marker to look for. Instead check whether the run already finished: if a PR exists for this branch (`gh pr view --json url 2>/dev/null`), report the URL and stop — the run was complete. Otherwise, if every phase is committed but there's no PR (point 7), the panel just re-runs on resume; it is read-only and idempotent, so re-running a panel that previously passed simply re-confirms green.

**5. Present the recovered state and get an explicit gate.** Never resume silently. Post:

```
## Resuming /ship on `<branch>`

Recovered from git:
### Phase 1 — <title>   ✓ committed (<sha>)
- Behavior / Verification / State  (from commit body)
### Phase 2 — <title>   ✓ committed (<sha>)
...
### Phase <K> — (no commit found) ← resume here

Fix-loop commits found: <list of `fix:` shas, or none>
Panel: <"all phases committed — panel will (re-)run on go" | "phases still remaining">
Uncommitted changes: <git status --short output, or "none">

Reply "go" to resume from Phase <K> (or from panel/PR), "replan" to rewrite the remaining plan, or tell me what to change.
```

**6. Handle the forks:**
- **Dirty tree on resume:** if `git status --porcelain` is non-empty, the last phase is *partially done, uncommitted*. Ask: *"Phase <K> has uncommitted work. Discard it and re-run the phase clean, or treat it as your manual work-in-progress and let the implementer continue on top?"* Default recommendation: discard. Do not run destructive git yourself — the lead only asks; if the user says discard, note it in the phase spawn prompt so the implementer starts clean.
- **User changed the plan ("replan"):** run Step 2 (grill+plan) but seed the griller with the recovered triplets as context so it only re-plans the *remaining/changed* phases. Committed phases are immutable history; the new plan's phase numbering MUST continue from the highest committed N+1 (do not renumber committed phases). Re-post the full plan (committed + new) and wait for `go`.
- **A committed phase's body is unparseable** (missing a triplet line, e.g. a hand-made commit): treat it as recovered-but-incomplete-contract. Show what was parsed, and ask the user to confirm the Verification command before it can be re-verified. Do not fabricate a triplet.

**7. Set the resume entry point** (used to jump into the existing loop). Git only records COMMITTED phases; it cannot know how many phases were originally planned or what the uncommitted tail was. So resume can rebuild phases 1..K (committed) but not phase K+1 onward:
- **Mid-plan interruption** (more phases were planned after K): the user restates the remaining phases — inline after your point-5 recap, or via `replan` (point 6). Committed phases 1..K stay immutable; new phases continue numbering from K+1. Resume the loop at the first phase with no commit.
- **All work committed** (K was the last phase) and no PR yet → jump to Step 4 and run the panel (idempotent; re-confirms green if it already passed).
- PR exists → report and stop.

Once the user replies `go`, proceed to the resolved entry point. The committed-phase set, reconstructed plan, and out-of-scope list now live in your context for the rest of the run.

## Step 2 — grill + plan (single inline phase)

**Pick the griller.** `/ship` is a coding workflow, so prefer `grill-with-docs` — it challenges the plan against the repo's existing domain model and sharpens terminology, which yields tracer-bullet phases that cut along real seams. Invoke `Skill(skill: "grill-with-docs", args: <prompt>)`. Fall back to `Skill(skill: "grill-me", args: <prompt>)` if `grill-with-docs` is not installed or errors — it is not bundled with `/ship`. If NEITHER skill is installed, run the Socratic interview yourself inline (they are conveniences, not hard dependencies): ask the clarifying questions, converge on scope, then produce the plan. Let the chosen path run to convergence.

**Commit grill-with-docs' file writes cleanly (don't fight them).** `grill-with-docs` updates `CONTEXT.md` / ADRs *inline as decisions crystallize* (and may create them), and it runs in your own context — you cannot stop it writing to the working tree. That is expected; do not try to suppress it. Instead, once the plan is approved (`go`), commit those doc changes as a single `docs: capture domain decisions from planning` commit BEFORE Step 3 phase 1. This restores a clean tree before the first phase and keeps the docs out of any phase commit. It is NOT a `phase <N>:` commit, so Step 1.5 resume ignores it. (Plain `grill-me` and the inline fallback write nothing, so this is a no-op for them.)

**Important** — the griller produces a freeform plan or summary. After it concludes, **you** (lead) transform that output into ship's required structure:

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

**Triplet rule:** every phase MUST have all three lines (Behavior / Verification / State). If a phase has no executable verification command, that's a defect — push the griller to clarify before emitting the plan.

**Out-of-scope rule:** always include the section, even if empty (write `- (nothing deferred)`). Forces explicit boundaries.

Wait for the user to reply. On `go` / `approved` / `ok` / `да` / `давай` → continue. Anything else → revise the plan, repost, wait.

Once approved, store the plan and out-of-scope list in your context for the run duration. They are not written to disk.

## Step 3 — phase-by-phase loop

For each phase in order **starting from the resume entry point set in Step 1.5** (a fresh run starts at Phase 1), do steps 3a → 3b → 3c → 3d. Phases already in the committed-phase set are skipped — do NOT respawn an implementer for a phase that already has a `phase <N>:` commit. If a resumed phase's last verifier verdict is unknown (interruption happened after commit, before verify), re-run just 3b (verifier) for that already-committed phase before advancing; a green/minor confirms it, a critical enters the normal fix-loop.

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
Lessons file: <LESSONS_ROOT>/implementer-lessons.md   (or "none")

Hard rules:
- Implement only this phase.
- Do not refactor out-of-scope code mid-phase.
- RESUME/DISCARD (include this line ONLY on a resumed phase after the user chose discard in Step 1.5): the working tree had uncommitted work from an interrupted run that the user chose to discard. Reset to HEAD first (`git checkout -- . && git clean -fd`) so you start this phase from the last committed state.
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
Lessons file: <LESSONS_ROOT>/verifier-lessons.md   (or "none")
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
  "verdict": "green | minor | critical | blocked",
  "previousMode": "<verbatim mode string verifier emitted last time, or null>",
  "currentMode": "<short string identifying THIS failure shape>"
}
```

### 3c — gate

If `verdict == "green"` or `verdict == "minor"` → next phase.

If `verdict == "blocked"` (environment/setup problem, not a code defect: missing deps, verification timeout, test runner not found): do NOT enter the fix-loop and do NOT consume retry budget. Surface the blocker to the user with the concrete setup action (e.g. *"verifier needs deps; run `pnpm install`"*, or *"verification exceeded 5 min; raise the timeout or investigate"*), then re-run the verifier (3b) once the user resolves it.

If `verdict == "critical"`:
- **Same-defect detector:** if `currentMode == previousMode` from the last attempt, do NOT respawn a blind implementer (it already failed this exact way) and do NOT consume more respawn budget. Go straight to the **auto-debug pass** below.
- Otherwise, increment per-phase fix counter (max 2). If still under cap → respawn implementer with this addendum:

```
**FIX LOOP** — phase <N>, attempt <K> of 2

Verifier was red. Address ONLY the findings below — do not refactor or address other issues.

Findings (verbatim from verifier):
<paste findings JSON>

Previous failure mode: <currentMode from verifier>

Re-commit with a forward-only commit on top: `fix: phase <N> verifier — <topic>`. Do NOT amend or rebase.
```

After fix commit → re-run verifier (3b).

**Auto-debug pass (one-shot, before giving up).** The blind respawn loop gives up in two cases: (a) the same-defect detector tripped, or (b) the 3rd consecutive critical (cap-2 exhausted). In EITHER case, before escalating to the user, spawn ONE `ship-debugger` (only if `debugAttempted` for this phase is still false — set it true when you spawn; there is no debug counter, it fires at most once per phase). Spawn prompt:

```
AUTO-DEBUG — phase <N>: <title>
The implementer fix-loop could not make the verifier green (<reason: same failure mode twice | cap-2 exhausted>).

Triplet:
  Behavior: <from plan>
  Verification: <command>
  State: <end-to-end claim>

Stuck failure mode: <currentMode from last verifier>
Verifier findings (verbatim, all attempts): <paste findings JSON>
Fix commits already tried (forward-only, do NOT revert): <git log <base-ref>..HEAD --oneline for this phase>

Branch: <current>   Base: <base-ref>
Out of scope (do NOT touch): <list>
Lessons file: <LESSONS_ROOT>/debugger-lessons.md   (or "none")

Run the diagnose loop. If you land a fix, commit forward-only `fix: phase <N> debug — <topic>` (one commit, no amend/rebase). If you cannot build a reproduction loop, return verdict `blocked` with your ranked hypotheses — do NOT guess-fix.
```

Wait for `ship-debugger`. Then:
- If it committed a fix → re-run verifier (3b) once. Green/minor → next phase.
- If it returned `blocked` (no repro loop), OR the re-run verifier is still critical → **escalate to the user now**, attaching the debugger's ranked hypotheses and the stuck failure mode. Ask: *continue / fix manually / abort*. Do not spawn the debugger again for this phase.

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
Lessons file: <LESSONS_ROOT>/code-review-lessons.md   (or "none")

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
  - Diff `<base-ref>..HEAD` touches files matching: `*auth*`, `*login*`, `*session*`, `*crypto*`, `*token*`, `*permission*`, `*.sql`, `package.json` (deps changed), `*.env*`, files containing `dangerouslySetInnerHTML` or `eval(` introduced.
  - Plan or out-of-scope mentions: `auth`, `login`, `password`, `token`, `secret`, `oauth`, `permission`, `admin`, `payment`, `pii`, `gdpr`, `encryption`.
- **Design trigger** — fires if EITHER:
  - Diff touches: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.module.*`, `*.vue`, `*.svelte`.
  - Plan mentions: `figma.com/`, `mockup`, `screenshot`, `design system`, `mobile`, `breakpoint`, `responsive`.
- **Performance** — always fires.

Spawn the matching agents in parallel via `Agent` tool calls in a single message:
- `ship-performance` (sonnet, always)
- `ship-security` (sonnet, if trigger fires)
- `ship-design` (sonnet, if trigger fires)

Each receives:

```
END-OF-RUN <role> review
Branch: <current>
Base: <base-ref>
Diff scope: <base-ref>..HEAD
Lessons file: <LESSONS_ROOT>/<role>-lessons.md   (or "none")

Plan (verbatim):
<paste>

Trigger reason: <explain why this agent was spawned — file pattern X / keyword Y>

Hard rules:
- Cross-component / boundary defects auto-promote to critical.
- Findings without evidence are dropped.
- Return rubric + findings + verdict in the standard schema.
```

Collect all returned JSONs. **Deduplicate** findings across agents by `location_hash` (file:line_range) alone, NOT by rubric dimension: the panel agents share no dimension vocabulary, so a `(dimension, location)` key never matches across agents. If two agents flag the same location, keep the higher-severity one and merge the evidence from both (different dimensions can legitimately describe the same line, e.g. performance `render` and code-review `boundaries` on one bad provider).

### 4c — panel fix-loop

Aggregate verdicts from 4a (code-review) + 4b (panel). Worst CODE verdict wins; a `blocked` verdict is handled separately (below) and does not roll up.

- `blocked` (design: no dev server / no browser MCP; or security: `pnpm audit` can't run because deps aren't installed) → do NOT respawn the implementer and do NOT consume panel retry budget. Surface the setup action to the user (e.g. *"start the dev server with `pnpm dev`"*, or *"run `pnpm install` so audit can run"*), re-run only the blocked agent once resolved, and keep the other agents' verdicts.
- `green` / `minor` → proceed to Step 5. No marker commit is written: a passed panel leaves no git trace, and if the run is interrupted after this point, resume simply re-runs the panel over the same diff (it is read-only and idempotent, so a re-run re-confirms green).
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

After implementer commits → re-run 4a (code-review gate). If code-review now green, re-run 4b. Same-defect detector applies: if a panel agent's `currentMode` matches its prior `previousMode` → do NOT respawn a blind implementer; go to the panel auto-debug pass below.

Cap = 2 panel retries. When the loop is exhausted — same-defect tripped, or 3rd critical — run the **panel auto-debug pass** ONCE before escalating (guard with a run-level `panelDebugAttempted` boolean; fires at most once per run). Spawn one `ship-debugger` with the consolidated criticals (severity=critical only, deduplicated), the stuck panel failure modes, and `Diff scope: <base-ref>..HEAD (all phases)` — no per-phase triplet; instruct it to commit forward-only `fix: panel debug — <topic>`. After it returns: if it committed a fix → re-run 4a (then 4b if green); if it returned `blocked` or the panel is still critical → escalate to the user with the full remaining critical list plus the debugger's hypotheses. User decides: continue / fix manually / abort.

## Step 5 — retro

Spawn `ship-retro` (haiku) once. Spawn prompt includes:
- **Lessons root:** `<LESSONS_ROOT>` (or `none`). Retro reads/writes `<role>-lessons.md` under this root; if `none`, retro skips all lesson reads and writes (nothing to persist).
- Slug, today's date (ISO), outcome (`success | partial | aborted`).
- Phase count.
- Summarized JSON of all verifier verdicts + panel verdicts (just rubric scores + findings, not full reports), plus any ship-debugger verdict + fixed/blocked outcome.
- Branch name.
- **Aggregated `lessonConflicts`:** collect the `lessonConflicts` array from EVERY implementer / verifier / debugger / panel return across the whole run, tag each with the role that raised it, and pass the combined list. Retro relies on this to expire stale lessons; if you omit it, bad lessons are never flagged and keep mis-steering future runs.
- **Aggregated `userCorrections`:** throughout Steps 1–6, whenever the user overrides or redirects you — revises the plan after a `go`, rejects/edits a phase result, overrules a gate decision, corrects an agent's output, or changes direction after an escalation — record it as `{ "stage": "plan | phase <N> | panel | push", "role": "lead | implementer | verifier | code-review | security | performance | design", "whatWasWrong": "<what the agent/plan did>", "correction": "<what the user told you to do instead>" }`. Accumulate these in your context the same way you accumulate `lessonConflicts` (you are the ONLY one who sees them — retro cannot read the transcript). Pass the combined array here. These are the highest-signal input to retro's Mistakes lessons; an empty array is fine (a clean run), but never omit corrections you observed. Pre-`go` plan negotiation with the griller is NOT a correction — only count overrides after the plan is approved.

Retro decides per-agent whether the run produced a *surprise delta* worth recording. It writes to vault paths only — never to repo files. See `ship-retro` agent for the exact write protocol and template.

Retro auto-writes (no approval gate), so it returns the verbatim text of every lesson it wrote or expired, plus a run-scoped `whatDidntWork` array (dead-ends and abandoned approaches this run — not persisted as lessons). Carry the lessons AND `whatDidntWork` into the Step 7 handoff so the user can audit and prune.

## Step 6 — push + PR

> This step is lead-executed and intentionally inlined: PR-template detection, commit-style inference, and the 3-layer evidence body are ship-specific and have no canonical equivalent installed (the `github` plugin is an MCP *server*, not a spawnable PR agent). If you later install a canonical GitHub-PR agent that accepts a pre-built body, the lead MAY delegate the raw `git push` + `gh pr create` call to it — but the body-assembly rules below stay owned by ship. Do not route push/PR through a panel subagent; subagents cannot open PRs on the lead's behalf.

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

<one-paragraph synthesis of what shipped, derived from the griller dialog>

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

- <verbatim from the griller's out_of_scope>

## Fix-loop audit

- `<sha>` fix: <topic> — addressed: <findings>
- `<sha>` fix: phase <N> debug — <topic> (auto-debug pass; hypothesis: <the correct one>)
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
<one line per lesson retro wrote: "  + <role>: <Trigger>"; per expired: "  ~ <role> expired: <Trigger>"; or "  (none this run)">

What didn't work this run:
<one line per retro whatDidntWork entry: "  - <stage>: <what was tried> → <why it failed / how it was corrected>"; or "  (nothing notable)">

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
- Same-defect detector overrides the retry counter: an identical failure mode skips further blind respawns and goes straight to the one-shot auto-debug pass, then user escalation if still red. No budget burned on a repeat.
- Auto-debug (`ship-debugger`) fires at most once per phase (`debugAttempted`) and once per run for the panel (`panelDebugAttempted`), only after the respawn loop is exhausted, always before user escalation. It commits a forward-only `fix: … debug — <topic>`, or returns `blocked` if it can't build a repro loop. (Full behavior in Step 3c/4c.)
- A `blocked` verdict (environment/setup failure: no dev server, no browser MCP, missing deps, verification timeout) never enters a fix-loop and never consumes retry budget; it escalates to the user with a concrete setup action, then the blocked agent re-runs.
- Forward the aggregated `lessonConflicts` (from every agent return) to `ship-retro`; expiry of stale lessons depends on it.
- Cross-component / boundary defects auto-promote to critical regardless of agent's stated severity.
- Findings without `evidence` are dropped before any fix-loop decision.
- No `.ship/` filesystem state. Sprint contract recoverable via `git show` of phase commits; completed phases recoverable from `git log`. Only committed phases are recoverable — the uncommitted plan tail is not, so resume relies on the user to restate remaining phases.
- Resume is git-only. On re-invocation on an existing ship branch, reconstruct via Step 1.5 — never persist a resume file, never silently resume (always re-post recovered state and wait for `go`). A passed panel leaves no marker; resume re-runs the idempotent panel rather than writing a sentinel commit.
- Committed phases are immutable on resume — a re-plan continues numbering from highest committed N+1, never renumbers or rewrites committed phases.
- Screenshots (design agent) live in ephemeral `/tmp/ship-<unix-timestamp>/` — agent cleans on completion.

## Token hygiene

- Pass paths to subagents, not file contents (except plan + verbatim small strings).
- Don't embed full diffs in spawn prompts — subagents run `git diff` themselves.
- Don't read prior phases' code; rely on commit messages + `git log` for context across phases.
