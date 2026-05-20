import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { resolveOperatorHandle } from "@/services/IdentityService";
import { ensureDeviceSecretBootstrapped } from "@/services/BiometricSecurityService";
import { useStandalonePipeline } from "@/hooks/useStandalonePipeline";
import { OperatorProvisioningScreen } from "@/screens/OperatorProvisioningScreen";
import { IngestionStagingScreen } from "@/screens/IngestionStagingScreen";
import { OperationalMonitorScreen } from "@/screens/OperationalMonitorScreen";
import type { RawSource } from "@/types/pipeline";

type BootState =
    | { phase: "loading" }
    | { phase: "provisioning" }
    | { phase: "ready"; operatorHandle: string };

type ScreenView = "staging" | "monitor";

export default function App(): React.ReactElement {
    const [boot, setBoot] = useState<BootState>({ phase: "loading" });
    const [view, setView] = useState<ScreenView>("staging");
    const pipeline = useStandalonePipeline();

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async (): Promise<void> => {
            try {
                await ensureDeviceSecretBootstrapped();
            } catch {
                // Secret bootstrap is non-fatal; surface failures on first sign attempt.
            }
            const handle = await resolveOperatorHandle();
            if (cancelled) return;
            setBoot(handle ? { phase: "ready", operatorHandle: handle } : { phase: "provisioning" });
        };
        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, []);

    const onProvisioned = useCallback((handle: string) => {
        setBoot({ phase: "ready", operatorHandle: handle });
    }, []);

    const onStart = useCallback(
        async (sources: RawSource[]): Promise<void> => {
            const id = await pipeline.start(sources);
            if (id) setView("monitor");
        },
        [pipeline],
    );

    const onStartDemo = useCallback(async (): Promise<void> => {
        const id = await pipeline.startDemo();
        if (id) setView("monitor");
    }, [pipeline]);

    const onBack = useCallback(() => {
        pipeline.reset();
        setView("staging");
    }, [pipeline]);

    if (boot.phase === "loading") {
        return (
            <View style={styles.loading}>
                <StatusBar style="light" />
                <ActivityIndicator color="#34d399" />
                <Text style={styles.loadingText}>Bootstrapping…</Text>
            </View>
        );
    }

    if (boot.phase === "provisioning") {
        return (
            <>
                <StatusBar style="light" />
                <OperatorProvisioningScreen onProvisioned={onProvisioned} />
            </>
        );
    }

    return (
        <>
            <StatusBar style="light" />
            {view === "staging" ? (
                <IngestionStagingScreen
                    operatorHandle={boot.operatorHandle}
                    isStarting={pipeline.isStarting}
                    lastErrorMessage={pipeline.lastError?.message ?? null}
                    onStart={onStart}
                    onStartDemo={onStartDemo}
                />
            ) : (
                <OperationalMonitorScreen
                    pipeline={pipeline}
                    operatorHandle={boot.operatorHandle}
                    onBack={onBack}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: "#0b0b0f",
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 12,
        marginTop: 12,
    },
});
