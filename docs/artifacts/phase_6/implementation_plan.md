# Phase 5: Frontend Pre-Implementation Audit & Blueprint

This blueprint outlines the architectural foundation for the Phase 5 Frontend layer. It ensures strict alignment with Next.js 15 (App Router), Tailwind CSS v4, and the existing backend OpenAPI specifications.

## User Review Required

Please review the architectural decisions detailed below. Specifically:
- **Tailwind v4 Integration**: Verify the `@theme` and CSS variable mappings for shadcn/ui.
- **OpenAPI Synchronization**: Confirm the two-step script for compiling the TS OpenAPI spec into static types.
- **Directory Restructuring**: Approval to migrate the existing `frontend/src/pages` structure to the `frontend/src/app` App Router paradigm.

Once approved, we will proceed with scaffolding the frontend workspace.

---

## 1. WORKSPACE SCRUTINY & REVISION MATRIX

| System Requirement | Next.js 15 / Tailwind v4 Invariant | Potential Conflict | Mitigation / Configuration Blueprint |
| :--- | :--- | :--- | :--- |
| **Next.js Hybrid Architecture** | `app/` Directory & RSC Default | Current frontend contains a legacy `src/pages` directory structure. | Delete `src/pages`. Re-initialize the `app/` router paradigm. Use Server Components by default for static data fetches. |
| **Component Hydration Boundary** | `'use client'` Directive | Hydration mismatch with real-time SSE streams and interactive DAG nodes. | Server fetch contract schemas (`GET /api/contracts`) via RSC. Inject `'use client'` only at leaves like `LiveTraceStream` and `DAGViewer`. |
| **Tailwind v4 Paradigm Shift** | Zero-config CSS-first (`@theme`) | Absence of `tailwind.config.js` causes shadcn/ui variables to break. | Hardcode shadcn HSL variables into `@theme` mapping in `src/app/globals.css`, eliminating JS config reliance. |
| **Utility Class Compilation** | Aggressive JIT Pruning | Dynamic state badges (e.g., SUCCESS/FAILED) losing styles. | Utilize explicit style mappings (e.g., clsx with static variants) in shadcn/ui definitions to prevent Tailwind v4 tree-shaking drops. |
| **OpenAPI Type Sync** | Static Schema Map | Backend `openapi.ts` is a module, preventing direct `openapi-typescript` parsing. | Inject an intermediate Node execution script to serialize `openapi.ts` to JSON before running type generation. |
| **State Consistency** | Network Concurrency (409 Conflict) | Double-clicking the HITL approval button fires duplicate mutations. | Implement strict atomic locking in the Axios layer and catch `409` errors to trigger a shadcn/ui destructive Toast notification. |

---

## 2. THE CSS-FIRST THEME BLUEPRINT

Tailwind v4 removes `tailwind.config.js`. We configure shadcn/ui design tokens by mapping CSS variables inside the new `@theme` directive in `src/app/globals.css`.

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

---

## 3. FEATURE-DRIVEN DIRECTORY STRUCTURING

Our modular setup separates RSC boundaries from RCC interactions, following S.O.L.I.D. and the multi-agent domains.

```bash
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Global RSC Layout + Providers
│   │   ├── globals.css                # Tailwind v4 Theme Directives
│   │   ├── page.tsx                   # Landing / Dashboard (RSC)
│   │   ├── pipeline/                  # Ingestion & Analytics
│   │   │   └── [id]/page.tsx          # Real-time Pipeline Trace View (RSC container)
│   │   └── execution/                 # HITL Approval Gate
│   │       └── [id]/page.tsx          # Approval Screen (RSC container)
│   ├── features/
│   │   ├── analytics/
│   │   │   ├── components/            # e.g., DAGViewer ('use client')
│   │   │   └── hooks/                 # e.g., useLiveTrace (SSE allocation)
│   │   ├── execution/
│   │   │   └── components/            # e.g., ApprovalForm ('use client')
│   │   └── ingestion/
│   │       └── components/            # e.g., SourceUploader ('use client')
│   ├── components/ui/                 # shadcn/ui Primitives
│   ├── types/
│   │   └── openapi.d.ts               # Auto-generated strict typings
│   └── lib/
│       ├── axios.ts                   # Axios interceptors + 409 handlers
│       └── utils.ts                   # clsx / tailwind-merge utilities
```

---

## 4. COMPILATION INTEGRITY COMMAND RUNNERS

The `package.json` must establish a rigorous type-checking pipeline ensuring frontend-to-backend schema alignment.

```json
{
  "name": "content-to-action-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "openapi:extract": "ts-node ../backend/src/docs/export-spec.ts > ../backend/src/docs/openapi.json",
    "openapi:generate": "openapi-typescript ../backend/src/docs/openapi.json -o src/types/openapi.d.ts",
    "sync:types": "npm run openapi:extract && npm run openapi:generate && npm run typecheck"
  }
}
```

### Transport Layer Highlights:

**1. SSE Memory Leak Neutralization**
The `useLiveTrace` hook is built to allocate and tear down the native `EventSource` on mount/unmount cleanly.
```typescript
'use client';
import { useEffect, useState } from 'react';
import type { components } from '@/types/openapi';

export function useLiveTrace(pipelineId: string) {
  const [events, setEvents] = useState<components['schemas']['TraceEvent'][]>([]);

  useEffect(() => {
    const source = new EventSource(`/api/pipeline/${pipelineId}/stream`);
    source.onmessage = (e) => {
      setEvents(prev => [...prev, JSON.parse(e.data)]);
    };
    return () => source.close(); // Neutralizes memory leaks
  }, [pipelineId]);

  return events;
}
```

**2. 409 Conflict Error Envelope Handler**
Axios interceptors or direct try-catch blocks will manage backend concurrency locks.
```typescript
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";

export const handleApproval = async (pipelineId: string, approvedBy: string) => {
  try {
    await axios.post(`/api/execution/${pipelineId}/approve`, { approved_by: approvedBy });
  } catch (error: any) {
    if (error.response?.status === 409) {
      toast({
        variant: "destructive",
        title: "State Conflict",
        description: error.response.data.error || "Execution state already modified.",
      });
    }
  }
};
```
