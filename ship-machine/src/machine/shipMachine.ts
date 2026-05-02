import { setup, assign } from "xstate";

export type Verdict = "green" | "minor" | "critical";

export type ShipContext = {
  totalPhases: number;
  currentPhase: number;
  phaseFixAttempts: number;
  panelFixAttempts: number;
  triggers: { security: boolean; design: boolean };
  previousMode: string | null;
  currentMode: string | null;
  branchName: string;
  baseRef: string;
  lastVerdict: Verdict | null;
};

export type ShipEvent =
  | { type: "USER_GO" }
  | { type: "USER_REVISE" }
  | { type: "USER_ABORT" }
  | { type: "USER_CONTINUE_DESPITE_CRITICAL" }
  | { type: "USER_FIX_MANUAL" }
  | { type: "IMPLEMENTER_DONE" }
  | { type: "IMPLEMENTER_BLOCKER" }
  | { type: "VERIFIER_GREEN" }
  | { type: "VERIFIER_MINOR" }
  | { type: "VERIFIER_CRITICAL"; mode: string }
  | { type: "VERIFIER_LIVELOCK" }
  | { type: "PANEL_GATE_GREEN" }
  | { type: "PANEL_GATE_MINOR" }
  | { type: "PANEL_GATE_CRITICAL"; mode: string }
  | { type: "PANEL_GATE_LIVELOCK" }
  | { type: "PANEL_TRIO_GREEN" }
  | { type: "PANEL_TRIO_CRITICAL"; mode: string }
  | { type: "PANEL_TRIO_LIVELOCK" }
  | { type: "NEXT_PHASE" }
  | { type: "ALL_PHASES_DONE" }
  | { type: "RETRO_DONE" }
  | { type: "PUSH_SUCCESS" }
  | { type: "PUSH_FAIL" }
  | { type: "RESET" };

const initialContext: ShipContext = {
  totalPhases: 4,
  currentPhase: 0,
  phaseFixAttempts: 0,
  panelFixAttempts: 0,
  triggers: { security: true, design: true },
  previousMode: null,
  currentMode: null,
  branchName: "feat/example",
  baseRef: "main",
  lastVerdict: null,
};

export const shipMachine = setup({
  types: {
    context: {} as ShipContext,
    events: {} as ShipEvent,
  },
  guards: {
    underPhaseFixCap: ({ context }) => context.phaseFixAttempts < 2,
    underPanelFixCap: ({ context }) => context.panelFixAttempts < 2,
    morePhases: ({ context }) => context.currentPhase < context.totalPhases,
    lastPhase: ({ context }) => context.currentPhase >= context.totalPhases,
  },
  actions: {
    incrementPhase: assign({
      currentPhase: ({ context }) => context.currentPhase + 1,
      phaseFixAttempts: 0,
      previousMode: null,
      currentMode: null,
    }),
    incrementPhaseFix: assign({
      phaseFixAttempts: ({ context }) => context.phaseFixAttempts + 1,
      previousMode: ({ context }) => context.currentMode,
      currentMode: ({ context, event }) =>
        "mode" in event ? (event.mode as string) : context.currentMode,
    }),
    incrementPanelFix: assign({
      panelFixAttempts: ({ context }) => context.panelFixAttempts + 1,
      previousMode: ({ context }) => context.currentMode,
      currentMode: ({ context, event }) =>
        "mode" in event ? (event.mode as string) : context.currentMode,
    }),
    setMode: assign({
      currentMode: ({ event }) =>
        "mode" in event ? (event.mode as string) : null,
    }),
    setVerdict: assign({
      lastVerdict: (_, params: { verdict: Verdict }) => params.verdict,
    }),
    resetForReview: assign({
      panelFixAttempts: 0,
      previousMode: null,
      currentMode: null,
    }),
    resetAll: assign(() => ({ ...initialContext })),
  },
}).createMachine({
  id: "ship",
  context: initialContext,
  initial: "idle",
  on: {
    USER_ABORT: { target: ".aborted" },
    RESET: { target: ".idle", actions: "resetAll" },
  },
  states: {
    idle: {
      on: {
        USER_GO: "branchSetup",
      },
    },
    branchSetup: {
      after: {
        300: "grilling",
      },
    },
    grilling: {
      on: {
        IMPLEMENTER_DONE: "awaitingGo",
      },
    },
    awaitingGo: {
      on: {
        USER_GO: {
          target: "phaseLoop",
          actions: assign({ currentPhase: 1 }),
        },
        USER_REVISE: "grilling",
      },
    },
    phaseLoop: {
      initial: "implementing",
      states: {
        implementing: {
          on: {
            IMPLEMENTER_DONE: "verifying",
            IMPLEMENTER_BLOCKER: "escalated",
          },
        },
        verifying: {
          on: {
            VERIFIER_GREEN: [
              { target: "#ship.panelGate", guard: "lastPhase" },
              { target: "advancing" },
            ],
            VERIFIER_MINOR: [
              { target: "#ship.panelGate", guard: "lastPhase" },
              { target: "advancing" },
            ],
            VERIFIER_CRITICAL: [
              {
                target: "fixLooping",
                guard: "underPhaseFixCap",
                actions: { type: "incrementPhaseFix" },
              },
              { target: "escalated" },
            ],
            VERIFIER_LIVELOCK: "escalated",
          },
        },
        fixLooping: {
          on: {
            IMPLEMENTER_DONE: "verifying",
          },
        },
        advancing: {
          entry: "incrementPhase",
          always: "implementing",
        },
        escalated: {
          on: {
            USER_CONTINUE_DESPITE_CRITICAL: [
              { target: "#ship.panelGate", guard: "lastPhase" },
              { target: "advancing" },
            ],
            USER_FIX_MANUAL: "implementing",
          },
        },
      },
    },
    panelGate: {
      entry: "resetForReview",
      on: {
        PANEL_GATE_GREEN: "panelTrio",
        PANEL_GATE_MINOR: "panelTrio",
        PANEL_GATE_CRITICAL: [
          {
            target: "panelGateFix",
            guard: "underPanelFixCap",
            actions: { type: "incrementPanelFix" },
          },
          { target: "escalatedPanel" },
        ],
        PANEL_GATE_LIVELOCK: "escalatedPanel",
      },
    },
    panelGateFix: {
      on: {
        IMPLEMENTER_DONE: "panelGate",
      },
    },
    panelTrio: {
      on: {
        PANEL_TRIO_GREEN: "retro",
        PANEL_TRIO_CRITICAL: [
          {
            target: "panelTrioFix",
            guard: "underPanelFixCap",
            actions: { type: "incrementPanelFix" },
          },
          { target: "escalatedPanel" },
        ],
        PANEL_TRIO_LIVELOCK: "escalatedPanel",
      },
    },
    panelTrioFix: {
      on: {
        IMPLEMENTER_DONE: "panelGate",
      },
    },
    escalatedPanel: {
      on: {
        USER_CONTINUE_DESPITE_CRITICAL: "retro",
        USER_FIX_MANUAL: "retro",
      },
    },
    retro: {
      on: {
        RETRO_DONE: "pushing",
      },
    },
    pushing: {
      on: {
        PUSH_SUCCESS: "done",
        PUSH_FAIL: "done",
      },
    },
    done: {},
    aborted: {},
  },
});

export const stateLabels: Record<string, { label: string; group: string }> = {
  idle: { label: "Idle", group: "input" },
  branchSetup: { label: "Branch setup", group: "input" },
  grilling: { label: "Grilling", group: "input" },
  awaitingGo: { label: "Awaiting go", group: "input" },
  "phaseLoop.implementing": { label: "Implementing", group: "phase" },
  "phaseLoop.verifying": { label: "Verifying", group: "phase" },
  "phaseLoop.fixLooping": { label: "Fix-loop", group: "phase" },
  "phaseLoop.advancing": { label: "→ next phase", group: "phase" },
  "phaseLoop.escalated": { label: "Escalated", group: "phase" },
  panelGate: { label: "Panel gate", group: "panel" },
  panelGateFix: { label: "Panel gate fix", group: "panel" },
  panelTrio: { label: "Panel trio", group: "panel" },
  panelTrioFix: { label: "Panel trio fix", group: "panel" },
  escalatedPanel: { label: "Escalated panel", group: "panel" },
  retro: { label: "Retro", group: "wrap" },
  pushing: { label: "Pushing + PR", group: "wrap" },
  done: { label: "Done", group: "wrap" },
  aborted: { label: "Aborted", group: "wrap" },
};
