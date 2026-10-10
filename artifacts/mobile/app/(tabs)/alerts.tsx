import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAlerts } from "@/contexts/AlertsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import type { DalkaAlert } from "@/constants/types";

function getAlertIcon(type: DalkaAlert["type"]): string {
  switch (type) {
    case "price_drop": return "trending-down";
    case "new_listing": return "plus-circle";
    case "message": return "message-circle";
    case "viewing": return "calendar";
    default: return "bell";
  }
}

function getAlertColor(type: DalkaAlert["type"], colors: any): string {
  switch (type) {
    case "price_drop": return "#2ECC71";
    case "new_listing": return colors.primary;
    case "message": return "#3498DB";
    case "viewing": return "#9B59B6";
    default: return colors.mutedForeground;
  }
}

function formatTime(timestamp: string, locale: string, t: (key: TranslationKey) => string) {
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return t("justNow");
  if (hours < 24) return t("hoursAgo").replace("{{count}}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo").replace("{{count}}", String(days));
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function getAlertTitle(alert: DalkaAlert, t: (key: TranslationKey) => string) {
  switch (alert.type) {
    case "price_drop": return t("priceReduced");
    case "new_listing": return alert.title.toLowerCase().includes("approv") ? t("listingApproved") : t("newListing");
    case "message": return t("newMessage");
    case "viewing": return alert.title.toLowerCase().includes("cancel") ? t("viewingCancelled") : t("viewingConfirmed");
  }
}

function getAlertBody(alert: DalkaAlert, t: (key: TranslationKey) => string) {
  switch (alert.type) {
    case "price_drop": return t("priceDropBody");
    case "new_listing": return alert.title.toLowerCase().includes("approv") ? t("listingApprovedBody") : t("newListingBody");
    case "message": return alert.body;
    case "viewing": return alert.title.toLowerCase().includes("cancel") ? t("viewingCancelledBody") : t("viewingConfirmedBody");
  }
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { alerts, unreadCount, isLoading, loadError, reload, markAsRead, markAllAsRead, deleteAlert } = useAlerts();
  const { language, t } = useLanguage();
  const locale = language === "so" ? "so-SO" : "en-US";
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const handlePress = (alert: DalkaAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void markAsRead(alert.id).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain")));
    if (alert.propertyId) {
      router.push(`/property/${alert.propertyId}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("notifications")}</Text>
        {unreadCount > 0 && (
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void markAllAsRead().catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain"))); }}>
            <Text style={[styles.markAll, { color: colors.primary }]}>{t("markAllRead")}</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.alertItem,
              { borderBottomColor: colors.border, opacity: pressed ? 0.9 : 1, backgroundColor: item.read ? "transparent" : "rgba(201,169,110,0.04)" },
            ]}
            onPress={() => handlePress(item)}
          >
            <View style={[styles.alertIcon, { backgroundColor: getAlertColor(item.type, colors) + "15" }]}>
              <Feather name={getAlertIcon(item.type) as any} size={18} color={getAlertColor(item.type, colors)} />
            </View>
            <View style={styles.alertInfo}>
              <View style={styles.alertTop}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]}>{getAlertTitle(item, t)}</Text>
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.alertBody, { color: colors.mutedForeground }]} numberOfLines={2}>{getAlertBody(item, t)}</Text>
              <Text style={[styles.alertTime, { color: colors.mutedForeground }]}>{formatTime(item.timestamp, locale, t)}</Text>
            </View>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void deleteAlert(item.id).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain"))); }}
              hitSlop={12}
              style={styles.deleteBtn}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </Pressable>
        )}
        ListHeaderComponent={loadError && alerts.length > 0 ? (
          <View style={styles.loadErrorBox}>
            <Text style={[styles.emptyText, { color: colors.destructive }]}>{loadError}</Text>
            <Pressable onPress={() => void reload()}><Text style={[styles.retryText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable>
          </View>
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator color={colors.primary} /> : loadError ? <Feather name="wifi-off" size={40} color={colors.muted} /> : <Feather name="bell-off" size={48} color={colors.muted} />}
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isLoading ? t("loadingListings") : loadError ? t("refreshError") : t("noNotifications")}</Text>
            {loadError ? <Text style={[styles.emptyText, { color: colors.destructive }]}>{loadError}</Text> : null}
            {loadError ? <Pressable onPress={() => void reload()}><Text style={[styles.retryText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable> : null}
            {!isLoading && !loadError ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("alertEmpty")}</Text> : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? Math.max(insets.bottom + 84, 88) : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 3 },
  markAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  alertItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  alertIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  alertInfo: { flex: 1, marginLeft: 14 },
  alertTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  alertBody: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 19 },
  alertTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  deleteBtn: { padding: 4, marginLeft: 8, marginTop: 4 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 100, gap: 12 },
  loadErrorBox: { paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
