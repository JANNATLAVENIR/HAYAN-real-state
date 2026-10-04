import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { changePassword } = useAuth();
  const { t } = useLanguage();
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("fillFields"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("minimumPassword"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error || t("failedChangePassword"));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setTimeout(() => router.back(), 2000);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + webTopPad + 8, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("changePassword")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {success ? (
          <View style={styles.successSection}>
            <View style={[styles.checkCircle, { backgroundColor: "rgba(46,204,113,0.12)" }]}>
              <Feather name="check" size={32} color="#2ECC71" />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>{t("passwordUpdated")}</Text>
            <Text style={[styles.successSubtitle, { color: colors.mutedForeground }]}>{t("passwordChanged")}</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: "rgba(196,91,91,0.1)", borderRadius: colors.radius }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("currentPassword")}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.textInput, { color: colors.foreground }]}
                  placeholder={t("currentPassword")}
                  placeholderTextColor={colors.mutedForeground}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                />
                <Pressable onPress={() => setShowCurrent(!showCurrent)} hitSlop={8}>
                  <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("newPassword")}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.textInput, { color: colors.foreground }]}
                  placeholder={t("newPassword")}
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                />
                <Pressable onPress={() => setShowNew(!showNew)} hitSlop={8}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("confirmNewPassword")}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.textInput, { color: colors.foreground }]}
                  placeholder={t("confirmPassword")}
                  placeholderTextColor={colors.mutedForeground}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showNew}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
              onPress={handleChange}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>{t("updatePassword")}</Text>
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
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, marginBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 20 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  submitBtn: { paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  successSection: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  successSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
