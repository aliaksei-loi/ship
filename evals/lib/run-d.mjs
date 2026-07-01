#!/usr/bin/env node
// Class D runner. Walks evals/cases/D*/, calls the ship_rules.mjs function named
// in each case's input.json, and deep-compares (key-order-insensitive) to expected.json.
// Exit 0 = all pass. Any mismatch prints expected vs got and exits nonzero.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as rules from './ship_rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const casesDir = join(here, '..', 'cases');

// Sort object keys recursively so comparison ignores key order.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((o, k) => {
        o[k] = canonical(v[k]);
        return o;
      }, {});
  }
  return v;
}
const eq = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

let fail = 0;
let run = 0;
for (const dir of readdirSync(casesDir).filter((d) => d.startsWith('D')).sort()) {
  const base = join(casesDir, dir);
  if (!existsSync(join(base, 'input.json'))) continue;
  const input = JSON.parse(readFileSync(join(base, 'input.json')));
  const expected = JSON.parse(readFileSync(join(base, 'expected.json')));
  const fn = rules[input.fn];
  run++;
  if (typeof fn !== 'function') {
    console.log(`FAIL ${dir} — unknown fn '${input.fn}'`);
    fail++;
    continue;
  }
  const got = fn(...input.args);
  const ok = eq(got, expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${dir} (${input.fn})`);
  if (!ok) {
    fail++;
    console.log('  expected', JSON.stringify(expected));
    console.log('  got     ', JSON.stringify(got));
  }
}
console.log(`\n${run - fail}/${run} passed`);
process.exit(fail ? 1 : 0);
