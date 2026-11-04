# ship-implementer memory

Seeded from 45 `/ship` v2 runs (May to September 2026). Stack-specific lessons live in each project's own docs; what is here is stack-agnostic. Add an entry when a run teaches you something that will recur in another repo. Keep entries to two lines. Delete what stops being true.

## Before you start

- The brief is a hypothesis. Every count, path, rule and mechanism in it was written from one symptom its author saw. Grep the real call sites, count from the catalog or the resolved config, and construct the legitimate case a proposed rule would false-positive on. Report each refutation with the number you measured. When this was required, every phase of a 7-phase run refuted at least one premise and two refutations prevented shipped regressions.
- A finding names a sample of a class, not the class. Enumerate the full set from the source of truth (schema, config object, component registry), fix the class in one pass, and add a guard so the hand-maintained list cannot re-form. Fixing exactly the named instances produced three consecutive critical rounds on one file.
- Smallest solution first. Grep for an existing helper, stdlib call or dependency before writing a new one, and read the whole flow you are entering, not only the lines you will touch.
- Before building mutual exclusion or a compare-and-set on a store or ORM primitive, read its implementation in `node_modules`. Signatures lie about atomicity; a where-conditioned update that is find-then-update admits K winners.
- Any table keyed by user or CMS text is a `Map` or `Object.create(null)`, never an object literal: the word `constructor` resolves through the prototype chain.
- Every phase changes something a later phase assumed. After a refutation, say which later phases it touches.

## Before you report green

- Exit 0 and a script's own summary line are not evidence. Query the destination for the state the action should have produced (row counts including join tables, a read-back of one record, byte totals) and put the numbers in the report. A runner that exits 0 having executed nothing is indistinguishable from one that worked.
- A gate must go red on a planted defect before its green means anything. Prove both directions and report both. A type gate once passed `const x: number = 'str'` for a whole repo.
- A mutation that passes measures the assertion, not the code. Confirm the mutation landed (count occurrences), the oracle can see the field (`JSON.stringify` drops keys valued `undefined`), and the test consumes the same input the product does.
- A name-filtered run (`-t`, `-k`, `--filter`) that matches nothing exits 0. Assert the executed count, and that it rose when the phase added tests.
- A long-running local process serves the code it booted with. Probe it for a marker only the new code emits before reading any exit code; restart it when the change touches config it reads once.
- Scoped type-check plus unit tests do not exercise the repo's own guard scripts (import boundaries, a `verify.sh`, cache-input rules). Run the repo's full gate at every phase commit and name what a scoped run skipped.
- A check that derives its expected value from the same source as its subject cannot fail. For every assertion, name the edit that would red it; if none exists, the check is decorative.
- Interpolate measured numbers into prose from the run that measured them, and name the population they were measured over. Typed numbers drift from the code that produced them.
- Bound every derived figure against a physical limit you know (RAM, disk, wall clock, an origin's rate cap) before publishing it. A published 3,162 GB peak was a wrong denominator.
- Never aim a destructive tool at production data to prove a guard. Assert refusal with the real value you read, route child runs to a scratch target, and treat a leg that consumes its whole timeout as a failure.
- A proof suite that imports the rule functions cannot see failures in the entry point between them. Spawn the real entry point as a subprocess against malformed input and assert on its exit code and error text.

## Classes reviewers caught after green gates

Check your own diff for these before you commit.

- A hook that swallows its own error while sharing the caller's transaction (`req`) aborts the parent write silently: the swallowed error lets the framework commit, and the database turns that commit into a rollback. Omit the shared transaction or let the error propagate.
- Client-settable headers (`x-forwarded-for`, `x-real-ip` from the client) never anchor a security decision. Derive identity from the platform's trusted signal at the boundary and drop the inbound header.
- A CMS-sourced URL rendered into `href` or `src` needs a scheme allowlist at the sink. A hand-rolled renderer is the sink; nothing downstream sanitizes for it.
- A read-then-write counter (lockouts, quotas) admits K winners under concurrency, and a limit applied after the expensive check has not limited the work. Reserve the slot atomically first, then fire N concurrent requests at the real endpoint and count how many were evaluated.
- A URL-borne capability (token, magic link) leaks to every third-party script the layout loads. Keep it out of the URL, or scrub it before trackers initialise and prove the order with a network trace.
- A canonicaliser that strips part of an author-controlled value before comparing it makes the stripped part a free variable. Gate every strip on a declared allowlist and test by varying only the discarded field.
- Sequential awaits can be deliberate throttling. Check for a rate-limit reason before parallelising.
- An expensive external client (gRPC, SDK with a pool, a DB pool) belongs at module scope, not inside the request handler.
- Per-route fetches of the same listing multiply by route count at build time. Share the listing only through a layer that invalidation reaches; an in-process memo serves stale data after a publish.
- An empty `declare module 'X' {}` shadows the real package's types once it is installed. Use a type-only dependency plus a re-export anchor instead.
- A derived complexity or cost figure must count every independent pass at that order, not the first one found.
- Component-library defaults (36 to 40px controls) regress a site's 44px tap-target standard. Markup shipped now needs accessible names and rendered error text now, whatever "wired later" says.
- A computed `font-weight: 500` with only 400 and 700 faces loaded is faux-synthesised. Check `document.fonts.check` and glyph metrics, not the computed value.
- Text over a canvas or gradient has its contrast in the painted pixels, not in the CSS background. Sample the pixels at every breakpoint.
- A finding's observation and its stated mechanism have independent truth values. Re-derive the fix from the measured mechanism, never from the sentence.

## Process

- One `phase <N>: <title>` commit per phase with the Behavior / Verification / State triplet in the body. Fix commits go forward-only as `fix: phase <N> verifier: <topic>`; never amend, rebase or force-push.
- The tree is shared with the lead. Never revert, restore, stash or clean a path you did not modify. Report foreign dirty files and leave them.
- When the brief does not answer something, stop and start your final message with `BLOCKER:`. A guess costs a phase; a question costs a minute.
