"use client";

import { useCallback, useState } from "react";
import { useMachine } from "@xstate/react";
import { ReactFlowProvider } from "@xyflow/react";

import { Graph } from "@/components/Graph";
import { Inspector } from "@/components/Inspector";
import { TransitionsPanel } from "@/components/TransitionsPanel";
import { shipMachine } from "@/machine/shipMachine";
import { activeIdFromState } from "@/machine/stateGraph";

export default function Home() {
  const [snapshot, send] = useMachine(shipMachine);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentId = activeIdFromState(snapshot.value);
  const status: "idle" | "running" | "done" | "aborted" = snapshot.matches("done")
    ? "done"
    : snapshot.matches("aborted")
      ? "aborted"
      : snapshot.matches("idle")
        ? "idle"
        : "running";

  const focusedId = selectedId ?? currentId;

  const handleReset = useCallback(() => {
    send({ type: "RESET" });
    setSelectedId(null);
  }, [send]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-[480px] overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/40">
          <ReactFlowProvider>
            <Graph
              currentId={currentId}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </ReactFlowProvider>
        </section>
        <aside className="flex min-h-0 flex-col gap-3">
          <Inspector currentId={currentId} context={snapshot.context} status={status} />
          <TransitionsPanel
            selectedId={focusedId}
            currentId={currentId}
            send={send}
            onReset={handleReset}
          />
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-zinc-900/80 bg-zinc-950/60 px-5 py-3 backdrop-blur">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-base">🚢</span>
          <h1 className="font-mono text-sm font-medium tracking-tight text-zinc-100">
            ship-machine
          </h1>
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-400 ring-1 ring-amber-500/30">
            interactive
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          State chart for the{" "}
          <a
            href="https://github.com/aliaksei-loi/ship"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 underline-offset-2 hover:underline"
          >
            /ship
          </a>{" "}
          v2 workflow. Click any state to see its outgoing transitions; fire
          them to walk the machine. Amber glow = current. Sky ring = selected
          for preview.
        </p>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-900/80 bg-zinc-950/40 px-5 py-2 text-[10px] text-zinc-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>built with xstate v5 + @xyflow/react + Next.js</span>
        <span className="text-zinc-800">·</span>
        <a
          href="https://github.com/aliaksei-loi/ship/tree/main/ship-machine"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400"
        >
          source
        </a>
      </div>
    </footer>
  );
}
