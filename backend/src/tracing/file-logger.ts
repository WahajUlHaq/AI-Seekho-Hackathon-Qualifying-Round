import * as fs from "fs";
import * as path from "path";

export interface AntigravityTraceEntry {
    timestamp: string;
    step: string;
    tool_called: string;
    reasoning: string;
    status: "SUCCESS" | "FAILED" | "ROLLED_BACK";
    rollback_action: string;
}

const DEFAULT_LOG_PATH = path.resolve(process.cwd(), "logs/antigravity_trace.log");

export class AntigravityFileLogger {
    private logPath: string;

    constructor(logPath: string = DEFAULT_LOG_PATH) {
        this.logPath = logPath;
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    append(entry: AntigravityTraceEntry): void {
        const line = JSON.stringify(entry) + "\n";
        fs.appendFileSync(this.logPath, line, "utf-8");
    }

    readAll(): AntigravityTraceEntry[] {
        if (!fs.existsSync(this.logPath)) return [];
        return fs
            .readFileSync(this.logPath, "utf-8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as AntigravityTraceEntry);
    }

    getPath(): string {
        return this.logPath;
    }
}

export const antigravityFileLogger = new AntigravityFileLogger();
