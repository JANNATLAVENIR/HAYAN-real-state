import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { FilterSheet } from "@/components/FilterSheet";
import { PropertyCard } from "@/components/PropertyCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";

export default function MapSearchScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const colors = useColors();
  const { t } = useLanguage();
  const { filteredProperties, filters, setFilters } = useListings();
  const [filterVisible, setFilterVisible] = useState(false);
  const points = filteredProperties.filter((property) => Number.isFinite(property.latitude) && Number.isFinite(property.longitude));
  const centerLatitude = points[0]?.latitude ?? 2.0469;
  const centerLongitude = points[0]?.longitude ?? 45.3182;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLongitude - 0.12}%2C${centerLatitude - 0.1}%2C${centerLongitude + 0.12}%2C${centerLatitude + 0.1}&layer=mapnik${points.length ? `&marker=${centerLatitude}%2C${centerLongitude}` : ""}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} style={[styles.button, { backgroundColor: colors.card }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.foreground }]}>{t("mapSearch")}</Text>
        <Pressable accessibilityLabel={t("filters")} onPress={() => setFilterVisible(true)} style={[styles.button, { backgroundColor: colors.card }]}>
          <Feather name="sliders" size={19} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={[styles.body, { flexDirection: width >= 900 ? "row" : "column" }]}>
        <ScrollView style={[styles.results, width >= 900 ? { width: 430, flexGrow: 0, flexShrink: 0 } : { maxHeight: height * 0.42 }]} contentContainerStyle={styles.list}>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{filteredProperties.length} {t("properties")}</Text>
          {filteredProperties.map((property) => <PropertyCard key={property.id} property={property} compact />)}
          {filteredProperties.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t("noProperties")}</Text>}
        </ScrollView>
        <View style={[styles.mapFrame, { height: width >= 900 ? Math.max(600, height - 64) : Math.max(320, height * 0.48), backgroundColor: colors.card }]}>
          <iframe title={t("mapSearch")} src={mapUrl} style={{ border: 0, width: "100%", height: "100%" }} loading="lazy" allowFullScreen />
          {points.length === 0 && <View style={[styles.mapNotice, { backgroundColor: colors.card }]}><Feather name="info" size={16} color={colors.primary} /><Text style={[styles.mapNoticeText, { color: colors.foreground }]}>{t("noMapListings")}</Text></View>}
        </View>
      </View>
      <FilterSheet visible={filterVisible} onClose={() => setFilterVisible(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, gap: 12 },
  heading: { fontSize: 16, fontWeight: "600" },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minHeight: 0 },
  results: { minWidth: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  count: { fontSize: 12, marginVertical: 5 },
  mapFrame: { flex: 1, minHeight: 280, overflow: "hidden" },
  mapNotice: { position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  mapNoticeText: { fontSize: 12, flexShrink: 1 },
  empty: { alignSelf: "center", padding: 24 },
});
