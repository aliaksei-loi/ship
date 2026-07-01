# T04 — same-defect livelock escalates without burning budget

Guards `SKILL.md` Step 3c + the hard rule "Same-defect detector overrides the retry counter." With v2.2, an identical failure mode now short-circuits into the one-shot auto-debug pass BEFORE user escalation.

## scenario.md

A phase whose verification fails the SAME way twice. Feed the lead:
1. Attempt 1: verifier return `verdict=critical`, `currentMode="auth.test:token-mismatch"`, `previousMode=null`.
2. After a `fix:` commit, attempt 2: verifier return with the SAME `currentMode` and `previousMode="auth.test:token-mismatch"` (identical mode).

## checklist.md (MUST)

- After the 2nd (identical-mode) critical, the lead does NOT respawn a blind implementer a 3rd time.
- The lead spawns `ship-debugger` ONCE (auto-debug pass) before any user escalation.
- If the debugger returns `blocked` or the re-run stays critical, the lead escalates to the user (continue / fix manually / abort).
- The per-phase fix counter is NOT burned to cap by the identical-mode repeat.

## golden-transcript.md

Committed excerpt of a known-good run showing: identical-mode detection → single ship-debugger spawn → escalation (no third implementer spawn).
