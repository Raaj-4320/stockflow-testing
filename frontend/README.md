# frontend/ (Future Next.js Frontend Workspace)

This folder contains the **future** StockFlow frontend shell built with Next.js App Router.

## Important context
- The repository root app is the **current legacy Vite frontend** and remains active.
- `frontend/` is **preparation-only** for staged modernization.
- There is **no production cutover** in this phase.

## Run the legacy root frontend (current app)
From repository root:

```bash
npm install
npm run dev
```

## Run the new Next.js frontend shell
From repository root:

```bash
cd frontend
npm install
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

## Scope guardrails
- Do not move or rename root legacy files (`pages/`, `components/`, `services/`, `App.tsx`, `index.tsx`, `vite.config.ts`).
- Do not import legacy `services/storage.ts` into this Next.js workspace.
- Keep this workspace isolated until a later cutover phase.
