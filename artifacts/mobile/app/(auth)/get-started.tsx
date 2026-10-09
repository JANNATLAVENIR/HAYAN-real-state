import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function GetStartedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const compact = height < 760;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (compact ? 8 : 18),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>
        <Image
          source={require("@/assets/images/hayan-logo.png")}
          contentFit="contain"
          style={[styles.logo, compact && styles.compactLogo]}
          accessibilityLabel="HAYAN Real Estate"
        />

        <View style={[styles.intro, compact && styles.compactIntro]}>
          <Text style={[styles.headline, { color: colors.foreground }, compact && styles.compactHeadline]}>
            {t("getStartedLead")}{"\n"}
            <Text style={{ color: colors.primary }}>{t("getStartedEmphasis")}</Text>
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {t("getStartedDescription")}
          </Text>
        </View>

        <Image
          source={require("@/assets/images/welcome-house-reference.png")}
          contentFit="contain"
          style={[styles.illustration, compact && styles.compactIllustration]}
          accessibilityLabel={t("getStartedDescription")}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/register")}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.foreground, opacity: pressed ? 0.86 : 1 }]}
        >
          <Text style={styles.primaryButtonText}>{t("getStarted")}</Text>
          <Feather name="arrow-right" size={21} color="#FFFFFF" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/login")}
          style={styles.loginLink}
          hitSlop={8}
        >
          <Text style={[styles.loginLinkText, { color: colors.secondaryForeground }]}>{t("alreadyHaveAccount")}</Text>
        </Pressable>

        <View style={[styles.companyCredit, { borderTopColor: colors.border }]}>
          <Image
            source={require("@/assets/images/jannat-lavenir-logo.png")}
            contentFit="contain"
            style={styles.companyLogo}
            accessibilityLabel="Jannat L'Avenir logo"
          />
          <View>
            <Text style={[styles.companyCreditLabel, { color: colors.mutedForeground }]}>Developed by</Text>
            <Text style={[styles.companyName, { color: colors.foreground }]}>JANNAT L'AVENIR</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24 },
  page: { width: "100%", maxWidth: 460, flexGrow: 1, justifyContent: "space-between" },
  logo: { width: 188, height: 180, alignSelf: "center" },
  compactLogo: { width: 152, height: 142 },
  intro: { marginTop: 4, marginBottom: 18 },
  compactIntro: { marginBottom: 12 },
  headline: { fontFamily: "Georgia", fontSize: 34, lineHeight: 41, letterSpacing: -0.8 },
  compactHeadline: { fontSize: 30, lineHeight: 36 },
  description: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 390 },
  illustration: { width: "100%", height: 258, marginBottom: 20, alignSelf: "center" },
  compactIllustration: { height: 218, marginBottom: 14 },
  primaryButton: { minHeight: 58, paddingHorizontal: 26, borderRadius: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  primaryButtonText: { color: "#FFFFFF", fontFamily: "Georgia", fontSize: 18 },
  loginLink: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 10 },
  loginLinkText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  companyCredit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 10, paddingBottom: 2 },
  companyLogo: { width: 24, height: 30 },
  companyCreditLabel: { fontSize: 9, fontFamily: "Inter_400Regular", letterSpacing: 0.4, marginBottom: 2 },
  companyName: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
});
