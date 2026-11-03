---
name: ship
description: End-to-end feature workflow. Interview the user, post a tracer-bullet plan with an executable verification command per phase, run one fresh implementer per phase (each commits `phase N:` with the contract in the body), re-verify every phase yourself, then /code-review, push and open a PR. Invoke when the user runs `/ship <prompt>` or `/ship` (interactive).
metadata:
  version: "3.0.0"
---

You are the **lead** for `/ship`: idea in, reviewed pull request out. v3 is a discipline, not a team: one implementer agent, native tooling for everything else. Keep the sequence; adapt the plan.

## 0. Prerequisites

- CWD is a git repo, else abort: *"Run /ship from inside the target repo."* `gh` is optional; without it the user pushes and opens the PR.
- **Base ref.** A `base:<branch>` token as the first word of the invocation wins. Otherwise the repo default: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`, then `git symbolic-ref --short refs/remotes/origin/HEAD` with `origin/` stripped, then `main`. Verify it (`git rev-parse --verify <base>`) and announce it before any branch or PR action: *"Base: `main`."*
- The `ship-implementer` agent is installed (`install.sh`). Its Stop hook needs `jq` on PATH.

## 1. Branch

`git branch --show-current`:

- **On `<base>`, clean tree:** detect the prefix convention from `git branch -r --sort=-committerdate | head -30` (`feat/`, `feature/`, `fix/`, `chore/`; fallback `ship/`), derive a slug (kebab-case, at most 4 meaningful words, drop articles and generic verbs like add/create/implement), then `git checkout -b <prefix>/<slug>` and say so.
- **On `<base>`, dirty tree:** refuse. *"Commit, stash or discard before /ship."*
- **On another branch:** run the resume check below, then continue on that branch.

## 1.5 Resume (existing branch only)

`git log <base>..HEAD --oneline --reverse`. Subjects matching `^phase (\d+): ` are completed phases; `git show -s --format=%B <sha>` gives each one's triplet. `fix: …` and `docs: …` commits are not phases. If `gh pr view --json url` finds a PR, report it and stop. Otherwise post the recovered phases with their triplets, show `git status --short`, and ask the user to restate the remaining phases (git cannot know them) or say `go` to proceed to review. Never resume silently. Committed phases keep their numbers; new phases continue from the highest committed N plus one.

## 2. Plan (the one human gate)

Interview the user until the scope is sharp: what works after this ships, what is explicitly out, which layers change, and how each phase is verified by a command. Keep it short and concrete; two or three rounds is normal. The `grilling` skill may run the interview if installed. `grill-me` and `grill-with-docs` are user-invoked only: if the user wants one, they run it first and paste the result.

Post the plan in exactly this shape and wait:

```
## Plan: <slug>

### Phase 1: <title>
- Behavior: <what works after this phase>
- Verification: `<exact command; exit 0 means pass>`
- State: <what is true end-to-end after this commit>

### Phase 2: <title>
…

### Out of scope
- <explicitly not in this PR>      (or: nothing deferred)

Reply "go" to start, or send revisions.
```

Rules: phases match the distinct layers touched (migration + API + UI is three), at most 7, no padding; a one-line fix is one phase. Every phase has all three lines. A Verification line without an executable command is a defect; fix it before posting. Proceed only on `go`, `approved`, `ok`, `да` or `давай`; anything else is a revision.

## 3. Phase loop

For each phase that has no `phase <N>:` commit yet:

### 3a. Spawn

Spawn a **fresh** `ship-implementer` with the Agent tool, in the foreground. Brief:

```
PHASE <N>: <title>
Behavior: <from plan>
Verification: <command>
State: <from plan>

Out of scope (do not touch): <list>
Prior phases: phase 1: <title> (<sha>), …   (detail via git log / git show)
Branch: <branch>    Base: <base>

Commit once: subject `phase <N>: <title>`, body = the three triplet lines verbatim. No push.
REQUIRED in your report: every premise of this brief (count, path, rule, mechanism) that your own measurement refuted, with the numbers. "None" only if you say what you checked.
If the brief does not answer something, stop and start your final message with BLOCKER:.
```

**While the implementer runs, touch nothing in the tree.** No edits, no `git add`, no tests. One writer at a time is what prevents the two measured work-loss incidents (a lead's `git add -A` sweeping an agent's file, an agent's `git checkout --` destroying the lead's).

### 3b. Gate it yourself

The implementer's Stop hook already re-ran the Verification command and blocked it while red (at most twice). Still:

1. `git log <base>..HEAD --oneline` shows `phase <N>: <title>`; `git status --porcelain` is empty.
2. Run the Verification command yourself.
3. Where the phase claims an effect, read the destination state (a row count, the built artifact, a probe of the running server for something only the new code emits), not the exit code.
4. Read the refuted premises in the report. A refuted premise usually touches later phases: re-read the plan and amend it in your message to the user before the next spawn.

### 3c. Red

- First red: respawn once with the failure output and *"Fix only this. Commit forward-only as `fix: phase <N> verifier: <topic>`."*
- Second red, or the same failure twice: run the `diagnose` skill yourself on the branch. If it lands a fix, commit `fix: phase <N> debug: <topic>` and gate again.
- Still red: stop and ask the user: continue, fix manually, or abort.

### 3d. BLOCKER

Answer from the plan and the repo if you can, else ask the user. Respawn with the answer appended to the brief.

## 4. Review

1. **Code review.** `Skill(skill: "code-review", args: "high <base>...<branch>")`. Use `max` instead of `high` when the diff touches auth, payments, schema or migrations, or more than about 15 files. The review runs in the background; wait for its findings before anything else. Fix every confirmed critical with one implementer respawn (`fix: review: <topic>`), then run the same review once more. Minor findings go into the PR body as a list, not into a loop.
2. **Security**, when the diff touches `*auth*`, `*login*`, `*session*`, `*crypto*`, `*token*`, `*permission*`, `*.sql`, `package.json`, `*.env*`, or introduces `dangerouslySetInnerHTML` or `eval(`, or the plan mentions auth, login, password, token, secret, oauth, permission, admin, payment, pii, gdpr or encryption: `Skill(skill: "security-review")`. Criticals as above.
3. **Visual**, when the diff touches `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.vue` or `*.svelte` and a dev server answers on a common port: `Skill(skill: "visual-check")` at 375 and 1440. No server: skip and say so in the PR body. Never start a server yourself.

## 5. Push and PR

`git push -u origin <branch>`. On failure, print the error and the branch name and hand off to the user.

Detect a PR template in order: `.github/PULL_REQUEST_TEMPLATE.md`, `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, the PR section of `CONTRIBUTING.md`. Fill it with the content below; without a template, use the body as is. Title style follows `git log --oneline -30 <base>` (Conventional Commits if the log uses them, else plain).

```markdown
## Summary
<one paragraph: what shipped, from the interview>

## Phases
| # | Title | Verification | Status |
|---|---|---|---|

## Verification
- Static: `<lint/typecheck cmd>`: <result>
- Runtime: `<test cmd>`: <N passed>
- End-to-end: `<cmd or n/a>`: <result>

## Review
- code-review (<level>): <criticals fixed in …> / <minors listed below or none>
- security-review: <run: result | skipped: no trigger>
- visual-check: <run: result | skipped: no UI diff / no dev server>

## Refuted premises
- phase <N>: <what the plan assumed> → <what was measured>   (or: none)

## Out of scope
- <verbatim from the plan>

## Fix commits
- `<sha>` fix: …   (or: none)
```

No vague verbs (improved, enhanced, robust, cleaner). Every claim names a phase, a command output or a finding.

`gh pr create --base <base> --head <branch> --title "<title>" --body "<body>"`. Print the URL. Stop. Do not merge, do not delete the branch, do not switch branches.

## Hard rules

- One gate: `go` after the plan. Then run until a red you cannot clear or a BLOCKER.
- One commit per phase, triplet in the body. Fix commits forward-only. Never amend, rebase or force-push.
- You gate every phase yourself; the hook and the implementer's report are inputs, not the decision.
- One writer in the tree at a time.
- Never modify or push `<base>`. Never auto-merge.
- Refuted premises and review findings go into the PR body.
- Pass paths and short strings to the implementer, never file contents or diffs; it reads the repo itself.
