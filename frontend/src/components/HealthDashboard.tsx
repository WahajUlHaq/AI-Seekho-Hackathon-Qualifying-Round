import { useEffect, useState } from "react";
import type { HealthResponse } from "../types";
import { MetricsBar } from "./MetricsBar";
import { JsonViewer } from "./JsonViewer";

const ENDPOINTS = [
  { method: "GET",  path: "/health",                       desc: "System health check" },
  { method: "POST", path: "/api/pipeline/run",             desc: "Full pipeline execution" },
  { method: "GET",  path: "/api/pipeline/:id/trace",       desc: "Pipeline trace export" },
  { method: "POST", path: "/api/genkit/run",               desc: "Genkit / Antigravity pipeline" },
  { method: "GET",  path: "/api/agents/tools",             desc: "Antigravity tool manifest" },
  { method: "POST", path: "/api/agents/ingest",            desc: "Module 1: Ingestion" },
  { method: "POST", path: "/api/agents/score",             desc: "Module 2: Credibility" },
  { method: "POST", path: "/api/agents/filter",            desc: "Module 3: Noise Filter" },
  { method: "POST", path: "/api/agents/detect",            desc: "Module 4: Contradictions" },
  { method: "POST", path: "/api/agents/resolve",           desc: "Module 5: Conflict Resolution" },
  { method: "POST", path: "/api/agents/temporal",          desc: "Module 6: Temporal Analysis" },
  { method: "POST", path: "/api/agents/insights",          desc: "Module 7: Insights" },
  { method: "POST", path: "/api/agents/impact",            desc: "Module 8: Impact Analysis" },
  { method: "POST", path: "/api/agents/actions",           desc: "Module 9: Action Chain" },
  { method: "POST", path: "/api/agents/simulate",          desc: "Module 10: Simulator" },
  { method: "GET",  path: "/api/contracts",                desc: "List contract definitions" },
  { method: "GET",  path: "/api/contracts/:id",            desc: "Get contract by name" },
  { method: "GET",  path: "/api/validations",              desc: "Validation history" },
  { method: "GET",  path: "/api/validations/:pipelineId",  desc: "Pipeline validations" },
];

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/health");
      const data = await res.json();
      setHealth(data as HealthResponse);
      setLastChecked(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Backend unreachable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHealth(); }, []);

  const isOnline = !error && !!health;

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <div>
            <p className="font-semibold text-sm">
              Backend {isOnline ? <span className="text-emerald-400">ONLINE</span> : <span className="text-red-400">OFFLINE</span>}
            </p>
            <p className="text-xs text-gray-500">http://localhost:8000</p>
          </div>
        </div>
        <div className="text-right">
          <button onClick={fetchHealth} className="btn-secondary text-xs">↺ Refresh</button>
          {lastChecked && (
            <p className="text-xs text-gray-600 mt-1">Last checked {lastChecked.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      {loading && <div className="card text-gray-400 text-sm">Checking backend…</div>}
      {error && <div className="card border-red-800/60 bg-red-950/20 text-red-400 text-sm">⛔ {error} — Is the server running? Run: <code className="bg-gray-800 px-1 rounded">npm run dev</code> in the backend folder.</div>}

      {health && (
        <>
          <MetricsBar metrics={[
            { label: "Environment",   icon: "🌍", value: health.environment,                         color: "text-sky-400" },
            { label: "AI Provider",   icon: "🤖", value: health.provider,                            color: "text-purple-400" },
            { label: "Contracts",     icon: "📋", value: health.contracts_loaded.length,             color: "text-emerald-400" },
            { label: "Status",        icon: "✅", value: health.status.toUpperCase(),                color: "text-emerald-400" },
          ]} />

          {/* Contracts loaded */}
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Loaded Contracts</p>
            <div className="flex flex-wrap gap-2">
              {health.contracts_loaded.map((c) => (
                <span key={c} className="badge-pass">{c}</span>
              ))}
            </div>
          </div>

          {/* Antigravity info */}
          {health.antigravity_orchestrator && (
            <div className="card border-purple-800/40 bg-purple-950/10">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Google Antigravity (Firebase Genkit)</p>
              <p className="text-sm text-purple-300">{health.antigravity_orchestrator}</p>
              <p className="text-xs text-gray-500 mt-2">
                Start Dev UI: <code className="bg-gray-800 px-1 rounded text-purple-300">npm run genkit:dev</code> → http://localhost:4000
              </p>
            </div>
          )}

          <JsonViewer data={health} title="Full Health Response" defaultCollapsed />
        </>
      )}

      {/* Endpoint map */}
      <div className="card">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
          API Endpoint Map — {ENDPOINTS.length} endpoints
        </p>
        <div className="space-y-1">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex items-center gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
              <span className={`text-xs font-bold w-10 text-center px-1 py-0.5 rounded ${e.method === "GET" ? "bg-emerald-900/40 text-emerald-400" : "bg-sky-900/40 text-sky-400"}`}>
                {e.method}
              </span>
              <code className="text-xs text-gray-300 flex-1">{e.path}</code>
              <span className="text-xs text-gray-500">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
