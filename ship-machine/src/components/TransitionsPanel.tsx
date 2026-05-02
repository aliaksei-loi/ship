"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import type { ShipEvent } from "@/machine/shipMachine";
import { type EdgeDef, transitionsFrom, NODE_DEFS } from "@/machine/stateGraph";
import { cn } from "@/lib/utils";

type Send = (event: ShipEvent) => void;

type Props = {
  selectedId: string;
  currentId: string;
  send: Send;
  onReset: () => void;
};

const eventColor: Record<EdgeDef["kind"], string> = {
  user: "text-amber-400",
  verdict: "text-zinc-200",
  auto: "text-zinc-400",
};

const labelOfNode = (id: string): string =>
  NODE_DEFS.find((n) => n.id === id)?.label ?? id;

export function TransitionsPanel({ selectedId, currentId, send, onReset }: Props) {
  const transitions = transitionsFrom(selectedId);
  const isCurrent = selectedId === currentId;

  return (
    <Panel
      title={
        isCurrent
          ? `From: ${labelOfNode(selectedId)} · current`
          : `From: ${labelOfNode(selectedId)} · preview`
      }
      className="flex-1 overflow-hidden"
      action={
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          title="Reset machine to idle"
        >
          <RotateCcw className="h-3 w-3" /> reset
        </button>
      }
    >
      <div className="flex-1 overflow-y-auto">
        {transitions.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-zinc-600">
            Terminal state — no outgoing transitions.
          </div>
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {transitions.map((t, i) => {
              const isAutoOnly = t.event === "auto";
              const cannotFire = !isCurrent || isAutoOnly;
              return (
                <li key={i}>
                  <button
                    onClick={() => {
                      if (cannotFire) return;
                      send({ type: t.event } as ShipEvent);
                    }}
                    disabled={cannotFire}
                    title={
                      isAutoOnly
                        ? "Auto-transition fires when entering this state — not user-firable"
                        : !isCurrent
                          ? "Machine isn't here. Walk to this state to fire."
                          : `Fire ${t.event}`
                    }
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-md border bg-zinc-950/60 px-2.5 py-2 text-left transition-colors",
                      cannotFire
                        ? "cursor-not-allowed border-zinc-900 opacity-60"
                        : "border-zinc-800 hover:border-amber-500/60 hover:bg-amber-500/5",
                    )}
                  >
                    <ArrowRight
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0",
                        cannotFire
                          ? "text-zinc-700"
                          : "text-zinc-500 group-hover:text-amber-400",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "truncate font-mono text-[11px]",
                          cannotFire ? "text-zinc-500" : eventColor[t.kind],
                        )}
                      >
                        {t.label}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                        → {labelOfNode(t.to)}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!isCurrent && (
        <div className="border-t border-zinc-900/80 px-3 py-1.5 text-[10px] text-zinc-600">
          Click <span className="text-zinc-400">{labelOfNode(currentId)}</span>{" "}
          to fire. Or walk the machine here.
        </div>
      )}
    </Panel>
  );
}
