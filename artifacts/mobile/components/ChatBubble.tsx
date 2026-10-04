import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
  isOwn: boolean;
  timestamp: string;
}

export function ChatBubble({ text, isOwn, timestamp }: Props) {
  const colors = useColors();

  const time = new Date(timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
      <View
        style={[
          styles.bubble,
          isOwn
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.secondary, borderBottomLeftRadius: 4 },
          { borderRadius: 18 },
        ]}
      >
        <Text style={[styles.text, { color: isOwn ? colors.primaryForeground : colors.foreground }]}>{text}</Text>
      </View>
      <Text style={[styles.time, { color: colors.mutedForeground }, isOwn ? styles.ownTime : styles.otherTime]}>{timeStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 4, paddingHorizontal: 16 },
  ownWrapper: { alignItems: "flex-end" },
  otherWrapper: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: 16, paddingVertical: 10 },
  text: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  time: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4, paddingHorizontal: 4 },
  ownTime: { textAlign: "right" },
  otherTime: { textAlign: "left" },
});
