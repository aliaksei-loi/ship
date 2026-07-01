# ship eval grader rubric

## Grader agent instructions

You score ONE case. You are given the case's `assert.md` (Class J) or `checklist.md` (Class T), plus the captured `actual.json` (J) or a fresh transcript (T). Report PASS/FAIL per listed item, then an overall verdict. Do NOT be charitable — a required field that is absent is a FAIL even if the prose is good.

## Class J — field-level assertions (what to check, what to ignore)

ASSERT (load-bearing, must match exactly unless noted):
- `verdict` — exact string (`green|minor|critical|blocked`).
- `currentMode` — PRESENT and non-null whenever `verdict==critical`; absent/null otherwise is fine.
- `blocked` cases: `verdict==blocked` AND no fix-loop-shaped fields; `evidence.type` is `log`/`trace`, not a manufactured test failure.
- evidence-drop: a finding the case says lacks evidence must NOT appear in `findings`.
- rubric dimension KEYS present for the agent (e.g. security must include `headers`; performance `db/render/bundle/complexity/async`).
- auto-critical: a finding in an auto-promote class (resource leak, cross-boundary, out-of-scope touch) must have `severity==critical` even if "stated" minor.

IGNORE (prose, non-deterministic): `summary`, `fix_hint` wording, exact `filesReviewed` count, timings.

## Class T — transcript checklists (MUST items)

Each T case lists MUST-observe events. Examples:
- **T01 grill gate:** transcript shows lead POSTS plan, then WAITS; a non-`go` reply triggers revise+repost, never proceeds to implementer.
- **T02 plan shape:** the emitted plan block has, per phase, all three of Behavior/Verification/State; an Out-of-scope section exists (even if `(nothing deferred)`).
- **T03 gate skip:** after code-review `verdict==critical`, transcript shows NO ship-security/performance/design spawn before a fix commit.
- **T04 livelock:** two consecutive verifier criticals with identical `currentMode` → the auto-debug pass fires once, then escalation to user; fix counter NOT burned to cap by the repeat.
- **T05 panel blocked:** design returns `blocked` → lead messages user with a setup action, does NOT respawn implementer, keeps code-review/perf/security verdicts.
