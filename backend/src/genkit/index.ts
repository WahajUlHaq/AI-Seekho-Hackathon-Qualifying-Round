import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { genkit } from "genkit";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";

export const ai = genkit({
    plugins: [
        googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    ],
    model: gemini20Flash,
});
