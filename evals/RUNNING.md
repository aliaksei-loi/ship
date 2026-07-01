# Running the ship evals

## Class D — scriptable, run first (fast, free)

```bash
node evals/lib/run-d.mjs        # walks evals/cases/D*/, asserts input.json → expected.json
```

Exit 0 = all D pass. Any diff between computed and `expected.json` fails loudly with the case id. Because `run-d.mjs` re-implements the SKILL rules in `lib/ship_rules.mjs`, a failure means EITHER a regression OR you changed the rule and forgot to update the fixture — both are signals worth stopping for.

Each D case dir holds `input.json` (`{ "fn": "<ship_rules export>", "args": [...] }`) and `expected.json` (the intended return; compared key-order-insensitively).

## Class J — agent-JSON conformance (one Claude session per case)

For each `evals/cases/J*/`:
1. Materialize the fixture repo: `bash evals/lib/mkfixture.sh evals/cases/J02` → prints a temp git repo with `base` committed on `main` and the fixture diff on `eval/case` (diff scope `main..HEAD`).
2. Spawn the target agent with the case's `spawn-prompt.txt` (verbatim — it mirrors what the lead sends), pointing at the temp repo.
3. Capture the agent's final JSON return to `actual.json`.
4. Grade against `graders/rubric.md` § "Class J assertions", asserting ONLY the load-bearing fields listed in the case. Prose (`summary`, `fix_hint`) is NOT asserted.

PASS = every listed field matches (verdict exact, `currentMode` present when required, evidence-drop honored, dimension keys present).

## Class T — golden-transcript rubric (human or grader agent)

Each `evals/cases/T*/` ships a `checklist.md` of MUST-observe events and (optionally) a `golden-transcript.md` reference. After a SKILL edit:
1. Re-run the scenario in the case against the edited skill, capturing a fresh transcript.
2. Score it against the checklist (also in `graders/rubric.md` § "Class T").

PASS = all MUST items observed. The golden transcript is the reference for what "right" looks like; re-bless it after an intentional behavior change.

## Definition of a passing suite

- All Class D green (`run-d.mjs` exit 0). **Mandatory before merge.**
- All Class J load-bearing assertions pass. **Advisory** — run the cases whose surface you touched.
- All Class T MUST checklist items observed. **Advisory** — same.

Note in the PR which classes you actually ran. D is cheap and mandatory; J/T are per-edit.
