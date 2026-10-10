import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

function formatTime(timestamp: string | undefined, locale: string) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString(locale, { weekday: "short" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations, isLoading, loadError, reload, receiveRealtimeMessage } = useChat();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === "so" ? "so-SO" : "en-US";
  const [searchQuery, setSearchQuery] = React.useState("");
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useFocusEffect(useCallback(() => {
    void reload();
    if (!supabase) return;
    const channel = supabase
      .channel("dalka-inbox-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        receiveRealtimeMessage(payload.new as Record<string, any>);
      })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [reload, receiveRealtimeMessage]));
  const filteredConversations = conversations.filter((conversation) => {
    const participantNames = conversation.participants
      .filter((participantId) => participantId !== user?.id)
      .map((participantId) => conversation.participantNames[participantId] ?? "");
    const searchText = [
      ...participantNames,
      conversation.propertyTitle ?? "",
      conversation.propertyLocation ?? "",
      conversation.lastMessage ?? "",
    ].join(" ").toLowerCase();
    return searchText.includes(searchQuery.trim().toLowerCase());
  });

  if (!user) {
    return (
      <View style={[styles.container, styles.guestGate, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={42} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("signInRequired")}</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("signInToContact")}</Text>
        <Pressable style={[styles.loginButton, { backgroundColor: colors.primary }]} onPress={() => router.push("/(auth)/login")}>
          <Text style={[styles.loginButtonText, { color: colors.primaryForeground }]}>{t("signIn")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("messages")}</Text>
      </View>

      <View style={[styles.chatSearch, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("searchConversations")}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.chatSearchInput, { color: colors.foreground }]}
        />
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.convItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/conversation/${item.id}`);
            }}
          >
            {(() => {
              const otherParticipantId = item.participants.find((participantId) => participantId !== user?.id);
              const avatarUrl = otherParticipantId ? item.participantAvatars?.[otherParticipantId] : undefined;
              if (item.propertyImage) return <Image source={{ uri: item.propertyImage }} style={styles.propertyThumb} contentFit="cover" />;
              return avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Feather name="user" size={20} color={colors.mutedForeground} />
                </View>
              );
            })()}
            <View style={styles.convInfo}>
              <View style={styles.convTop}>
                <Text style={[styles.convName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.participants.filter((participantId) => participantId !== user?.id).map((participantId) => item.participantNames[participantId]).filter(Boolean).join(", ") || "Conversation"}
                </Text>
                <Text style={[styles.convTime, { color: colors.mutedForeground }]}>{formatTime(item.lastMessageTime, locale)}</Text>
              </View>
              {item.propertyTitle && (
                <Text style={[styles.convProperty, { color: colors.primary }]} numberOfLines={1}>{item.propertyTitle}</Text>
              )}
              {(item.propertyPrice != null || item.propertyLocation) && (
                <Text style={[styles.convMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.propertyPrice != null ? `${new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.propertyPrice)}${item.propertyListingType === "rent" ? t("perMonth") : ""}` : ""}
                  {item.propertyPrice != null && item.propertyLocation ? " · " : ""}
                  {item.propertyLocation ?? ""}
                </Text>
              )}
              <Text style={[styles.convMessage, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.lastMessage || t("noMessagesYet")}
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{item.unreadCount}</Text>
              </View>
            )}
          </Pressable>
        )}
        ListHeaderComponent={loadError && conversations.length > 0 ? (
          <View style={styles.loadErrorBox}>
            <Text style={[styles.emptyText, { color: colors.destructive }]}>{loadError}</Text>
            <Pressable onPress={() => void reload()}><Text style={[styles.retryText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable>
          </View>
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator color={colors.primary} /> : loadError ? <Feather name="wifi-off" size={40} color={colors.muted} /> : <Feather name="message-circle" size={48} color={colors.muted} />}
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isLoading ? t("loadingListings") : loadError ? t("refreshError") : searchQuery ? t("noChatMatches") : t("noMessages")}</Text>
            {loadError ? <Text style={[styles.emptyText, { color: colors.destructive }]}>{loadError}</Text> : null}
            {loadError ? <Pressable onPress={() => void reload()}><Text style={[styles.retryText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable> : null}
            {!isLoading && !loadError && !searchQuery ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("startConversation")}</Text> : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? Math.max(insets.bottom + 84, 108) : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  chatSearch: { height: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderWidth: 1, borderRadius: 23, marginHorizontal: 20, marginBottom: 8 },
  chatSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 23, fontFamily: "Inter_700Bold", letterSpacing: 0.1 },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  propertyThumb: { width: 58, height: 58, borderRadius: 14, backgroundColor: "#EAE6DF" },
  convInfo: { flex: 1, marginLeft: 14 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  convTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 8 },
  convProperty: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  convMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  convMessage: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 100, gap: 12 },
  guestGate: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
  loadErrorBox: { paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  loginButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
