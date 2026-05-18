"use client";

import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useLiveTrace } from "@/features/execution/hooks/useLiveTrace";
import { useStrategyProposal } from "@/features/execution/hooks/useStrategyProposal";
import { usePipelineAnalytics } from "@/features/analytics/hooks/usePipelineAnalytics";
import { AgentReasoningLedger } from "@/features/analytics/components/AgentReasoningLedger";
import { CredibilityGrid } from "@/features/analytics/components/CredibilityGrid";
import { ForecasterChart } from "@/features/analytics/components/ForecasterChart";
import { ContradictionPanel } from "@/features/analytics/components/ContradictionPanel";
import { StrategyDraftReview } from "@/features/execution/components/StrategyDraftReview";

type Props = {
  params: Promise<{ pipeline_id: string }>;
};

function AnalyticsSkeletons() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function PipelinePage({ params }: Props) {
  const { pipeline_id } = use(params);
  // Bumping this forces useStrategyProposal to re-poll after an approve/reject
  // so the page mode transitions without waiting for a page reload.
  const [proposalRefresh, setProposalRefresh] = useState(0);

  const { events, status } = useLiveTrace(pipeline_id);
  const { data: analytics, ready } = usePipelineAnalytics(pipeline_id);
  const proposal = useStrategyProposal(pipeline_id, proposalRefresh);

  const showApprovalGate = proposal.status === "pending" && proposal.record !== null;

  return (
    <main className="container mx-auto space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pipeline {pipeline_id}
        </h1>
        <Badge variant={status === "error" ? "destructive" : "secondary"}>
          {status}
        </Badge>
        {proposal.status === "pending" ? (
          <Badge variant="outline" className="animate-pulse">
            Awaiting HITL approval
          </Badge>
        ) : proposal.currentState ? (
          <Badge variant={proposal.currentState === "REJECTED" ? "destructive" : "outline"}>
            {proposal.currentState}
          </Badge>
        ) : null}
        {!ready && proposal.status !== "pending" ? (
          <Badge variant="outline" className="animate-pulse">
            compiling analytics…
          </Badge>
        ) : null}
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <AgentReasoningLedger events={events} status={status} />

        <div className="space-y-6">
          {showApprovalGate && proposal.record ? (
            <StrategyDraftReview
              record={proposal.record}
              onApproved={() => setProposalRefresh((n) => n + 1)}
              onRejected={() => setProposalRefresh((n) => n + 1)}
            />
          ) : ready && analytics ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CredibilityGrid analytics={analytics} />
              <ForecasterChart data={analytics.forecast_data} />
              <ContradictionPanel analytics={analytics} />
            </div>
          ) : (
            <AnalyticsSkeletons />
          )}
        </div>
      </section>
    </main>
  );
}
