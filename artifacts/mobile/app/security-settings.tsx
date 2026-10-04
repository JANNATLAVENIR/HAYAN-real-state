import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Factor = { id: string; friendly_name?: string; status: string };
type PendingFactor = { id: string; qrCode: string; secret: string };
function svgMarkup(value: string) {
  const data = value.match(/^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/i);
  if (!data) return value;
  if (value.includes(";base64,")) {
    try { return globalThis.atob(data[1]); } catch { return ""; }
  }
  try { return decodeURIComponent(data[1]); } catch { return data[1]; }
}

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const { user, biometricEnabled, setBiometricEnabled } = useAuth();
  const [factor, setFactor] = useState<Factor | null>(null);
  const [pending, setPending] = useState<PendingFactor | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadFactors = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setMessage(error.message);
    const verified = data?.totp.find((item) => item.status === "verified");
    setFactor(verified ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void loadFactors(); }, [loadFactors]);

  const toggleBiometric = async () => {
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      if (biometricEnabled) {
        await setBiometricEnabled(false); setMessage(t("biometricDisabled"));
      } else {
        const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
        if (!hardware || !enrolled) { setMessage(t("biometricUnavailable")); return; }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: t("biometricUnlock"), cancelLabel: t("cancel"), disableDeviceFallback: false });
        if (!result.success) return;
        await setBiometricEnabled(true); setMessage(t("biometricEnabled"));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : t("tryAgain")); }
    finally { setBusy(false); }
  };

  const beginEnrollment = async () => {
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "HAYÁN authenticator" });
      if (error) throw error;
      setPending({ id: data.id, qrCode: svgMarkup(data.totp.qr_code), secret: data.totp.secret });
      setCode("");
    } catch (error) { setMessage(error instanceof Error ? error.message : t("mfaSetupFailed")); }
    finally { setBusy(false); }
  };

  const verifyEnrollment = async () => {
    if (!supabase || !pending || !/^\d{6}$/.test(code)) { setMessage(t("mfaCodeInvalid")); return; }
    setBusy(true); setMessage("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pending.id });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: pending.id, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      setFactor({ id: pending.id, friendly_name: "HAYÁN authenticator", status: "verified" });
      setPending(null); setCode(""); setMessage(t("mfaEnabled"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("mfaVerifyFailed")); }
    finally { setBusy(false); }
  };

  const removeFactor = async () => {
    if (!supabase || !factor) return;
    if (!/^\d{6}$/.test(code)) { setMessage(t("mfaUnenrollCode")); return; }
    setBusy(true); setMessage("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      setFactor(null); setCode(""); setMessage(t("mfaDisabled"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("mfaVerifyFailed")); }
    finally { setBusy(false); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("securitySettings")}</Text><View style={{ width: 22 }} />
    </View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.headingRow}><Feather name="smartphone" size={19} color={colors.primary} /><Text style={[styles.heading, { color: colors.foreground }]}>{t("biometricUnlock")}</Text></View>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("biometricUnlockDescription")}</Text>
        <Pressable onPress={() => void toggleBiometric()} disabled={busy || Platform.OS === "web"} style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{biometricEnabled ? t("disableBiometric") : t("enableBiometric")}</Text>}
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.headingRow}><Feather name="shield" size={19} color={colors.primary} /><Text style={[styles.heading, { color: colors.foreground }]}>{t("mfaTitle")}</Text></View>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("mfaDescription")}</Text>
        {pending ? <>
          {pending.qrCode ? <View style={styles.qr}><SvgXml xml={pending.qrCode} width={190} height={190} /></View> : null}
          <Text style={[styles.secretLabel, { color: colors.mutedForeground }]}>{t("mfaSecret")}</Text>
          <Text selectable style={[styles.secret, { color: colors.foreground, backgroundColor: colors.secondary }]}>{pending.secret}</Text>
          <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" placeholderTextColor={colors.mutedForeground} style={[styles.code, { color: colors.foreground, borderColor: colors.border }]} />
          <Pressable onPress={() => void verifyEnrollment()} disabled={busy} style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius }]}><Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{busy ? t("saving") : t("mfaVerifySetup")}</Text></Pressable>
        </> : factor ? <>
          <Text style={[styles.enabled, { color: colors.primary }]}>{t("mfaEnabled")}</Text>
          <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" placeholderTextColor={colors.mutedForeground} style={[styles.code, { color: colors.foreground, borderColor: colors.border }]} />
          <Pressable onPress={() => Alert.alert(t("disableMfa"), t("mfaUnenrollCode"), [{ text: t("cancel"), style: "cancel" }, { text: t("disableMfa"), style: "destructive", onPress: () => { void removeFactor(); } }])} disabled={busy} style={[styles.button, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}><Text style={[styles.buttonText, { color: colors.foreground }]}>{t("disableMfa")}</Text></Pressable>
        </> : <Pressable onPress={() => void beginEnrollment()} disabled={busy} style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius }]}><Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{busy ? t("saving") : t("enableMfa")}</Text></Pressable>}
      </View>
      {message ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text> : null}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 },
  card: { borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 14 }, headingRow: { flexDirection: "row", alignItems: "center", gap: 10 }, heading: { fontFamily: "Inter_600SemiBold", fontSize: 16 }, body: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, marginTop: 8 }, button: { alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, marginTop: 16 }, buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  qr: { backgroundColor: "white", padding: 12, alignSelf: "center", marginTop: 18 }, secretLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 16 }, secret: { padding: 12, marginTop: 6, fontFamily: "Inter_600SemiBold", textAlign: "center", letterSpacing: 1 }, code: { borderBottomWidth: 1, padding: 12, textAlign: "center", letterSpacing: 8, fontSize: 20, marginTop: 16 }, enabled: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 16 }, message: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", margin: 16 },
});
