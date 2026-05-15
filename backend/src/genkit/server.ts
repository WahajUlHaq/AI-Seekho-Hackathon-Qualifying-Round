import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

// Import the flow to register it with Genkit
import "./pipeline-flow";

// Start the Genkit flow server.
// This enables the Antigravity Dev UI at http://localhost:4000
// and the flow runner at http://localhost:3400
//
// Run with: npm run genkit:dev  (sets GENKIT_ENV=dev, auto-starts Dev UI on port 4000)
console.log("[Genkit] Antigravity orchestration server initializing...");
console.log("[Genkit] Flow: autonomous_content_to_action_pipeline");
console.log("[Genkit] Dev UI: http://localhost:4000");
console.log("[Genkit] Flow runner: http://localhost:3400");
