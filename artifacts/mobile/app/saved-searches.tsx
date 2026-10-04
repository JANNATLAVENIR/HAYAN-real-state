import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FilterOptions } from "@/constants/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type SavedSearch = { id: string; name: string; filters: FilterOptions; created_at: string };

export default function SavedSearchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setFilters } = useListings();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user || !supabase) { setLoading(false); setError(t("savedSearchSetup")); return; }
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("saved_searches").select("id,name,filters,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setItems((data ?? []) as SavedSearch[]);
    setLoading(false);
  }, [user, t]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("saved_searches").delete().eq("id", id);
    if (deleteError) Alert.alert(t("updateFailed"), deleteError.message);
    else setItems((current) => current.filter((item) => item.id !== id));
  };

  const describe = (filters: FilterOptions) => [
    filters.query,
    filters.city,
    filters.listingType ? (filters.listingType === "rent" ? t("forRent") : t("forSale")) : "",
    filters.type?.map((type) => t(type)).join(", "),
    filters.minPrice ? `${t("minimum")}: $${filters.minPrice.toLocaleString()}` : "",
    filters.maxPrice ? `${t("maximum")}: $${filters.maxPrice.toLocaleString()}` : "",
    filters.minBedrooms ? `${filters.minBedrooms}+ ${t("bedrooms")}` : "",
    filters.minBathrooms ? `${filters.minBathrooms}+ ${t("bathrooms")}` : "",
    filters.petFriendly ? t("petFriendlyOnly") : "",
    filters.parking ? t("parkingAvailable") : "",
  ].filter(Boolean).join(" · ") || t("allProperties");

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("savedSearches")}</Text><View style={{ width: 22 }} />
    </View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : error ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{error}</Text> : items.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t("noSavedSearches")}</Text> :
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {items.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable style={styles.cardBody} onPress={() => { setFilters(item.filters); router.replace("/(tabs)"); }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>{describe(item.filters)}</Text>
          </Pressable>
          <Pressable accessibilityLabel={t("delete")} onPress={() => Alert.alert(t("delete"), item.name, [{ text: t("cancel"), style: "cancel" }, { text: t("delete"), style: "destructive", onPress: () => { void remove(item.id); } }])} hitSlop={10}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        </View>)}
      </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 }, empty: { textAlign: "center", margin: 28, fontFamily: "Inter_400Regular", fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }, cardBody: { flex: 1 }, cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 }, description: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6, lineHeight: 18 },
});
