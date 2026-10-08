import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BrandingSettings } from "@/contexts/BrandingContext";

const symbolAsset = require("@/assets/images/icon-512.png");

export function BrandLockup({
  settings,
  foreground,
  muted,
  compact = false,
}: {
  settings: BrandingSettings;
  foreground: string;
  muted: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.lockup} accessibilityLabel={[settings.brandName, settings.brandTagline].filter(Boolean).join(" ")}>
      {settings.showLogo ? (
        <Image
          source={settings.logoUrl ? { uri: settings.logoUrl } : symbolAsset}
          contentFit="contain"
          style={{ width: settings.logoWidth, height: settings.logoHeight }}
          accessibilityLabel="Hayan house symbol"
        />
      ) : null}
      {settings.showBrandName || settings.showBrandTagline ? (
        <View style={styles.copy}>
          {settings.showBrandName && settings.brandName ? (
            <Text numberOfLines={1} style={[styles.name, { color: foreground, fontSize: compact ? 14 : 16 }]}>{settings.brandName}</Text>
          ) : null}
          {settings.showBrandTagline && settings.brandTagline ? (
            <Text numberOfLines={1} style={[styles.tagline, { color: muted, fontSize: compact ? 7 : 8 }]}>{settings.brandTagline}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  copy: { minWidth: 0, justifyContent: "center", gap: 2 },
  name: { fontFamily: "Inter_700Bold", letterSpacing: 1.6 },
  tagline: { fontFamily: "Inter_500Medium", letterSpacing: 1.35 },
});
