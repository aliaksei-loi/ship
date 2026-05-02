"use client";

import { Button } from "@/components/ui/Button";
import { Group, Panel } from "@/components/ui/Panel";
import type { ShipEvent } from "@/machine/shipMachine";

type Send = (event: ShipEvent) => void;

const VERDICT_BTNS: Array<{
  label: string;
  event: ShipEvent;
  variant?: "secondary" | "danger";
}> = [
  { label: "Implementer done", event: { type: "IMPLEMENTER_DONE" } },
  { label: "Implementer blocker", event: { type: "IMPLEMENTER_BLOCKER" }, variant: "danger" },
  { label: "Verifier green", event: { type: "VERIFIER_GREEN" } },
  { label: "Verifier minor", event: { type: "VERIFIER_MINOR" } },
  { label: "Verifier critical", event: { type: "VERIFIER_CRITICAL", mode: "test:assertion" }, variant: "danger" },
  { label: "Verifier livelock", event: { type: "VERIFIER_LIVELOCK" }, variant: "danger" },
  { label: "Panel gate green", event: { type: "PANEL_GATE_GREEN" } },
  { label: "Panel gate critical", event: { type: "PANEL_GATE_CRITICAL", mode: "boundary:leak" }, variant: "danger" },
  { label: "Panel gate livelock", event: { type: "PANEL_GATE_LIVELOCK" }, variant: "danger" },
  { label: "Panel trio green", event: { type: "PANEL_TRIO_GREEN" } },
  { label: "Panel trio critical", event: { type: "PANEL_TRIO_CRITICAL", mode: "perf:thrash" }, variant: "danger" },
  { label: "Panel trio livelock", event: { type: "PANEL_TRIO_LIVELOCK" }, variant: "danger" },
];

const USER_BTNS: Array<{ label: string; event: ShipEvent; variant?: "secondary" | "danger" | "accent" }> = [
  { label: "Go / approve", event: { type: "USER_GO" }, variant: "accent" },
  { label: "Revise plan", event: { type: "USER_REVISE" } },
  { label: "Continue despite critical", event: { type: "USER_CONTINUE_DESPITE_CRITICAL" } },
  { label: "Fix manually", event: { type: "USER_FIX_MANUAL" } },
  { label: "Abort", event: { type: "USER_ABORT" }, variant: "danger" },
];

const AUTO_BTNS: Array<{ label: string; event: ShipEvent }> = [
  { label: "Retro done", event: { type: "RETRO_DONE" } },
  { label: "Push success", event: { type: "PUSH_SUCCESS" } },
  { label: "Push fail", event: { type: "PUSH_FAIL" } },
];

export function EventButtons({ send, disabled }: { send: Send; disabled: boolean }) {
  return (
    <Panel title="Manual events" className="flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <Group title="User decisions">
          {USER_BTNS.map((b) => (
            <Button
              key={b.label}
              size="sm"
              variant={b.variant ?? "secondary"}
              disabled={disabled}
              onClick={() => send(b.event)}
              className="justify-start"
            >
              {b.label}
            </Button>
          ))}
        </Group>
        <Group title="Subagent verdicts">
          {VERDICT_BTNS.map((b) => (
            <Button
              key={b.label}
              size="sm"
              variant={b.variant ?? "secondary"}
              disabled={disabled}
              onClick={() => send(b.event)}
              className="justify-start"
            >
              {b.label}
            </Button>
          ))}
        </Group>
        <Group title="Auto / system">
          {AUTO_BTNS.map((b) => (
            <Button
              key={b.label}
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => send(b.event)}
              className="justify-start"
            >
              {b.label}
            </Button>
          ))}
        </Group>
      </div>
    </Panel>
  );
}
