import { IngestionDashboard } from "@/features/ingestion/components/IngestionDashboard";

export const metadata = {
  title: "Ingestion Workspace",
};

export default function IngestionPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <IngestionDashboard />
    </main>
  );
}
