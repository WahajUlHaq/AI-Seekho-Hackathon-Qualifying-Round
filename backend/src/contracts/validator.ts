import { Contract, ContractField } from "./registry";
import { llmClient } from "../utils/llm-client";

export type ValidationLevel = "PASS" | "WARN" | "REJECT";

export interface ValidationResult {
    level: ValidationLevel;
    passed: boolean;
    errors: string[];
    warnings: string[];
    semantic_issues?: string[];
    contract_name: string;
    contract_version: string;
    validated_at: string;
}

export class ContractValidator {
    validate(data: unknown, contract: Contract): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const record =
            typeof data === "object" && data !== null
                ? (data as Record<string, unknown>)
                : {};

        this.validateFields(record, contract.fields, "", errors, warnings);

        const level: ValidationLevel =
            errors.length > 0 ? "REJECT" : warnings.length > 0 ? "WARN" : "PASS";

        return {
            level,
            passed: level !== "REJECT",
            errors,
            warnings,
            contract_name: contract.name,
            contract_version: contract.version,
            validated_at: new Date().toISOString(),
        };
    }

    private validateFields(
        data: Record<string, unknown>,
        fields: Record<string, ContractField>,
        prefix: string,
        errors: string[],
        warnings: string[]
    ): void {
        for (const [fieldName, schema] of Object.entries(fields)) {
            const key = prefix ? `${prefix}.${fieldName}` : fieldName;
            const value = data[fieldName];

            if (schema.required && (value === undefined || value === null)) {
                errors.push(`Missing required field: ${key}`);
                continue;
            }
            if (value === undefined || value === null) continue;

            if (!this.checkType(value, schema.type)) {
                errors.push(`Field ${key}: expected ${schema.type}, got ${Array.isArray(value) ? "array" : typeof value}`);
                continue;
            }

            if (schema.type === "string" && typeof value === "string") {
                if (schema.regex && !new RegExp(schema.regex).test(value)) {
                    errors.push(`Field ${key}: "${value}" does not match pattern ${schema.regex}`);
                }
                if (schema.enum && !schema.enum.includes(value)) {
                    errors.push(`Field ${key}: "${value}" is not one of [${schema.enum.join(", ")}]`);
                }
            }

            if (schema.type === "number" && typeof value === "number") {
                if (schema.min !== undefined && value < schema.min) {
                    warnings.push(`Field ${key}: ${value} is below minimum ${schema.min}`);
                }
                if (schema.max !== undefined && value > schema.max) {
                    warnings.push(`Field ${key}: ${value} exceeds maximum ${schema.max}`);
                }
            }

            if (schema.type === "array" && Array.isArray(value) && schema.items) {
                value.forEach((item, i) => {
                    if (schema.items!.type === "object" && schema.items!.properties) {
                        this.validateFields(
                            item as Record<string, unknown>,
                            schema.items!.properties,
                            `${key}[${i}]`,
                            errors,
                            warnings
                        );
                    }
                });
            }
        }
    }

    private checkType(value: unknown, type: ContractField["type"]): boolean {
        switch (type) {
            case "string":  return typeof value === "string";
            case "number":  return typeof value === "number";
            case "boolean": return typeof value === "boolean";
            case "array":   return Array.isArray(value);
            case "object":  return typeof value === "object" && !Array.isArray(value) && value !== null;
        }
    }

    async validateSemantic(
        data: unknown,
        contract: Contract,
        context?: string
    ): Promise<ValidationResult> {
        const structural = this.validate(data, contract);

        if (!contract.semantic_checks || contract.semantic_checks.length === 0) {
            return structural;
        }

        const prompt = `You are a data validation agent. Check if the following data satisfies all semantic rules.

Contract: ${contract.name} v${contract.version}

Semantic rules to check:
${contract.semantic_checks.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Data:
${JSON.stringify(data, null, 2)}
${context ? `\nContext: ${context}` : ""}

For each rule, respond with PASS or FAIL and a brief reason. Format exactly:
RULE_1: PASS|FAIL - reason
RULE_2: PASS|FAIL - reason
OVERALL: PASS|FAIL`;

        const response = await llmClient.complete(prompt, true);
        const semantic_issues: string[] = [];
        let overallFail = false;

        for (const line of response.split("\n")) {
            if (line.includes("FAIL") && !line.startsWith("OVERALL")) {
                semantic_issues.push(line.trim());
            }
            if (line.startsWith("OVERALL") && line.includes("FAIL")) {
                overallFail = true;
            }
        }

        return {
            ...structural,
            level: overallFail ? "REJECT" : structural.level,
            passed: !overallFail && structural.passed,
            semantic_issues,
        };
    }
}

export const contractValidator = new ContractValidator();
