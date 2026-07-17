import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const FLOATING_FOOTER_GLOBAL_AUDIO_ID = "global-audio-bar";
export const FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY = 0;

const FOOTER_GAP = 8;
const RESTING_BOTTOM_GAP = 10;
const KEYBOARD_BOTTOM_GAP = 8;

type FloatingFooterRenderContext = {
  bottomInset: number;
  stackIndex: number;
};

export type FloatingFooterLayer = {
  id: string;
  priority?: number;
  visible?: boolean;
  render: (context: FloatingFooterRenderContext) => ReactNode;
};

type FloatingFooterContextValue = {
  registerLayer: (layer: FloatingFooterLayer) => void;
  unregisterLayer: (id: string) => void;
  stackInset: number;
};

const FloatingFooterContext = createContext<FloatingFooterContextValue | null>(
  null,
);

function isGlobalAudioLayer(layer: FloatingFooterLayer) {
  return layer.id === FLOATING_FOOTER_GLOBAL_AUDIO_ID;
}

function compareLayers(a: FloatingFooterLayer, b: FloatingFooterLayer) {
  if (isGlobalAudioLayer(a) && !isGlobalAudioLayer(b)) return -1;
  if (!isGlobalAudioLayer(a) && isGlobalAudioLayer(b)) return 1;

  const priorityA = a.priority ?? 50;
  const priorityB = b.priority ?? 50;
  if (priorityA !== priorityB) return priorityA - priorityB;
  return a.id.localeCompare(b.id);
}

export function FloatingFooterProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((state) => state.height);
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const [layers, setLayers] = useState<Record<string, FloatingFooterLayer>>({});
  const [heights, setHeights] = useState<Record<string, number>>({});

  const bottomInset = keyboardVisible
    ? Math.max(keyboardHeight + KEYBOARD_BOTTOM_GAP, insets.bottom)
    : insets.bottom + RESTING_BOTTOM_GAP;

  const visibleLayers = useMemo(
    () =>
      Object.values(layers)
        .filter((layer) => layer.visible !== false)
        .sort(compareLayers),
    [layers],
  );

  const stackHeight = visibleLayers.reduce((total, layer, index) => {
    const height = heights[layer.id] ?? 0;
    const gap = index > 0 ? FOOTER_GAP : 0;
    return total + height + gap;
  }, 0);

  const registerLayer = useCallback((layer: FloatingFooterLayer) => {
    setLayers((current) => ({ ...current, [layer.id]: layer }));
  }, []);

  const unregisterLayer = useCallback((id: string) => {
    setLayers((current) => {
      const { [id]: _removed, ...next } = current;
      return next;
    });
    setHeights((current) => {
      const { [id]: _removed, ...next } = current;
      return next;
    });
  }, []);

  const updateHeight = useCallback((id: string, event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setHeights((current) => {
      if (current[id] === nextHeight) return current;
      return { ...current, [id]: nextHeight };
    });
  }, []);

  const value = useMemo(
    () => ({
      registerLayer,
      stackInset: bottomInset + stackHeight,
      unregisterLayer,
    }),
    [bottomInset, registerLayer, stackHeight, unregisterLayer],
  );

  return (
    <FloatingFooterContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { bottom: bottomInset }]}
      >
        {visibleLayers
          .slice()
          .reverse()
          .map((layer, reverseIndex) => {
            const stackIndex = visibleLayers.length - reverseIndex - 1;
            return (
              <View
                key={layer.id}
                pointerEvents="box-none"
                onLayout={(event) => updateHeight(layer.id, event)}
                style={reverseIndex > 0 ? styles.layerWithGap : styles.layer}
              >
                {layer.render({ bottomInset, stackIndex })}
              </View>
            );
          })}
      </View>
    </FloatingFooterContext.Provider>
  );
}

export function useFloatingFooterLayer(layer: FloatingFooterLayer) {
  const context = useContext(FloatingFooterContext);
  const registerLayer = context?.registerLayer;
  const unregisterLayer = context?.unregisterLayer;

  useEffect(() => {
    if (!registerLayer) return;
    registerLayer(layer);
  }, [layer, registerLayer]);

  useEffect(() => {
    if (!unregisterLayer) return;
    return () => unregisterLayer(layer.id);
  }, [layer.id, unregisterLayer]);
}

export function useFloatingFooterInset() {
  return useContext(FloatingFooterContext)?.stackInset ?? 0;
}

export function useAnimatedFloatingFooterBottom({
  duration = 180,
  gap = 8,
  minimum = 18,
}: {
  duration?: number;
  gap?: number;
  minimum?: number;
} = {}) {
  const stackInset = useFloatingFooterInset();
  const targetBottom = Math.max(minimum, stackInset + gap);
  const animatedBottom = useRef(new Animated.Value(targetBottom)).current;

  useEffect(() => {
    Animated.timing(animatedBottom, {
      toValue: targetBottom,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedBottom, duration, targetBottom]);

  return animatedBottom;
}

const styles = StyleSheet.create({
  host: {
    alignItems: "stretch",
    elevation: 3000,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 3000,
  },
  layer: {},
  layerWithGap: {
    marginBottom: FOOTER_GAP,
  },
});
