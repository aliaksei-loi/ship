import type { ShipEvent } from "./shipMachine";

export type Step = {
  event: ShipEvent;
  delay: number;
  note?: string;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  steps: Step[];
};

const phaseHappy = (): Step[] => [
  { event: { type: "IMPLEMENTER_DONE" }, delay: 600, note: "implementer commits phase" },
  { event: { type: "VERIFIER_GREEN" }, delay: 600, note: "verifier passes" },
];

export const scenarios: Scenario[] = [
  {
    id: "happy",
    name: "Happy path",
    description:
      "Default flow — go, 4 phases each commit + verify green, panel gate green, panel trio green, retro, push, done.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 800, note: "grill-me converges" },
      { event: { type: "USER_GO" }, delay: 600, note: "user approves plan" },
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      { event: { type: "PANEL_GATE_GREEN" }, delay: 700, note: "code-review gate clean" },
      { event: { type: "PANEL_TRIO_GREEN" }, delay: 800, note: "perf + security + design clean" },
      { event: { type: "RETRO_DONE" }, delay: 500 },
      { event: { type: "PUSH_SUCCESS" }, delay: 500 },
    ],
  },
  {
    id: "phase-flake",
    name: "Verifier minor → continue",
    description:
      "First phase verifier returns minor (flaky test). Pipeline continues without fix-loop.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "VERIFIER_MINOR" }, delay: 600, note: "flake but acceptable" },
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      { event: { type: "PANEL_GATE_GREEN" }, delay: 700 },
      { event: { type: "PANEL_TRIO_GREEN" }, delay: 700 },
      { event: { type: "RETRO_DONE" }, delay: 500 },
      { event: { type: "PUSH_SUCCESS" }, delay: 500 },
    ],
  },
  {
    id: "phase-fix-success",
    name: "Phase fix-loop succeeds attempt 1",
    description:
      "Phase 2 verifier red → implementer fix → verifier green → continue.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      ...phaseHappy(),
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      {
        event: { type: "VERIFIER_CRITICAL", mode: "auth.test:assertion-fail" },
        delay: 600,
        note: "test red",
      },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 800, note: "fix commit" },
      { event: { type: "VERIFIER_GREEN" }, delay: 600, note: "fixed" },
      ...phaseHappy(),
      ...phaseHappy(),
      { event: { type: "PANEL_GATE_GREEN" }, delay: 700 },
      { event: { type: "PANEL_TRIO_GREEN" }, delay: 700 },
      { event: { type: "RETRO_DONE" }, delay: 500 },
      { event: { type: "PUSH_SUCCESS" }, delay: 500 },
    ],
  },
  {
    id: "phase-livelock",
    name: "Phase livelock → user aborts",
    description:
      "Same defect twice in a row triggers livelock detection. User aborts the run.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      {
        event: { type: "VERIFIER_CRITICAL", mode: "auth.test:assertion-fail" },
        delay: 600,
      },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 700, note: "first fix attempt" },
      {
        event: { type: "VERIFIER_LIVELOCK" },
        delay: 600,
        note: "same mode → escalate",
      },
      { event: { type: "USER_ABORT" }, delay: 800 },
    ],
  },
  {
    id: "panel-gate-fix",
    name: "Panel gate critical → fix → green",
    description:
      "All phases pass. Code-review gate finds a critical bug. Fix-loop resolves it. Trio green, run completes.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      {
        event: { type: "PANEL_GATE_CRITICAL", mode: "boundary:promise-swallowed" },
        delay: 700,
        note: "code-review finds boundary bug",
      },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 800, note: "panel fix commit" },
      { event: { type: "PANEL_GATE_GREEN" }, delay: 700, note: "now clean" },
      { event: { type: "PANEL_TRIO_GREEN" }, delay: 700 },
      { event: { type: "RETRO_DONE" }, delay: 500 },
      { event: { type: "PUSH_SUCCESS" }, delay: 500 },
    ],
  },
  {
    id: "panel-trio-manual",
    name: "Trio perf critical → user fixes manually",
    description:
      "Performance reviewer flags a critical issue. User chooses fix-manual instead of more retries.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      ...phaseHappy(),
      { event: { type: "PANEL_GATE_GREEN" }, delay: 700 },
      {
        event: { type: "PANEL_TRIO_CRITICAL", mode: "render:context-thrash" },
        delay: 700,
        note: "perf finds re-render storm",
      },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 700, note: "first fix attempt" },
      { event: { type: "PANEL_GATE_GREEN" }, delay: 600 },
      {
        event: { type: "PANEL_TRIO_CRITICAL", mode: "render:context-thrash" },
        delay: 700,
        note: "still red",
      },
      { event: { type: "USER_FIX_MANUAL" }, delay: 900, note: "user takes over" },
      { event: { type: "RETRO_DONE" }, delay: 500 },
      { event: { type: "PUSH_SUCCESS" }, delay: 500 },
    ],
  },
  {
    id: "abort-mid",
    name: "User aborts mid-phase",
    description:
      "User changes their mind during phase 2. Single USER_ABORT terminates the run cleanly.",
    steps: [
      { event: { type: "USER_GO" }, delay: 400 },
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600 },
      { event: { type: "USER_GO" }, delay: 500 },
      ...phaseHappy(),
      { event: { type: "IMPLEMENTER_DONE" }, delay: 600, note: "phase 2 commit" },
      { event: { type: "USER_ABORT" }, delay: 800 },
    ],
  },
];
