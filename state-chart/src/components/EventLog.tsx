"use client";

import { useEffect, useRef } from "react";
import { Panel } from "@/components/ui/Panel";
import type { ShipEvent } from "@/machine/shipMachine";
import { formatTime } from "@/lib/utils";

export type LogEntry = {
  id: number;
  time: Date;
  event: ShipEvent;
  fromState: string;
  toState: string;
  source: "manual" | "scenario" | "auto";
  note?: string;
};

export function EventLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <Panel title="Event log" className="flex-1 overflow-hidden">
      <div ref={ref} className="flex-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <div className="px-2 py-8 text-center text-[11px] text-zinc-600">
            No events yet. Pick a scenario or fire a manual event.
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded border border-zinc-900/50 bg-zinc-950/40 px-2 py-1 font-mono text-[10px] leading-relaxed"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-400">{e.event.type}</span>
                  <span className="text-zinc-600">{formatTime(e.time)}</span>
                </div>
                <div className="mt-0.5 truncate text-zinc-500">
                  {e.fromState} → <span className="text-zinc-300">{e.toState}</span>
                </div>
                {e.note && <div className="mt-0.5 italic text-zinc-600">{e.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
