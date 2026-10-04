import { Feather } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";

const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

function formatTimeSlot(value: string, locale: string, use12HourClock: boolean) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: use12HourClock }).format(date);
}

function getNextDays(count: number, locale: string) {
  const days = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayName: d.toLocaleDateString(locale, { weekday: "short" }),
      dayNum: d.getDate().toString(),
      month: d.toLocaleDateString(locale, { month: "short" }),
    });
  }
  return days;
}

export default function ScheduleViewingScreen() {
  const params = useLocalSearchParams<{ propertyId: string; title: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === "so" ? "so-SO" : "en-US";
  const { scheduleViewing, getProperty } = useListings();
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const days = getNextDays(14, locale);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    if (!user) {
      Alert.alert(t("signInRequired"), t("signInToSchedule"));
      return;
    }
    try {
      const propertyOwnerId = getProperty(params.propertyId)?.ownerId ?? "";
      await scheduleViewing({ propertyId: params.propertyId, propertyTitle: params.title, userId: user.id, agentId: propertyOwnerId, date: selectedDate, time: selectedTime });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmed(true);
    } catch (error) {
      Alert.alert(t("couldNotSchedule"), error instanceof Error ? error.message : t("tryAgain"));
    }
  };

  const addToCalendar = async () => {
    try {
      const permission = await Calendar.requestCalendarPermissions(Platform.OS === "ios");
      if (permission.status !== "granted") {
        Alert.alert(t("calendarPermissionTitle"), t("calendarPermissionBody"));
        return;
      }
      const [year, month, day] = selectedDate.split("-").map(Number);
      const [hour, minute] = selectedTime.split(":").map(Number);
      const startDate = new Date(year, month - 1, day, hour, minute, 0);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const calendar = Platform.OS === "ios"
        ? Calendar.getDefaultCalendarSync()
        : (await Calendar.getCalendars(Calendar.EntityTypes.EVENT))
          .filter((item) => item.allowsModifications)
          .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))[0];
      if (!calendar) {
        Alert.alert(t("calendarUnavailableTitle"), t("calendarUnavailableBody"));
        return;
      }
      await calendar.createEvent({
        title: `${t("scheduleViewing")}: ${params.title}`,
        startDate,
        endDate,
        location: params.title,
        notes: `HAYÁN Real Estate property viewing (${params.propertyId})`,
        alarms: [{ relativeOffset: -30 }],
      });
      Alert.alert(t("calendarEventAddedTitle"), t("calendarEventAddedBody"));
    } catch (error) {
      Alert.alert(t("calendarUnavailableTitle"), error instanceof Error ? error.message : t("tryAgain"));
    }
  };

  if (confirmed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.confirmedSection, { paddingTop: insets.top + webTopPad + 60 }]}>
          <View style={[styles.checkCircle, { backgroundColor: "rgba(201,169,110,0.12)" }]}>
            <Feather name="check" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.confirmedTitle, { color: colors.foreground }]}>{t("viewingScheduled")}</Text>
          <Text style={[styles.confirmedSubtitle, { color: colors.mutedForeground }]}>
            {t("viewingRequest")} {params.title} · {selectedDate} · {selectedTime}
          </Text>
          <Pressable style={[styles.calendarBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={() => void addToCalendar()}>
            <Feather name="calendar" size={17} color={colors.primary} />
            <Text style={[styles.calendarBtnText, { color: colors.foreground }]}>{t("addToCalendar")}</Text>
          </Pressable>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>{t("done")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("scheduleViewing")}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.propertyName, { color: colors.foreground }]}>{params.title}</Text>

        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t("selectDate")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesRow}>
          {days.map((d) => (
            <Pressable
              key={d.date}
              style={[
                styles.dateCard,
                {
                  borderColor: selectedDate === d.date ? colors.primary : colors.border,
                  backgroundColor: selectedDate === d.date ? colors.primary : colors.card,
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedDate(d.date); }}
            >
              <Text style={[styles.dateDayName, { color: selectedDate === d.date ? colors.primaryForeground : colors.mutedForeground }]}>{d.dayName}</Text>
              <Text style={[styles.dateDayNum, { color: selectedDate === d.date ? colors.primaryForeground : colors.foreground }]}>{d.dayNum}</Text>
              <Text style={[styles.dateMonth, { color: selectedDate === d.date ? colors.primaryForeground : colors.mutedForeground }]}>{d.month}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{t("selectTime")}</Text>
        <View style={styles.timesGrid}>
          {TIME_SLOTS.map((t) => (
            <Pressable
              key={t}
              style={[
                styles.timeChip,
                {
                  borderColor: selectedTime === t ? colors.primary : colors.border,
                  backgroundColor: selectedTime === t ? colors.primary : "transparent",
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTime(t); }}
            >
              <Text style={[styles.timeText, { color: selectedTime === t ? colors.primaryForeground : colors.foreground }]}>{formatTimeSlot(t, locale, language === "en")}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: selectedDate && selectedTime ? colors.primary : colors.muted,
              borderRadius: colors.radius,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleConfirm}
          disabled={!selectedDate || !selectedTime}
        >
          <Text style={[styles.confirmBtnText, { color: selectedDate && selectedTime ? colors.primaryForeground : colors.mutedForeground }]}>
            {t("confirmViewing")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  propertyName: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 14 },
  datesRow: { gap: 10, paddingRight: 20 },
  dateCard: { width: 68, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
  dateDayName: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dateDayNum: { fontSize: 22, fontFamily: "Inter_700Bold", marginVertical: 4 },
  dateMonth: { fontSize: 11, fontFamily: "Inter_500Medium" },
  timesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  timeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  confirmBtn: { paddingVertical: 16, alignItems: "center" },
  confirmBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  confirmedSection: { flex: 1, alignItems: "center", paddingHorizontal: 40, gap: 16 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  confirmedTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  confirmedSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  doneBtn: { paddingHorizontal: 40, paddingVertical: 14, marginTop: 16 },
  calendarBtn: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 18 },
  calendarBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  doneBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
});
