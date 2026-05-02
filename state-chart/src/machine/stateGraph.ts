import dagre from "@dagrejs/dagre";
import { type Edge, type Node, MarkerType } from "@xyflow/react";

export type GraphNodeData = {
  label: string;
  group: string;
  isActive: boolean;
};

export type GraphNode = Node<GraphNodeData, "shipState">;

type Def = { id: string; label: string; group: string };
type EdgeDef = { from: string; to: string; label: string; kind: "user" | "verdict" | "auto" };

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

const EDGE_DEFS: EdgeDef[] = [
  { from: "idle", to: "branchSetup", label: "USER_GO", kind: "user" },
  { from: "branchSetup", to: "grilling", label: "auto", kind: "auto" },
  { from: "grilling", to: "awaitingGo", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "awaitingGo", to: "phaseLoop.implementing", label: "USER_GO", kind: "user" },
  { from: "awaitingGo", to: "grilling", label: "USER_REVISE", kind: "user" },
  { from: "phaseLoop.implementing", to: "phaseLoop.verifying", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "phaseLoop.implementing", to: "phaseLoop.escalated", label: "BLOCKER", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.advancing", label: "GREEN/MINOR", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "panelGate", label: "GREEN (last phase)", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.fixLooping", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "phaseLoop.verifying", to: "phaseLoop.escalated", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "phaseLoop.fixLooping", to: "phaseLoop.verifying", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "phaseLoop.advancing", to: "phaseLoop.implementing", label: "auto", kind: "auto" },
  { from: "phaseLoop.escalated", to: "phaseLoop.advancing", label: "USER_CONTINUE", kind: "user" },
  { from: "phaseLoop.escalated", to: "phaseLoop.implementing", label: "USER_FIX_MANUAL", kind: "user" },
  { from: "panelGate", to: "panelTrio", label: "GREEN/MINOR", kind: "verdict" },
  { from: "panelGate", to: "panelGateFix", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "panelGate", to: "escalatedPanel", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "panelGateFix", to: "panelGate", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "panelTrio", to: "retro", label: "GREEN", kind: "verdict" },
  { from: "panelTrio", to: "panelTrioFix", label: "CRITICAL (under cap)", kind: "verdict" },
  { from: "panelTrio", to: "escalatedPanel", label: "LIVELOCK / over cap", kind: "verdict" },
  { from: "panelTrioFix", to: "panelGate", label: "IMPLEMENTER_DONE", kind: "verdict" },
  { from: "escalatedPanel", to: "retro", label: "USER_CONTINUE / FIX_MANUAL", kind: "user" },
  { from: "retro", to: "pushing", label: "RETRO_DONE", kind: "auto" },
  { from: "pushing", to: "done", label: "PUSH_SUCCESS / FAIL", kind: "auto" },
];

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

export function buildGraph(activeId: string): { nodes: GraphNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 28, ranksep: 56, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of NODE_DEFS) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of EDGE_DEFS) g.setEdge(e.from, e.to);

  dagre.layout(g);

  const nodes: GraphNode[] = NODE_DEFS.map((def) => {
    const pos = g.node(def.id);
    return {
      id: def.id,
      type: "shipState",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { label: def.label, group: def.group, isActive: def.id === activeId },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  const edges: Edge[] = EDGE_DEFS.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label,
    type: "smoothstep",
    animated: e.from === activeId,
    style: edgeStyleByKind(e.kind, e.from === activeId),
    labelStyle: {
      fontFamily: "var(--font-geist-mono)",
      fontSize: 9,
      fill: "rgb(161 161 170)",
    },
    labelBgStyle: { fill: "rgb(9 9 11)", fillOpacity: 0.85 },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 2,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeColor(e.kind),
      width: 18,
      height: 18,
    },
  }));

  return { nodes, edges };
}

function edgeColor(kind: EdgeDef["kind"]) {
  switch (kind) {
    case "user":
      return "rgb(245 158 11)"; // amber-500
    case "verdict":
      return "rgb(161 161 170)"; // zinc-400
    case "auto":
      return "rgb(113 113 122)"; // zinc-500
  }
}

function edgeStyleByKind(kind: EdgeDef["kind"], active: boolean) {
  return {
    stroke: edgeColor(kind),
    strokeWidth: active ? 2.4 : 1.4,
    opacity: active ? 1 : 0.75,
  };
}

export function activeIdFromState(value: unknown): string {
  // value: string for atomic, { phaseLoop: 'implementing' } for nested
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
