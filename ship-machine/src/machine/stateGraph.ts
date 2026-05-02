import dagre from "@dagrejs/dagre";
import { type Edge, type Node, MarkerType } from "@xyflow/react";

export type NodeGroup = "input" | "phase" | "panel" | "wrap";

export type GraphNodeData = {
  label: string;
  group: NodeGroup;
  isCurrent: boolean;
  isSelected: boolean;
  isReachable: boolean;
};

export type GraphNode = Node<GraphNodeData, "shipState">;

export type EdgeKind = "user" | "verdict" | "auto";

export type EdgeDef = {
  from: string;
  to: string;
  event: string;
  label: string;
  kind: EdgeKind;
};

type Def = { id: string; label: string; group: NodeGroup };

export const NODE_DEFS: Def[] = [
  { id: "idle", label: "Idle", group: "input" },
  { id: "branchSetup", label: "Branch setup", group: "input" },
  { id: "grilling", label: "Grilling", group: "input" },
  { id: "awaitingGo", label: "Awaiting go", group: "input" },
  { id: "phaseLoop.implementing", label: "Implementing", group: "phase" },
  { id: "phaseLoop.verifying", label: "Verifying", group: "phase" },
  { id: "phaseLoop.fixLooping", label: "Phase fix-loop", group: "phase" },
  { id: "phaseLoop.advancing", label: "→ next phase", group: "phase" },
  { id: "phaseLoop.escalated", label: "Phase escalated", group: "phase" },
  { id: "panelGate", label: "Panel gate (code-review)", group: "panel" },
  { id: "panelGateFix", label: "Gate fix-loop", group: "panel" },
  { id: "panelTrio", label: "Panel trio", group: "panel" },
  { id: "panelTrioFix", label: "Trio fix-loop", group: "panel" },
  { id: "escalatedPanel", label: "Panel escalated", group: "panel" },
  { id: "retro", label: "Retro", group: "wrap" },
  { id: "pushing", label: "Push + PR", group: "wrap" },
  { id: "done", label: "Done", group: "wrap" },
  { id: "aborted", label: "Aborted", group: "wrap" },
];

export const EDGE_DEFS: EdgeDef[] = [
  { from: "idle", to: "branchSetup", event: "USER_GO", label: "USER_GO", kind: "user" },
  { from: "branchSetup", to: "grilling", event: "auto", label: "auto (300ms)", kind: "auto" },
  { from: "grilling", to: "awaitingGo", event: "IMPLEMENTER_DONE", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "awaitingGo", to: "phaseLoop.implementing", event: "USER_GO", label: "USER_GO", kind: "user" },
  { from: "awaitingGo", to: "grilling", event: "USER_REVISE", label: "USER_REVISE", kind: "user" },
  { from: "phaseLoop.implementing", to: "phaseLoop.verifying", event: "IMPLEMENTER_DONE", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "phaseLoop.implementing", to: "phaseLoop.escalated", event: "IMPLEMENTER_BLOCKER", label: "IMPLEMENTER_BLOCKER", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.advancing", event: "VERIFIER_GREEN", label: "GREEN/MINOR", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "panelGate", event: "VERIFIER_GREEN", label: "GREEN (last phase)", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.fixLooping", event: "VERIFIER_CRITICAL", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.escalated", event: "VERIFIER_LIVELOCK", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "phaseLoop.fixLooping", to: "phaseLoop.verifying", event: "IMPLEMENTER_DONE", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "phaseLoop.advancing", to: "phaseLoop.implementing", event: "auto", label: "auto", kind: "auto" },
  { from: "phaseLoop.escalated", to: "phaseLoop.advancing", event: "USER_CONTINUE_DESPITE_CRITICAL", label: "USER_CONTINUE", kind: "user" },
  { from: "phaseLoop.escalated", to: "phaseLoop.implementing", event: "USER_FIX_MANUAL", label: "USER_FIX_MANUAL", kind: "user" },
  { from: "panelGate", to: "panelTrio", event: "PANEL_GATE_GREEN", label: "GREEN/MINOR", kind: "verdict" },
  { from: "panelGate", to: "panelGateFix", event: "PANEL_GATE_CRITICAL", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "panelGate", to: "escalatedPanel", event: "PANEL_GATE_LIVELOCK", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "panelGateFix", to: "panelGate", event: "IMPLEMENTER_DONE", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "panelTrio", to: "retro", event: "PANEL_TRIO_GREEN", label: "GREEN", kind: "verdict" },
  { from: "panelTrio", to: "panelTrioFix", event: "PANEL_TRIO_CRITICAL", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "panelTrio", to: "escalatedPanel", event: "PANEL_TRIO_LIVELOCK", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "panelTrioFix", to: "panelGate", event: "IMPLEMENTER_DONE", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "escalatedPanel", to: "retro", event: "USER_CONTINUE_DESPITE_CRITICAL", label: "USER_CONTINUE / FIX_MANUAL", kind: "user" },
  { from: "retro", to: "pushing", event: "RETRO_DONE", label: "RETRO_DONE", kind: "auto" },
  { from: "pushing", to: "done", event: "PUSH_SUCCESS", label: "PUSH_SUCCESS / FAIL", kind: "auto" },
];

const NODE_WIDTH = 208;
const NODE_HEIGHT = 68;

export function computeLayout(): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 90,
    edgesep: 30,
    marginx: 28,
    marginy: 28,
    ranker: "tight-tree",
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of NODE_DEFS) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of EDGE_DEFS) g.setEdge(e.from, e.to);

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const def of NODE_DEFS) {
    const pos = g.node(def.id);
    positions[def.id] = {
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
    };
  }
  return positions;
}

export function buildNodes(
  positions: Record<string, { x: number; y: number }>,
  currentId: string,
  selectedId: string | null,
): GraphNode[] {
  const reachableFromCurrent = new Set(
    EDGE_DEFS.filter((e) => e.from === currentId).map((e) => e.to),
  );

  return NODE_DEFS.map((def) => ({
    id: def.id,
    type: "shipState" as const,
    position: positions[def.id] ?? { x: 0, y: 0 },
    data: {
      label: def.label,
      group: def.group,
      isCurrent: def.id === currentId,
      isSelected: def.id === selectedId,
      isReachable: reachableFromCurrent.has(def.id),
    },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));
}

export function buildEdges(currentId: string, selectedId: string | null): Edge[] {

  return EDGE_DEFS.map((e, i) => {
    const isFromCurrent = e.from === currentId;
    const isFromSelected = selectedId !== null && e.from === selectedId;
    const isHighlighted = isFromCurrent || isFromSelected;
    return {
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: isHighlighted ? e.label : undefined,
      type: "smoothstep",
      animated: isFromCurrent,
      pathOptions: { borderRadius: 14, offset: 18 },
      zIndex: isHighlighted ? 10 : 0,
      style: {
        stroke: edgeColor(e.kind, isHighlighted),
        strokeWidth: isHighlighted ? 2.4 : 1.1,
        strokeDasharray: e.kind === "auto" && !isHighlighted ? "3 4" : undefined,
        opacity: isHighlighted ? 1 : 0.32,
      },
      labelStyle: {
        fontFamily: "var(--font-geist-mono)",
        fontSize: 10,
        fontWeight: 500,
        fill: "rgb(244 244 245)",
      },
      labelBgStyle: {
        fill: "rgb(9 9 11)",
        fillOpacity: 0.95,
        stroke: edgeColor(e.kind, true),
        strokeWidth: 0.5,
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor(e.kind, isHighlighted),
        width: 20,
        height: 20,
      },
    };
  });
}

function edgeColor(kind: EdgeKind, highlighted: boolean) {
  if (!highlighted) {
    return "rgb(82 82 91)"; // zinc-600
  }
  switch (kind) {
    case "user":
      return "rgb(245 158 11)"; // amber-500
    case "verdict":
      return "rgb(228 228 231)"; // zinc-200
    case "auto":
      return "rgb(161 161 170)"; // zinc-400
  }
}

export function activeIdFromState(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      const [parent, child] = entries[0];
      if (typeof child === "string") return `${parent}.${child}`;
      return `${parent}.${activeIdFromState(child)}`;
    }
  }
  return "idle";
}

export function transitionsFrom(stateId: string): EdgeDef[] {
  return EDGE_DEFS.filter((e) => e.from === stateId);
}
