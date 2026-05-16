interface Metric {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

interface Props { metrics: Metric[]; }

export function MetricsBar({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="metric-card">
          <span className="text-xl">{m.icon}</span>
          <span className={`text-2xl font-bold ${m.color ?? "text-sky-400"}`}>{m.value}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
