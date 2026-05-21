import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/** Infinite scale+opacity pulse — use for SSE dot, HITL badge. */
export function usePulse(active: boolean, duration = 1600): Animated.Value {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!active) {
            anim.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(anim, {
                    toValue: 1,
                    duration,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [active, duration, anim]);
    return anim;
}

/** Slide-in from bottom — new cards, HITL sheet. */
export function useSlideIn(
    trigger: boolean,
    fromY = 20,
    duration = 320,
): { translateY: Animated.Value; opacity: Animated.Value } {
    const anim = useRef(new Animated.Value(fromY)).current;
    const opac = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (trigger) {
            Animated.parallel([
                Animated.spring(anim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 18,
                    stiffness: 200,
                }),
                Animated.timing(opac, {
                    toValue: 1,
                    duration,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [trigger, anim, opac, duration]);
    return { translateY: anim, opacity: opac };
}

/** Shimmer skeleton — loading states. */
export function useShimmer(duration = 1400): Animated.Value {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [anim, duration]);
    return anim;
}
