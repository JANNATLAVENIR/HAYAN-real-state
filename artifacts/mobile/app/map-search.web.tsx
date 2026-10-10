import { Feather } from "@expo/vector-icons";
import type { Map as LeafletMap } from "leaflet";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import "leaflet/dist/leaflet.css";

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
  const [mapError, setMapError] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const points = filteredProperties.filter((property) => Number.isFinite(property.latitude) && Number.isFinite(property.longitude));
  const pointsKey = JSON.stringify(points.map(({ id, latitude, longitude, title, price }) => ({ id, latitude, longitude, title, price })));
  const mapPoints = JSON.parse(pointsKey) as Array<{ id: string; latitude: number; longitude: number; title: string; price: number }>;
  const centerLatitude = points[0]?.latitude ?? 2.0469;
  const centerLongitude = points[0]?.longitude ?? 45.3182;

  useEffect(() => {
    let cancelled = false;
    let activeMap: LeafletMap | null = null;

    const mountMap = async () => {
      if (!mapElement.current) return;
      try {
        const leaflet = await import("leaflet");
        if (cancelled || !mapElement.current) return;
        const L = leaflet.default;
        const map = L.map(mapElement.current, { scrollWheelZoom: false, zoomControl: true });
        activeMap = map;
        mapInstance.current = map;
        setMapError(false);
        map.setView([centerLatitude, centerLongitude], 13);
        const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });
        tileLayer.on("tileerror", () => setMapError(true));
        tileLayer.on("tileload", () => setMapError(false));
        tileLayer.addTo(map);

        mapPoints.forEach((property) => {
          const priceLabel = `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(property.price)}`;
          const icon = L.divIcon({
            className: "hayan-map-marker",
            html: `<span style="display:flex;flex-direction:column;align-items:center;gap:3px"><span style="display:flex;width:27px;height:27px;align-items:center;justify-content:center;border:2px solid #fff;border-radius:50%;background:#202124;color:#fff;box-shadow:0 2px 7px #0004"><span style="font-size:14px;font-weight:700">⌂</span></span><span style="padding:3px 7px;border:1px solid #fff;border-radius:12px;background:#202124;color:#fff;box-shadow:0 2px 7px #0003;font:600 10px Inter,Arial,sans-serif;white-space:nowrap">${priceLabel}</span></span>`,
            iconSize: [58, 54],
            iconAnchor: [29, 16],
          });
          L.marker([property.latitude!, property.longitude!], { icon, title: property.title, alt: property.title })
            .on("click", () => router.push(`/property/${property.id}`))
            .addTo(map);
        });

        if (mapPoints.length > 1) {
          map.fitBounds(L.latLngBounds(mapPoints.map((property) => [property.latitude, property.longitude])), {
            padding: [36, 36],
            maxZoom: 14,
          });
        }
        window.requestAnimationFrame(() => map.invalidateSize());
      } catch {
        if (!cancelled) setMapError(true);
      }
    };

    void mountMap();
    return () => {
      cancelled = true;
      activeMap?.remove();
      if (mapInstance.current === activeMap) mapInstance.current = null;
    };
  // pointsKey makes the map update only when the displayed pins actually change.
  }, [pointsKey, centerLatitude, centerLongitude, router]);

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
          <div ref={mapElement} role="application" aria-label={t("mapSearch")} style={{ width: "100%", height: "100%" }} />
          {mapError && <View style={[styles.mapNotice, { backgroundColor: colors.card }]}><Feather name="alert-circle" size={16} color={colors.primary} /><Text style={[styles.mapNoticeText, { color: colors.foreground }]}>{t("mapTilesError")}</Text></View>}
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
