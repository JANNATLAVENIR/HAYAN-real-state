import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  useWindowDimensions,
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
  const { t, language, setLanguage } = useLanguage();
  const { height } = useWindowDimensions();
  const compact = height < 850;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t("fillFields"));
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await login(email, password);

      if (result.needsAdminApproval) {
        setMessage(t("accountPendingApproval"));
      } else if (result.accountRejected) {
        setError(t("accountRequestRejected"));
      } else if (!result.success) {
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 24 : 16), paddingBottom: insets.bottom + 18 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.page, compact && styles.compactPage]}>
        <Image source={require("@/assets/images/welcome-house-reference.png")} contentFit="cover" style={styles.loginBackdrop} accessibilityElementsHidden importantForAccessibility="no" pointerEvents="none" />
        <View style={styles.languageRow}>
          <View style={styles.languageSwitch}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: language === "en" }} onPress={() => void setLanguage("en")}><Text style={[styles.languageText, { color: language === "en" ? colors.primary : colors.mutedForeground }]}>EN</Text></Pressable>
            <Text style={[styles.languageDivider, { color: colors.border }]}>|</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: language === "so" }} onPress={() => void setLanguage("so")}><Text style={[styles.languageText, { color: language === "so" ? colors.primary : colors.mutedForeground }]}>SO</Text></Pressable>
          </View>
        </View>
        <View style={[styles.brandSection, compact && styles.compactBrandSection]}>
          <Image source={require("@/assets/images/hayan-logo.png")} contentFit="contain" style={styles.brandLogo} accessibilityLabel="HAYÁN Real Estate" />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.welcomeText, { color: colors.foreground }]}>
            {language === "en" ? <>Welcome <Text style={{ color: colors.primary }}>back</Text></> : t("welcomeBack")}
          </Text>
          <Text style={[styles.subtitleText, { color: colors.mutedForeground }]}>{t("signInContinue")}</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "rgba(196,91,91,0.1)", borderRadius: colors.radius }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}
          {message ? <Text accessibilityRole="alert" style={[styles.infoText, { color: colors.primary }]}>{message}</Text> : null}

          <View style={styles.fieldGroup}>
            <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder={language === "en" ? "Email address" : t("email")}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t("email")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder={t("enterPassword")}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t("password")}
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
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.foreground, opacity: pressed ? 0.88 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.loginBtnText, { color: colors.background }]}>{language === "en" ? "Log In" : t("signIn")}</Text>
                <Feather name="arrow-right" size={21} color={colors.background} />
              </>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: "center" },
  page: { width: "100%", maxWidth: 520, flexGrow: 1, justifyContent: "space-between", position: "relative" },
  compactPage: { justifyContent: "flex-start" },
  loginBackdrop: { position: "absolute", width: "100%", height: 230, bottom: 0, left: 0, opacity: 0.2 },
  languageRow: { height: 34, alignItems: "flex-end", justifyContent: "center" },
  languageSwitch: { flexDirection: "row", alignItems: "center", gap: 12 },
  languageText: { fontSize: 13, fontFamily: "Georgia" },
  languageDivider: { fontSize: 13 },
  brandSection: { alignItems: "center", marginTop: 12, marginBottom: 18 },
  compactBrandSection: { marginTop: 4, marginBottom: 12 },
  brandLogo: { width: 220, height: 166 },
  formSection: { flex: 1 },
  welcomeText: { fontSize: 38, lineHeight: 46, fontFamily: "Georgia", letterSpacing: -0.8 },
  subtitleText: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", marginTop: 7, marginBottom: 22 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  infoText: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 16 },
  fieldGroup: { marginBottom: 14 },
  inputWrapper: { minHeight: 60, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, gap: 12, backgroundColor: "rgba(255,255,255,0.42)" },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Georgia" },
  forgotText: { fontSize: 13, fontFamily: "Georgia", textAlign: "right", marginBottom: 24 },
  loginBtn: { minHeight: 60, paddingHorizontal: 26, borderRadius: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 18 },
  loginBtnText: { fontSize: 17, fontFamily: "Georgia" },
  bottomSection: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22 },
  noAccountText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signUpText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  companyCredit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 12, paddingBottom: 6 },
  companyLogo: { width: 24, height: 32 },
  companyCreditLabel: { fontSize: 10, fontFamily: "Inter_400Regular", letterSpacing: 0.5, marginBottom: 3 },
  companyName: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1.1 },
});
