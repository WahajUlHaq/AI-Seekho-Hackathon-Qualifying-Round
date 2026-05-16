import { useState, useMemo } from "react";
import type { Source, SourceType, PipelineRequest, GenkitResult } from "../types";
import { SCENARIOS } from "../scenarios";
import { scoreAllSources } from "../domain";
import { api } from "../api";
import { DomainBadge } from "./DomainBadge";
import { MetricsBar } from "./MetricsBar";
import { JsonViewer } from "./JsonViewer";
import { AUTHORITY_TYPES } from "../types";

const SOURCE_TYPES: SourceType[] = ["pdf", "url", "csv", "json", "table", "realtime_feed"];

function emptySource(idx: number): Source {
  return {
    source_id: `SRC-${String(idx).padStart(3, "0")}`,
    source_type: "json",
    content: "",
    metadata: { timestamp: new Date().toISOString().slice(0, 19) + "Z", authority_type: "internal_system" },
  };
}

export function PipelineRunner() {
  const [mode, setMode] = useState<"genkit" | "express">("genkit");
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0].id);
  const [sources, setSources] = useState<Source[]>(SCENARIOS[0].request.sources);
  const [constraints, setConstraints] = useState(SCENARIOS[0].request.constraints);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenkitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<"result" | "trace" | "raw">("result");

  const domainScore = useMemo(
    () => scoreAllSources(sources.map((s) => s.content)),
    [sources]
  );

  function loadScenario(id: string) {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    setSelectedScenario(id);
    setSources(sc.request.sources);
    setConstraints(sc.request.constraints);
    setResult(null);
    setError(null);
    setTraceData(null);
  }

  function updateSource(idx: number, field: keyof Source | "timestamp" | "authority_type", value: string) {
    setSources((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      if (field === "timestamp") return { ...s, metadata: { ...s.metadata, timestamp: value } };
      if (field === "authority_type") return { ...s, metadata: { ...s.metadata, authority_type: value } };
      return { ...s, [field]: value };
    }));
  }

  function addSource() {
    setSources((prev) => [...prev, emptySource(prev.length + 1)]);
  }

  function removeSource(idx: number) {
    setSources((prev) => prev.filter((_, i) => i !== idx));
  }

  async function run() {
    if (domainScore.level === "out-of-domain") {
      setError("❌ Domain Rejection: All sources appear to be outside the Supply Chain & Operations domain. Please provide inventory, logistics, procurement, or warehouse-related data.");
      return;
    }
    if (sources.length === 0) { setError("Add at least one source."); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setTraceData(null);

    const req: PipelineRequest = { sources, constraints };

    try {
      if (mode === "genkit") {
        const r = await api.runGenkit(req);
        setResult(r as GenkitResult);
        // Fetch trace if pipeline_id available
        if ((r as GenkitResult).pipeline_id) {
          try {
            const t = await api.getPipelineTrace((r as GenkitResult).pipeline_id);
            setTraceData(t);
          } catch { /* trace may not exist for genkit runs */ }
        }
      } else {
        const r = await api.runPipeline(req);
        // Normalise express result into GenkitResult shape for display
        const norm: GenkitResult = {
          pipeline_id: (r as { pipeline_id?: string }).pipeline_id ?? "N/A",
          status: (r as { status?: string }).status ?? "completed",
          workplan: "Ingest → Score → Filter → Detect → Resolve → Temporal → Insights → Impact → Actions → Simulate",
          summary: `Pipeline completed via Express orchestrator.`,
          sources_ingested: (r as { ingestion?: { sources_processed?: number } }).ingestion?.sources_processed ?? sources.length,
          contradictions_found: ((r as { contradictions?: unknown[] }).contradictions ?? []).length,
          insights_extracted: ((r as { insights?: unknown[] }).insights ?? []).length,
          actions_generated: ((r as { action_chain?: { actions?: unknown[] } }).action_chain?.actions ?? []).length,
          simulation_success_rate: (r as { outcome?: { metrics?: { success_rate?: number } } }).outcome?.metrics?.success_rate ?? 0.75,
          total_cost_pkr: (r as { outcome?: { metrics?: { total_cost?: number } } }).outcome?.metrics?.total_cost ?? 0,
          risk_reduction_pct: (r as { outcome?: { projected_impact?: { risk_reduction?: number } } }).outcome?.projected_impact?.risk_reduction ?? 65,
          ai_reasoning: "Express orchestrator with Groq fallback",
          orchestrator: "express",
        };
        setResult(norm);
        if (norm.pipeline_id !== "N/A") {
          try { setTraceData(await api.getPipelineTrace(norm.pipeline_id)); } catch { /* ignore */ }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Mode:</span>
            <button
              onClick={() => setMode("genkit")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === "genkit" ? "bg-purple-900/50 border-purple-600 text-purple-300" : "border-gray-700 text-gray-400 hover:text-gray-200"}`}
            >
              🤖 Genkit / Antigravity
            </button>
            <button
              onClick={() => setMode("express")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === "express" ? "bg-sky-900/50 border-sky-600 text-sky-300" : "border-gray-700 text-gray-400 hover:text-gray-200"}`}
            >
              ⚡ Express Pipeline
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">Scenario:</span>
            <select
              value={selectedScenario}
              onChange={(e) => loadScenario(e.target.value)}
              className="input max-w-xs text-xs"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Scenario description */}
        {(() => {
          const sc = SCENARIOS.find((s) => s.id === selectedScenario);
          return sc ? (
            <p className="text-xs text-gray-400 border-l-2 border-sky-700 pl-3">{sc.description}</p>
          ) : null;
        })()}
      </div>

      {/* Domain Score */}
      <DomainBadge score={domainScore} />

      {/* Constraints */}
      <div className="card space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Constraints</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Budget (PKR)</label>
            <input
              type="number"
              className="input"
              value={constraints.budget_limit.amount}
              onChange={(e) => setConstraints((c) => ({ ...c, budget_limit: { ...c.budget_limit, amount: Number(e.target.value) } }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Currency</label>
            <input
              className="input"
              value={constraints.budget_limit.currency}
              onChange={(e) => setConstraints((c) => ({ ...c, budget_limit: { ...c.budget_limit, currency: e.target.value } }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Time Limit (hours)</label>
            <input
              type="number"
              className="input"
              value={constraints.time_limit_hours}
              onChange={(e) => setConstraints((c) => ({ ...c, time_limit_hours: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Urgency</label>
            <select
              className="input"
              value={constraints.urgency}
              onChange={(e) => setConstraints((c) => ({ ...c, urgency: e.target.value as "critical" | "high" | "medium" | "low" }))}
            >
              {["critical", "high", "medium", "low"].map((u) => (
                <option key={u} value={u}>{u.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Sources ({sources.length})
          </h3>
          <button onClick={addSource} className="btn-secondary text-xs py-1">+ Add Source</button>
        </div>

        {sources.map((src, idx) => (
          <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-sky-400 w-16">{src.source_id}</span>
              <select
                className="input max-w-[140px] text-xs"
                value={src.source_type}
                onChange={(e) => updateSource(idx, "source_type", e.target.value)}
              >
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                className="input max-w-[180px] text-xs"
                value={src.metadata.authority_type}
                onChange={(e) => updateSource(idx, "authority_type", e.target.value)}
              >
                {AUTHORITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input
                className="input max-w-[190px] text-xs"
                type="datetime-local"
                value={src.metadata.timestamp.slice(0, 16)}
                onChange={(e) => updateSource(idx, "timestamp", e.target.value + ":00Z")}
              />
              <button
                onClick={() => removeSource(idx)}
                className="ml-auto text-gray-500 hover:text-red-400 transition-colors text-xs"
              >
                ✕ Remove
              </button>
            </div>
            <textarea
              className="input font-mono text-xs leading-relaxed h-28 resize-y"
              placeholder="Paste or type supply-chain content here — inventory reports, CSVs, JSON, emails, news feeds…"
              value={src.content}
              onChange={(e) => updateSource(idx, "content", e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Run */}
      <div className="flex items-center gap-4">
        <button
          onClick={run}
          disabled={loading || sources.length === 0}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running pipeline…
            </>
          ) : (
            `▶ Run ${mode === "genkit" ? "Antigravity" : "Express"} Pipeline`
          )}
        </button>
        {loading && (
          <span className="text-xs text-gray-400">
            Processing {sources.length} sources through 10-module pipeline…
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-800/60 bg-red-950/20">
          <p className="text-red-400 text-sm font-medium">⛔ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && !error && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="badge-pass">✓ {result.status?.toUpperCase() ?? "COMPLETED"}</span>
            <span className="text-xs text-gray-500">Pipeline ID: {result.pipeline_id}</span>
            <span className="text-xs text-gray-500 ml-auto">Orchestrator: {result.orchestrator}</span>
          </div>

          <MetricsBar metrics={[
            { label: "Sources Ingested",       icon: "📥", value: result.sources_ingested,                               color: "text-sky-400" },
            { label: "Contradictions Found",   icon: "⚡", value: result.contradictions_found,                           color: "text-amber-400" },
            { label: "Insights Extracted",     icon: "💡", value: result.insights_extracted,                             color: "text-emerald-400" },
            { label: "Actions Generated",      icon: "🎯", value: result.actions_generated,                              color: "text-purple-400" },
            { label: "Simulation Success",     icon: "📊", value: `${(result.simulation_success_rate * 100).toFixed(0)}%`, color: "text-emerald-400" },
            { label: "Total Cost (PKR)",       icon: "💰", value: result.total_cost_pkr.toLocaleString(),                color: "text-sky-400" },
            { label: "Risk Reduction",         icon: "🛡️", value: `${result.risk_reduction_pct}%`,                       color: "text-emerald-400" },
            { label: "Urgency",                icon: "🔥", value: constraints.urgency.toUpperCase(),                     color: "text-red-400" },
          ]} />

          {/* Workplan */}
          <div className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">10-Step Workplan</p>
            <div className="flex flex-wrap gap-2">
              {result.workplan.split("→").map((step, i) => (
                <span key={i} className="flex items-center gap-1 text-xs text-gray-300">
                  <span className="text-sky-500 font-bold">{i + 1}.</span>
                  {step.trim()}
                  {i < 9 && <span className="text-gray-600 ml-1">→</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Summary & Reasoning tabs */}
          <div className="card space-y-3">
            <div className="flex gap-4 border-b border-gray-800 pb-2">
              {(["result", "trace", "raw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`text-xs pb-1 capitalize ${activeTab === t ? "tab-active" : "tab-inactive"}`}
                >
                  {t === "result" ? "📋 Summary" : t === "trace" ? "🔍 Trace" : "{ } Raw JSON"}
                </button>
              ))}
            </div>

            {activeTab === "result" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">AI Summary</p>
                  <p className="text-sm text-gray-200 leading-relaxed">{result.summary}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">AI Reasoning Trace</p>
                  <p className="text-xs text-gray-300 leading-relaxed font-mono bg-gray-800/50 rounded-lg p-3">{result.ai_reasoning}</p>
                </div>
              </div>
            )}

            {activeTab === "trace" && (
              traceData
                ? <JsonViewer data={traceData} title="Antigravity Pipeline Trace" />
                : <p className="text-xs text-gray-500">Trace not available for this orchestrator mode.</p>
            )}

            {activeTab === "raw" && (
              <JsonViewer data={result} title="Full API Response" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
