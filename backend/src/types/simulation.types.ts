// Shared types used across simulation modules and agents

export interface Constraints {
    budget_limit: { amount: number; currency: string };
    time_limit: { deadline?: string; max_duration_hours: number };
    resource_limits: {
        api_calls_per_hour: number;
        compute_units: number;
        human_hours_available: number;
    };
    urgency_level: "critical" | "high" | "medium" | "low";
}

export type ActionType =
    | "diagnose"
    | "notify"
    | "update_system"
    | "mitigate"
    | "monitor"
    | "verify"
    | "escalate";

export interface ActionNode {
    action_id: string;
    action_type: ActionType;
    title: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    depends_on: string[];
    blocks: string[];
    constraints: {
        max_cost: number;
        max_duration_hours: number;
        required_resources: string[];
        api_rate_limit: number;
    };
    simulatable: boolean;
    simulation_details: {
        simulation_type: string;
        parameters: Record<string, unknown>;
        expected_success_rate: number;
    };
    failure_recovery: {
        retry_count: number;
        fallback_action_id: string | null;
        rollback_required: boolean;
    };
}

export interface ActionChain {
    chain_id: string;
    action_count: number;
    insight_id: string;
    actions: ActionNode[];
    execution_order: string[];
    total_estimated_cost: number;
    total_estimated_duration_hours: number;
    constraint_violations: Array<{
        action_id: string;
        constraint_type: string;
        violation_details: string;
    }>;
}

export interface SimulationState {
    state_id: string;
    timestamp: string;
    variables: Record<string, unknown>;
}

export interface ActionExecutionResult {
    action_id: string;
    status: "success" | "failed" | "skipped";
    before_state: SimulationState;
    after_state: SimulationState;
    execution_log: string[];
    cost: number;
    duration_ms: number;
    failure_reason: string | null;
}

export interface RecoveryPlan {
    failed_action_id: string;
    recovery_strategy: "retry" | "fallback" | "rollback" | "skip_and_continue";
    retry_attempts: number;
    fallback_action: ActionNode | null;
    rollback_to_state: SimulationState | null;
    recovery_execution_log: string[];
}

export interface ConstraintViolation {
    constraint_type: "budget" | "time" | "resource" | "urgency";
    limit: number;
    required: number;
    severity: "blocking" | "warning";
}

export interface ConstraintValidationResult {
    action_id: string;
    is_feasible: boolean;
    violations: ConstraintViolation[];
    recommended_modification: string | null;
}

export interface StateDiff {
    variable: string;
    before_value: unknown;
    after_value: unknown;
    change_type: "added" | "removed" | "modified" | "unchanged";
}

export interface OutcomeVisualization {
    before_state: SimulationState;
    after_state: SimulationState;
    state_diff: StateDiff[];
    action_execution_timeline: Array<{
        action_id: string;
        action_title: string;
        start_time: string;
        end_time: string;
        status: "success" | "failed" | "skipped";
        cost: number;
        duration_ms: number;
    }>;
    metrics: {
        total_cost: number;
        total_duration_ms: number;
        success_rate: number;
        actions_attempted: number;
        actions_succeeded: number;
        actions_failed: number;
        failures_recovered: number;
    };
    projected_impact: {
        risk_reduction: number;
        estimated_value: number;
        affected_entities: string[];
    };
}

export interface ImpactOption {
    option_id: string;
    label: string;
    tradeoff: "lowest_cost" | "fastest_resolution" | "balanced" | "lowest_risk";
    cost_pkr: number;
    time_hours: number;
    affected_customers: number;
    rationale: string;
}

export interface ImpactAnalysis {
    insight_id: string;
    primary_impact: string;
    impact_category: "revenue" | "cost" | "risk" | "compliance" | "reputation" | "operational";
    impact_severity: "critical" | "high" | "medium" | "low";
    quantified_impact: {
        estimated_cost: number | null;
        estimated_time_hours: number | null;
        affected_count: number | null;
        // V2: explicit PKR + customers fields for the constraint-tradeoff judges
        cost_pkr?: number;
        affected_customers?: number;
    };
    constraints_violated: string[];
    time_horizon: "immediate" | "short_term" | "medium_term" | "long_term";
    cascading_effects: string[];
    risk_if_ignored: string;
    options: ImpactOption[];   // V2: 2-3 explicit tradeoff options per insight
}
