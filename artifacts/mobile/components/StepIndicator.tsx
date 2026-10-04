import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= currentStep ? colors.primary : colors.muted,
                    borderColor: i <= currentStep ? colors.primary : colors.border,
                  },
                ]}
              >
                {i < currentStep && <Text style={[styles.checkmark, { color: colors.primaryForeground }]}>✓</Text>}
                {i === currentStep && <View style={[styles.innerDot, { backgroundColor: colors.primaryForeground }]} />}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: i <= currentStep ? colors.foreground : colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {labels[i]}
              </Text>
            </View>
            {i < totalSteps - 1 && (
              <View style={[styles.line, { backgroundColor: i < currentStep ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, paddingHorizontal: 20 },
  stepsRow: { flexDirection: "row", alignItems: "flex-start" },
  stepItem: { alignItems: "center", width: 60 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  innerDot: { width: 8, height: 8, borderRadius: 4 },
  checkmark: { fontSize: 12, fontFamily: "Inter_700Bold" },
  label: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.5, marginTop: 6, textAlign: "center" },
  line: { flex: 1, height: 2, marginTop: 13 },
});
