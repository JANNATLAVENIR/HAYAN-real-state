import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PropertyCard } from "@/components/PropertyCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Collection = { id: string; name: string };

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { properties } = useListings();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [active, setActive] = useState<Collection | null>(null);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const savedProperties = useMemo(() => properties.filter((property) => user?.bookmarks.includes(property.id)), [properties, user?.bookmarks]);

  const loadCollections = useCallback(async () => {
    if (!user || !supabase) { setError(t("collectionSetup")); setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("property_collections").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setCollections((data ?? []) as Collection[]);
    setLoading(false);
  }, [user, t]);

  useEffect(() => { void loadCollections(); }, [loadCollections]);

  const openCollection = async (collection: Collection) => {
    if (!supabase) return;
    setActive(collection);
    const { data, error: queryError } = await supabase.from("property_collection_items").select("property_id").eq("collection_id", collection.id);
    if (queryError) { Alert.alert(t("updateFailed"), queryError.message); return; }
    setItemIds((data ?? []).map((item) => item.property_id));
  };

  const createCollection = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user || !supabase) return;
    const { data, error: insertError } = await supabase.from("property_collections").insert({ user_id: user.id, name: trimmed }).select("id,name").single();
    if (insertError || !data) { Alert.alert(t("updateFailed"), insertError?.message ?? t("tryAgain")); return; }
    setName(""); setCollections((current) => [data as Collection, ...current]);
  };

  const toggleProperty = async (propertyId: string) => {
    if (!active || !supabase) return;
    const included = itemIds.includes(propertyId);
    const result = included
      ? await supabase.from("property_collection_items").delete().eq("collection_id", active.id).eq("property_id", propertyId)
      : await supabase.from("property_collection_items").insert({ collection_id: active.id, property_id: propertyId });
    if (result.error) { Alert.alert(t("updateFailed"), result.error.message); return; }
    setItemIds((current) => included ? current.filter((id) => id !== propertyId) : [...current, propertyId]);
  };

  const removeCollection = async (collection: Collection) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("property_collections").delete().eq("id", collection.id);
    if (deleteError) { Alert.alert(t("deleteFailed"), deleteError.message); return; }
    setCollections((current) => current.filter((item) => item.id !== collection.id));
    if (active?.id === collection.id) setActive(null);
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <Feather name="lock" size={42} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>{t("signInRequired")}</Text>
        <Pressable style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }} onPress={() => router.push("/(auth)/login")}>
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>{t("signIn")}</Text>
        </Pressable>
      </View>
    );
  }

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => active ? setActive(null) : router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{active?.name ?? t("collections")}</Text>
      {active ? <Pressable accessibilityLabel={t("delete")} onPress={() => Alert.alert(t("delete"), active.name, [{ text: t("cancel"), style: "cancel" }, { text: t("delete"), style: "destructive", onPress: () => { void removeCollection(active); } }])}><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable> : <View style={{ width: 22 }} />}
    </View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : error ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{error}</Text> : active ? (
      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t("addSavedHomes")}</Text>
        {savedProperties.length ? savedProperties.map((property) => <View key={property.id} style={styles.propertyRow}>
          <View style={{ flex: 1 }}><PropertyCard property={property} compact /></View>
          <Pressable accessibilityLabel={itemIds.includes(property.id) ? t("removeFromCollection") : t("collections")} onPress={() => void toggleProperty(property.id)} style={[styles.toggle, { borderColor: colors.border }]}>
            <Feather name={itemIds.includes(property.id) ? "check" : "plus"} size={18} color={colors.primary} />
          </Pressable>
        </View>) : <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t("noSavedSearches")}</Text>}
      </ScrollView>
    ) : (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.createRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput value={name} onChangeText={setName} placeholder={t("collectionName")} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} maxLength={80} returnKeyType="done" onSubmitEditing={() => void createCollection()} />
          <Pressable accessibilityLabel={t("createCollection")} onPress={() => void createCollection()} disabled={!name.trim()}><Feather name="plus-circle" size={24} color={name.trim() ? colors.primary : colors.muted} /></Pressable>
        </View>
        {collections.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t("noCollections")}</Text> : collections.map((collection) => <Pressable key={collection.id} onPress={() => void openCollection(collection)} style={[styles.collectionRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.collectionIcon, { backgroundColor: colors.secondary }]}><Feather name="folder" size={18} color={colors.primary} /></View>
          <Text style={[styles.collectionName, { color: colors.foreground }]}>{collection.name}</Text>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>)}
      </ScrollView>
    )}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 }, empty: { textAlign: "center", margin: 28, fontFamily: "Inter_400Regular", fontSize: 14 },
  createRow: { borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 18, gap: 12 }, input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  collectionRow: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }, collectionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, collectionName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  sectionTitle: { paddingHorizontal: 20, fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }, propertyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }, toggle: { width: 38, height: 38, borderWidth: 1, borderRadius: 19, alignItems: "center", justifyContent: "center", marginLeft: 4 },
});
