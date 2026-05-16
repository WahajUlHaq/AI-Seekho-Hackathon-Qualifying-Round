import { useState } from "react";
import type { TabId } from "./types";
import { PipelineRunner } from "./components/PipelineRunner";
import { AgentTester } from "./components/AgentTester";
import { ContractViewer } from "./components/ContractViewer";
import { HealthDashboard } from "./components/HealthDashboard";

interface Tab { id: TabId; label: string; icon: string; }

const TABS: Tab[] = [
  { id: "pipeline",  label: "Pipeline Runner",   icon: "🚀" },
  { id: "agents",    label: "Agent Lab",          icon: "🔬" },
  { id: "contracts", label: "Contracts",           icon: "📋" },
  { id: "health",    label: "System Health",       icon: "📡" },
];

export default function App() {
  const [tab, setTab] = useState<TabId>("pipeline");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <div>
              <h1 className="text-sm font-bold text-gray-100 tracking-tight">
                Supply Chain Intelligence Agent
              </h1>
              <p className="text-xs text-gray-500">
                Autonomous Content-to-Action Pipeline · AI Seekho 2026 · Powered by Gemini + Genkit
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800/50 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              14-Module Pipeline
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-purple-400 bg-purple-900/30 border border-purple-800/50 rounded-full px-2.5 py-1">
              🤖 Antigravity
            </span>
          </div>
        </div>

        {/* Domain banner */}
        <div className="border-t border-gray-800/50 bg-sky-950/20 px-4 py-1.5">
          <p className="text-xs text-sky-400/80 text-center">
            Domain: <strong>Supply Chain & Operations Management</strong> ·
            Inventory · Procurement · Logistics · Warehousing · Demand Forecasting · Risk Management
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 text-sm flex items-center gap-1.5 transition-colors ${tab === t.id ? "tab-active" : "tab-inactive"}`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {tab === "pipeline"  && <PipelineRunner />}
        {tab === "agents"    && <AgentTester />}
        {tab === "contracts" && <ContractViewer />}
        {tab === "health"    && <HealthDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50 py-3 text-center">
        <p className="text-xs text-gray-600">
          AI Seekho 2026 · Challenge 1 · Autonomous Content-to-Action Agent · Supply Chain Domain
        </p>
      </footer>
    </div>
  );
}
