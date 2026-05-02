"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  type NodeProps,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { buildGraph, type GraphNode } from "@/machine/stateGraph";
import { cn } from "@/lib/utils";

const groupAccent: Record<string, string> = {
  input: "border-sky-500/40 shadow-sky-500/20",
  phase: "border-emerald-500/40 shadow-emerald-500/20",
  panel: "border-violet-500/40 shadow-violet-500/20",
  wrap: "border-amber-500/40 shadow-amber-500/20",
};

function ShipStateNode({ data }: NodeProps<GraphNode>) {
  const accent = groupAccent[data.group] ?? "border-zinc-700";

  return (
    <div
      className={cn(
        "rounded-md border bg-zinc-900/95 px-3 py-2 text-center shadow-md transition-all",
        accent,
        data.isActive
          ? "scale-[1.04] border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_24px_-4px_rgba(245,158,11,0.7)]"
          : "opacity-90",
      )}
      style={{ width: 180 }}
    >
      <div className="font-mono text-[11px] tracking-tight text-zinc-100">
        {data.label}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
        {data.group}
      </div>
    </div>
  );
}

const nodeTypes = { shipState: ShipStateNode };

export function Graph({ activeId }: { activeId: string }) {
  const { nodes, edges } = useMemo(() => buildGraph(activeId), [activeId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      minZoom={0.3}
      maxZoom={1.5}
      colorMode="dark"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background gap={24} size={1} color="rgba(255,255,255,0.04)" />
      <Controls
        showInteractive={false}
        className="!border-zinc-800 !bg-zinc-950"
        style={{ colorScheme: "dark" }}
      />
    </ReactFlow>
  );
}
