import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t("fillFields"));
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(result.error || t("loginFailed"));
      } else if (result.needsMfa) {
        router.replace("/(auth)/verify-mfa" as never);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : `${t("loginFailed")}. ${t("tryAgain")}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <Text style={[styles.brandName, { color: colors.primary }]}>HAYÁN</Text>
          <Text style={[styles.brandTagline, { color: colors.mutedForeground }]}>{t("luxuryRealEstate")}</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.welcomeText, { color: colors.foreground }]}>{t("welcomeBack")}</Text>
          <Text style={[styles.subtitleText, { color: colors.mutedForeground }]}>{t("signInContinue")}</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "rgba(196,91,91,0.1)", borderRadius: colors.radius }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("email")}</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder="name@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("password")}</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder={t("enterPassword")}
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>{t("forgotPassword")}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>{t("signIn")}</Text>
            )}
          </Pressable>

        </View>

        <View style={styles.bottomSection}>
          <Text style={[styles.noAccountText, { color: colors.mutedForeground }]}>
            {t("noAccount")} {" "}
          </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={[styles.signUpText, { color: colors.primary }]}>{t("signUp")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  brandSection: { alignItems: "center", marginBottom: 48 },
  brandName: { fontSize: 40, fontFamily: "Inter_700Bold", letterSpacing: 12 },
  brandTagline: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 4, marginTop: 8 },
  formSection: { flex: 1 },
  welcomeText: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  subtitleText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 28 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "right", marginBottom: 24 },
  loginBtn: { paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  bottomSection: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 32 },
  noAccountText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signUpText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
