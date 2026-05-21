import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openApiSpec } from "./openapi";

// Usage: ts-node export-spec.ts [outPath]
// Default out: ./openapi.json (relative to this script).
const outArg = process.argv[2] ?? resolve(__dirname, "openapi.json");
const outPath = resolve(process.cwd(), outArg);

writeFileSync(outPath, JSON.stringify(openApiSpec, null, 2), "utf8");
process.stdout.write(`[export-spec] wrote ${outPath}\n`);
