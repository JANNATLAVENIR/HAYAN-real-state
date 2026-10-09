import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Conversation, Message } from "@/constants/types";
import { SEED_CONVERSATIONS } from "@/constants/seed";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChatContextType {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  receiveRealtimeMessage: (row: Record<string, any>) => void;
  sendMessage: (conversationId: string, senderId: string, text: string) => Promise<void>;
  getConversation: (id: string) => Conversation | undefined;
  createConversation: (conv: Omit<Conversation, "id" | "lastMessage" | "lastMessageTime" | "unreadCount">) => Promise<string>;
  markAsRead: (conversationId: string) => Promise<void>;
  totalUnread: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

const CONV_KEY = "@dalka_conversations";
const MSG_KEY = "@dalka_messages";

const SEED_MESSAGES: Record<string, Message[]> = {
  "conv-1": [
    { id: "msg-1", conversationId: "conv-1", senderId: "agent-1", text: "Waad ku mahadsan tahay xiisaha aad u muujisay guriga Hodan.", timestamp: "2025-03-25T14:00:00Z", read: true },
    { id: "msg-2", conversationId: "conv-1", senderId: "user-1", text: "Waan ka helay. Ma qabsan karaa waqti aan ku soo booqdo?", timestamp: "2025-03-25T14:15:00Z", read: true },
    { id: "msg-3", conversationId: "conv-1", senderId: "agent-1", text: "Haa, waan kuu qaban karaa waqti booqasho.", timestamp: "2025-03-25T14:30:00Z", read: false },
  ],
  "conv-2": [
    { id: "msg-4", conversationId: "conv-2", senderId: "user-1", text: "Waxaan gudbiyey dalabkaygii guriga Hargeysa. War ma jiraa?", timestamp: "2025-03-24T08:00:00Z", read: true },
    { id: "msg-5", conversationId: "conv-2", senderId: "agent-1", text: "Iibiyuhu wuu aqbalay dalabkaaga. Hambalyo!", timestamp: "2025-03-24T09:15:00Z", read: true },
  ],
};

function mapMessage(row: Record<string, any>): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.text,
    timestamp: row.created_at,
    read: Boolean(row.read_at),
  };
}

function mapConversation(row: Record<string, any>, profileNames: Record<string, string> = {}, profileAvatars: Record<string, string> = {}, unreadCount = 0, fallbackUserName = "User"): Conversation {
  const members = row.conversation_members ?? [];
  const property = row.properties ?? null;
  const lastMessage = (row.messages ?? []).sort((a: any, b: any) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  )[0];
  return {
    id: row.id,
    participants: members.map((member: any) => member.user_id),
    participantNames: Object.fromEntries(
      members.map((member: any) => [member.user_id, profileNames[member.user_id] ?? fallbackUserName]),
    ),
    participantAvatars: Object.fromEntries(
      members.filter((member: any) => profileAvatars[member.user_id]).map((member: any) => [member.user_id, profileAvatars[member.user_id]]),
    ),
    propertyId: row.property_id ?? undefined,
    propertyTitle: property?.title ?? undefined,
    propertyPrice: property?.price == null ? undefined : Number(property.price),
    propertyLocation: property ? [property.address, property.city].filter(Boolean).join(", ") : undefined,
    propertyImage: property?.images?.[0] ?? undefined,
    propertyListingType: property?.listing_type === "rent" ? "rent" : property?.listing_type === "sale" ? "sale" : undefined,
    lastMessage: lastMessage?.text,
    lastMessageTime: lastMessage?.created_at,
    unreadCount,
  };
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const [{ data: conversationRows, error: conversationsError }, { data: unreadRows, error: unreadError }] = await Promise.all([
          supabase.from("conversations")
            .select("*, conversation_members(user_id), properties(title, price, listing_type, address, city, images), messages(text, created_at)")
            .order("created_at", { ascending: false, referencedTable: "messages" })
            .limit(1, { referencedTable: "messages" }),
          supabase.from("messages").select("conversation_id")
            .is("read_at", null).neq("sender_id", user?.id ?? ""),
        ]);
        if (conversationsError) throw new Error(conversationsError.message);
        if (unreadError) throw new Error(unreadError.message);
        const memberIds = [...new Set((conversationRows ?? []).flatMap((row: any) => (row.conversation_members ?? []).map((member: any) => member.user_id)))];
        const { data: profiles, error: profilesError } = memberIds.length
          ? await supabase.from("public_profiles").select("id,name,avatar_url").in("id", memberIds)
          : { data: [], error: null };
        if (profilesError) throw new Error(profilesError.message);
        const profileNames = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, profile.name]));
        const profileAvatars = Object.fromEntries((profiles ?? []).filter((profile: any) => profile.avatar_url).map((profile: any) => [profile.id, profile.avatar_url]));
        const unreadCounts = (unreadRows ?? []).reduce<Record<string, number>>((counts, row: any) => {
          counts[row.conversation_id] = (counts[row.conversation_id] ?? 0) + 1;
          return counts;
        }, {});
        setConversations((conversationRows ?? []).map((row: any) => {
          const unreadCount = unreadCounts[row.id] ?? 0;
          return mapConversation(row, profileNames, profileAvatars, unreadCount, t("unknownUser"));
        }));
      } else {
        const convRaw = await AsyncStorage.getItem(CONV_KEY);
        const msgRaw = await AsyncStorage.getItem(MSG_KEY);
        if (convRaw) {
          setConversations(JSON.parse(convRaw));
          setMessages(msgRaw ? JSON.parse(msgRaw) : {});
        } else {
          setConversations(SEED_CONVERSATIONS);
          setMessages(SEED_MESSAGES);
          await AsyncStorage.setItem(CONV_KEY, JSON.stringify(SEED_CONVERSATIONS));
          await AsyncStorage.setItem(MSG_KEY, JSON.stringify(SEED_MESSAGES));
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load conversations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [t, user?.id]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    setMessages((current) => ({ ...current, [conversationId]: [] }));
    const { data, error } = await supabase.from("messages").select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const fetched = (data ?? []).map((row: any) => mapMessage(row));
    setMessages((current) => {
      const merged = new Map(fetched.map((message) => [message.id, message]));
      (current[conversationId] ?? []).forEach((message) => merged.set(message.id, message));
      return {
        ...current,
        [conversationId]: [...merged.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      };
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    setConversations([]);
    setMessages({});
    void loadData();
  }, [authLoading, user?.id, loadData]);

  const receiveRealtimeMessage = useCallback((row: Record<string, any>) => {
    const message = mapMessage(row);
    setMessages((current) => {
      const existing = current[message.conversationId] ?? [];
      if (existing.some((item) => item.id === message.id)) return current;
      return { ...current, [message.conversationId]: [...existing, message] };
    });
    setConversations((current) => current.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessage: message.text,
            lastMessageTime: message.timestamp,
            unreadCount: message.senderId === user?.id ? conversation.unreadCount : conversation.unreadCount + 1,
          }
        : conversation,
    ));
  }, [user?.id]);

  const sendMessage = useCallback(async (conversationId: string, senderId: string, text: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text: text.trim(),
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "Unable to send message");
      const message = mapMessage(data);
      setMessages((current) => ({ ...current, [conversationId]: [...(current[conversationId] ?? []), message] }));
      setConversations((current) => current.map((conversation) =>
        conversation.id === conversationId
                  ? {
                      ...conversation,
                      lastMessage: message.text,
                      lastMessageTime: message.timestamp,
                      unreadCount: message.senderId === user?.id ? conversation.unreadCount : conversation.unreadCount + 1,
                    }
          : conversation,
      ));
      return;
    }

    const msg: Message = {
      id: "msg-" + Date.now().toString(36),
      conversationId,
      senderId,
      text,
      timestamp: new Date().toISOString(),
      read: true,
    };

    const updatedMessages = { ...messages };
    if (!updatedMessages[conversationId]) updatedMessages[conversationId] = [];
    updatedMessages[conversationId] = [...updatedMessages[conversationId], msg];
    setMessages(updatedMessages);

    const updatedConvs = conversations.map((c) =>
      c.id === conversationId ? { ...c, lastMessage: text, lastMessageTime: msg.timestamp } : c
    );
    setConversations(updatedConvs);

    await AsyncStorage.setItem(MSG_KEY, JSON.stringify(updatedMessages));
    await AsyncStorage.setItem(CONV_KEY, JSON.stringify(updatedConvs));

  }, [messages, conversations]);

  const getConversation = useCallback((id: string) => conversations.find((c) => c.id === id), [conversations]);

  const createConversation = useCallback(async (conv: Omit<Conversation, "id" | "lastMessage" | "lastMessageTime" | "unreadCount">) => {
    const participantIds = [...new Set(conv.participants)];
    if (participantIds.length !== 2) throw new Error("A direct conversation requires exactly two participants");
    if (isSupabaseConfigured && supabase) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(authError?.message ?? "Sign in to start a conversation");
      if (!participantIds.includes(authData.user.id)) throw new Error("A direct conversation requires you and one other participant");
      const otherUserId = participantIds.find((participantId) => participantId !== authData.user.id);
      if (!otherUserId) throw new Error("Choose another user to message");

      const { data: conversationId, error } = await supabase.rpc("get_or_create_direct_conversation", {
        p_other_user_id: otherUserId,
        p_property_id: conv.propertyId ?? null,
      });
      if (error || !conversationId) throw new Error(error?.message ?? "Unable to open conversation");

      await loadData();
      return conversationId;
    }

    if (!user?.id || !participantIds.includes(user.id)) throw new Error("A direct conversation requires you and one other participant");
    const existing = conversations.find((conversation) =>
      conversation.participants.length === 2
      && participantIds.every((participantId) => conversation.participants.includes(participantId))
      && (conversation.propertyId ?? undefined) === (conv.propertyId ?? undefined),
    );
    if (existing) return existing.id;

    const id = "conv-" + Date.now().toString(36);
    const newConv: Conversation = { ...conv, id, lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 };
    const updated = [newConv, ...conversations];
    setConversations(updated);
    await AsyncStorage.setItem(CONV_KEY, JSON.stringify(updated));
    return id;
  }, [conversations, loadData, user?.id]);

  const markAsRead = useCallback(async (conversationId: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .is("read_at", null)
        .neq("sender_id", user?.id ?? "");
      if (error) throw new Error(error.message);
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
      setMessages((current) => ({
        ...current,
        [conversationId]: (current[conversationId] ?? []).map((message) =>
          message.senderId === user?.id ? message : { ...message, read: true },
        ),
      }));
      return;
    }

    const updatedConvs = conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    );
    setConversations(updatedConvs);

    const updatedMessages = { ...messages };
    if (updatedMessages[conversationId]) {
      updatedMessages[conversationId] = updatedMessages[conversationId].map((m) => ({ ...m, read: true }));
    }
    setMessages(updatedMessages);

    await AsyncStorage.setItem(CONV_KEY, JSON.stringify(updatedConvs));
    await AsyncStorage.setItem(MSG_KEY, JSON.stringify(updatedMessages));
  }, [conversations, messages, user?.id]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <ChatContext.Provider value={{ conversations, messages, isLoading, loadError, reload: loadData, loadConversationMessages, receiveRealtimeMessage, sendMessage, getConversation, createConversation, markAsRead, totalUnread }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
