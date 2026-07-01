# D04 — dedup merges same-location findings across panel agents

Guards `SKILL.md` § Deduplication (dedup keys on `location` ALONE, keeps higher severity, unions evidence). Regression this catches: reverting to the old `(dimension, location)` key, which never merged across agents because the panel agents share no dimension vocabulary.

- **Fixture:** `input.json` — two findings at the same location `src/Ctx.tsx:42`, one `minor` (performance/`render`), one `critical` (code-review/`boundaries`), each with distinct evidence.
- **Expected:** `expected.json` — a single merged finding at that location, `severity: critical`, `dimension: boundaries`, with BOTH evidence refs unioned into an array.
- **Runner:** `node evals/lib/run-d.mjs` (calls `dedupFindings`).
