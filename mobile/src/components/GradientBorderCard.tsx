import React from "react";
import { View, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/lib/theme";

interface Props {
    colors?: readonly [string, string, ...string[]];
    radius?: number;
    thickness?: number;
    innerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    children: React.ReactNode;
}

export function GradientBorderCard({
    colors,
    radius = 14,
    thickness = 1.5,
    innerStyle,
    style,
    start,
    end,
    children,
}: Props): React.ReactElement {
    const c = colors ?? T.gradBlue;
    return (
        <LinearGradient
            colors={c as readonly [string, string, ...string[]]}
            start={start ?? { x: 0, y: 0 }}
            end={end ?? { x: 1, y: 1 }}
            style={[{ padding: thickness, borderRadius: radius }, style]}
        >
            <View
                style={[
                    {
                        backgroundColor: T.bgSurfaceV2,
                        borderRadius: Math.max(radius - thickness, 0),
                        overflow: "hidden",
                    },
                    innerStyle,
                ]}
            >
                {children}
            </View>
        </LinearGradient>
    );
}
