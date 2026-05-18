import axios from "axios";

async function testApiFlow() {
    console.log("=== STARTING DUAL-PHASE API FLOW SMOKE TEST ===");
    const API_URL = "http://localhost:8000";

    const payload = {
        sources: [
            {
                type: "txt",
                content: "InsightFlow AI strategic assessment report: Identified significant operational anomaly in quarterly cost tracking. Total unexplained variance of $45,000 in logistics division.",
                filename: "anomaly_logistics_email.txt"
            },
            {
                type: "csv",
                content: "sku,reported_qty,actual_qty,variance\nSKU-9982,500,450,-50\nSKU-1002,1200,1200,0\nSKU-3031,350,150,-200",
                filename: "variance_metrics.csv"
            }
        ],
        constraints: {
            budget_limit: 800000,
            time_limit_hours: 12,
            urgency: "critical"
        }
    };

    let pipelineId = "";

    try {
        // --- PHASE A: Run Ingestion and Strategy Generation ---
        console.log("\n[1/3] Triggering Phase A Ingestion & Strategy Generation...");
        console.log(`POST ${API_URL}/api/pipeline/run`);
        
        const phaseAResponse = await axios.post(`${API_URL}/api/pipeline/run`, payload);
        
        console.log("\n[Phase A Response Success!]");
        console.log(`Pipeline ID: ${phaseAResponse.data.pipeline_id}`);
        console.log(`Status: ${phaseAResponse.data.status}`);
        console.log(`Sources Processed: ${phaseAResponse.data.sources_processed}`);
        console.log(`Contradictions Found: ${phaseAResponse.data.contradictions_found}`);
        console.log(`Insights Risk Count: ${phaseAResponse.data.insights.risks.length}`);
        console.log(`Proposed Actions count: ${phaseAResponse.data.proposal.proposedActions.length}`);
        
        pipelineId = phaseAResponse.data.pipeline_id;

        // Verify state is PENDING in the approval store
        console.log("\n[2/3] Verifying HITL pending gate state...");
        console.log(`GET ${API_URL}/api/execution/${pipelineId}/pending`);
        
        const pendingResponse = await axios.get(`${API_URL}/api/execution/${pipelineId}/pending`);
        console.log(`Pending Store Status: ${pendingResponse.data.state}`);
        console.log(`Proposed At: ${pendingResponse.data.proposed_at}`);

        // --- PHASE B: Trigger HITL Approve and Execute Actions ---
        console.log("\n[3/3] Simulating Human approval and executing actions (Phase B)...");
        console.log(`POST ${API_URL}/api/execution/${pipelineId}/approve`);
        
        const phaseBResponse = await axios.post(`${API_URL}/api/execution/${pipelineId}/approve`, {
            approved_by: "API E2E Smoke Tester"
        });

        console.log("\n[Phase B Response Success!]");
        console.log(`Final Status: ${phaseBResponse.data.status}`);
        console.log(`Execution status: ${phaseBResponse.data.execution_status}`);
        console.log(`Simulated Results: ${phaseBResponse.data.execution_results.length} actions executed`);
        console.log(`Recovery plan: ${phaseBResponse.data.recovery.recovery_plan}`);
        console.log(`Total Projected Cost: $${phaseBResponse.data.outcome.total_cost}`);
        console.log(`Risk Reduction: ${phaseBResponse.data.outcome.projected_risk_reduction}%`);
        console.log(`Audit Receipt Hash: ${phaseBResponse.data.audit.verification_hash}`);
        console.log(`Receipt saved at: ${phaseBResponse.data.audit.receipt_path}`);

        console.log("\n=== DUAL-PHASE API FLOW SMOKE TEST PASSED SUCCESSFULLY ===");

    } catch (err: any) {
        console.error("\n=== DUAL-PHASE API FLOW SMOKE TEST FAILED ===");
        if (err.response) {
            console.error("HTTP Error Status:", err.response.status);
            console.error("HTTP Response Body:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Message:", err.message);
        }
        process.exit(1);
    }
}

// Run the script if executed directly
if (require.main === module) {
    testApiFlow();
}
