import { useEffect, useState } from "react";
import { api } from "../api";
import type { Contract } from "../types";
import { JsonViewer } from "./JsonViewer";

export function ContractViewer() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<unknown>(null);
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getContracts()
      .then((r) => setContracts(r.contracts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function viewContract(name: string) {
    setSelectedName(name);
    try {
      const full = await api.getContract(name);
      setSelected(full);
    } catch (e: unknown) {
      setSelected({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (loading) return <div className="card text-gray-400 text-sm">Loading contracts…</div>;
  if (error) return <div className="card text-red-400 text-sm">⛔ {error}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {contracts.map((c) => (
          <div
            key={c.name}
            className="card cursor-pointer hover:border-sky-700 transition-colors"
            onClick={() => viewContract(c.name)}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-semibold text-sky-400">{c.name}</span>
              <span className="badge-pass">v{c.version}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">{c.description}</p>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>📋 {c.field_count} fields</span>
              <span>🔍 {c.semantic_checks} semantic checks</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Module: {c.module}</p>
          </div>
        ))}
      </div>

      {selected && (
        <JsonViewer data={selected} title={`Contract: ${selectedName}`} />
      )}
    </div>
  );
}
