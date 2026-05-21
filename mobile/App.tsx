import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
    NavigationContainer,
    DefaultTheme,
    useNavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Svg, { Path, Polygon, Rect } from "react-native-svg";

import { assertConfig, type ConfigError } from "@/config/api";
import { resolveOperatorHandle } from "@/services/IdentityService";
import { ensureDeviceSecretBootstrapped } from "@/services/BiometricSecurityService";
import { PipelineProvider, usePipelineContext } from "@/context/PipelineContext";
import { CriticalConfigScreen } from "@/screens/CriticalConfigScreen";
import { OperatorProvisioningScreen } from "@/screens/OperatorProvisioningScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ExecutionScreen } from "@/screens/ExecutionScreen";
import { ChainFlowScreen } from "@/screens/ChainFlowScreen";
import { AuditInsightsScreen } from "@/screens/AuditInsightsScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
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
        background: T.bgBaseV2,
        card: T.bgSurfaceV2,
        text: T.tx1V2,
        border: T.bdDimV2,
        primary: T.teal,
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
                d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z"
                stroke={color}
                strokeWidth={1.8}
            />
            <Path d="M10 8.5l5 3.5-5 3.5V8.5Z" fill={color} />
        </Svg>
    );
}

function ChainFlowIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
            <Polygon
                points="12,2 21,7 21,17 12,22 3,17 3,7"
                stroke={color}
                strokeWidth={1.8}
                strokeLinejoin="round"
                fill="none"
            />
            <Polygon
                points="12,7 17,9.5 17,14.5 12,17 7,14.5 7,9.5"
                fill={color}
                opacity={0.5}
            />
        </Svg>
    );
}

function AuditIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
            <Rect x="4" y="13" width="3.5" height="7" rx="0.5" fill={color} />
            <Rect x="10.25" y="9" width="3.5" height="11" rx="0.5" fill={color} />
            <Rect x="16.5" y="5" width="3.5" height="15" rx="0.5" fill={color} />
        </Svg>
    );
}

function ProfileIcon({ color }: { color: string }): React.ReactElement {
    return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                stroke={color}
                strokeWidth={1.8}
            />
            <Path
                d="M4 21a8 8 0 0 1 16 0"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
            />
        </Svg>
    );
}

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
            {showBadge ? <Animated.View style={[styles.pendingBadge, { opacity }]} /> : null}
        </View>
    );
}

// ── Tabs component (inside Provider so it can read pipeline state) ──

function Tabs({ operatorHandle, onSignOut }: { operatorHandle: string; onSignOut: () => void }): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigationRef = useNavigationContainerRef<RootTabParamList>();
    const lastNavStatus = useRef<string | null>(null);

    useEffect(() => {
        const status = pipeline.derivedStatus;
        if (status !== "POLLING_COMPLETED" && status !== "REJECTED") {
            lastNavStatus.current = null;
            return;
        }
        if (lastNavStatus.current === status) return;
        lastNavStatus.current = status;
        const t = setTimeout(() => {
            if (navigationRef.isReady()) {
                navigationRef.navigate("ChainFlow" as never);
            }
        }, 800);
        return () => clearTimeout(t);
    }, [pipeline.derivedStatus, navigationRef]);

    return (
        <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: T.bgSurfaceV2,
                        borderTopColor: T.bdDimV2,
                        height: 72,
                        paddingBottom: 16,
                        paddingTop: 6,
                    },
                    tabBarActiveTintColor: T.teal,
                    tabBarInactiveTintColor: T.tx3V2,
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontWeight: "600",
                        letterSpacing: 0.2,
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
                    {() => <DashboardScreen operatorHandle={operatorHandle} />}
                </Tab.Screen>
                <Tab.Screen
                    name="Execution"
                    options={{
                        title: "Execution",
                        tabBarIcon: ({ color }) => <ExecutionTabIcon color={color} />,
                    }}
                >
                    {() => <ExecutionScreen operatorHandle={operatorHandle} />}
                </Tab.Screen>
                <Tab.Screen
                    name="ChainFlow"
                    options={{
                        title: "ChainFlow",
                        tabBarIcon: ({ color }) => <ChainFlowIcon color={color} />,
                    }}
                >
                    {() => <ChainFlowScreen operatorHandle={operatorHandle} />}
                </Tab.Screen>
                <Tab.Screen
                    name="Audit"
                    component={AuditInsightsScreen}
                    options={{
                        title: "Audit",
                        tabBarIcon: ({ color }) => <AuditIcon color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Profile"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
                    }}
                >
                    {() => <ProfileScreen operatorHandle={operatorHandle} onSignOut={onSignOut} />}
                </Tab.Screen>
            </Tab.Navigator>
        </NavigationContainer>
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
            setBoot(
                handle
                    ? { phase: "ready", operatorHandle: handle }
                    : { phase: "provisioning" },
            );
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
                    <ActivityIndicator color={T.teal} />
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
                    onProvisioned={(handle) =>
                        setBoot({ phase: "ready", operatorHandle: handle })
                    }
                />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            <PipelineProvider>
                <Tabs operatorHandle={boot.operatorHandle} onSignOut={() => setBoot({ phase: "provisioning" })} />
            </PipelineProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: T.bgBaseV2,
        alignItems: "center",
        justifyContent: "center",
    },
    bootEyebrow: {
        color: T.tx3V2,
        fontSize: 9,
        letterSpacing: 1.2,
        marginBottom: 14,
        fontWeight: "700",
    },
    loadingText: {
        color: T.tx3V2,
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
