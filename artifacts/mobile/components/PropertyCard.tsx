import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Property } from "@/constants/types";

const heroImg = require("@/assets/images/hero-property.png");
const villaImg = require("@/assets/images/villa-property.png");

function getPropertyImage(images: string[]) {
  const firstImage = images[0];
  if (firstImage?.startsWith("https://") || firstImage?.startsWith("http://")) return { uri: firstImage };
  if (images[0] === "villa-property") return villaImg;
  return heroImg;
}

function formatPrice(price: number, listingType: string, locale: string, perMonth: string) {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (listingType === "rent") return `${formatter.format(price)}${perMonth}`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: price >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(price);
}

interface Props {
  property: Property;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  compact?: boolean;
}

export function PropertyCard({ property, isBookmarked, onBookmark, compact }: Props) {
  const colors = useColors();
  const { language, t } = useLanguage();
  const locale = language === "so" ? "so-SO" : "en-US";
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/property/${property.id}`);
  };

  const handleBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBookmark?.();
  };

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactContainer,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.95 : 1 },
        ]}
        onPress={handlePress}
      >
        <Image source={getPropertyImage(property.images)} style={[styles.compactImage, { borderRadius: colors.radius }]} contentFit="cover" />
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: colors.foreground }]} numberOfLines={1}>{property.title}</Text>
          <Text style={[styles.compactLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
            {property.address}, {property.city}
          </Text>
          <Text style={[styles.compactPrice, { color: colors.primary }]}>
            {formatPrice(property.price, property.listingType, locale, t("perMonth"))}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card, borderRadius: colors.radius, opacity: pressed ? 0.97 : 1 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.imageWrapper}>
        <Image source={getPropertyImage(property.images)} style={[styles.image, { borderTopLeftRadius: colors.radius, borderTopRightRadius: colors.radius }]} contentFit="cover" />
        {property.featured && (
          <View style={[styles.featuredBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.featuredText, { color: colors.primaryForeground }]}>{t("featured")}</Text>
          </View>
        )}
        {property.availabilityStatus && property.availabilityStatus !== "available" ? (
          <View style={[styles.availabilityBadge, { backgroundColor: "rgba(44,44,44,0.78)" }]}>
            <Text style={styles.typeText}>{t(property.availabilityStatus)}</Text>
          </View>
        ) : null}
        <View style={[styles.typeBadge, { backgroundColor: "rgba(44,44,44,0.7)" }]}>
          <Text style={styles.typeText}>{property.listingType === "rent" ? t("forRent") : t("forSale")}</Text>
        </View>
        {onBookmark && (
          <Pressable style={styles.bookmarkBtn} onPress={handleBookmark} hitSlop={12}>
            <View style={[styles.bookmarkCircle, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
              <Feather name={isBookmarked ? "heart" : "heart"} size={18} color={isBookmarked ? colors.primary : colors.mutedForeground} />
            </View>
          </Pressable>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.price, { color: colors.primary }]}>
          {formatPrice(property.price, property.listingType, locale, t("perMonth"))}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{property.title}</Text>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.location, { color: colors.mutedForeground }]} numberOfLines={1}>
            {property.address}, {property.city}
          </Text>
        </View>
        {property.type !== "land" && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Feather name="home" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.bedrooms} {t("bedrooms")}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Feather name="droplet" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.bathrooms} {t("bathrooms")}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Feather name="maximize" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.area.toLocaleString(locale)} {t("sqm")}</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  imageWrapper: { position: "relative" },
  image: { width: "100%", height: 220 },
  featuredBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  typeBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  availabilityBadge: { position: "absolute", bottom: 16, right: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, color: "#fff" },
  bookmarkBtn: { position: "absolute", top: 16, right: 16 },
  bookmarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { padding: 16 },
  price: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4, letterSpacing: 0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  location: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E8E3DC" },
  stat: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  statText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statDivider: { width: 1, height: 16 },
  compactContainer: {
    flexDirection: "row",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  compactImage: { width: 80, height: 80 },
  compactInfo: { flex: 1, marginLeft: 12, justifyContent: "center" },
  compactTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  compactLocation: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  compactPrice: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
});
