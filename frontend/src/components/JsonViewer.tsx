import { useState } from "react";

interface Props {
  data: unknown;
  title?: string;
  defaultCollapsed?: boolean;
}

export function JsonViewer({ data, title, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2);

  function copy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        {title && <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>}
        <div className="flex gap-2 ml-auto">
          <button onClick={copy} className="btn-secondary text-xs py-1 px-2">
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="btn-secondary text-xs py-1 px-2">
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <pre className="text-xs text-emerald-300 overflow-auto max-h-96 leading-relaxed">
          {json}
        </pre>
      )}
    </div>
  );
}
