/**
 * V2 Phase 4 — Global Trace Formatting Engine.
 *
 * Parses the line-delimited `antigravity_trace.log` produced by the
 * `AntigravityFileLogger`, wraps every event into a single, strictly-valid
 * JSON array (`[...]`), validates the 5 core rubric keys are present on
 * every entry, and writes the finalized document to disk for hackathon
 * submission.
 *
 * Antigravity invokes this formatter ONCE at the very end of the pipeline
 * lifecycle (or from the panic handler on failure). The formatter is a
 * passive tool — it never starts background work and never mutates state
 * beyond writing the output file.
 */

import * as fs from "fs";
import * as path from "path";
import {
    antigravityFileLogger,
    AntigravityTraceEntry,
    RUBRIC_CATEGORIES,
    RubricCategory,
} from "./file-logger";

/** Mandatory top-level keys on every persisted trace entry. */
export const REQUIRED_RUBRIC_KEYS = [
    "workplan_formulation",
    "task_execution",
    "tool_calls",
    "constraint_evaluation",
    "failure_recovery",
] as const;

export interface TraceFormatterOptions {
    /** Override the source log path. Defaults to the singleton file-logger path. */
    logPath?: string;
    /** Where to write the final JSON array. Defaults to docs/submission/antigravity_trace_final.json. */
    outputPath?: string;
    /** Pretty-print JSON with 2-space indentation. Defaults to true. */
    pretty?: boolean;
}

export interface TraceFormatterResult {
    /** Resolved input log path. */
    log_path: string;
    /** Resolved output JSON path. */
    output_path: string;
    /** Number of parsed entries written to the array. */
    entry_count: number;
    /** Count of entries per rubric category. */
    rubric_breakdown: Record<RubricCategory, number>;
    /** Validation summary — all keys present is a strict pass. */
    validation: {
        all_entries_have_rubric_keys: boolean;
        missing_keys_per_entry: Array<{ index: number; missing: string[] }>;
    };
    /** The in-memory JSON array (also the on-disk contents). */
    entries: AntigravityTraceEntry[];
}

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_OUTPUT_PATH = path.resolve(
    BACKEND_ROOT,
    "..",
    "docs",
    "submission",
    "antigravity_trace_final.json"
);

/**
 * Reads the raw line-delimited log, parses each line into a JSON object,
 * skips malformed lines (loudly — they go to stderr), and returns the
 * resulting array.
 */
function parseLogFile(logPath: string): AntigravityTraceEntry[] {
    if (!fs.existsSync(logPath)) {
        throw new Error(
            `[trace-formatter] Source log not found at ${logPath}. ` +
                `Run a pipeline first so the AntigravityFileLogger has events to format.`
        );
    }

    const raw = fs.readFileSync(logPath, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);

    const entries: AntigravityTraceEntry[] = [];
    lines.forEach((line, idx) => {
        try {
            const parsed = JSON.parse(line) as AntigravityTraceEntry;
            entries.push(parsed);
        } catch (err) {
            // Malformed entries are skipped but reported. They should never
            // happen in practice because the logger emits JSON.stringify
            // output one-line-per-entry.
            // eslint-disable-next-line no-console
            console.error(
                `[trace-formatter] Skipping malformed line ${idx + 1}: ${(err as Error).message}`
            );
        }
    });
    return entries;
}

function validateEntries(entries: AntigravityTraceEntry[]): TraceFormatterResult["validation"] {
    const missing_keys_per_entry: Array<{ index: number; missing: string[] }> = [];

    entries.forEach((entry, index) => {
        const record = entry as unknown as Record<string, unknown>;
        const missing = REQUIRED_RUBRIC_KEYS.filter((key) => record[key] === undefined);
        if (missing.length > 0) {
            missing_keys_per_entry.push({ index, missing });
        }
    });

    return {
        all_entries_have_rubric_keys: missing_keys_per_entry.length === 0,
        missing_keys_per_entry,
    };
}

function buildRubricBreakdown(
    entries: AntigravityTraceEntry[]
): Record<RubricCategory, number> {
    const breakdown = Object.fromEntries(
        RUBRIC_CATEGORIES.map((c) => [c, 0])
    ) as Record<RubricCategory, number>;

    for (const entry of entries) {
        const cat = entry.rubric_category;
        if (cat && breakdown[cat] !== undefined) {
            breakdown[cat] += 1;
        }
    }
    return breakdown;
}

/**
 * Format and persist the final submission trace.
 *
 * Antigravity calls this at end-of-pipeline (or from the panic handler).
 * The function is intentionally synchronous — fs operations are tiny and
 * the trace formatter is the very last step of the run.
 */
export function formatTrace(opts: TraceFormatterOptions = {}): TraceFormatterResult {
    const logPath = path.resolve(opts.logPath ?? antigravityFileLogger.getPath());
    const outputPath = path.resolve(opts.outputPath ?? DEFAULT_OUTPUT_PATH);
    const pretty = opts.pretty ?? true;

    const entries = parseLogFile(logPath);
    const validation = validateEntries(entries);
    const rubric_breakdown = buildRubricBreakdown(entries);

    // Ensure the submission directory exists before writing.
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const serialized = pretty
        ? JSON.stringify(entries, null, 2)
        : JSON.stringify(entries);
    fs.writeFileSync(outputPath, serialized, "utf-8");

    return {
        log_path: logPath,
        output_path: outputPath,
        entry_count: entries.length,
        rubric_breakdown,
        validation,
        entries,
    };
}
