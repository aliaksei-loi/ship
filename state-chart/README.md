# state-chart

Interactive state chart for the [`/ship`](../) v2 workflow. Pick a scenario or fire events manually to see how the orchestrator handles fix-loops, livelock detection, and user escalations.

Built with **xstate v5** + **@xyflow/react** + **Next.js**.

## What this models

The lead orchestrator's state across a `/ship` run — input → grill+plan → per-phase loop → end-of-run review panel → retro → push. ~18 states across 4 groups (input, phase, panel, wrap), ~25 events grouped into user decisions / subagent verdicts / auto.

Pre-built scenarios cover happy path, verifier flake, phase fix-loop, phase livelock, panel-gate fix, trio perf critical with manual user resolution, and mid-flow abort.

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

## Layout

- **Left**: scenario picker (auto-play with pause/resume/stop) + grouped manual event buttons.
- **Center**: React Flow graph with auto-layout (dagre TB), current state glows amber.
- **Right**: inspector (state, status, current phase, retry counters, livelock detection) + chronological event log.

## Project structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # 3-pane layout
│   └── globals.css
├── machine/
│   ├── shipMachine.ts        # xstate v5 setup
│   ├── scenarios.ts          # 7 pre-built event sequences
│   └── stateGraph.ts         # machine → React Flow nodes/edges via dagre
├── components/
│   ├── Graph.tsx
│   ├── ScenarioPicker.tsx
│   ├── EventButtons.tsx
│   ├── Inspector.tsx
│   ├── EventLog.tsx
│   └── ui/
│       ├── Button.tsx
│       └── Panel.tsx
└── lib/utils.ts
```

## License

MIT.
