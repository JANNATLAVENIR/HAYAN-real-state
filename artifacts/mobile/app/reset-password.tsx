import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { setPasswordRecoveryActive, supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const processing = useRef(false);

  useEffect(() => {
    let active = true;
    const receiveRecoveryLink = async (url: string) => {
      if (!active || !supabase || processing.current) return;
      let query: URLSearchParams;
      try {
        const hashIndex = url.indexOf("#");
        const queryIndex = url.indexOf("?");
        const queryPart = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : "";
        const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
        query = new URLSearchParams(queryPart);
        const fragment = new URLSearchParams(hashPart);
        const code = query.get("code") ?? fragment.get("code");
        const tokenHash = query.get("token_hash") ?? fragment.get("token_hash");
        const accessToken = fragment.get("access_token") ?? query.get("access_token");
        const refreshToken = fragment.get("refresh_token") ?? query.get("refresh_token");
        const flowType = fragment.get("type") ?? query.get("type");
        if (!code && !tokenHash && !(accessToken && refreshToken && flowType === "recovery")) return;

        setPasswordRecoveryActive(true);
        processing.current = true;
        const result = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : tokenHash
            ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
            : await supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
        if (!active) return;
        if (result.error) {
          setPasswordRecoveryActive(false);
          processing.current = false;
          setError(result.error.message);
          return;
        }
        if (code && (!("redirectType" in result.data) || result.data.redirectType !== "recovery")) {
          setPasswordRecoveryActive(false);
          processing.current = false;
          await supabase.auth.signOut();
          setError("This is not a password recovery link. Request a new one.");
          return;
        }
        setRecoveryReady(true);
        setError("");
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        setPasswordRecoveryActive(false);
        if (active) setError("This password reset link is invalid or expired. Request a new one.");
        processing.current = false;
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      void receiveRecoveryLink(window.location.href);
    } else {
      void Linking.getInitialURL().then((url) => { if (url) void receiveRecoveryLink(url); });
      const subscription = Linking.addEventListener("url", ({ url }) => { void receiveRecoveryLink(url); });
      return () => { active = false; setPasswordRecoveryActive(false); subscription.remove(); };
    }
    return () => { active = false; setPasswordRecoveryActive(false); };
  }, []);

  const handleReset = async () => {
    if (!recoveryReady) return setError(t("unableResetLink"));
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
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{recoveryReady ? t("chooseSecurePassword") : "Open the password reset link from your email to continue."}</Text>
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
        <Pressable onPress={handleReset} disabled={loading || !recoveryReady} style={[styles.button, { backgroundColor: colors.primary, opacity: recoveryReady ? 1 : 0.6 }]}>
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
