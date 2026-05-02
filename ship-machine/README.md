# ship-machine

Interactive state explorer for the [`/ship`](../) v2 workflow. Click any state in the graph to see its outgoing transitions; fire transitions to walk the machine through fix-loops, livelock detection, and user escalations.

Built with **xstate v5** + **@xyflow/react** + **Next.js**.

## What this models

The lead orchestrator's state across a `/ship` run — input → grill+plan → per-phase loop → end-of-run review panel → retro → push. ~18 states across 4 groups (input, phase, panel, wrap), ~25 events grouped into user decisions / subagent verdicts / auto.

## How it works

- **Amber glow** — current state (machine is here).
- **Sky ring** — selected state (clicked, preview only).
- **Bright highlighted edges** — outgoing transitions from current and selected states.

Side panel `TransitionsPanel` lists outgoing transitions for the focused state. Buttons are firable only when the focused state is the current state — otherwise they render as disabled previews so you can explore "what's next from here" without driving the machine.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Deploy to Vercel

```bash
pnpm dlx vercel --prod
```

Or push to GitHub and import via the Vercel dashboard. No env vars required.

## Project structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # 2-pane layout
│   └── globals.css
├── machine/
│   ├── shipMachine.ts          # xstate v5 setup
│   └── stateGraph.ts           # machine → React Flow nodes/edges via dagre
├── components/
│   ├── Graph.tsx               # clickable React Flow graph
│   ├── Inspector.tsx           # current state + context
│   ├── TransitionsPanel.tsx    # outgoing events from focused state
│   └── ui/Panel.tsx
└── lib/utils.ts
```

## License

MIT.
