import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type MfaChallenge = { factorId: string; challengeId: string };

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const isSomali = language === "so";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [reauthenticated, setReauthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = {
    title: isSomali ? "Tirtir akoonka" : "Delete account",
    warning: isSomali
      ? "Tallaabadani si joogto ah ayay u tirtiraysaa akoonkaaga, guryaha aad leedahay iyo sawirradooda, bookmarks, fariimaha aad dirtay, ogeysiisyada, ballamaha iyo xogta kale ee akoonka ku xiran. Lama soo celin karo."
      : "This permanently deletes your account, your property listings and their photos, bookmarks, messages you sent, notifications, appointments, and other linked account data. This cannot be undone.",
    storage: isSomali
      ? "Sawirrada waxaa marka hore laga saarayaa kaydka. Haddii tirtiriddu kala go'do, waxaad dib u geli kartaa oo codsiga ku celin kartaa."
      : "Photos are removed from storage first. If deletion is interrupted, sign in again and retry the request.",
    password: isSomali ? "Erayga sirta ah hadda" : "Current password",
    phrase: isSomali ? "Qor DELETE si aad u xaqiijiso" : "Type DELETE to confirm",
    delete: isSomali ? "Tirtir akoonka si joogto ah" : "Permanently delete account",
    cancel: isSomali ? "Ka noqo" : "Cancel",
    mfa: isSomali ? "Geli koodhka 6-god ah ee app-ka xaqiijinta" : "Enter the 6-digit code from your authenticator app",
    retry: isSomali ? "Isku day mar kale" : "Try again",
    signIn: isSomali ? "Marka hore gal akoonkaaga." : "Sign in to your account first.",
  };

  const invokeDeletion = async () => {
    if (!supabase) throw new Error("Account deletion service is not configured.");
    const { error: invokeError } = await supabase.functions.invoke("delete-account", { body: { confirmation: "DELETE" } });
    if (invokeError) {
      let code = "";
      let message = invokeError.message;
      try {
        const responseBody = await (invokeError as any).context?.json?.();
        code = responseBody?.error ?? "";
        message = responseBody?.message ?? message;
      } catch { /* Keep the SDK error when the response is not JSON. */ }
      if (code === "LAST_ACTIVE_ADMIN") throw new Error(isSomali ? "Admin-ka ugu dambeeya lama tirtiri karo. Marka hore admin kale ha loo magacaabo." : "The last active admin cannot be deleted. Assign another admin first.");
      if (code === "RECENT_SIGN_IN_REQUIRED") throw new Error(isSomali ? "Galitaankaagu wuu duugoobay. Mar kale geli erayga sirta ah." : "Your sign-in is too old. Re-enter your password and retry.");
      if (code === "MFA_VERIFICATION_REQUIRED") throw new Error(isSomali ? "Xaqiiji koodhka MFA ka hor tirtiridda." : "Verify your MFA code before deleting the account.");
      throw new Error(message);
    }
    await logout();
    router.replace("/(auth)/login");
  };

  const submit = async () => {
    if (!supabase) { setError(copy.signIn); return; }
    if (confirmation !== "DELETE") { setError(isSomali ? "Qor DELETE si aad u sii waddo." : "Type DELETE to continue."); return; }
    setBusy(true);
    setError("");
    try {
      if (challenge) {
        if (!/^\d{6}$/.test(mfaCode)) throw new Error(isSomali ? "Geli koodh sax ah oo 6-god ah." : "Enter a valid 6-digit code.");
        const { error: verifyError } = await supabase.auth.mfa.verify({ ...challenge, code: mfaCode });
        if (verifyError) throw new Error(verifyError.message);
        setChallenge(null);
        await invokeDeletion();
        return;
      }

      if (!user) { setError(copy.signIn); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (signInError) throw new Error(signInError.message);
      setReauthenticated(true);
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw new Error(assuranceError.message);
      if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw new Error(factorsError.message);
        const factor = factors.totp.find((item) => item.status === "verified");
        if (!factor) throw new Error(isSomali ? "Lama helin MFA la xaqiijiyey." : "No verified MFA factor was found.");
        const { data: newChallenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challengeError) throw new Error(challengeError.message);
        setChallenge({ factorId: factor.id, challengeId: newChallenge.id });
        return;
      }
      await invokeDeletion();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (isSomali ? "Tirtiriddu way fashilantay." : "Account deletion failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!user && !reauthenticated && !challenge) {
    return <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
      <Text style={[styles.body, { color: colors.foreground }]}>{copy.signIn}</Text>
      <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => router.replace("/(auth)/login")}>
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{isSomali ? "Gal" : "Sign in"}</Text>
      </Pressable>
    </View>;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.warningCard, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
        <Feather name="alert-triangle" size={22} color={colors.destructive} />
        <Text style={[styles.body, { color: colors.foreground }]}>{copy.warning}</Text>
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>{copy.storage}</Text>

      <Text style={[styles.label, { color: colors.foreground }]}>{challenge ? copy.mfa : copy.password}</Text>
      {challenge ? (
        <TextInput value={mfaCode} onChangeText={(value) => setMfaCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
      ) : (
        <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder={copy.password} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
      )}
      {!challenge ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>{copy.phrase}</Text>
        <TextInput value={confirmation} onChangeText={(value) => setConfirmation(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
      </> : null}

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <Pressable onPress={() => void submit()} disabled={busy || (!challenge && (!password || confirmation !== "DELETE")) || (Boolean(challenge) && mfaCode.length !== 6)} style={[styles.button, { backgroundColor: colors.destructive, opacity: busy ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{challenge ? copy.retry : copy.delete}</Text>}
      </Pressable>
      <Pressable onPress={() => router.back()} disabled={busy} style={[styles.cancelButton, { borderColor: colors.border }]}>
        <Text style={[styles.cancelText, { color: colors.foreground }]}>{copy.cancel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  warningCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  body: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 8 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 15 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 14 },
  button: { borderRadius: 8, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 20 },
  buttonText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  cancelButton: { borderWidth: 1, borderRadius: 8, minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 10 },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
