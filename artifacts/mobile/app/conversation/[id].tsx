import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { messages, getConversation, loadConversationMessages, receiveRealtimeMessage, sendMessage, markAsRead, isLoading, loadError, reload } = useChat();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const conversation = getConversation(id);
  const chatMessages = messages[id] || [];
  const otherParticipantId = conversation?.participants.find((participantId) => participantId !== user?.id);
  const otherParticipantAvatar = otherParticipantId ? conversation?.participantAvatars?.[otherParticipantId] : undefined;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const previousHeight = root.style.getPropertyValue("--hayan-chat-viewport-height");
    const previousTop = root.style.getPropertyValue("--hayan-chat-viewport-top");
    const previousKeyboardState = root.dataset.hayanKeyboardOpen;
    const updateViewport = () => {
      root.style.setProperty("--hayan-chat-viewport-height", `${viewport.height}px`);
      root.style.setProperty("--hayan-chat-viewport-top", `${viewport.offsetTop}px`);
      root.dataset.hayanKeyboardOpen = window.innerHeight - viewport.height > 120 ? "true" : "false";
    };
    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      if (previousHeight) root.style.setProperty("--hayan-chat-viewport-height", previousHeight);
      else root.style.removeProperty("--hayan-chat-viewport-height");
      if (previousTop) root.style.setProperty("--hayan-chat-viewport-top", previousTop);
      else root.style.removeProperty("--hayan-chat-viewport-top");
      if (previousKeyboardState === undefined) delete root.dataset.hayanKeyboardOpen;
      else root.dataset.hayanKeyboardOpen = previousKeyboardState;
    };
  }, []);

  useEffect(() => {
    if (!id || !user || isLoading || !conversation) return;
    let active = true;
    setMessagesLoading(true);
    void loadConversationMessages(id)
      .catch((error: unknown) => { if (active) setSendError(error instanceof Error ? error.message : t("tryAgain")); })
      .finally(() => { if (active) setMessagesLoading(false); });
    return () => { active = false; };
  }, [id, user?.id, conversation?.id, isLoading, loadConversationMessages, t]);

  useEffect(() => {
    if (id && user && conversation) void markAsRead(id).catch((error: unknown) => setSendError(error instanceof Error ? error.message : t("tryAgain")));
  }, [id, chatMessages.length, user?.id, conversation?.id, markAsRead, t]);

  useEffect(() => {
    if (!id || !user || !conversation || !supabase) return;
    const channel = supabase
      .channel(`conversation-${id}-messages`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${id}`,
      }, (payload) => receiveRealtimeMessage(payload.new as Record<string, any>))
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [id, user?.id, conversation?.id, receiveRealtimeMessage]);

  const handleSend = () => {
    if (!text.trim() || !user || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const messageText = text.trim();
    setText("");
    setSendError("");
    setSending(true);
    void sendMessage(id, user.id, messageText)
      .catch((error: unknown) => {
        setText(messageText);
        setSendError(error instanceof Error ? error.message : t("messageSendFailed"));
      })
      .finally(() => setSending(false));
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.guestGate, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={42} color={colors.primary} />
        <Text style={[styles.headerName, { color: colors.foreground }]}>{t("signInRequired")}</Text>
        <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>{t("signInToContact")}</Text>
        <Pressable style={[styles.loginButton, { backgroundColor: colors.primary }]} onPress={() => router.push("/(auth)/login")}>
          <Text style={[styles.loginButtonText, { color: colors.primaryForeground }]}>{t("signIn")}</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || !conversation) {
    return (
      <View style={[styles.container, styles.guestGate, { backgroundColor: colors.background }]}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : <Feather name="lock" size={36} color={colors.primary} />}
        <Text style={[styles.emptyChatText, { color: loadError ? colors.destructive : colors.mutedForeground }]}>
          {isLoading ? t("loadingListings") : loadError || t("conversationUnavailable")}
        </Text>
        {loadError ? <Pressable onPress={() => void reload()}><Text style={[styles.loginButtonText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable> : null}
        {!isLoading ? <Pressable onPress={() => router.replace("/(tabs)/chat")}><Text style={[styles.loginButtonText, { color: colors.primary }]}>{t("messages")}</Text></Pressable> : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      nativeID="hayan-chat-screen"
      style={styles.container}
      behavior={Platform.OS === "web" ? undefined : "padding"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("messages")} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/chat")} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          {otherParticipantAvatar ? (
            <Image source={{ uri: otherParticipantAvatar }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.foreground }]}>
              {conversation?.participants.filter((participantId) => participantId !== user?.id).map((participantId) => conversation.participantNames[participantId]).filter(Boolean).join(", ") || t("conversation")}
            </Text>
            {conversation?.propertyTitle && (
              <Text style={[styles.headerProperty, { color: colors.primary }]} numberOfLines={1}>
                {conversation.propertyTitle}
              </Text>
            )}
          </View>
          <Pressable hitSlop={12}>
            <Feather name="more-vertical" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {conversation.propertyId && conversation.propertyTitle ? (
          <Pressable
            onPress={() => router.push(`/property/${conversation.propertyId}`)}
            style={[styles.propertyContext, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          >
            {conversation.propertyImage ? (
              <Image source={{ uri: conversation.propertyImage }} style={styles.propertyImage} contentFit="cover" />
            ) : (
              <View style={[styles.propertyImage, styles.propertyImageFallback, { backgroundColor: colors.secondary }]}>
                <Feather name="home" size={18} color={colors.mutedForeground} />
              </View>
            )}
            <View style={styles.propertyInfo}>
              <Text style={[styles.propertyTitle, { color: colors.foreground }]} numberOfLines={1}>{conversation.propertyTitle}</Text>
              {conversation.propertyPrice != null ? (
                <Text style={[styles.propertyMeta, { color: colors.primary }]} numberOfLines={1}>
                  {new Intl.NumberFormat(language === "so" ? "so-SO" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(conversation.propertyPrice)}{conversation.propertyListingType === "rent" ? t("perMonth") : ""}
                </Text>
              ) : null}
              {conversation.propertyLocation ? <Text style={[styles.propertyMeta, { color: colors.mutedForeground }]} numberOfLines={1}>{conversation.propertyLocation}</Text> : null}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        {loadError ? (
          <View style={styles.loadErrorBox}>
            <Text style={[styles.emptyChatText, { color: colors.destructive }]}>{loadError}</Text>
            <Pressable onPress={() => void reload()}><Text style={[styles.loginButtonText, { color: colors.primary }]}>{t("tryAgain")}</Text></Pressable>
          </View>
        ) : null}

        <FlatList
          nativeID="hayan-chat-messages"
          data={[...chatMessages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              text={item.text}
              isOwn={item.senderId === user?.id}
              timestamp={item.timestamp}
            />
          )}
          inverted
          style={styles.messagesViewport}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              {isLoading || messagesLoading ? <ActivityIndicator color={colors.primary} /> : null}
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>{isLoading || messagesLoading ? t("loadingListings") : loadError ? t("refreshError") : t("startChat")}</Text>
            </View>
          }
        />

        {sendError ? (
          <Text accessibilityRole="alert" style={[styles.sendError, { color: colors.destructive }]}>
            {t("messageSendFailed")}: {sendError}
          </Text>
        ) : null}
        <View nativeID="hayan-chat-composer" style={[styles.inputBar, Platform.OS === "web" && styles.webInputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 0 : insets.bottom + 8 }]}>
          <View style={[styles.inputWrapper, Platform.OS === "web" && styles.webInputWrapper, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 24 }]}>
            <TextInput
              nativeID="chat-message-input"
              style={[styles.textInput, Platform.OS === "web" && styles.webTextInput, { color: colors.foreground }]}
              placeholder={t("typeMessage")}
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
          </View>
          <Pressable
            style={[styles.sendBtn, Platform.OS === "web" && styles.webSendBtn, { backgroundColor: text.trim() && !sending ? colors.primary : colors.muted }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="send" size={18} color={text.trim() ? colors.primaryForeground : colors.mutedForeground} />}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  guestGate: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
  loginButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerInfo: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerProperty: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  propertyContext: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  propertyImage: { width: 48, height: 48, borderRadius: 6 },
  propertyImageFallback: { alignItems: "center", justifyContent: "center" },
  propertyInfo: { flex: 1 },
  propertyTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  propertyMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  messagesViewport: { flex: 1, minHeight: 0 },
  messagesList: { paddingVertical: 16 },
  emptyChat: { alignItems: "center", padding: 40, transform: [{ scaleY: -1 }] },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loadErrorBox: { alignItems: "center", padding: 12, gap: 8 },
  sendError: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
  webInputBar: { paddingHorizontal: 16, paddingTop: 8, gap: 9 },
  inputWrapper: { flex: 1, minHeight: 44, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 7, maxHeight: 100, justifyContent: "center" },
  webInputWrapper: { minHeight: 46, paddingVertical: 5 },
  textInput: { fontSize: 15, lineHeight: 21, fontFamily: "Inter_400Regular", maxHeight: 80, paddingVertical: 0, textAlignVertical: "center" },
  webTextInput: { fontSize: 16, lineHeight: 21, minHeight: 21, paddingVertical: 0, maxHeight: 76 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  webSendBtn: { width: 42, height: 42, borderRadius: 21 },
});
