import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email) {
      setError(t("enterEmail"));
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await forgotPassword(email);
    setLoading(false);
    if (!result.success) {
      setError(result.error || t("unableResetLink"));
      return;
    }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>

        {sent ? (
          <View style={styles.sentSection}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(201,169,110,0.12)" }]}>
              <Feather name="mail" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("checkEmail")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
              {t("resetSentPrefix")} {email}. {t("resetSentSuffix")}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("backToLogin")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("forgotPasswordTitle")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t("forgotInstructions")}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: "rgba(196,91,91,0.1)", borderRadius: colors.radius }]}>
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("emailAddress")}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="mail" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.textInput, { color: colors.foreground }]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("sendResetLink")}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  backBtn: { marginBottom: 28 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8, marginBottom: 32, lineHeight: 22 },
  errorBox: { padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { paddingVertical: 16, alignItems: "center" },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  sentSection: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 20 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
});
