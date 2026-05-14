import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export interface ContractField {
    type: "string" | "number" | "boolean" | "array" | "object";
    required?: boolean;
    regex?: string;
    enum?: string[];
    min?: number;
    max?: number;
    items?: ContractField;
    properties?: Record<string, ContractField>;
}

export interface Contract {
    name: string;
    version: string;
    module: string;
    description: string;
    fields: Record<string, ContractField>;
    semantic_checks?: string[];
}

export class ContractRegistry {
    private contracts: Map<string, Contract> = new Map();

    async loadAll(definitionsDir: string): Promise<void> {
        if (!fs.existsSync(definitionsDir)) {
            console.warn(`[ContractRegistry] Definitions directory not found: ${definitionsDir}`);
            return;
        }
        const files = fs
            .readdirSync(definitionsDir)
            .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

        for (const file of files) {
            const content = fs.readFileSync(path.join(definitionsDir, file), "utf-8");
            const contract = yaml.load(content) as Contract;
            // Register by name (latest) and name@version (pinned)
            this.contracts.set(contract.name, contract);
            this.contracts.set(`${contract.name}@${contract.version}`, contract);
            console.log(`[ContractRegistry] Loaded: ${contract.name} v${contract.version}`);
        }
    }

    get(name: string): Contract | undefined {
        return this.contracts.get(name);
    }

    getRequired(name: string): Contract {
        const contract = this.contracts.get(name);
        if (!contract) throw new Error(`[ContractRegistry] Contract not found: ${name}`);
        return contract;
    }

    list(): string[] {
        const names = new Set<string>();
        this.contracts.forEach((_, key) => {
            if (!key.includes("@")) names.add(key);
        });
        return Array.from(names);
    }
}

export const contractRegistry = new ContractRegistry();
