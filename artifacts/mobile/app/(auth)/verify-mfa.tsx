import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function VerifyMfaScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const { startMfaChallenge, verifyMfa } = useAuth();
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void startMfaChallenge().then((challenge) => {
      if (active) { setFactorId(challenge.factorId); setChallengeId(challenge.challengeId); setLoading(false); }
    }).catch((reason: unknown) => {
      if (active) { setError(reason instanceof Error ? reason.message : t("mfaSetupFailed")); setLoading(false); }
    });
    return () => { active = false; };
  }, [startMfaChallenge, t]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code) || !factorId || !challengeId) { setError(t("mfaCodeInvalid")); return; }
    setSubmitting(true); setError("");
    const result = await verifyMfa(factorId, challengeId, code);
    setSubmitting(false);
    if (!result.success) { setError(result.error ?? t("mfaVerifyFailed")); return; }
    router.replace("/(tabs)");
  };

  return <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={styles.content}>
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}><Feather name="shield" size={26} color={colors.primary} /></View>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("mfaChallengeTitle")}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("mfaChallengeBody")}</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : <>
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" placeholderTextColor={colors.mutedForeground} maxLength={6} style={[styles.code, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        <Pressable onPress={() => void submit()} disabled={submitting} style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("verifyCode")}</Text>}
        </Pressable>
      </>}
      <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.back}><Text style={[styles.backText, { color: colors.mutedForeground }]}>{t("backToLogin")}</Text></Pressable>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28 }, content: { alignItems: "center" }, icon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" }, body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, textAlign: "center", marginTop: 8, marginBottom: 18 },
  error: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 12 }, code: { width: "100%", borderWidth: 1, borderRadius: 10, padding: 16, textAlign: "center", letterSpacing: 8, fontSize: 22, fontFamily: "Inter_600SemiBold" },
  button: { width: "100%", padding: 15, alignItems: "center", marginTop: 14 }, buttonText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }, back: { padding: 16, marginTop: 8 }, backText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
