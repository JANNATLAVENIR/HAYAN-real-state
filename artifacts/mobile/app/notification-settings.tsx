import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

function tokenStorageKey(userId: string) { return `@dalka_push_token_${userId}`; }

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  useEffect(() => {
    let active = true;
    void (async () => {
      const permission = await Notifications.getPermissionsAsync().catch(() => null);
      const token = user ? await SecureStore.getItemAsync(tokenStorageKey(user.id)).catch(() => null) : null;
      if (active) {
        setEnabled(Boolean(permission?.granted && token));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const enable = async () => {
    if (!user || !supabase) return;
    if (Platform.OS === "web") { setMessage(t("pushMobileOnly")); return; }
    if (!projectId) { setMessage(t("pushProjectIdMissing")); return; }
    setBusy(true); setMessage("");
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "HAYÁN alerts", importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250], lightColor: "#C9A96E",
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
      if (!permission.granted) { setMessage(t("pushPermissionDenied")); return; }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const { error } = await supabase.rpc("register_push_device", {
        p_expo_push_token: token,
        p_platform: Platform.OS === "ios" ? "ios" : "android",
      });
      if (error) throw error;
      await SecureStore.setItemAsync(tokenStorageKey(user.id), token);
      setEnabled(true); setMessage(t("pushEnabled"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("pushUnavailable"));
    } finally { setBusy(false); }
  };

  const disable = async () => {
    if (!user || !supabase) return;
    setBusy(true); setMessage("");
    try {
      const token = await SecureStore.getItemAsync(tokenStorageKey(user.id));
      if (token) {
        const { error } = await supabase.from("push_devices").delete().eq("user_id", user.id).eq("expo_push_token", token);
        if (error) throw error;
        await SecureStore.deleteItemAsync(tokenStorageKey(user.id));
      }
      setEnabled(false); setMessage(t("pushDisabled"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("pushUnavailable")); }
    finally { setBusy(false); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("notificationSettings")}</Text><View style={{ width: 22 }} />
    </View>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}><Feather name="bell" size={22} color={colors.primary} /></View>
      <Text style={[styles.heading, { color: colors.foreground }]}>{t("pushNotifications")}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("pushNotificationsDescription")}</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 22 }} /> : <Pressable onPress={() => void (enabled ? disable() : enable())} disabled={busy} style={[styles.button, { backgroundColor: enabled ? colors.secondary : colors.primary, borderRadius: colors.radius }]}>
        {busy ? <ActivityIndicator color={enabled ? colors.foreground : colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: enabled ? colors.foreground : colors.primaryForeground }]}>{enabled ? t("disablePush") : t("enablePush")}</Text>}
      </Pressable>}
      {message ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 }, card: { borderWidth: 1, borderRadius: 12, padding: 22, margin: 20, alignItems: "center" },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 16 }, heading: { fontFamily: "Inter_600SemiBold", fontSize: 18, textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21, marginTop: 8 }, button: { minWidth: 180, paddingVertical: 14, alignItems: "center", marginTop: 20 }, buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 14 }, message: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 14 },
});
