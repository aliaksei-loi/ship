# ship evals

Regression guard for the /ship **workflow** (not for the code /ship ships). Run before merging any edit to `skills/ship/SKILL.md` or `agents/*.md`.

## Why this exists

Both Anthropic agent guides say "start with evaluation." /ship is LLM-driven, so full end-to-end automation is infeasible and claiming it would be a lie. Instead we test the **deterministic contracts** the LLM is required to honor: the trigger lists, the dedup key, the verdict rollup, the retry-cap arithmetic, the same-defect detector, and the blocked-vs-critical routing.

## Three case classes (honest about runnability)

| Class | What it tests | How it runs | Determinism |
|---|---|---|---|
| **D** deterministic | pure rule functions: trigger-eval, dedup, verdict-rollup, cap math | `node evals/lib/run-d.mjs` asserts fixture inputs → `expected.json`, NO LLM | fully deterministic; also a spec-drift alarm |
| **J** agent-JSON | one agent's JSON return given a synthetic diff + real spawn prompt | grader agent (or human) spawns the agent in a throwaway fixture repo, diffs return vs `expected.json` on load-bearing fields | near-deterministic on verdict/mode/evidence fields; prose ignored |
| **T** transcript | multi-step lead routing (gate skip, fix-loop, livelock) | grader agent or human scores a committed golden transcript against `graders/rubric.md` | rubric-scored, not asserted |

See [`RUNNING.md`](RUNNING.md) for exact commands, and [`graders/rubric.md`](graders/rubric.md) for the pass/fail definition Class J and T share.

## Honest coverage

Of ~26 planned cases, 12 (Class D) are true push-button automation. The other ~14 (J + T) are agent- or human-scored, advisory per-edit. If you expect a green-button CI over the whole suite, that expectation is wrong for an LLM orchestrator — only Class D is CI-gateable. All D cases are authored and runnable. `D04`, `J02`, and `T04` additionally carry a written spec (`case.md`); the J/T fixture files themselves (base/head trees, `spawn-prompt.txt`, golden transcripts) are NOT yet materialized — author them from the case spec before running those classes (`mkfixture.sh` fails loudly on a case with no fixture trees).

## Case index

| ID | Class | Guards | v2.x |
|---|---|---|---|
| D01 | D | security trigger fires on `*auth*` file | |
| D02 | D | security trigger fires on plan keyword `payment`, no matching file | |
| D03 | D | design trigger fires on `.tsx`, perf always-fires, security skipped | |
| D04 | D | dedup merges two findings on same `location`, keeps higher severity, unions evidence | 2.1 |
| D05 | D | dedup does NOT merge across different locations even w/ same dimension name | 2.1 |
| D06 | D | verdict rollup: worst-of code verdicts; `blocked` does not roll up | 2.1 |
| D07 | D | retro lessons cap: 100 lines is within cap (inclusive boundary) | 2.4 |
| D08 | D | retro lessons cap: 101 lines is over cap | 2.4 |
| D09 | D | retry cap: attempt 2 is within the per-loop cap of 2 | 2.4 |
| D10 | D | retry cap: attempt 3 is over cap | 2.4 |
| D11 | D | same-defect detector fires on identical `currentMode` across attempts | 2.4 |
| D12 | D | same-defect detector does NOT fire when there is no prior mode | 2.4 |
| J01 | J | verifier red test → verdict critical + `currentMode` present | |
| J02 | J | verifier missing-deps → verdict `blocked` (not critical), log evidence | 2.1 |
| J03 | J | verifier timeout >5min → `blocked` | 2.1 |
| J04 | J | code-review resource-leak → auto-critical regardless of stated severity | |
| J05 | J | code-review out-of-scope file touched → critical | |
| J06 | J | code-review finding without evidence is self-dropped | |
| J07 | J | design no dev server → `blocked` (not critical), single trace finding | 2.1 |
| J08 | J | security wildcard CORS + credentials → critical, `headers` dimension present | 2.1 |
| J09 | J | retro applies one lessonConflict → entry gets `expired-by ` prefix, returns `lessonsExpired` | 2.1 |
| J10 | J | implementer given contradicting lesson → follows task, emits `lessonConflicts` | |
| T01 | T | grill gate: lead will not proceed past plan without explicit go/approved/да | |
| T02 | T | tracer-bullet plan shape: every phase has Behavior/Verification/State + Out-of-scope | |
| T03 | T | sequential gate: code-review critical → trio NOT spawned | |
| T04 | T | same-defect livelock: identical `currentMode` → escalation, retry budget not burned | |
| T05 | T | panel blocked (design, no dev server) → user routed, other verdicts kept, no respawn | 2.1 |

(26 cases: 12 D, 10 J, ~5 T. `2.x` marks the version whose audit/remediation batch introduced the guarded behavior.)
