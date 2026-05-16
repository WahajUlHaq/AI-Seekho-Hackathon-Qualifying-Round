import type { PipelineRequest, PipelineResult, GenkitResult, HealthResponse, Contract } from "./types";

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  health: () => get<HealthResponse>("/health".replace("/api", "")),

  runPipeline: (req: PipelineRequest) =>
    post<PipelineResult>("/pipeline/run", req),

  runGenkit: (req: PipelineRequest) =>
    post<GenkitResult>("/genkit/run", req),

  getPipelineTrace: (id: string) =>
    get<unknown>(`/pipeline/${id}/trace`),

  getContracts: () =>
    get<{ contracts: Contract[]; total: number }>("/contracts"),

  getContract: (id: string) =>
    get<unknown>(`/contracts/${id}`),

  getValidations: (pipelineId?: string) =>
    pipelineId
      ? get<unknown>(`/validations/${pipelineId}`)
      : get<unknown>("/validations"),

  runAgent: (agent: string, body: unknown) =>
    post<unknown>(`/agents/${agent}`, body),

  getAgentTools: () =>
    get<unknown>("/agents/tools"),
};
