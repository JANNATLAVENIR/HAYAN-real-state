import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Agent = { id: string; name: string; avatar_url: string | null; bio: string | null };

export default function AgentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError(t("savedSearchSetup")); return; }
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("public_profiles").select("id,name,avatar_url,bio").eq("role", "agent").order("name");
    if (queryError) setError(queryError.message);
    else setAgents((data ?? []) as Agent[]);
    setLoading(false);
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  const visible = agents.filter((agent) => `${agent.name} ${agent.bio ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("agentDirectory")}</Text><View style={{ width: 22 }} />
    </View>
    <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}><Feather name="search" size={17} color={colors.mutedForeground} /><TextInput value={query} onChangeText={setQuery} placeholder={t("agentDirectory")} placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} /></View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : error ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{error}</Text> : visible.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t("profileUnavailable")}</Text> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
      {visible.map((agent) => <Pressable key={agent.id} onPress={() => router.push({ pathname: "/user/[id]", params: { id: agent.id } })} style={[styles.agent, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {agent.avatar_url ? <Image source={{ uri: agent.avatar_url }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.secondary }]}><Text style={[styles.initials, { color: colors.primary }]}>{agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</Text></View>}
        <View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{agent.name}</Text><Text numberOfLines={2} style={[styles.bio, { color: colors.mutedForeground }]}>{agent.bio || t("realEstateAgent")}</Text></View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>)}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 },
  search: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderRadius: 10, margin: 20, paddingHorizontal: 13 }, searchInput: { flex: 1, paddingVertical: 13, fontFamily: "Inter_400Regular", fontSize: 14 },
  agent: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 24 }, avatarFallback: { alignItems: "center", justifyContent: "center" }, initials: { fontSize: 16, fontFamily: "Inter_600SemiBold" }, name: { fontSize: 15, fontFamily: "Inter_600SemiBold" }, bio: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 3 }, empty: { textAlign: "center", margin: 30, fontSize: 14, fontFamily: "Inter_400Regular" },
});
