"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <div className="h-32 rounded-xl shimmer" />
      <div className="h-44 rounded-xl shimmer" />
    </div>
  );
}

const STATUS_STYLE: Record<
  string,
  { label: string; dot: string }
> = {
  idle:       { label: "Idle",       dot: "bg-zinc-500" },
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse" },
  open:       { label: "Streaming",  dot: "bg-emerald-400 animate-pulse" },
  ended:      { label: "Ended",      dot: "bg-zinc-500" },
  error:      { label: "Error",      dot: "bg-red-400 animate-pulse" },
};

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

  const [latestProposal, setLatestProposal] = useState<
    typeof proposal.record | null
  >(null);
  if (proposal.record && latestProposal !== proposal.record) {
    setLatestProposal(proposal.record);
  }

  const st = STATUS_STYLE[status] ?? STATUS_STYLE.idle;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">

      {/* Ambient orb */}
      <div
        className="fixed top-[30%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-float-2 28s ease-in-out infinite",
          zIndex: 0,
        }}
        aria-hidden
      />

      {/* Sticky pipeline header */}
      <div
        className="sticky top-0 z-20 flex-shrink-0 px-4 py-2.5"
        style={{
          background: "rgba(6,6,10,0.84)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 animate-fade-in-up">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            <ArrowLeft className="size-3.5" />
            New pipeline
          </Link>
          <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold tracking-tight">
              Pipeline{" "}
              <span className="font-mono text-zinc-400">{pipeline_id}</span>
            </span>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgb(161,161,170)",
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </div>
            {proposal.status === "pending" ? (
              <Badge
                variant="outline"
                className="animate-pulse text-amber-300"
                style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
              >
                Awaiting HITL
              </Badge>
            ) : proposal.currentState ? (
              <Badge variant={proposal.currentState === "REJECTED" ? "destructive" : "outline"}>
                {proposal.currentState}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr] animate-fade-in">
            <AgentReasoningLedger events={events} status={status} />

            <div className="space-y-6 pb-8">
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
                  <details className="rounded-xl p-3 glass-card">
                    <summary className="cursor-pointer text-sm font-medium text-zinc-300 select-none">
                      Analytics pool (M-Parser + M-Forecaster + M-Auditor)
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
        </div>
      </div>
    </div>
  );
}
