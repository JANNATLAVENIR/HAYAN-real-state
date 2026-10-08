import { Feather } from "@expo/vector-icons";
import React from "react";
import { Linking, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

export function PropertyMap({ latitude, longitude, title, style }: { latitude: number; longitude: number; title: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;

  return (
    <Pressable onPress={() => void Linking.openURL(mapUrl)} accessibilityRole="link" accessibilityLabel={`Open map for ${title}`}>
      <View style={[styles.container, { backgroundColor: colors.secondary }, style]}>
        <Feather name="map-pin" size={28} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.link, { color: colors.primary }]}>Open location map</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 190, marginTop: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  title: { fontSize: 14, fontWeight: "600" },
  link: { fontSize: 13, fontWeight: "600" },
});
