import axios from "axios";

async function test() {
    console.log("=== TEST 1.5: Express Server Health Check ===");
    console.log("NOTE: Server must be running on port 8000 first.");

    try {
        // Test /health endpoint
        const healthRes = await axios.get("http://localhost:8000/health", { timeout: 5000 });
        console.log("Health status:", healthRes.status);
        console.log("Health body:", JSON.stringify(healthRes.data).slice(0, 200));
        console.log(healthRes.status === 200 ? "  ✅ /health OK" : "  ❌ /health unexpected status");

        // Test /api/pipeline/contracts/list
        const contractsRes = await axios.get("http://localhost:8000/api/pipeline/contracts/list", { timeout: 5000 });
        console.log("Contracts status:", contractsRes.status);
        console.log("Contracts body:", JSON.stringify(contractsRes.data).slice(0, 200));
        const hasContracts = contractsRes.data?.contracts && Array.isArray(contractsRes.data.contracts);
        console.log(hasContracts ? "  ✅ /api/pipeline/contracts/list OK" : "  ❌ contracts list missing");

        const allPassed = healthRes.status === 200 && hasContracts;
        console.log(allPassed ? "\n✅ PASS: Server is running and responding" : "\n❌ FAIL: Some checks failed");
    } catch (error: any) {
        if (error.code === "ECONNREFUSED") {
            console.log("❌ FAIL: Server not running. Start it with: APP_ENV=development npm run dev");
        } else {
            console.log("❌ FAIL:", error.message);
        }
    }
}

test();
