"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  type NodeProps,
  Panel as RFPanel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  buildEdges,
  buildNodes,
  computeLayout,
  type GraphNode,
} from "@/machine/stateGraph";
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
      style={{ width: 208 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-zinc-700 !bg-zinc-800"
      />
      <div className="font-mono text-[12px] leading-tight tracking-tight text-zinc-100">
        {data.label}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
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

function Legend() {
  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/85 px-3 py-2 backdrop-blur">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">
        legend
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-y-1 text-[10px] text-zinc-400">
        <LegendDot className="bg-amber-400" label="current" />
        <LegendDot className="bg-sky-400" label="selected" />
        <LegendLine className="border-amber-500" label="user event" />
        <LegendLine className="border-zinc-200" label="agent verdict" />
        <LegendLine className="border-zinc-400 [border-style:dashed]" label="auto" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      <span>{label}</span>
    </div>
  );
}

function LegendLine({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-0 w-5 border-t-2", className)} />
      <span>{label}</span>
    </div>
  );
}

type Props = {
  currentId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function Graph({ currentId, selectedId, onSelect }: Props) {
  const layout = useMemo(() => computeLayout(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(
    buildNodes(layout, currentId, selectedId),
  );
  const [edges, setEdges] = useEdgesState(buildEdges(currentId, selectedId));

  // Update node decorations + edges when machine state changes — preserves manual drag positions
  useEffect(() => {
    setNodes((curr) => {
      const fresh = buildNodes(layout, currentId, selectedId);
      const positions = new Map(curr.map((n) => [n.id, n.position]));
      return fresh.map((n) => ({
        ...n,
        position: positions.get(n.id) ?? n.position,
      }));
    });
    setEdges(buildEdges(currentId, selectedId));
  }, [layout, currentId, selectedId, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      minZoom={0.3}
      maxZoom={1.5}
      colorMode="dark"
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background gap={28} size={1} color="rgba(255,255,255,0.05)" />
      <Controls
        showInteractive={false}
        className="!border-zinc-800 !bg-zinc-950"
        style={{ colorScheme: "dark" }}
      />
      <RFPanel position="bottom-right">
        <Legend />
      </RFPanel>
    </ReactFlow>
  );
}
