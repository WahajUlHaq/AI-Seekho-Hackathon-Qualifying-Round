import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface Props {
    label: string;
    color: string;
    bg?: string;
    border?: string;
    dot?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function PillBadge({ label, color, bg, border, dot, style }: Props): React.ReactElement {
    return (
        <View
            style={[
                styles.pill,
                {
                    backgroundColor: bg ?? `${color}1a`,
                    borderColor: border ?? `${color}55`,
                },
                style,
            ]}
        >
            {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
            <Text style={[styles.text, { color }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        alignSelf: "flex-start",
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    text: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
});
