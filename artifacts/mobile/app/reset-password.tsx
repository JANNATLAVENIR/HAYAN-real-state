import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 8) return setError(t("passwordAtLeast8"));
    if (password !== confirmPassword) return setError(t("passwordsMismatch"));
    setError("");
    setLoading(true);
    const result = await resetPassword(password);
    setLoading(false);
    if (!result.success) return setError(result.error ?? t("unableResetLink"));
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: "rgba(201,169,110,0.12)" }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("setNewPassword")}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("chooseSecurePassword")}</Text>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder={t("newPassword")}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder={t("confirmPassword")}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable onPress={handleReset} disabled={loading} style={[styles.button, { backgroundColor: colors.primary }]}>
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("updatePassword")}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  content: { paddingHorizontal: 28 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginTop: 8, marginBottom: 24 },
  error: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 14 },
  input: { borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 14, borderRadius: 4 },
  button: { alignItems: "center", paddingVertical: 16, marginTop: 8, borderRadius: 4 },
  buttonText: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 1.3 },
});
