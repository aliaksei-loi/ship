"use client";

import { Field, Panel } from "@/components/ui/Panel";
import type { ShipContext } from "@/machine/shipMachine";
import { cn } from "@/lib/utils";

type Props = {
  currentId: string;
  context: ShipContext;
  status: "idle" | "running" | "done" | "aborted";
};

export function Inspector({ currentId, context, status }: Props) {
  const livelock =
    !!context.previousMode && context.previousMode === context.currentMode;

  return (
    <Panel title="Inspector">
      <Field
        label="Current"
        value={
          <span
            className={cn(
              status === "aborted" && "text-red-600 dark:text-red-400",
              status === "done" && "text-emerald-700 dark:text-emerald-400",
              status === "running" && "text-amber-700 dark:text-amber-400",
            )}
          >
            {currentId}
          </span>
        }
      />
      <Field label="Status" value={status} />
      <Field
        label="Phase"
        value={`${context.currentPhase} / ${context.totalPhases}`}
      />
      <Field
        label="Phase fix attempts"
        value={
          <span
            className={cn(
              context.phaseFixAttempts >= 2 && "text-red-600 dark:text-red-400",
            )}
          >
            {context.phaseFixAttempts} / 2
          </span>
        }
      />
      <Field
        label="Panel fix attempts"
        value={
          <span
            className={cn(
              context.panelFixAttempts >= 2 && "text-red-600 dark:text-red-400",
            )}
          >
            {context.panelFixAttempts} / 2
          </span>
        }
      />
      <Field
        label="Triggers"
        value={
          <span className="space-x-1">
            <span
              className={cn(
                context.triggers.security
                  ? "text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-400 dark:text-zinc-600",
              )}
            >
              security
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span
              className={cn(
                context.triggers.design
                  ? "text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-400 dark:text-zinc-600",
              )}
            >
              design
            </span>
          </span>
        }
      />
      <Field label="Previous mode" value={context.previousMode ?? "—"} />
      <Field
        label="Current mode"
        value={
          <span className={cn(livelock && "text-red-600 dark:text-red-400")}>
            {context.currentMode ?? "—"}
            {livelock && " · LIVELOCK"}
          </span>
        }
      />
      <Field label="Branch" value={context.branchName} />
      <Field label="Base ref" value={context.baseRef} />
    </Panel>
  );
}
