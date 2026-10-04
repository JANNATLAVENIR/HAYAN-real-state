import { Feather } from "@expo/vector-icons";
import MapView, { Marker, Region } from "react-native-maps";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterSheet } from "@/components/FilterSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";

const DEFAULT_REGION: Region = { latitude: 2.0469, longitude: 45.3182, latitudeDelta: 0.16, longitudeDelta: 0.16 };

export default function MapSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useLanguage();
  const { filteredProperties, filters, setFilters } = useListings();
  const [filterVisible, setFilterVisible] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const didFitPins = useRef(false);
  const points = useMemo(() => filteredProperties.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)), [filteredProperties]);
  const initialRegion = points.length ? { ...DEFAULT_REGION, latitude: points[0].latitude!, longitude: points[0].longitude! } : DEFAULT_REGION;

  useEffect(() => {
    if (!mapReady || !points.length || didFitPins.current) return;
    didFitPins.current = true;
    mapRef.current?.fitToCoordinates(points.map((property) => ({ latitude: property.latitude!, longitude: property.longitude! })), {
      edgePadding: { top: 120, right: 48, bottom: 80, left: 48 },
      animated: true,
    });
  }, [mapReady, points]);

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={initialRegion} onMapReady={() => setMapReady(true)}>
        {points.map((property) => (
          <Marker
            key={property.id}
            coordinate={{ latitude: property.latitude!, longitude: property.longitude! }}
            title={property.title}
            description={`${property.city} · $${property.price.toLocaleString()}`}
            onCalloutPress={() => router.push(`/property/${property.id}`)}
          />
        ))}
      </MapView>
      <View style={[styles.topBar, { top: insets.top + (Platform.OS === "web" ? 67 : 8) }]}>
        <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.card }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, backgroundColor: colors.card }]}>{t("mapSearch")}</Text>
        <Pressable accessibilityLabel={t("filters")} onPress={() => setFilterVisible(true)} style={[styles.iconButton, { backgroundColor: colors.card }]}>
          <Feather name="sliders" size={19} color={colors.foreground} />
        </Pressable>
      </View>
      {points.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.card, bottom: insets.bottom + 24 }]}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.foreground }]}>{t("noMapListings")}</Text>
        </View>
      )}
      <FilterSheet visible={filterVisible} onClose={() => setFilterVisible(false)} filters={filters} onApply={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", elevation: 3 },
  title: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, overflow: "hidden", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  empty: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, elevation: 3 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
