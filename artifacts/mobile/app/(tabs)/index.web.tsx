import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { FilterSheet } from "@/components/FilterSheet";
import { BrandLockup } from "@/components/BrandLockup";
import { PropertyCard } from "@/components/PropertyCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { useBranding } from "@/contexts/BrandingContext";

export default function WebDiscoveryScreen() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const router = useRouter();
  const { user, toggleBookmark } = useAuth();
  const { t } = useLanguage();
  const { settings } = useBranding();
  const { filteredProperties, filters, setFilters, isLoading, loadError, refreshListings } = useListings();
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState(filters.query ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setQuery(filters.query ?? ""), [filters.query]);

  const columnCount = width >= 1500 ? 3 : width >= 760 ? 2 : 1;
  const contentWidth = Math.min(width - (width >= 1000 ? 256 : 0), 1440) - 56;
  const gridWidth = columnCount === 1 ? "100%" : (contentWidth - 16 * (columnCount - 1)) / columnCount;
  const saveSearch = async () => {
    if (!user || !supabase) {
      Alert.alert(t("signInRequired"), t("saveSearchSignIn"));
      return;
    }
    setSaving(true);
    const name = filters.query || filters.city ? `${t("searchCityLabel")}: ${filters.query || filters.city}` : `${t("savedSearches")} ${new Date().toLocaleDateString()}`;
    const { error } = await supabase.from("saved_searches").insert({ user_id: user.id, name, filters });
    setSaving(false);
    if (error) Alert.alert(t("updateFailed"), error.message);
    else Alert.alert(t("savedSearches"), t("searchSaved"));
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.headingBlock}>
              <BrandLockup settings={settings} foreground={colors.foreground} muted={colors.mutedForeground} compact />
              {settings.showWelcome ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{user ? `${settings.welcomeText}, ${user.name.split(" ")[0]}` : settings.welcomeText}</Text> : null}
              <Text style={[styles.subtitle, { color: colors.foreground }]}>{t("discover")}</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable accessibilityLabel={t("saveSearchesAction")} onPress={() => void saveSearch()} style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {saving ? <ActivityIndicator color={colors.primary} /> : <Feather name="bookmark" size={19} color={colors.foreground} />}
              </Pressable>
              <Pressable accessibilityLabel={t("mapSearch")} onPress={() => router.push("/map-search" as never)} style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="map" size={19} color={colors.foreground} />
              </Pressable>
              <Pressable accessibilityLabel={t("filters")} onPress={() => setFilterOpen(true)} style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="sliders" size={19} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={t("searchProperties")}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={(value) => { setQuery(value); setFilters({ ...filters, query: value || undefined }); }}
              returnKeyType="search"
            />
            {query ? <Pressable onPress={() => { setQuery(""); setFilters({ ...filters, query: undefined }); }}><Feather name="x" size={17} color={colors.mutedForeground} /></Pressable> : null}
          </View>
          <View style={styles.quickActions}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setFilters({ ...filters, listingType: filters.listingType === "sale" ? undefined : "sale" }); }} style={[styles.quickButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.quickText, { color: colors.foreground }]}>{t("forSale")}</Text>
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setFilters({ ...filters, listingType: filters.listingType === "rent" ? undefined : "rent" }); }} style={[styles.quickButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.quickText, { color: colors.foreground }]}>{t("forRent")}</Text>
            </Pressable>
            {Object.keys(filters).length > 0 && <Pressable onPress={() => { setFilters({}); setQuery(""); }} style={styles.clearButton}><Text style={[styles.clearText, { color: colors.primary }]}>{t("clear")}</Text></Pressable>}
          </View>
        </View>

        {loadError && <Pressable onPress={() => void refreshListings()} style={[styles.notice, { backgroundColor: colors.card }]}><Feather name="wifi-off" size={17} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.foreground }]}>{t("refreshError")} · {t("tryAgain")}</Text></Pressable>}
        <View style={styles.resultsHeader}>
          <View><Text style={[styles.resultsTitle, { color: colors.foreground }]}>{query ? t("results") : t("latestListings")}</Text><Text style={[styles.resultsCount, { color: colors.mutedForeground }]}>{filteredProperties.length} {t("properties")}</Text></View>
          <Pressable onPress={() => void refreshListings()} accessibilityLabel={t("tryAgain")} style={[styles.refreshButton, { borderColor: colors.border }]}><Feather name="refresh-cw" size={16} color={colors.foreground} /></Pressable>
        </View>
        {isLoading && filteredProperties.length === 0 ? (
          <View style={styles.empty}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("loadingListings")}</Text></View>
        ) : filteredProperties.length ? (
          <View style={styles.grid}>
            {filteredProperties.map((property) => (
              <View key={property.id} style={{ width: gridWidth }}>
                <PropertyCard
                  property={property}
                  isBookmarked={user?.bookmarks.includes(property.id)}
                  onBookmark={() => user ? void toggleBookmark(property.id).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain"))) : Alert.alert(t("signInRequired"), t("signInContinue"))}
                  style={{ marginHorizontal: 0, marginBottom: 20, overflow: "hidden" }}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}><Feather name="home" size={42} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("noProperties")}</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("adjustFilters")}</Text></View>
        )}
      </ScrollView>
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  content: { width: "100%", maxWidth: 1440, alignSelf: "center", paddingHorizontal: 28, paddingBottom: 108 },
  hero: { paddingTop: 40, paddingBottom: 24 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 24 },
  headingBlock: { gap: 3 },
  eyebrow: { fontFamily: "Inter_400Regular", fontSize: 13 },
  brandLogo: { width: 112, height: 88 },
  subtitle: { fontFamily: "Inter_500Medium", fontSize: 16, marginTop: 5 },
  heroActions: { flexDirection: "row", gap: 9, paddingTop: 7 },
  iconButton: { height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1 },
  search: { minHeight: 52, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: "Inter_400Regular", outlineStyle: "none" as never },
  quickActions: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, flexWrap: "wrap" },
  quickButton: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 8 },
  quickText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  clearButton: { paddingHorizontal: 12, paddingVertical: 8 },
  clearText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 10, marginBottom: 18 },
  noticeText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  resultsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 20 },
  resultsCount: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  refreshButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 16 },
  empty: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
