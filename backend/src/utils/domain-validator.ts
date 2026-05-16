const DOMAIN_KEYWORDS = [
  "inventory", "stock", "sku", "stockout", "reorder", "shortage", "overstock",
  "warehouse", "facility", "storage", "rack", "pallet", "picking", "putaway",
  "supplier", "vendor", "procurement", "sourcing", "purchase", "tender", "rfq",
  "logistics", "delivery", "shipment", "freight", "transport", "dispatch", "carrier",
  "demand", "forecast", "sales", "orders", "velocity", "seasonal", "consumption",
  "budget", "cost", "pkr", "revenue", "margin", "invoice", "payment",
  "risk", "disruption", "strike", "delay", "critical", "emergency", "contingency",
  "operations", "production", "manufacturing", "lead time", "capacity", "utilization",
  "distribution", "inter-branch", "transfer", "route", "fleet", "wms",
];

const OUT_OF_DOMAIN_SIGNALS = [
  "medicine", "health", "patient", "doctor", "hospital", "treatment", "disease",
  "politics", "election", "government", "parliament",
  "sports", "cricket", "football", "match", "player",
  "entertainment", "movie", "film", "actor", "music", "celebrity",
  "recipe", "food", "cooking", "restaurant",
  "weather", "temperature", "climate",
];

export interface DomainCheckResult {
  score: number;
  level: "in-domain" | "borderline" | "out-of-domain";
  passed: boolean;
  reason: string;
}

export function checkDomain(texts: string[]): DomainCheckResult {
  const combined = texts.join(" ").toLowerCase();

  let score = 0;
  for (const kw of DOMAIN_KEYWORDS) {
    if (combined.includes(kw)) score += 10;
  }
  for (const signal of OUT_OF_DOMAIN_SIGNALS) {
    if (combined.includes(signal)) score -= 25;
  }
  score = Math.max(0, Math.min(100, score));

  const level =
    score >= 30 ? "in-domain" :
    score >= 10 ? "borderline" : "out-of-domain";

  const passed = level !== "out-of-domain";

  const reason =
    level === "in-domain"
      ? `Domain validated (score ${score}/100). Supply chain content detected.`
      : level === "borderline"
      ? `Borderline domain relevance (score ${score}/100). Processing with caution — add more supply chain context for best results.`
      : `Domain rejected (score ${score}/100). This agent only processes Supply Chain & Operations data: inventory, procurement, logistics, warehousing, demand forecasting, or risk management. Received content does not match any of these categories.`;

  return { score, level, passed, reason };
}
