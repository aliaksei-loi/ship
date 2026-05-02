"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMachine } from "@xstate/react";
import { ReactFlowProvider } from "@xyflow/react";

import { Inspector } from "@/components/Inspector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TransitionsPanel } from "@/components/TransitionsPanel";
import { shipMachine, type ShipEvent } from "@/machine/shipMachine";
import { activeIdFromState } from "@/machine/stateGraph";
import { cn } from "@/lib/utils";

// Theme-aware graph; skip SSR to avoid hydration mismatch on theme/colorMode
const Graph = dynamic(() => import("@/components/Graph").then((m) => m.Graph), {
  ssr: false,
});

type LiveStatus = "off" | "connecting" | "live";

export default function Home() {
  const [snapshot, send] = useMachine(shipMachine);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>("off");
  const sendRef = useRef(send);
  sendRef.current = send;

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

  // Subscribe to /api/stream — events posted to /api/event from /ship
  // get fed into the local actor so the UI mirrors the agent's progress.
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    setLive("connecting");
    const es = new EventSource("/api/stream");

    const onMsg = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && typeof data.type === "string") {
          sendRef.current(data as ShipEvent);
        }
      } catch {
        /* ignore malformed */
      }
    };
    const onReady = () => setLive("live");
    const onErr = () => setLive("connecting");

    es.addEventListener("ready", onReady);
    es.addEventListener("message", onMsg);
    es.addEventListener("error", onErr);

    return () => {
      es.removeEventListener("ready", onReady);
      es.removeEventListener("message", onMsg);
      es.removeEventListener("error", onErr);
      es.close();
      setLive("off");
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header live={live} />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-[480px] overflow-hidden rounded-lg border border-zinc-200/80 bg-white/40 dark:border-zinc-800/80 dark:bg-zinc-950/40">
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

function Header({ live }: { live: LiveStatus }) {
  return (
    <header className="border-b border-zinc-200/80 bg-white/60 px-5 py-3 backdrop-blur dark:border-zinc-900/80 dark:bg-zinc-950/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="text-base">🚢</span>
            <h1 className="font-mono text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
              ship-machine
            </h1>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400">
              interactive
            </span>
            <LiveIndicator live={live} />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-500">
            State chart for the{" "}
            <a
              href="https://github.com/aliaksei-loi/ship"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              /ship
            </a>{" "}
            v2 workflow. Click any state to see its outgoing transitions; fire
            them to walk the machine. Amber glow = current. Sky ring = selected.
          </p>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

function LiveIndicator({ live }: { live: LiveStatus }) {
  if (live === "off") return null;
  const isLive = live === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ring-1",
        isLive
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400"
          : "bg-zinc-500/10 text-zinc-600 ring-zinc-400/30 dark:text-zinc-400",
      )}
      title={
        isLive
          ? "Streaming events from /api/stream — POST events to /api/event to drive the machine"
          : "Connecting to event stream"
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isLive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400",
        )}
      />
      {isLive ? "live" : "connecting"}
    </span>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white/40 px-5 py-2 text-[10px] text-zinc-500 dark:border-zinc-900/80 dark:bg-zinc-950/40 dark:text-zinc-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>built with xstate v5 + @xyflow/react + Next.js</span>
        <span className="text-zinc-300 dark:text-zinc-800">·</span>
        <a
          href="https://github.com/aliaksei-loi/ship/tree/main/ship-machine"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-700 dark:hover:text-zinc-400"
        >
          source
        </a>
      </div>
    </footer>
  );
}
