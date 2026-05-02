"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { scenarios, type Scenario } from "@/machine/scenarios";
import { cn } from "@/lib/utils";

type Props = {
  current: Scenario | null;
  isPlaying: boolean;
  onPlay: (scenario: Scenario) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
};

export function ScenarioPicker({
  current,
  isPlaying,
  onPlay,
  onPause,
  onResume,
  onStop,
  onReset,
}: Props) {
  return (
    <Panel
      title="Scenarios"
      action={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onReset} title="Reset machine">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-900 px-3 py-2">
        {!isPlaying && current ? (
          <Button size="sm" variant="accent" onClick={onResume}>
            <Play className="h-3 w-3" /> Resume
          </Button>
        ) : isPlaying ? (
          <Button size="sm" variant="secondary" onClick={onPause}>
            <Pause className="h-3 w-3" /> Pause
          </Button>
        ) : (
          <Button size="sm" variant="accent" onClick={() => onPlay(scenarios[0])}>
            <Play className="h-3 w-3" /> Happy path
          </Button>
        )}
        {current && (
          <Button size="sm" variant="ghost" onClick={onStop}>
            <Square className="h-3 w-3" /> Stop
          </Button>
        )}
      </div>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto px-2 py-2">
        {scenarios.map((s) => {
          const active = current?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onPlay(s)}
              className={cn(
                "rounded-md border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-amber-500/60 bg-amber-500/10"
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60",
              )}
            >
              <div className="font-mono text-xs text-zinc-100">{s.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                {s.description}
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
