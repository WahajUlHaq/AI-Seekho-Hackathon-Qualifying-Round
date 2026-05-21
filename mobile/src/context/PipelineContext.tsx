import React, { createContext, useContext } from "react";
import { useStandalonePipeline, type UseStandalonePipeline } from "@/hooks/useStandalonePipeline";

const PipelineContext = createContext<UseStandalonePipeline | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const pipeline = useStandalonePipeline();
    return <PipelineContext.Provider value={pipeline}>{children}</PipelineContext.Provider>;
}

export function usePipelineContext(): UseStandalonePipeline {
    const ctx = useContext(PipelineContext);
    if (!ctx) {
        throw new Error("usePipelineContext must be used inside <PipelineProvider>");
    }
    return ctx;
}
