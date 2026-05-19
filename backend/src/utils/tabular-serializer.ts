/**
 * Tabular-to-Text Serializer
 *
 * Converts CSV/JSON rows into natural-language sentences before they reach
 * the RAG embedding step. This prevents the well-known "tabular hallucination"
 * problem where embeddings of raw JSON/CSV strings retrieve unrelated rows
 * because the model sees keys-and-values as a single dense token blob.
 *
 * After serialization, each row reads like a sentence the embedding model
 * can faithfully ground (e.g. "As of 2026-05-19, Supplier SUP-104 reliability
 * dropped to 0.61 with status Delayed").
 */

const TIMESTAMP_KEYS = ["Date", "date", "timestamp", "Timestamp", "as_of", "asOf"];
const ENTITY_KEYS = [
    "Supplier_ID", "supplier_id", "SupplierID",
    "SKU", "sku", "Sku",
    "Product", "product_id", "product", "ProductID",
    "Customer_ID", "customer_id",
    "Order_ID", "order_id",
    "ID", "id",
];

function humanize(field: string): string {
    return field
        .replace(/[_-]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .trim();
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "(unknown)";
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "yes" : "no";
    return String(value).trim();
}

export function serializeCSVRow(
    row: Record<string, unknown>,
    columns?: string[]
): string {
    const parts: string[] = [];

    // 1. Timestamp prefix
    let timestampValue: string | null = null;
    for (const key of TIMESTAMP_KEYS) {
        if (row[key] !== undefined && row[key] !== "") {
            timestampValue = formatValue(row[key]);
            break;
        }
    }
    if (timestampValue) parts.push(`As of ${timestampValue}`);

    // 2. Entity identifiers (subject of the sentence)
    const seenKeys = new Set<string>(TIMESTAMP_KEYS);
    const entityFragments: string[] = [];
    for (const key of ENTITY_KEYS) {
        if (row[key] !== undefined && row[key] !== "") {
            entityFragments.push(`${humanize(key)} ${formatValue(row[key])}`);
            seenKeys.add(key);
        }
    }
    if (entityFragments.length > 0) {
        parts.push(entityFragments.join(" / "));
    }

    // 3. Remaining facts (predicate of the sentence)
    const colList = columns ?? Object.keys(row);
    const remainingFacts: string[] = [];
    for (const key of colList) {
        if (seenKeys.has(key)) continue;
        if (row[key] === undefined || row[key] === null || row[key] === "") continue;
        remainingFacts.push(`${humanize(key)} is ${formatValue(row[key])}`);
    }
    if (remainingFacts.length > 0) {
        parts.push(remainingFacts.join("; "));
    }

    return parts.filter(Boolean).join(" — ") + ".";
}

export interface SerializedTable {
    sentences: string[];
    summary: string;
    row_count: number;
}

export function serializeCSVTable(
    rows: Record<string, unknown>[],
    columns?: string[]
): SerializedTable {
    if (rows.length === 0) {
        return { sentences: [], summary: "Empty table — 0 rows.", row_count: 0 };
    }

    const sentences = rows.map((row) => serializeCSVRow(row, columns));
    const cols = columns ?? Object.keys(rows[0]);
    const summary = `Tabular dataset with ${rows.length} rows and ${cols.length} columns: ${cols.join(", ")}.`;

    return { sentences, summary, row_count: rows.length };
}

export function serializeJSONValue(
    value: unknown,
    pathPrefix = ""
): string[] {
    const sentences: string[] = [];

    if (value === null || value === undefined) {
        return sentences;
    }

    if (Array.isArray(value)) {
        // Array of records → serialize each as a row
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && !Array.isArray(value[0])) {
            for (const item of value as Record<string, unknown>[]) {
                sentences.push(serializeCSVRow(item));
            }
        } else {
            sentences.push(
                `${pathPrefix || "List"} contains ${value.length} ${typeof value[0] === "object" ? "items" : "values"}: ${value.slice(0, 10).map(formatValue).join(", ")}${value.length > 10 ? ", ..." : ""}.`
            );
        }
        return sentences;
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        for (const [k, v] of Object.entries(obj)) {
            const fullPath = pathPrefix ? `${pathPrefix}.${k}` : k;
            if (v === null || v === undefined) continue;

            if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
                sentences.push(...serializeJSONValue(v, fullPath));
            } else {
                sentences.push(`${humanize(fullPath)} is ${formatValue(v)}.`);
            }
        }
        return sentences;
    }

    sentences.push(`${pathPrefix || "Value"} is ${formatValue(value)}.`);
    return sentences;
}

export function serializeJSONDocument(parsed: unknown): SerializedTable {
    const sentences = serializeJSONValue(parsed);
    const summary = Array.isArray(parsed)
        ? `JSON array with ${(parsed as unknown[]).length} items.`
        : `JSON document with ${Object.keys(parsed as Record<string, unknown>).length} top-level fields.`;
    return { sentences, summary, row_count: sentences.length };
}
