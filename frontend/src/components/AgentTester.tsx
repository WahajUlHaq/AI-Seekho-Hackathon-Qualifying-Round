import { useState } from "react";
import { api } from "../api";
import { JsonViewer } from "./JsonViewer";
import { scoreAllSources } from "../domain";
import { DomainBadge } from "./DomainBadge";

interface AgentDef {
  path: string;
  label: string;
  icon: string;
  module: number;
  sampleBody: Record<string, unknown>;
}

const AGENTS: AgentDef[] = [
  {
    path: "ingest", label: "Multi-Source Ingestion", icon: "📥", module: 1,
    sampleBody: {
      pipeline_id: "TEST-AGENT-001",
      sources: [
        { source_id: "S1", source_type: "csv", content: "date,sku,stock_units\n2026-05-15,SKU-1234,45", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "internal_system" } },
        { source_id: "S2", source_type: "json", content: '{"sku":"SKU-1234","status":"CRITICAL","reorder_point":200}', metadata: { timestamp: "2026-05-15T09:01:00Z", authority_type: "internal_system" } },
      ],
    },
  },
  {
    path: "score", label: "Credibility Scorer", icon: "⭐", module: 2,
    sampleBody: {
      pipeline_id: "TEST-AGENT-002",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "Official warehouse report: inventory at 45 units, CRITICAL shortage declared.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
        { source_id: "S2", source_type: "url", content: "Rumour on social media: warehouse running out of stock.", metadata: { timestamp: "2026-05-14T00:00:00Z", authority_type: "news_feed" } },
      ],
    },
  },
  {
    path: "filter", label: "Noise Filter & Dedup", icon: "🔍", module: 3,
    sampleBody: {
      pipeline_id: "TEST-AGENT-003",
      sources: [
        { source_id: "S1", source_type: "json", content: "Inventory: 45 units SKU-1234, CRITICAL shortage.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "internal_system" } },
        { source_id: "S2", source_type: "url", content: "Inventory: 45 units SKU-1234, CRITICAL shortage.", metadata: { timestamp: "2026-05-15T09:01:00Z", authority_type: "news_feed" } },
        { source_id: "S3", source_type: "csv", content: "date,sku,sales\n2026-05-15,SKU-1234,180", metadata: { timestamp: "2026-05-15T12:00:00Z", authority_type: "analytics_platform" } },
      ],
    },
  },
  {
    path: "detect", label: "Contradiction Detector", icon: "⚡", module: 4,
    sampleBody: {
      pipeline_id: "TEST-AGENT-004",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "Warehouse report: inventory level 45 units. CRITICAL shortage declared.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
        { source_id: "S2", source_type: "json", content: '{"inventory_level":200,"status":"normal","facility":"Warehouse B"}', metadata: { timestamp: "2026-05-15T08:00:00Z", authority_type: "internal_system" } },
      ],
    },
  },
  {
    path: "resolve", label: "Conflict Resolution", icon: "🤝", module: 5,
    sampleBody: {
      pipeline_id: "TEST-AGENT-005",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "Stock level: 45 units. CRITICAL.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
        { source_id: "S2", source_type: "json", content: "Stock level: 200 units. Normal.", metadata: { timestamp: "2026-05-14T09:00:00Z", authority_type: "internal_system" } },
      ],
    },
  },
  {
    path: "temporal", label: "Temporal Analysis", icon: "📅", module: 6,
    sampleBody: {
      pipeline_id: "TEST-AGENT-006",
      sources: [
        { source_id: "S1", source_type: "csv", content: "date,orders\n2026-05-11,100\n2026-05-12,98\n2026-05-13,100\n2026-05-14,130\n2026-05-15,180", metadata: { timestamp: "2026-05-15T12:00:00Z", authority_type: "analytics_platform" } },
      ],
    },
  },
  {
    path: "insights", label: "Insight Extraction", icon: "💡", module: 7,
    sampleBody: {
      pipeline_id: "TEST-AGENT-007",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "CRITICAL inventory shortage: 45 units vs 200 reorder point. Transport strike causing 5-day delay. Sales velocity +38% in 48 hours.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
        { source_id: "S2", source_type: "json", content: '{"alternate_supplier":"Beta Parts","lead_time_days":14,"cost_premium_pct":12,"emergency_stock":200}', metadata: { timestamp: "2026-05-15T08:00:00Z", authority_type: "supplier_portal" } },
      ],
    },
  },
  {
    path: "impact", label: "Impact Analysis", icon: "📊", module: 8,
    sampleBody: {
      pipeline_id: "TEST-AGENT-008",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "Inventory critical shortage: stockout in 2 days. Potential lost revenue: PKR 9M. 47 customer complaints pending. 3 production lines at risk.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
      ],
      constraints: { budget_limit: { amount: 500000, currency: "PKR" }, time_limit: { max_duration_hours: 24 }, urgency_level: "high" },
    },
  },
  {
    path: "actions", label: "Action Chain Generator", icon: "🎯", module: 9,
    sampleBody: {
      pipeline_id: "TEST-AGENT-009",
      sources: [
        { source_id: "S1", source_type: "pdf", content: "Emergency procurement needed. Alternate supplier Beta Parts has 500 units at +12% cost. Inter-branch transfer from Warehouse B: 200 units, 2-day lead time.", metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" } },
      ],
      insights: [
        { insight_id: "INS-001", title: "Critical shortage imminent", description: "45 units will exhaust in 2 days at current demand", priority: "CRITICAL", confidence: 0.95 },
      ],
      constraints: { budget_limit: { amount: 500000, currency: "PKR" }, time_limit: { max_duration_hours: 24 }, urgency_level: "critical" },
    },
  },
  {
    path: "simulate", label: "Simulator", icon: "🔬", module: 10,
    sampleBody: {
      pipeline_id: "TEST-AGENT-010",
      actions: [
        { action_id: "ACT-001", action_type: "diagnose", description: "Verify exact stock count", depends_on: [], simulatable: true, constraints: { budget: 0 }, failure_recovery: { strategy: "retry" } },
        { action_id: "ACT-002", action_type: "notify", description: "Alert procurement team", depends_on: ["ACT-001"], simulatable: true, constraints: { budget: 1000 }, failure_recovery: { strategy: "escalate" } },
        { action_id: "ACT-003", action_type: "update_system", description: "Place emergency order with Beta Parts", depends_on: ["ACT-002"], simulatable: true, constraints: { budget: 300000 }, failure_recovery: { strategy: "rollback" } },
      ],
      execution_order: ["ACT-001", "ACT-002", "ACT-003"],
      constraints: { budget_limit: { amount: 500000, currency: "PKR" } },
    },
  },
];

export function AgentTester() {
  const [selected, setSelected] = useState<AgentDef>(AGENTS[0]);
  const [body, setBody] = useState(JSON.stringify(AGENTS[0].sampleBody, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  function selectAgent(agent: AgentDef) {
    setSelected(agent);
    setBody(JSON.stringify(agent.sampleBody, null, 2));
    setResult(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(body);
      const res = await api.runAgent(selected.path, parsed);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const bodyContent = (() => {
    try {
      const parsed = JSON.parse(body);
      const sources = (parsed.sources ?? []) as Array<{ content?: string }>;
      return scoreAllSources(sources.map((s) => s.content ?? ""));
    } catch {
      return scoreAllSources([body]);
    }
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      {/* Agent list */}
      <div className="lg:col-span-1 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Select Module</p>
        {AGENTS.map((a) => (
          <button
            key={a.path}
            onClick={() => selectAgent(a)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              selected.path === a.path
                ? "bg-sky-900/40 border border-sky-700 text-sky-300"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <span>{a.icon}</span>
            <div>
              <div className="font-medium text-xs">{a.label}</div>
              <div className="text-gray-500 text-xs">Module {a.module}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Editor + Result */}
      <div className="lg:col-span-3 space-y-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{selected.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-100">{selected.label}</h3>
              <p className="text-xs text-gray-500">POST /api/agents/{selected.path}</p>
            </div>
          </div>

          <DomainBadge score={bodyContent} />

          <div className="mt-3">
            <label className="text-xs text-gray-500 mb-1 block">Request Body (JSON)</label>
            <textarea
              className="input font-mono text-xs leading-relaxed h-64 resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <button onClick={run} disabled={loading} className="btn-primary mt-3 flex items-center gap-2">
            {loading ? (
              <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running…</>
            ) : `▶ Run ${selected.label}`}
          </button>
        </div>

        {error && (
          <div className="card border-red-800/60 bg-red-950/20">
            <p className="text-red-400 text-sm">⛔ {error}</p>
          </div>
        )}

        {result && <JsonViewer data={result} title={`${selected.label} Output`} />}
      </div>
    </div>
  );
}
