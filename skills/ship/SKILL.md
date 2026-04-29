---
name: ship
description: End-to-end feature workflow — grills the user on the idea, generates a multi-phase plan, then runs a dedicated agent team (implementer, verifier, reviewer, visual-qa, retro) phase-by-phase on a dedicated branch (worktree by default, or `--here` in the current checkout). Invoke when the user runs `/ship <idea>` or says "ship this", "let's ship", "from idea to branch". Replaces /ticket and /orchestrate for net-new feature work.
metadata:
  version: "1.0.0"
---

You are the **team lead** for the `/ship` workflow. The human gave you a feature idea. Your job: take it from raw idea to a ready-to-review branch via three phases — grill, plan, team — pausing only at one approval gate and on hard failures.

The flow is fixed. Do not improvise. Surface decisions to the human only at the gate or on blockers.

## Prerequisites (fail fast)

1. CWD must be a git repo. If not: abort — *"Run /ship from inside the target repo."*
2. `gh` CLI must be available. If not: warn but continue (PR step is manual anyway).
3. Default branch resolved: `base-ref=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')` → fallback to `main`.

## Step 0 — sweep stale ship/* worktrees and orphan state dirs

Before starting a new run, tidy. Sweep runs in both modes regardless of how the user invoked ship — both kinds of stale state can accumulate.

**Worktrees:**

```bash
git worktree list --porcelain
```

For each worktree under `.worktrees/<slug>/` whose branch is `ship/<slug>`:
- If `git rev-parse --verify ship/<slug>@{upstream}` errors with "no upstream" → leave alone (work in progress).
- If `git for-each-ref --format='%(upstream:track)' refs/heads/ship/<slug>` returns `[gone]` → branch was merged + deleted upstream. Run `git worktree remove "<path>"` then `git branch -D "ship/<slug>"`.
- If `git merge-base --is-ancestor ship/<slug> origin/<base-ref>` succeeds → branch fully merged to base. Same removal.

**Orphan state dirs (`--here` leftovers):**

After the worktree sweep, list `<repo-root>/.ship/*/`. For each `<slug>`:
- Skip if `.worktrees/<slug>/` still exists (the worktree branch above already handled it).
- If branch `ship/<slug>` is absent locally → orphan, `rm -rf` the state dir.
- If `git for-each-ref --format='%(upstream:track)' refs/heads/ship/<slug>` is `[gone]` → `rm -rf` the state dir AND `git branch -D "ship/<slug>"`.
- If `git merge-base --is-ancestor ship/<slug> origin/<base-ref>` succeeds → same removal.
- Otherwise → leave alone (in-progress on this or another machine).

Show what got swept (one line per removed item, prefixed `worktree:` or `state:`). Silently skip if nothing to clean.

## Step 1 — slug, mode, branch setup

**Slug** (mode-independent): auto-derive from `<idea>` — kebab-case **at most 4 meaningful words** (drop articles: a, the, of, to, and, for, in, on; drop generic verbs at the start: implement, add, create, build, make — they don't add information). Example:

- `implement light/system/dark modes` → `light-system-dark-modes` (drop "implement", split slashes)
- `add user dashboard analytics widget` → `user-dashboard-analytics-widget` (drop "add")
- `build new homepage hero section` → `homepage-hero-section` (drop "build", drop "new")

Cap at 4 words for clean branch names + PR titles. Don't ask, just proceed.

**Mode selection:**

- `/ship <idea>` → **worktree mode** (default). Operates in a sibling directory `<repo-root>/.worktrees/<slug>/`.
- `/ship --here <idea>` → **`--here` mode**. Operates in the main checkout. Use when you want ship to run on the same checkout you have open in your editor.

If a resume is detected (Step 2), the on-disk state dictates the mode and any `--here` (or its absence) on this invocation is ignored.

`repo-root=$(git rev-parse --show-toplevel)` is set in both modes.

**Gitignore (both modes):** ensure `.worktrees/` and `.ship/` are gitignored on the main checkout. If either is missing from `.gitignore`, append + commit immediately on main with message `chore: gitignore .worktrees/ + .ship/`. Do this BEFORE the next step so phase commits don't leak metadata.

### Worktree mode (default)

1. `worktree-path=$repo-root/.worktrees/<slug>`
2. **Branch off LOCAL `<base-ref>`, not `origin/<base-ref>`.** Reason: local main may have commits (like the gitignore above) that haven't been pushed; branching off `origin/<base-ref>` would miss them and leak metadata into phase commits.
3. Run Step 1a (local-vs-origin sanity check).
4. `git worktree add "$worktree-path" -b "ship/<slug>" "<base-ref>"`
5. `cd "$worktree-path"`

**State dir:** `<worktree-path>/.ship/<slug>/`.

### `--here` mode

1. **Collision check:** if a live worktree already holds `ship/<slug>` (from `git worktree list --porcelain`), refuse — *"Worktree at `<path>` already holds branch `ship/<slug>`. Resume there, or `git worktree remove "<path>"` and re-run."* (Step 0 has already swept stale worktrees, so this only fires on truly live ones.)
2. **Dirty-tree check:** `git status --porcelain` must be empty. If not, refuse — *"Working tree not clean. Commit, stash, or discard before /ship --here."*
3. **Branch decision (create-or-resume):**
   - `ship/<slug>` does not exist → run Step 1a, then `git checkout -b "ship/<slug>" "<base-ref>"`.
   - `ship/<slug>` exists, current `HEAD` is `ship/<slug>` → continue.
   - `ship/<slug>` exists, `HEAD` is something else → `git checkout "ship/<slug>"` (clean tree was verified in step 2 above). Print *"Auto-checked-out ship/<slug> from <prior-branch>."*
4. CWD stays at `<repo-root>` (do not `cd`).

**State dir:** `<repo-root>/.ship/<slug>/`.

### Step 1a — local-vs-origin sanity check
Run before creating a fresh `ship/<slug>` branch (worktree mode always; `--here` mode only when the branch doesn't yet exist). Check whether local `<base-ref>` is behind `origin/<base-ref>`:

```bash
git fetch origin "<base-ref>" --quiet
behind=$(git rev-list --count "<base-ref>..origin/<base-ref>")
ahead=$(git rev-list --count "origin/<base-ref>..<base-ref>")
```

- `behind > 0`: warn the human — *"Local `<base-ref>` is behind `origin/<base-ref>` by N commit(s). Continue from local (potentially stale), or pull first?"* Default offer: pull. Wait for human reply.
- `ahead > 0`: local has unpushed commits (gitignore commit, or earlier work). Proceed silently — the new branch will include them, which is what we want.
- both zero: clean, proceed.

## Step 2 — resume detection

Run before any branch/worktree creation in Step 1.

**Mode detection (resume case):**
- `<repo-root>/.worktrees/<slug>/.ship/<slug>/` exists → worktree-mode resume. Any `--here` flag on this invocation is ignored.
- `<repo-root>/.ship/<slug>/` exists AND no `.worktrees/<slug>/` → `--here`-mode resume.
- Both exist → corrupt state, refuse — *"Both worktree and `--here` state exist for ship/<slug>. Inspect and remove one before resuming."*
- Neither exists → fresh start in the mode the human chose via flag (or default = worktree).

**Resume table** (state dir = whichever path the mode detection above selected):

| Files present in state dir | Next phase |
| --- | --- |
| nothing | fresh start |
| `context.md` only | re-run prd-to-plan |
| `plan.md`, no `approved` marker | approval gate |
| `approved` marker, no `phase-1.commit` marker | implement phase 1 |
| `phase-N.commit` marker present, more phases in plan | implement phase N+1 |
| all phase markers present, no `retro.done` | retro |
| `retro.done` | already shipped — print handoff and stop |

Show: *"Resuming ship/<slug> (<mode>) — last phase: <N>. Continue? [y/N]"*. On no, ask whether to wipe the state dir (and worktree, if applicable) and restart.

**`--here` resume extras:** clean-tree check still applies — refuse if `git status --porcelain` is non-empty. If `HEAD` is not `ship/<slug>`, auto-checkout (clean tree was just verified) and print *"Auto-checked-out ship/<slug> from <prior-branch>."*

## Step 3 — grill phase

Invoke the `grill-me` skill with the idea as input. Let grill-me run to completion (it ends naturally when the human is satisfied).

After grill-me concludes, **summarize the resolved decisions** into `<state-dir>/context.md` (the **State dir** path defined in Step 1 — `<worktree-path>/.ship/<slug>/` in worktree mode, `<repo-root>/.ship/<slug>/` in `--here` mode):

```markdown
# Ship context: <slug>

## Idea
<original idea, verbatim>

## Resolved decisions
- <key decision 1 — short>
- <key decision 2>
...

## Out of scope
- <explicitly excluded>

## Open questions for plan
- <if any — but try to resolve in grill before exit>
```

Keep it tight — this is the input to plan generation, not a PRD. 30–80 lines max.

## Step 4 — plan generation

Invoke the `prd-to-plan` skill, instructed to **treat `.ship/<slug>/context.md` as PRD-equivalent and write the plan directly to `.ship/<slug>/plan.md`**. If prd-to-plan defaults to `./plans/` regardless, move the file after completion:

```bash
[ -f "./plans/<slug>.md" ] && mv "./plans/<slug>.md" ".ship/<slug>/plan.md"
[ -d "./plans" ] && rmdir "./plans" 2>/dev/null  # only if empty
```

The plan must have multiple `## Phase` sections — verify before continuing. If 0 phases, surface to the human and stop.

## Step 5 — Gate 1 (HUMAN, plan approval)

Post:

```
Plan ready for ship/<slug>: .ship/<slug>/plan.md

[paste plan inline]

Approve? Reply "go" / "approved" / "ok" to start the team.
Reply with changes to request revisions.
```

Wait for explicit go. On approval: `touch .ship/<slug>/approved`.

On revision: edit `plan.md`, repost, wait again.

## Step 6 — phase-by-phase team loop

For each phase in `plan.md`, in order:

### 6a — implementer
**Precondition (`--here` mode only):** verify `git symbolic-ref --short HEAD` returns `ship/<slug>`. If not — abort the run; the human checked out away mid-flight. Don't auto-fix here (different from Step 2 resume): mid-run drift means something else is wrong.

Spawn one teammate using `ship-implementer`. Spawn prompt includes:
- `cwd` = worktree path (worktree mode) or `<repo-root>` (`--here` mode)
- Branch = `ship/<slug>`
- Path to `.ship/<slug>/plan.md` (relative to `cwd`)
- Path to `.ship/<slug>/context.md` (relative to `cwd`)
- **The phase number and title to implement** (e.g. *"Implement phase 2: 'Wire dashboard data fetcher'"*)
- Hard rule: implement only this phase, commit with message `phase <n>: <title>`, then return.
- On ambiguity: stop and message lead.

Wait for done or blocker. Resolve blockers same as /ticket: try to answer from plan/context first, escalate to human only if a real decision.

After implementer signals done:
- Verify: `git log <base-ref>..HEAD` includes `phase <n>: <title>`.
- `git status --porcelain` empty.
- Touch `.ship/<slug>/phase-<n>.commit`.

### 6b — verify + review (always parallel)
Spawn in parallel:
- **ship-verifier**: runs tests on the branch, writes `.ship/<slug>/phase-<n>-verifier.md`, emits JSON `{testCommand, testExitCode, testsPassed, testsFailed, notes}`.
- **ship-reviewer**: reads diff `<base-ref>..HEAD`, writes `.ship/<slug>/phase-<n>-reviewer.md`, emits JSON `{findings: [{severity, file, line, note}], filesReviewed, summary}`.

### 6c — visual-qa (conditional, parallel with verify+review)
Spawn `ship-visual-qa` ONLY if any signal matches:

- Plan or context contains `figma.com/`.
- Plan or context mentions: `mockup`, `screenshot`, `design system`, `mobile`, `breakpoint`, `responsive`.
- Phase commit changed any file matching: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.module.*`, `*.vue`, `*.svelte`.

Check signals:
```bash
git diff --name-only "<base-ref>..HEAD" | grep -E '\.(tsx?|jsx?|css|scss|module\.[a-z]+|vue|svelte)$'
grep -lE 'figma\.com|mockup|screenshot|design system|mobile|breakpoint|responsive' .ship/<slug>/plan.md .ship/<slug>/context.md
```

If signals present, spawn visual-qa with phase context. It writes `.ship/<slug>/phase-<n>-visual.md` and emits JSON `{findings, screenshotsTaken, summary}`.

### 6d — gate-on-failure
Wait for verifier + reviewer (+ visual-qa if spawned). Decision rules:

| Condition | Action |
| --- | --- |
| verifier `testExitCode == 0` AND no `critical` reviewer findings AND (no visual-qa OR no `critical` visual findings) | auto-continue to next phase |
| any `critical` finding from any agent | **STOP**, show consolidated report, ask human: *"Continue, fix, or abort?"* |
| only `minor` findings | auto-continue, surface in final summary |

On STOP — wait for human direction. If "fix": dispatch implementer again **with the consolidated findings JSON as input** (max 2 fix loops per phase, then escalate). If "abort": stop the run, leave state on disk for resume.

### Fix-loop spawn-prompt template

When the human says "fix", spawn `ship-implementer` again with this addendum to the original phase prompt:

```
**FIX LOOP (attempt <N> of 2)**

The previous attempt at this phase produced critical findings. Address ONLY the findings below — do not refactor, redesign, or address other issues you spot. Re-commit the phase with the same `phase <n>: <title>` message (amend or new commit, your choice; if new commit, the verifier will only see the latest one).

Critical findings to address:
<paste verifier failure JSON if testExitCode != 0>
<paste reviewer findings array filtered to severity=="critical">
<paste visual-qa findings filtered to severity=="critical">

Acceptance for this fix loop: ALL listed criticals resolved. Do not introduce new files outside the original phase scope.
```

After implementer completes the fix, re-run verifier + reviewer + (if previously fired) visual-qa. If still red after attempt 2, **stop and escalate to the human** — do not auto-loop a third time.

Loop to next phase. After last phase, proceed to retro.

## Step 7 — retro

Spawn `ship-retro` once. Spawn prompt:
- Path to all `.ship/<slug>/phase-*.{verifier,reviewer,visual}.md`
- Path to `plan.md` and `context.md`
- Slug + date (today, ISO)
- Final outcome: success / partial / aborted
- Phase count

Retro reads each role's per-phase reports, then **writes directly** with provenance tags to:

- `~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship/implementer-lessons.md`
- `~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship/reviewer-lessons.md`
- `~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship/verifier-lessons.md`
- `~/Documents/AL Obsidian/AL/Claude/Sessions/_agents/ship/visual-qa-lessons.md` (only if visual-qa ran)

Each entry tagged: `<!-- ship/<slug> YYYY-MM-DD -->`. See `ship-retro` agent for format.

After retro: `touch .ship/<slug>/retro.done`.

## Step 8 — push + open PR

`/ship` ends with the work visible for review. Push the branch, open a PR with an auto-generated title + body, then print the handoff.

```bash
git push -u origin "ship/<slug>"
```

Build the PR title from the slug. Default form: `feat: <human-cased slug>` (drop leading verb if it duplicates `feat:` — e.g. `add-foo` → `feat: add foo`, `implement-light-system-dark-modes` → `feat: light/system/dark modes` after collapsing kebabs back to readable English). Use your judgment.

Build the PR body as a structured summary (NOT the raw plan dump). Template:

```markdown
## Summary

<one-paragraph synthesis of what shipped, derived from context.md "Resolved decisions">

## Phases

- **Phase 1 — <title>**: verifier ✓ · reviewer <crit>/<minor> · visual ✓
- **Phase 2 — <title>**: ...
- ...

## Open design questions

<bullets from per-phase reports flagged "deferred to handoff" — only if any>

## Lessons added (Obsidian)

- implementer (<n>), reviewer (<n>), verifier (<n>)<, visual-qa (<n>)>

## Plan

<details><summary>Full plan (`.ship/<slug>/plan.md`)</summary>

<inline the plan.md contents here, since `.ship/` is gitignored and won't be in the branch>

</details>
```

Open the PR:

```bash
gh pr create --base "<base-ref>" --head "ship/<slug>" \
  --title "<title>" \
  --body "<body>"
```

Capture the returned URL.

## Step 9 — handoff summary

Post (mode-aware lines marked; render only the line for the active mode):

```
🚢 SHIP DONE — <slug>

Mode:     <worktree | in-place (--here)>
Worktree: <worktree-path>             ← worktree mode only
You are on: ship/<slug>               ← --here mode only
Branch:   ship/<slug>
Base:     <base-ref>
PR:       <url>

Phases (<N>):
  1. <phase-title> — verifier ✓ reviewer (<critical>/<minor>) [visual ✓]
  2. ...

Lessons added:
  implementer (<count>), reviewer (<count>), verifier (<count>) [, visual-qa (<count>)]

Open design questions (if any):
  - <surface from per-phase visual/reviewer reports>

Next:
  Review the PR: <url>
  After merge, the next /ship run sweeps:
    - this worktree                   ← worktree mode
    - the .ship/<slug>/ state dir     ← --here mode
  You can also run /clean_gone manually to remove it now.
```

Do NOT merge the PR yourself. Do NOT remove the worktree or state dir (sweep happens at next /ship invocation, or via /clean_gone).

## Hard rules

- Default to a worktree. `--here` runs in the main checkout but refuses on a dirty tree, and refuses if a live worktree already holds `ship/<slug>` for the same slug.
- One Gate only (Step 5, plan approval). Never auto-approve the plan.
- Never invent phases — execute what `plan.md` says.
- Never silently skip a phase. Failure → stop and ask.
- Push and open a PR at Step 8 — but never **merge** the PR yourself; the human reviews and merges.
- Never delete `.ship/<slug>/` mid-run. Resume needs it.
- Visual-qa fires conditionally based on signals — do not force-run on every phase.

## Token hygiene

- Don't read full plan/context back into your context across phases — you have them on disk.
- Don't read full diffs unless deciding on a fix loop. Trust agent reports.
- Each subagent's prompt should reference paths, not embed file contents.

## Quality gates summary

| Gate | Enforced by | On failure |
| --- | --- | --- |
| Git repo | skill check | abort |
| Default branch resolvable | skill check | warn, default `main` |
| Slug derivable | skill check | ask human |
| Plan has phases | skill check | abort, ask human |
| Plan approval | human reply | wait |
| Implementer ambiguity | subagent prompt | blocker escalation |
| Verifier exit 0 | JSON | fix loop (max 2) |
| No critical reviewer findings | JSON | fix loop (max 2) |
| No critical visual findings (if ran) | JSON | fix loop (max 2) |
| Retro lessons written | retro agent | warn, continue handoff |
