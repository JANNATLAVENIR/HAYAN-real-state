import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { PropertyCard } from "@/components/PropertyCard";
import { FilterSheet } from "@/components/FilterSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { recommendProperties } from "@/lib/recommendations";

export default function DiscoveryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, toggleBookmark } = useAuth();
  const { t } = useLanguage();
  const { filteredProperties, filters, setFilters, isLoading, loadError, refreshListings } = useListings();
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.query ?? "");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setSearchQuery(filters.query ?? ""); }, [filters.query]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const properties = filteredProperties;
  const recommendations = recommendProperties(properties, user, 3);

  const featured = properties.filter((p) => p.featured);
  const hasActiveFilters = Object.keys(filters).length > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshListings();
    } finally {
      setRefreshing(false);
    }
  };

  const saveCurrentSearch = async () => {
    if (!user || !supabase) {
      Alert.alert(t("signInRequired"), t("saveSearchSignIn"));
      return;
    }
    const name = filters.query || filters.city ? `${t("searchCityLabel")}: ${filters.query || filters.city}` : `${t("savedSearches")} ${new Date().toLocaleDateString()}`;
    const { error } = await supabase.from("saved_searches").insert({ user_id: user.id, name, filters });
    if (error) Alert.alert(t("updateFailed"), error.message);
    else Alert.alert(t("savedSearches"), t("searchSaved"));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPad + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {user ? `${t("welcome")}, ${user.name.split(" ")[0]}` : t("welcome")}
            </Text>
            <Text style={[styles.brandName, { color: colors.primary }]}>HAYÁN</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("saveSearchesAction")} onPress={() => void saveCurrentSearch()} style={[styles.filterBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="bookmark" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("mapSearch")} onPress={() => router.push("/map-search" as never)} style={[styles.filterBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="map" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilter(true); }} style={[styles.filterBtn, { borderColor: hasActiveFilters ? colors.primary : colors.border, backgroundColor: hasActiveFilters ? "rgba(201,169,110,0.1)" : colors.card }]}>
              <Feather name="sliders" size={18} color={hasActiveFilters ? colors.primary : colors.foreground} />
              {hasActiveFilters && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          </View>
        </View>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t("searchProperties")}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={(value) => { setSearchQuery(value); setFilters({ ...filters, query: value || undefined }); }}
          />
          {searchQuery ? (
            <Pressable onPress={() => { setSearchQuery(""); setFilters({ ...filters, query: undefined }); }} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            isBookmarked={user?.bookmarks.includes(item.id)}
            onBookmark={() => {
              if (!user) {
                Alert.alert(t("signInRequired"), t("signInContinue"));
                return;
              }
              void toggleBookmark(item.id).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain")));
            }}
          />
        )}
        ListHeaderComponent={
          <View>
            {recommendations.length > 0 ? (
              <View style={styles.recommendationsSection}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("recommendedForYou")}</Text>
                {recommendations.map((property) => (
                  <PropertyCard key={`recommended-${property.id}`} property={property} compact />
                ))}
              </View>
            ) : null}
            {loadError && properties.length > 0 ? (
              <Text style={[styles.loadError, { color: colors.mutedForeground }]}>{t("refreshError")}</Text>
            ) : null}
            {featured.length > 0 && !searchQuery ? (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("latestListings")}</Text>
                <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{properties.length} {t("properties")}</Text>
              </View>
            ) : searchQuery ? (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("results")}</Text>
                <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{properties.length} {t("found")}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("loadingListings")}</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <Feather name="wifi-off" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("refreshError")}</Text>
              <Pressable onPress={() => void refreshListings()} hitSlop={8}>
                <Text style={[styles.retryText, { color: colors.primary }]}>{t("tryAgain")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="home" size={48} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("noProperties")}</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("adjustFilters")}</Text>
            </View>
          )
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 100) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />

      <FilterSheet visible={showFilter} onClose={() => setShowFilter(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerActions: { flexDirection: "row", gap: 8 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", letterSpacing: 0.5 },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 8, marginTop: 2 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  listContent: { paddingTop: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  sectionCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  recommendationsSection: { paddingHorizontal: 20, paddingTop: 8, marginBottom: 8 },
  loadError: { paddingHorizontal: 20, paddingVertical: 10, fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", padding: 8 },
});
