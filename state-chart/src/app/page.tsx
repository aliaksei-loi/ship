"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { ReactFlowProvider } from "@xyflow/react";

import { Graph } from "@/components/Graph";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { EventButtons } from "@/components/EventButtons";
import { Inspector } from "@/components/Inspector";
import { EventLog, type LogEntry } from "@/components/EventLog";
import { shipMachine, type ShipEvent } from "@/machine/shipMachine";
import { activeIdFromState } from "@/machine/stateGraph";
import { type Scenario } from "@/machine/scenarios";

export default function Home() {
  const [snapshot, send] = useMachine(shipMachine);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const stepIndex = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logId = useRef(0);

  const activeId = activeIdFromState(snapshot.value);
  const status: "idle" | "running" | "done" | "aborted" = snapshot.matches("done")
    ? "done"
    : snapshot.matches("aborted")
      ? "aborted"
      : snapshot.matches("idle")
        ? "idle"
        : "running";

  const fire = useCallback(
    (event: ShipEvent, source: LogEntry["source"], note?: string) => {
      const fromValue = activeIdFromState(snapshot.value);
      send(event);
      setLog((prev) => [
        ...prev,
        {
          id: ++logId.current,
          time: new Date(),
          event,
          fromState: fromValue,
          toState: "→",
          source,
          note,
        },
      ]);
    },
    [send, snapshot.value],
  );

  useEffect(() => {
    setLog((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.toState !== "→") return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, toState: activeIdFromState(snapshot.value) },
      ];
    });
  }, [snapshot.value]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const advanceScenario = useCallback(
    (scenario: Scenario) => {
      const i = stepIndex.current;
      if (i >= scenario.steps.length) {
        setIsPlaying(false);
        return;
      }
      const step = scenario.steps[i];
      timer.current = setTimeout(() => {
        fire(step.event, "scenario", step.note);
        stepIndex.current = i + 1;
        advanceScenario(scenario);
      }, step.delay);
    },
    [fire],
  );

  const handlePlay = useCallback(
    (scenario: Scenario) => {
      clearTimer();
      send({ type: "RESET" });
      setLog([]);
      stepIndex.current = 0;
      setCurrentScenario(scenario);
      setIsPlaying(true);
      advanceScenario(scenario);
    },
    [advanceScenario, clearTimer, send],
  );

  const handleStop = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
    setCurrentScenario(null);
  }, [clearTimer]);

  const handlePause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, [clearTimer]);

  const handleResume = useCallback(() => {
    if (!currentScenario) return;
    setIsPlaying(true);
    advanceScenario(currentScenario);
  }, [advanceScenario, currentScenario]);

  const handleReset = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
    setCurrentScenario(null);
    setLog([]);
    send({ type: "RESET" });
  }, [clearTimer, send]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 flex-col gap-3">
          <ScenarioPicker
            current={currentScenario}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onReset={handleReset}
          />
          <EventButtons send={(e) => fire(e, "manual")} disabled={isPlaying} />
        </aside>
        <section className="min-h-[480px] overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/40">
          <ReactFlowProvider>
            <Graph activeId={activeId} />
          </ReactFlowProvider>
        </section>
        <aside className="flex min-h-0 flex-col gap-3">
          <Inspector activeId={activeId} context={snapshot.context} status={status} />
          <EventLog entries={log} />
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-zinc-900/80 bg-zinc-950/60 px-5 py-3 backdrop-blur">
      <div className="flex flex-col gap-0.5">
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
          v2 workflow. Pick a scenario or fire events manually to see how the orchestrator handles
          fix-loops, livelocks, and user escalations.
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
          href="https://github.com/aliaksei-loi/ship/tree/main/state-chart"
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
