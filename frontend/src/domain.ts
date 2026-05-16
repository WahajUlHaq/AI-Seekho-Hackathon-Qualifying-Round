import type { DomainScore } from "./types";

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  inventory: ["inventory", "stock", "sku", "stockout", "reorder", "units", "shortage", "overstock", "warehouse stock"],
  procurement: ["procurement", "purchase", "supplier", "vendor", "contract", "sourcing", "rfq", "quotation", "tender"],
  logistics: ["logistics", "delivery", "shipment", "freight", "transport", "route", "dispatch", "carrier", "shipping", "fleet"],
  warehouse: ["warehouse", "facility", "storage", "rack", "bin", "pallet", "picking", "putaway", "wms", "inter-branch"],
  demand: ["demand", "forecast", "sales", "orders", "velocity", "seasonal", "trend", "consumption", "throughput"],
  finance: ["budget", "cost", "pkr", "revenue", "margin", "spend", "price", "invoice", "payment", "capex", "opex"],
  risk: ["risk", "disruption", "strike", "delay", "shortage", "critical", "emergency", "contingency", "mitigation", "escalation"],
  operations: ["operations", "production", "manufacturing", "lead time", "cycle time", "throughput", "capacity", "utilization"],
};

const OUT_OF_DOMAIN_SIGNALS = [
  "medicine", "health", "patient", "doctor", "hospital", "treatment", "disease",
  "politics", "election", "government", "parliament",
  "sports", "cricket", "football", "match", "player", "team",
  "entertainment", "movie", "film", "actor", "music", "celebrity",
  "weather", "temperature", "rain", "climate",
  "recipe", "food", "cooking", "restaurant",
];

export function scoreDomain(text: string): DomainScore {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  let score = 0;
  for (const [category, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += 10;
        matched.push(`${category}: ${kw}`);
      }
    }
  }

  // Penalise out-of-domain signals
  for (const signal of OUT_OF_DOMAIN_SIGNALS) {
    if (lower.includes(signal)) score -= 25;
  }

  const capped = Math.max(0, Math.min(100, score));

  const level: DomainScore["level"] =
    capped >= 30 ? "in-domain" : capped >= 10 ? "borderline" : "out-of-domain";

  const verdict =
    level === "in-domain"
      ? "✅ Supply chain content detected — ready to process."
      : level === "borderline"
      ? "⚠️ Borderline relevance — add more supply chain context for best results."
      : "❌ Out of domain — this agent only processes supply chain & operations data.";

  return { score: capped, level, matched: matched.slice(0, 6), verdict };
}

export function scoreAllSources(contents: string[]): DomainScore {
  const combined = contents.join(" ");
  return scoreDomain(combined);
}
