import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Svg, { Path, Rect } from "react-native-svg";

import { assertConfig, type ConfigError } from "@/config/api";
import { resolveOperatorHandle } from "@/services/IdentityService";
import { ensureDeviceSecretBootstrapped } from "@/services/BiometricSecurityService";
import { PipelineProvider, usePipelineContext } from "@/context/PipelineContext";
import { CriticalConfigScreen } from "@/screens/CriticalConfigScreen";
import { OperatorProvisioningScreen } from "@/screens/OperatorProvisioningScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ExecutionScreen } from "@/screens/ExecutionScreen";
import { AuditInsightsScreen } from "@/screens/AuditInsightsScreen";
import type { RootTabParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

type BootState =
    | { phase: "loading" }
    | { phase: "config_error"; errors: ConfigError[] }
    | { phase: "provisioning" }
    | { phase: "ready"; operatorHandle: string };

const Tab = createBottomTabNavigator<RootTabParamList>();

const NAV_THEME = {
    ...DefaultTheme,
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        background: T.bgBase,
        card: T.bgSurface,
        text: T.tx1,
        border: T.bdDim,
        primary: T.emerald,
        notification: T.amber,
    },
};

// ── Tab icons ────────────────────────────────────────────

const ICON_SIZE = 22;

function DashboardIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
            <Rect x="3" y="3" width="8" height="8" rx="2" fill={color} />
            <Rect x="13" y="3" width="8" height="8" rx="2" fill={color} />
            <Rect x="3" y="13" width="8" height="8" rx="2" fill={color} />
            <Rect x="13" y="13" width="8" height="8" rx="2" fill={color} />
        </Svg>
    );
}

function ExecutionIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
            <Path
                d="M5 7l5 5-5 5"
                stroke={color}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M13 17h7"
                stroke={color}
                strokeWidth={2.2}
                strokeLinecap="round"
            />
        </Svg>
    );
}

function AuditIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 3 4 6v5c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V6l-8-3Z"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <Path
                d="m8.5 12 2.5 2.5 4.5-5"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

/**
 * Execution tab icon with an amber pulse badge that appears when the active
 * pipeline is awaiting HITL approval.
 */
function ExecutionTabIcon({ color }: { color: string }): React.ReactElement {
    const { derivedStatus } = usePipelineContext();
    const showBadge = derivedStatus === "HITL_PENDING";
    const pulse = usePulse(showBadge, 1400);
    const opacity = showBadge
        ? pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] })
        : new Animated.Value(0);

    return (
        <View style={styles.tabIconWrap}>
            <ExecutionIcon color={color} />
            {showBadge ? (
                <Animated.View style={[styles.pendingBadge, { opacity }]} />
            ) : null}
        </View>
    );
}

// ── Root component ───────────────────────────────────────

export default function App(): React.ReactElement {
    const configErrors = useMemo(() => assertConfig(), []);
    const [boot, setBoot] = useState<BootState>(
        configErrors.length > 0
            ? { phase: "config_error", errors: configErrors }
            : { phase: "loading" },
    );

    useEffect(() => {
        if (boot.phase !== "loading") return;
        let cancelled = false;
        const bootstrap = async (): Promise<void> => {
            try {
                await ensureDeviceSecretBootstrapped();
            } catch {
                // Non-fatal: failures surface on first sign attempt.
            }
            const handle = await resolveOperatorHandle();
            if (cancelled) return;
            setBoot(handle ? { phase: "ready", operatorHandle: handle } : { phase: "provisioning" });
        };
        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [boot.phase]);

    if (boot.phase === "config_error") {
        return (
            <SafeAreaProvider>
                <StatusBar style="light" />
                <CriticalConfigScreen errors={boot.errors} />
            </SafeAreaProvider>
        );
    }

    if (boot.phase === "loading") {
        return (
            <SafeAreaProvider>
                <View style={styles.loading}>
                    <StatusBar style="light" />
                    <Text style={styles.bootEyebrow}>SYSTEM BOOTSTRAP</Text>
                    <ActivityIndicator color={T.emerald} />
                    <Text style={styles.loadingText}>Bootstrapping…</Text>
                </View>
            </SafeAreaProvider>
        );
    }

    if (boot.phase === "provisioning") {
        return (
            <SafeAreaProvider>
                <StatusBar style="light" />
                <OperatorProvisioningScreen
                    onProvisioned={(handle) => setBoot({ phase: "ready", operatorHandle: handle })}
                />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            <PipelineProvider>
                <NavigationContainer theme={NAV_THEME}>
                    <Tab.Navigator
                        screenOptions={{
                            headerStyle: { backgroundColor: T.bgSurface },
                            headerTintColor: T.tx1,
                            headerTitleStyle: {
                                fontFamily: T.fontMono,
                                fontWeight: "700",
                                letterSpacing: 0.6,
                            },
                            tabBarStyle: {
                                backgroundColor: T.bgSurface,
                                borderTopColor: T.bdDim,
                                height: 68,
                                paddingBottom: 14,
                            },
                            tabBarActiveTintColor: T.emerald,
                            tabBarInactiveTintColor: T.tx3,
                            tabBarLabelStyle: {
                                fontFamily: T.fontMono,
                                fontSize: 9,
                                fontWeight: "700",
                                letterSpacing: 0.8,
                            },
                        }}
                    >
                        <Tab.Screen
                            name="Dashboard"
                            options={{
                                title: "Dashboard",
                                tabBarIcon: ({ color }) => <DashboardIcon color={color} />,
                            }}
                        >
                            {() => <DashboardScreen operatorHandle={boot.operatorHandle} />}
                        </Tab.Screen>
                        <Tab.Screen
                            name="Execution"
                            options={{
                                title: "Execution",
                                tabBarIcon: ({ color }) => <ExecutionTabIcon color={color} />,
                            }}
                        >
                            {() => <ExecutionScreen operatorHandle={boot.operatorHandle} />}
                        </Tab.Screen>
                        <Tab.Screen
                            name="Audit"
                            component={AuditInsightsScreen}
                            options={{
                                title: "Audit & Insights",
                                tabBarIcon: ({ color }) => <AuditIcon color={color} />,
                            }}
                        />
                    </Tab.Navigator>
                </NavigationContainer>
            </PipelineProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: T.bgBase,
        alignItems: "center",
        justifyContent: "center",
    },
    bootEyebrow: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        letterSpacing: 1.2,
        marginBottom: 14,
    },
    loadingText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 12,
        marginTop: 12,
    },
    tabIconWrap: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    pendingBadge: {
        position: "absolute",
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.amber,
    },
});
