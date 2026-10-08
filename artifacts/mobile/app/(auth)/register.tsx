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
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import type { User } from "@/constants/types";

const ROLES: { label: TranslationKey; value: User["role"]; icon: string; desc: TranslationKey }[] = [
  { label: "buyerRole", value: "buyer", icon: "search", desc: "buyerRoleDesc" },
  { label: "sellerRole", value: "seller", icon: "tag", desc: "sellerRoleDesc" },
  { label: "renterRole", value: "renter", icon: "key", desc: "renterRoleDesc" },
];

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("buyer");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError(t("requiredFields"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordAtLeast8"));
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await register({ email, password, name, phone, role });
      if (!result.success) setError(result.error || t("registrationFailed"));
      else if (result.needsEmailConfirmation) setMessage(t("confirmationEmail"));
      else if (result.needsAdminApproval) setMessage(t("accountPendingApproval"));
      else router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${t("registrationFailed")}. ${t("tryAgain")}`);
    } finally {
      setLoading(false);
    }
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

        <Text style={[styles.title, { color: colors.foreground }]}>{t("createAccount")}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("joinDalka")}</Text>

          {error ? (
          <View style={[styles.errorBox, { backgroundColor: "rgba(196,91,91,0.1)", borderRadius: colors.radius }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
          ) : null}
          {message ? <Text accessibilityRole="alert" style={{ color: colors.primary, marginBottom: 16 }}>{message}</Text> : null}

        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t("iAm")}</Text>
        <View style={styles.rolesGrid}>
          {ROLES.map((r) => (
            <Pressable
              key={r.value}
              style={[
                styles.roleCard,
                {
                  borderColor: role === r.value ? colors.primary : colors.border,
                  backgroundColor: role === r.value ? "rgba(201,169,110,0.08)" : colors.card,
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRole(r.value);
              }}
            >
              <Feather name={r.icon as any} size={20} color={role === r.value ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.roleLabel, { color: role === r.value ? colors.primary : colors.foreground }]}>{t(r.label)}</Text>
              <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>{t(r.desc)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("fullName")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="user" size={18} color={colors.mutedForeground} />
            <TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder={t("yourName")} placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} autoComplete="name" />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("email")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="mail" size={18} color={colors.mutedForeground} />
            <TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder="your@email.com" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("phone")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="phone" size={18} color={colors.mutedForeground} />
            <TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder="+252 61 234 5678" placeholderTextColor={colors.mutedForeground} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("password")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder={t("createPassword")} placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="new-password" />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.registerBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.registerBtnText, { color: colors.primaryForeground }]}>{t("createAccount")}</Text>
          )}
        </Pressable>

        <View style={styles.bottomRow}>
          <Text style={[styles.haveAccountText, { color: colors.mutedForeground }]}>{t("alreadyAccount")} </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.signInText, { color: colors.primary }]}>{t("signIn")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  backBtn: { marginBottom: 20 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 24 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 12 },
  rolesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  roleCard: { width: "48%", padding: 14, borderWidth: 1, flexGrow: 1, minWidth: 140 },
  roleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  roleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  registerBtn: { paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 16 },
  registerBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  bottomRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  haveAccountText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signInText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
