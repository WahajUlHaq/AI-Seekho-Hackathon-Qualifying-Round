"use client";

import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLiveTrace } from "@/features/execution/hooks/useLiveTrace";
import { useStrategyProposal } from "@/features/execution/hooks/useStrategyProposal";
import { useDerivedExecutionState } from "@/features/execution/hooks/useDerivedExecutionState";
import { usePipelineAnalytics } from "@/features/analytics/hooks/usePipelineAnalytics";
import { AgentReasoningLedger } from "@/features/analytics/components/AgentReasoningLedger";
import { CredibilityGrid } from "@/features/analytics/components/CredibilityGrid";
import { ForecasterChart } from "@/features/analytics/components/ForecasterChart";
import { ContradictionPanel } from "@/features/analytics/components/ContradictionPanel";
import { StrategyDraftReview } from "@/features/execution/components/StrategyDraftReview";
import { DagNodeGraph } from "@/features/execution/components/DagNodeGraph";
import { ExecutionChainCard } from "@/features/execution/components/ExecutionChainCard";
import { RecoveryPlanCard } from "@/features/execution/components/RecoveryPlanCard";
import { OutcomeImpactCard } from "@/features/execution/components/OutcomeImpactCard";
import { ComplianceAuditCard } from "@/features/execution/components/ComplianceAuditCard";
import { HitlBanner } from "@/features/execution/components/HitlBanner";

type Props = {
  params: Promise<{ pipeline_id: string }>;
};

function AnalyticsSkeletons() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function PipelinePage({ params }: Props) {
  const { pipeline_id } = use(params);
  const [proposalRefresh, setProposalRefresh] = useState(0);

  const { events, status } = useLiveTrace(pipeline_id);
  const { data: analytics, ready: analyticsReady } = usePipelineAnalytics(pipeline_id);
  const proposal = useStrategyProposal(pipeline_id, proposalRefresh);
  const derived = useDerivedExecutionState(events);

  const showApprovalGate = proposal.status === "pending" && proposal.record !== null;
  const isPostApproval =
    proposal.status === "gone" &&
    (proposal.currentState === "EXECUTING" || proposal.currentState === "COMPLETED");
  const isRejected = proposal.status === "gone" && proposal.currentState === "REJECTED";

  // Proposal payload is preserved client-side for the DAG live overlay once
  // approval has happened (the /pending route returns 409 post-approval).
  const [latestProposal, setLatestProposal] = useState<
    typeof proposal.record | null
  >(null);
  if (proposal.record && latestProposal !== proposal.record) {
    setLatestProposal(proposal.record);
  }

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
          ) : isPostApproval || isRejected ? (
            <div className="space-y-6">
              <HitlBanner
                state={derived.hitlState ?? (isRejected ? "REJECTED" : "APPROVED")}
                rejectionReason={derived.hitlReason}
              />

              {latestProposal && !isRejected ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Live Execution Graph</span>
                      <Badge variant="outline">
                        {latestProposal.proposal.proposedActions.length} actions
                      </Badge>
                      {derived.cycleDetected ? (
                        <Badge variant="destructive">cycle fallback</Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DagNodeGraph
                      actions={latestProposal.proposal.proposedActions}
                      statuses={derived.actionStatuses}
                      taintedSet={derived.taintedSet}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {!isRejected ? (
                <>
                  <ExecutionChainCard pipelineId={pipeline_id} enabled />
                  <RecoveryPlanCard pipelineId={pipeline_id} enabled />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <OutcomeImpactCard pipelineId={pipeline_id} enabled />
                    <ComplianceAuditCard pipelineId={pipeline_id} enabled />
                  </div>
                </>
              ) : null}

              <details className="rounded-xl border bg-muted/10 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Analytics pool (M-Parser + M-Forecaster + M-Auditor) — secondary
                </summary>
                <div className="mt-4">
                  {analyticsReady && analytics ? (
                    <div className="space-y-6">
                      <CredibilityGrid analytics={analytics} />
                      <ForecasterChart data={analytics.forecast_data} />
                      <ContradictionPanel analytics={analytics} />
                    </div>
                  ) : (
                    <AnalyticsSkeletons />
                  )}
                </div>
              </details>
            </div>
          ) : (
            <AnalyticsSkeletons />
          )}
        </div>
      </section>
    </main>
  );
}
