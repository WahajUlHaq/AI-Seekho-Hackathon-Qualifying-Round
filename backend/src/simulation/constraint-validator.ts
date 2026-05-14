import {
    ActionChain,
    ActionNode,
    Constraints,
    ConstraintValidationResult,
    ConstraintViolation,
} from "../types/simulation.types";

export class ConstraintValidator {
    validateActionChain(
        chain: ActionChain,
        constraints: Constraints
    ): ConstraintValidationResult[] {
        return chain.actions.map((action) => this.validateSingle(action, constraints));
    }

    private validateSingle(
        action: ActionNode,
        constraints: Constraints
    ): ConstraintValidationResult {
        const violations: ConstraintViolation[] = [];

        // Budget check
        if (action.constraints.max_cost > constraints.budget_limit.amount) {
            violations.push({
                constraint_type: "budget",
                limit: constraints.budget_limit.amount,
                required: action.constraints.max_cost,
                severity: "blocking",
            });
        }

        // Time check
        if (
            action.constraints.max_duration_hours >
            constraints.time_limit.max_duration_hours
        ) {
            violations.push({
                constraint_type: "time",
                limit: constraints.time_limit.max_duration_hours,
                required: action.constraints.max_duration_hours,
                severity: "blocking",
            });
        }

        // API rate limit check
        if (
            action.constraints.api_rate_limit >
            constraints.resource_limits.api_calls_per_hour
        ) {
            violations.push({
                constraint_type: "resource",
                limit: constraints.resource_limits.api_calls_per_hour,
                required: action.constraints.api_rate_limit,
                severity: "warning",
            });
        }

        const is_feasible =
            violations.filter((v) => v.severity === "blocking").length === 0;

        let recommended_modification: string | null = null;
        if (!is_feasible) {
            if (violations.some((v) => v.constraint_type === "budget")) {
                recommended_modification =
                    "Reduce scope or use lower-cost alternative";
            } else if (violations.some((v) => v.constraint_type === "time")) {
                recommended_modification =
                    "Parallelize with other actions or reduce wait time";
            }
        }

        return {
            action_id: action.action_id,
            is_feasible,
            violations,
            recommended_modification,
        };
    }
}

export const constraintValidator = new ConstraintValidator();
