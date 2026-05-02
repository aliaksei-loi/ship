"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { buildGraph, type GraphNode } from "@/machine/stateGraph";
import { cn } from "@/lib/utils";

const groupAccent: Record<string, string> = {
  input: "border-sky-500/40",
  phase: "border-emerald-500/40",
  panel: "border-violet-500/40",
  wrap: "border-amber-500/40",
};

function ShipStateNode({ data }: NodeProps<GraphNode>) {
  const accent = groupAccent[data.group] ?? "border-zinc-700";

  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-md border bg-zinc-900/95 px-3 py-2 text-center shadow-md transition-all",
        accent,
        // current: amber glow
        data.isCurrent &&
          "scale-[1.05] !border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_28px_-4px_rgba(245,158,11,0.8)]",
        // selected (clicked, not current): blue ring
        data.isSelected &&
          !data.isCurrent &&
          "ring-2 ring-sky-400/60 !border-sky-400",
        // reachable from current: subtle highlight
        data.isReachable &&
          !data.isCurrent &&
          !data.isSelected &&
          "border-zinc-500 shadow-[0_0_12px_-4px_rgba(228,228,231,0.4)]",
        // dim everything else
        !data.isCurrent && !data.isSelected && !data.isReachable && "opacity-70",
      )}
      style={{ width: 184 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-zinc-700 !bg-zinc-800"
      />
      <div className="font-mono text-[11px] tracking-tight text-zinc-100">
        {data.label}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
        {data.group}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-zinc-700 !bg-zinc-800"
      />
    </div>
  );
}

const nodeTypes = { shipState: ShipStateNode };

type Props = {
  currentId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function Graph({ currentId, selectedId, onSelect }: Props) {
  const { nodes, edges } = useMemo(
    () => buildGraph(currentId, selectedId),
    [currentId, selectedId],
  );

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
      elementsSelectable={true}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
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
