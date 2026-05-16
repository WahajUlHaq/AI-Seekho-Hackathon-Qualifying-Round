export type SourceType = "pdf" | "url" | "csv" | "json" | "table" | "realtime_feed";

export interface Source {
  source_id: string;
  source_type: SourceType;
  content: string;
  metadata: {
    timestamp: string;
    authority_type: string;
  };
}

export interface Constraints {
  budget_limit: { amount: number; currency: string };
  time_limit_hours: number;
  urgency: "critical" | "high" | "medium" | "low";
}

export interface PipelineRequest {
  sources: Source[];
  constraints: Constraints;
}

export interface PipelineResult {
  pipeline_id: string;
  status: string;
  ingestion?: { sources_processed: number };
  contradictions?: unknown[];
  insights?: unknown[];
  action_chain?: { actions: unknown[] };
  outcome?: {
    metrics?: { success_rate: number; total_cost: number };
    projected_impact?: { risk_reduction: number };
  };
  trace?: unknown;
  orchestrator?: string;
  error?: string;
}

export interface GenkitResult {
  pipeline_id: string;
  status: string;
  workplan: string;
  summary: string;
  sources_ingested: number;
  contradictions_found: number;
  insights_extracted: number;
  actions_generated: number;
  simulation_success_rate: number;
  total_cost_pkr: number;
  risk_reduction_pct: number;
  ai_reasoning: string;
  orchestrator: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  environment: string;
  provider: string;
  contracts_loaded: string[];
  timestamp: string;
  antigravity_orchestrator?: string;
}

export interface Contract {
  name: string;
  version: string;
  module: string;
  description: string;
  field_count: number;
  semantic_checks: number;
}

export interface DomainScore {
  score: number;
  level: "in-domain" | "borderline" | "out-of-domain";
  matched: string[];
  verdict: string;
}

export type TabId = "pipeline" | "genkit" | "agents" | "contracts" | "health";

export const AUTHORITY_TYPES = [
  "internal_system",
  "analytics_platform",
  "supplier_portal",
  "news_feed",
  "legal_document",
  "official_report",
  "customer_feedback",
  "realtime_sensor",
];
