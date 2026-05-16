import type { DomainScore } from "../types";

interface Props { score: DomainScore; }

export function DomainBadge({ score }: Props) {
  const color =
    score.level === "in-domain" ? "emerald" :
    score.level === "borderline" ? "amber" : "red";

  const bar = Math.min(100, score.score);

  return (
    <div className={`card border-${color}-800/60 bg-${color}-950/20`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Domain Validation</span>
        <span className={`text-${color}-400 font-bold text-sm`}>{score.score}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full bg-${color}-500 transition-all duration-500`}
          style={{ width: `${bar}%` }}
        />
      </div>
      <p className="text-xs text-gray-300">{score.verdict}</p>
      {score.matched.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {score.matched.map((kw) => (
            <span key={kw} className={`text-xs px-1.5 py-0.5 rounded bg-${color}-900/40 text-${color}-300 border border-${color}-800/50`}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
