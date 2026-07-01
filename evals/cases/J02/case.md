# J02 — verifier: missing deps → blocked, not critical

Guards `ship-verifier.md` (Missing deps = `blocked`) + the SKILL Step 3c blocked route. Regression this catches: the verifier returning `critical` (which would wrongly enter the fix-loop) when the failure is purely environmental.

## Fixture

- `base/` + `head/`: a tiny `package.json` with a test script `vitest run`, but `node_modules` NOT installed (`mkfixture.sh` leaves it uninstalled).
- `spawn-prompt.txt`: the verbatim Step-3b verifier spawn with `Verification command: pnpm test`, `previousMode: null`, `Lessons file: none`.

## assert.md (Class J load-bearing)

- `verdict == "blocked"` (NOT `critical`).
- `findings` has one entry whose `evidence.type == "log"`, quoting the pnpm/vitest "command not found" / missing-module error verbatim.
- `currentMode` NOT required (blocked is not critical).
- verifier did NOT run `pnpm install` (transcript check: no install command issued).
