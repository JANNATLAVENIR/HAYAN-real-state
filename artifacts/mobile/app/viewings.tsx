import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ScheduledViewing } from "@/constants/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useColors } from "@/hooks/useColors";

type ViewingFilter = "all" | "pending" | "confirmed" | "past";

function formatViewingDate(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function formatViewingTime(value: string, locale: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hour, minute));
}

function isPastViewing(item: ScheduledViewing) {
  return item.status === "cancelled" || Date.parse(`${item.date}T${item.time.slice(0, 5)}:00`) < Date.now();
}

export default function ViewingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { settings } = useBranding();
  const { viewings, isLoading, refreshListings, cancelViewing, respondToViewing, rescheduleViewing } = useListings();
  const [filter, setFilter] = useState<ViewingFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [rescheduling, setRescheduling] = useState<ScheduledViewing | null>(null);
  const [statusChange, setStatusChange] = useState<{ item: ScheduledViewing; status: "confirmed" | "cancelled" } | null>(null);
  const [statusChangeError, setStatusChangeError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const locale = language === "so" ? "so-SO" : "en-US";

  const visibleViewings = useMemo(() => {
    const mine = viewings.filter((item) => item.userId === user?.id || item.agentId === user?.id);
    const filtered = mine.filter((item) => {
      const past = isPastViewing(item);
      if (filter === "past") return past;
      if (filter === "pending" || filter === "confirmed") return !past && item.status === filter;
      return true;
    });
    return filtered.sort((a, b) => {
      const direction = filter === "past" ? -1 : 1;
      return direction * `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  }, [viewings, user?.id, filter]);

  const updateStatus = (item: ScheduledViewing, status: "confirmed" | "cancelled") => {
    setStatusChangeError("");
    setStatusChange({ item, status });
  };

  const confirmStatusChange = async () => {
    if (!statusChange) return;
    setSavingStatus(true);
    setStatusChangeError("");
    try {
      if (statusChange.status === "cancelled") await cancelViewing(statusChange.item.id);
      else await respondToViewing(statusChange.item.id, statusChange.status);
      setStatusChange(null);
    } catch (error) {
      setStatusChangeError(error instanceof Error ? error.message : t("tryAgain"));
    } finally {
      setSavingStatus(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshListings();
    } finally {
      setRefreshing(false);
    }
  };

  const openReschedule = (item: ScheduledViewing) => {
    setRescheduling(item);
    setNewDate(item.date);
    setNewTime(item.time.slice(0, 5));
  };

  const saveReschedule = async () => {
    if (!rescheduling) return;
    try {
      await rescheduleViewing(rescheduling.id, newDate.trim(), newTime.trim());
      setRescheduling(null);
      Alert.alert(t("viewingRescheduled"));
    } catch (error) {
      Alert.alert(t("couldNotSchedule"), error instanceof Error ? error.message : t("tryAgain"));
    }
  };

  const filters: { key: ViewingFilter; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "pending", label: t("pending") },
    { key: "confirmed", label: t("confirmedStatus") },
    { key: "past", label: t("pastViewings") },
  ];

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }]}>
        <Feather name="lock" size={42} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground, textAlign: "center", marginTop: 16 }]}>{t("signInRequired")}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center", marginTop: 8 }]}>{t("signInToSchedule")}</Text>
        <Pressable style={[styles.guestLoginButton, { backgroundColor: colors.primary }]} onPress={() => router.push("/(auth)/login")}>
          <Text style={[styles.guestLoginText, { color: colors.primaryForeground }]}>{t("signIn")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8), borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel={t("cancel")} hitSlop={12}>
          <Feather name="arrow-left" size={23} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("myViewings")}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("viewingsDescription")}</Text>
        </View>
        <Pressable onPress={() => void onRefresh()} accessibilityLabel={t("refreshSchedule")} hitSlop={12}>
          <Feather name="refresh-cw" size={19} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => { Haptics.selectionAsync(); setFilter(item.key); }}
              style={[styles.filterChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, borderRadius: colors.radius }]}
            >
              <Text style={[styles.filterText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !refreshing ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, visibleViewings.length === 0 && styles.emptyList, {
            paddingBottom: insets.bottom + (Platform.OS === "web" && settings.showFooter ? settings.navHeight + settings.footerHeight / 4 + 24 : 36),
          }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {visibleViewings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}><Feather name="calendar" size={28} color={colors.primary} /></View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("noViewings")}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>{t("viewingsEmptyDescription")}</Text>
            </View>
          ) : visibleViewings.map((item) => {
            const incoming = item.agentId === user?.id && item.userId !== user?.id;
            const past = isPastViewing(item);
            const statusColor = item.status === "confirmed" ? "#2D8A62" : item.status === "pending" ? colors.primary : colors.mutedForeground;
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.dateIcon, { backgroundColor: colors.background }]}>
                    <Feather name="calendar" size={17} color={colors.primary} />
                  </View>
                  <View style={styles.cardHeading}>
                    <Text style={[styles.propertyTitle, { color: colors.foreground }]} numberOfLines={2}>{item.propertyTitle}</Text>
                    <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>{incoming ? t("incomingViewing") : t("yourViewingRequest")}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status === "pending" ? t("pending") : item.status === "confirmed" ? t("confirmedStatus") : t("cancelledStatus")}</Text>
                  </View>
                </View>

                <View style={[styles.dateTime, { borderTopColor: colors.border }]}>
                  <Feather name="calendar" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.dateText, { color: colors.foreground }]}>{formatViewingDate(item.date, locale)}</Text>
                  <Feather name="clock" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.dateText, { color: colors.foreground }]}>{formatViewingTime(item.time, locale)}</Text>
                </View>

                {incoming && item.requesterName ? (
                  <Text style={[styles.requester, { color: colors.mutedForeground }]}>{t("requester")}: {item.requesterName}</Text>
                ) : null}

                {!past && item.status !== "cancelled" ? (
                  <View style={[styles.actions, { borderTopColor: colors.border }]}>
                    {incoming && item.status === "pending" ? (
                      <Pressable style={[styles.actionButton, { backgroundColor: colors.primary, borderRadius: colors.radius }]} onPress={() => updateStatus(item, "confirmed")}>
                        <Feather name="check" size={16} color={colors.primaryForeground} />
                        <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{t("confirm")}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius }]} onPress={() => updateStatus(item, "cancelled")}>
                      <Feather name="x" size={16} color={colors.destructive} />
                      <Text style={[styles.actionText, { color: colors.destructive }]}>{t("cancelViewing")}</Text>
                    </Pressable>
                    <Pressable style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius }]} onPress={() => openReschedule(item)}>
                      <Feather name="clock" size={15} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>{t("rescheduleViewing")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
      <Modal visible={Boolean(rescheduling)} transparent animationType="fade" onRequestClose={() => setRescheduling(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("rescheduleViewing")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("rescheduleHelp")}</Text>
            <TextInput value={newDate} onChangeText={setNewDate} placeholder={t("newViewingDate")} placeholderTextColor={colors.mutedForeground} style={[styles.rescheduleInput, { color: colors.foreground, borderColor: colors.border }]} autoCapitalize="none" />
            <TextInput value={newTime} onChangeText={setNewTime} placeholder={t("newViewingTime")} placeholderTextColor={colors.mutedForeground} style={[styles.rescheduleInput, { color: colors.foreground, borderColor: colors.border }]} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRescheduling(null)} style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}><Text style={[styles.actionText, { color: colors.foreground }]}>{t("cancel")}</Text></Pressable>
              <Pressable onPress={() => void saveReschedule()} style={[styles.actionButton, { backgroundColor: colors.primary }]}><Text style={[styles.actionText, { color: colors.primaryForeground }]}>{t("update")}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(statusChange)} transparent animationType="fade" onRequestClose={() => setStatusChange(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {statusChange?.status === "confirmed" ? t("confirmViewing") : t("cancelViewing")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {statusChange?.status === "confirmed" ? t("confirmViewingPrompt") : t("cancelViewingPrompt")}
            </Text>
            {statusChangeError ? <Text style={[styles.subtitle, { color: colors.destructive }]}>{statusChangeError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable disabled={savingStatus} onPress={() => setStatusChange(null)} style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t("keepViewing")}</Text>
              </Pressable>
              <Pressable disabled={savingStatus} onPress={() => void confirmStatusChange()} style={[styles.actionButton, { backgroundColor: statusChange?.status === "cancelled" ? colors.destructive : colors.primary }]}>
                {savingStatus ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                  {statusChange?.status === "confirmed" ? t("confirmViewing") : t("cancelViewing")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 78, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  guestLoginButton: { marginTop: 18, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  guestLoginText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36, gap: 12 },
  emptyList: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 9 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loading: { marginTop: 38 },
  card: { borderWidth: 1, padding: 15 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  dateIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  cardHeading: { flex: 1 },
  propertyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  roleLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dateTime: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
  dateText: { fontSize: 12, fontFamily: "Inter_500Medium", marginRight: 6 },
  requester: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 10 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 12 },
  actionButton: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modalCard: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 12 },
  rescheduleInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
});
