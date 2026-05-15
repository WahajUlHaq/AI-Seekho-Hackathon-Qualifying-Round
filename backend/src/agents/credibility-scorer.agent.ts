import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import {
    SourceDocument,
    CredibilityResult,
    CredibilityTier,
} from "../interfaces/source-document.interface";

interface AuthorityPattern {
    pattern: string;
    score: number;
}

interface AuthorityDomainsConfig {
    patterns: AuthorityPattern[];
    defaultFallback: string;
    nonUrlDefaultScore: number;
}

interface CredibilityScorerConfig {
    maxAgeHours: number;
    recencyMaxScore: number;
    authorityMaxScore: number;
    qualityMaxScore: number;
    authorityDefaultScore: number;
    qualityPromptMaxChars: number;
    tierThresholds: { high: number; medium: number; low: number };
}

export interface CredibilityScorerInput extends AgentInput {
    sources: SourceDocument[];
}

export interface CredibilityScorerOutput extends AgentOutput {
    scorer_id: string;
    scored_at: string;
    sources_scored: number;
    sources: SourceDocument[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

export class CredibilityScorerAgent extends BaseAgent<
    CredibilityScorerInput,
    CredibilityScorerOutput
> {
    private readonly cfg: CredibilityScorerConfig;
    private readonly authorityConfig: AuthorityDomainsConfig;
    private readonly authorityCache: Map<string, number> = new Map();

    constructor() {
        super("CredibilityScorerAgent", "credibility_scorer");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.credibilityScorer as CredibilityScorerConfig;

        const authorityPath = path.resolve(__dirname, "../../config/authorityDomains.config.json");
        this.authorityConfig = JSON.parse(fs.readFileSync(authorityPath, "utf-8")) as AuthorityDomainsConfig;
    }

    protected async execute(input: CredibilityScorerInput): Promise<CredibilityScorerOutput> {
        const { pipeline_id, sources } = input;
        const scoredSources: SourceDocument[] = [];

        for (const doc of sources) {
            const recency   = this.scoreRecency(doc.ingested_at);
            const authority = await this.scoreAuthority(pipeline_id, doc);
            const quality   = await this.scoreQuality(pipeline_id, doc);
            const total     = Math.min(100, recency + authority + quality);
            const tier      = this.assignTier(total);

            const credibilityScore: CredibilityResult = {
                recency,
                authority,
                quality,
                total,
                tier,
                reasoning: `recency=${recency} authority=${authority} quality=${quality}`,
            };

            scoredSources.push({
                ...doc,
                credibility_tier: tier,
                credibility_score: credibilityScore,
            });
        }

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            scorer_id: makeId("SCR"),
            scored_at: new Date().toISOString(),
            sources_scored: scoredSources.length,
            sources: scoredSources,
        };
    }

    private scoreRecency(ingestedAt: string): number {
        const hoursSince = (Date.now() - new Date(ingestedAt).getTime()) / 3_600_000;
        return Math.max(0, this.cfg.recencyMaxScore - (hoursSince / this.cfg.maxAgeHours) * this.cfg.recencyMaxScore);
    }

    private async scoreAuthority(pipelineId: string, doc: SourceDocument): Promise<number> {
        if (doc.source_type !== "url" || !doc.raw_url) {
            return this.authorityConfig.nonUrlDefaultScore;
        }

        const cached = this.authorityCache.get(doc.raw_url);
        if (cached !== undefined) return cached;

        for (const { pattern, score } of this.authorityConfig.patterns) {
            if (new RegExp(pattern).test(doc.raw_url)) {
                this.authorityCache.set(doc.raw_url, score);
                return score;
            }
        }

        if (this.authorityConfig.defaultFallback === "llm") {
            try {
                const prompt = `Rate the authority and trustworthiness of this domain as a source of factual information.
Domain: ${doc.raw_url}
Reply with ONLY a JSON object: {"score": <integer 0 to ${this.cfg.authorityMaxScore}>, "reasoning": "<brief reason>"}`;

                const response = await this.llmComplete(pipelineId, prompt, false, "authority_scoring");
                const jsonMatch = response.match(/\{[\s\S]*?\}/);
                const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                const score = typeof parsed?.score === "number"
                    ? Math.min(this.cfg.authorityMaxScore, Math.max(0, parsed.score))
                    : this.authorityConfig.nonUrlDefaultScore;

                this.authorityCache.set(doc.raw_url, score);
                return score;
            } catch {
                return this.authorityConfig.nonUrlDefaultScore;
            }
        }

        return this.authorityConfig.nonUrlDefaultScore;
    }

    private async scoreQuality(pipelineId: string, doc: SourceDocument): Promise<number> {
        const excerpt = doc.content.slice(0, this.cfg.qualityPromptMaxChars);

        const prompt = `Rate the information quality of the following content on a scale of 0 to ${this.cfg.qualityMaxScore}.
Consider: factual clarity, specificity, internal consistency, and usefulness as a data source.
Content:
${excerpt}

Reply with ONLY a JSON object: {"score": <integer 0 to ${this.cfg.qualityMaxScore}>, "reasoning": "<brief reason>"}`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, false, "quality_scoring");
            const jsonMatch = response.match(/\{[\s\S]*?\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            return typeof parsed?.score === "number"
                ? Math.min(this.cfg.qualityMaxScore, Math.max(0, parsed.score))
                : Math.round(this.cfg.qualityMaxScore * 0.5);
        } catch {
            return Math.round(this.cfg.qualityMaxScore * 0.5);
        }
    }

    private assignTier(total: number): CredibilityTier {
        if (total >= this.cfg.tierThresholds.high)   return "HIGH";
        if (total >= this.cfg.tierThresholds.medium) return "MEDIUM";
        if (total >= this.cfg.tierThresholds.low)    return "LOW";
        return "UNVERIFIED";
    }
}
