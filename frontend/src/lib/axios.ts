import axios, { AxiosError, type AxiosInstance } from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

export interface ConflictError {
  kind: "conflict";
  status: 409;
  pipelineId?: string;
  currentState?: string;
  message: string;
}

export interface ApiError {
  kind: "api";
  status: number;
  message: string;
  raw: unknown;
}

export type NormalizedError = ConflictError | ApiError;

export function isConflict(error: unknown): error is ConflictError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { kind?: string }).kind === "conflict"
  );
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; pipeline_id?: string; current_state?: string }>) => {
    const status = error.response?.status;
    const body = error.response?.data;

    if (status === 409) {
      const conflict: ConflictError = {
        kind: "conflict",
        status: 409,
        pipelineId: body?.pipeline_id,
        currentState: body?.current_state,
        message: body?.error ?? "Execution state already modified.",
      };
      return Promise.reject(conflict);
    }

    const normalized: ApiError = {
      kind: "api",
      status: status ?? 0,
      message: body?.error ?? error.message ?? "Request failed",
      raw: error.response?.data ?? error,
    };
    return Promise.reject(normalized);
  }
);
