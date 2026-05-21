/**
 * Document picking + RawSource assembly. Uses Expo SDK 54 APIs:
 *   - DocumentPicker.getDocumentAsync → { canceled, assets: [...] }
 *   - new File(uri).base64() / .text() (legacy readAsStringAsync throws)
 *
 * Encoding rules (mirror frontend/src/features/ingestion/components/IngestionDashboard.tsx):
 *   - pdf  → base64
 *   - csv / txt / json → raw UTF-8
 *   - url  → URL string in content
 */

import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { RawSource, SourceType } from "@/types/pipeline";

export type StagedKind = "file" | "url" | "text";

export interface StagedSource {
    id: string;                       // local UI id (also used as source_id default)
    kind: StagedKind;
    sourceType: SourceType;
    displayName: string;
    content: string;
    sizeBytes: number;
}

const MIME_TO_TYPE: Record<string, SourceType> = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/csv": "csv",
    "text/plain": "txt",
    "application/json": "json",
};

const EXT_TO_TYPE: Record<string, SourceType> = {
    pdf: "pdf",
    csv: "csv",
    txt: "txt",
    json: "json",
};

function detectSourceType(name: string, mimeType: string | undefined): SourceType {
    if (mimeType && MIME_TO_TYPE[mimeType]) return MIME_TO_TYPE[mimeType];
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    return EXT_TO_TYPE[ext] ?? "txt";
}

function nextId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export class IngestionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "IngestionError";
    }
}

export async function pickAndStage(): Promise<StagedSource | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "text/plain", "application/json"],
        multiple: false,
        copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;

    const sourceType = detectSourceType(asset.name, asset.mimeType);
    const file = new File(asset.uri);

    let content: string;
    try {
        content = sourceType === "pdf" ? await file.base64() : await file.text();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new IngestionError(`Failed to read ${asset.name}: ${msg}`);
    }

    return {
        id: nextId("SRC"),
        kind: "file",
        sourceType,
        displayName: asset.name,
        content,
        sizeBytes: asset.size ?? content.length,
    };
}

export function addTextSnippet(text: string): StagedSource {
    const clean = text.trim();
    if (!clean) throw new IngestionError("Empty text snippet.");
    return {
        id: nextId("SRC"),
        kind: "text",
        sourceType: "txt",
        displayName: clean.slice(0, 32) + (clean.length > 32 ? "…" : ""),
        content: clean,
        sizeBytes: clean.length,
    };
}

export function addUrl(url: string): StagedSource {
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) {
        throw new IngestionError("URL must start with http:// or https://.");
    }
    return {
        id: nextId("SRC"),
        kind: "url",
        sourceType: "url",
        displayName: clean,
        content: clean,
        sizeBytes: clean.length,
    };
}

export function toRawSources(staged: readonly StagedSource[]): RawSource[] {
    return staged.map((s, i) => ({
        source_id: s.id || `SRC-${i + 1}`,
        source_type: s.sourceType,
        content: s.content,
        ingested_at: new Date().toISOString(),
    }));
}
