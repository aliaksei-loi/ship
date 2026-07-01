// Reference re-implementation of SKILL.md's deterministic rules.
// SOURCE OF TRUTH is SKILL.md; this file mirrors it so Class D evals can assert
// without an LLM in the loop. If you change a rule in SKILL.md, change it HERE
// and update the affected cases' expected.json — a failing D eval means either a
// regression OR an intentional rule change whose fixture was not updated.

// --- Trigger lists (SKILL.md Step 4b) ---
export const SECURITY_FILE_GLOBS = ['*auth*', '*login*', '*session*', '*crypto*', '*token*', '*permission*', '*.sql', '*.env*', 'package.json'];
export const SECURITY_CONTENT = ['dangerouslySetInnerHTML', 'eval('];
export const SECURITY_KEYWORDS = ['auth', 'login', 'password', 'token', 'secret', 'oauth', 'permission', 'admin', 'payment', 'pii', 'gdpr', 'encryption'];
export const DESIGN_FILE_EXT = ['.tsx', '.jsx', '.css', '.scss', '.vue', '.svelte'];
export const DESIGN_FILE_GLOBS = ['*.module.*'];
export const DESIGN_KEYWORDS = ['figma.com/', 'mockup', 'screenshot', 'design system', 'mobile', 'breakpoint', 'responsive'];

// Minimal glob: leading/trailing '*' => substring; leading '*' => suffix; trailing '*' => prefix; else exact.
function globMatch(pattern, name) {
  if (pattern.length > 2 && pattern.startsWith('*') && pattern.endsWith('*')) return name.includes(pattern.slice(1, -1));
  if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1));
  if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

// evaluateTriggers({changedFiles:[], introducedLines:[]}, planText) -> {security, design, performance:true}
// Performance ALWAYS fires. Security/design fire on file match OR (security only) introduced content OR plan keyword.
export function evaluateTriggers(diff = {}, planText = '') {
  const files = diff.changedFiles || [];
  const lines = diff.introducedLines || [];
  const plan = (planText || '').toLowerCase();

  const securityByFile = files.some((f) => SECURITY_FILE_GLOBS.some((g) => globMatch(g, f)));
  const securityByContent = lines.some((l) => SECURITY_CONTENT.some((c) => l.includes(c)));
  const securityByKeyword = SECURITY_KEYWORDS.some((k) => plan.includes(k));

  const designByFile = files.some(
    (f) => DESIGN_FILE_EXT.some((e) => f.endsWith(e)) || DESIGN_FILE_GLOBS.some((g) => globMatch(g, f)),
  );
  const designByKeyword = DESIGN_KEYWORDS.some((k) => plan.includes(k));

  return {
    security: securityByFile || securityByContent || securityByKeyword,
    design: designByFile || designByKeyword,
    performance: true,
  };
}

// dedupFindings(allFindings[]) -> merged[]; key = location ALONE (SKILL.md § Deduplication).
// On collision keep the higher-severity finding's severity/dimension/summary and UNION the evidence.
// NOT keyed on rubric dimension — the panel agents share no dimension vocabulary.
const SEV_RANK = { critical: 2, minor: 1 };
export function dedupFindings(findings = []) {
  const byLoc = new Map();
  for (const f of findings) {
    const existing = byLoc.get(f.location);
    if (!existing) {
      byLoc.set(f.location, { ...f, evidence: f.evidence ? [f.evidence] : [] });
      continue;
    }
    if (f.evidence) existing.evidence.push(f.evidence);
    if ((SEV_RANK[f.severity] || 0) > (SEV_RANK[existing.severity] || 0)) {
      existing.severity = f.severity;
      if (f.dimension !== undefined) existing.dimension = f.dimension;
      if (f.summary !== undefined) existing.summary = f.summary;
    }
  }
  return [...byLoc.values()];
}

// rollupVerdict(verdicts[]) -> 'green'|'minor'|'critical'. 'blocked' is filtered out first
// (handled separately, does NOT roll up — SKILL.md Step 4c).
const VERDICT_RANK = { green: 0, minor: 1, critical: 2 };
export function rollupVerdict(verdicts = []) {
  const considered = verdicts.filter((v) => v !== 'blocked');
  if (considered.length === 0) return 'green';
  return considered.reduce((worst, v) => (VERDICT_RANK[v] > VERDICT_RANK[worst] ? v : worst), 'green');
}

// capOk(lineCount) -> within the 100-line retro lessons cap.
export function capOk(lineCount) {
  return lineCount <= 100;
}

// retryUnderCap(attempt) -> within the per-loop retry cap of 2.
export function retryUnderCap(attempt) {
  return attempt <= 2;
}

// sameDefect(prev, cur) -> livelock detector (SKILL.md Step 3c). Fires only when a prior
// mode exists AND matches the current one.
export function sameDefect(prev, cur) {
  return prev != null && prev === cur;
}
