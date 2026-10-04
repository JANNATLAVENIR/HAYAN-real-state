import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useListings } from "@/contexts/ListingsContext";
import { translateAmenity, useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { PropertyReviews } from "@/components/PropertyReviews";
import { supabase } from "@/lib/supabase";

const heroImg = require("@/assets/images/hero-property.png");
const villaImg = require("@/assets/images/villa-property.png");

function getPropertyImage(image: string) {
  if (image.startsWith("https://") || image.startsWith("http://")) return { uri: image };
  if (image === "villa-property") return villaImg;
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

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, toggleBookmark } = useAuth();
  const { language, t } = useLanguage();
  const { getProperty, incrementViews } = useListings();
  const { createConversation, conversations } = useChat();
  const [publicPhone, setPublicPhone] = useState<string | null>(null);
  const [ownerVerified, setOwnerVerified] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const property = getProperty(id);
  const isBookmarked = user?.bookmarks.includes(id);
  const galleryImages = property?.images.length ? property.images : ["hero-property"];

  useEffect(() => {
    if (id) void incrementViews(id).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!property?.ownerId || !supabase) return;
    let active = true;
    void supabase.from("public_profiles").select("public_phone,is_verified").eq("id", property.ownerId).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setPublicPhone(data?.public_phone ?? null);
        setOwnerVerified(Boolean(data?.is_verified));
      });
    return () => { active = false; };
  }, [property?.ownerId]);

  if (!property) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>{t("propertyNotFound")}</Text>
      </View>
    );
  }

  const handleContact = async () => {
    if (!user) {
      Alert.alert(t("signInRequired"), t("signInToContact"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const existing = conversations.find((conversation) =>
        conversation.participants.length === 2
        && conversation.participants.includes(user.id)
        && conversation.participants.includes(property.ownerId),
      );
      if (existing) {
        router.push(`/conversation/${existing.id}`);
      } else {
        const conversationId = await createConversation({
          participants: [user.id, property.ownerId],
          participantNames: { [user.id]: t("you"), [property.ownerId]: t("propertyOwner") },
          propertyId: property.id,
          propertyTitle: property.title,
        });
        router.push(`/conversation/${conversationId}`);
      }
    } catch (error) {
      Alert.alert(t("messageSendFailed"), error instanceof Error ? error.message : t("tryAgain"));
    }
  };

  const handleSchedule = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/schedule-viewing?propertyId=${property.id}&title=${encodeURIComponent(property.title)}`);
  };

  const submitReport = async (reason: string) => {
    if (!user) return Alert.alert(t("signInRequired"), t("signInToContact"));
    if (!supabase) return Alert.alert(t("reportListing"), t("verificationRequired"));
    const { error } = await supabase.from("property_reports").insert({ property_id: property.id, reporter_id: user.id, reason, details: "" });
    if (error) return Alert.alert(t("reportFailed"), error.code === "23505" ? t("reportSent") : error.message);
    Alert.alert(t("reportSent"));
  };

  const handleReport = () => {
    if (!user) return Alert.alert(t("signInRequired"), t("signInToContact"));
    setReportOpen(true);
  };

  const handlePhoneContact = async (channel: "call" | "whatsapp") => {
    if (!publicPhone) return Alert.alert(t("contactSeller"), t("noPublicPhone"));
    const url = channel === "call" ? `tel:${publicPhone}` : `https://wa.me/${publicPhone.replace(/\D/g, "")}`;
    try { await Linking.openURL(url); } catch { Alert.alert(t("contactSeller"), t("noPublicPhone")); }
  };

  const isAvailable = (property.availabilityStatus ?? "available") === "available";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.imageSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setActiveImageIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          >
            {galleryImages.map((image, index) => (
              <Image key={`${index}-${image}`} source={getPropertyImage(image)} style={[styles.heroImage, { width }]} contentFit="cover" />
            ))}
          </ScrollView>
          <View style={[styles.imageOverlay, { paddingTop: insets.top + webTopPad }]}>
            <Pressable style={styles.backCircle} onPress={() => router.back()} hitSlop={12}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <View style={styles.imageActions}>
              <Pressable style={styles.backCircle} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!user) return Alert.alert(t("signInRequired"), t("signInContinue"));
                void toggleBookmark(property.id).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain")));
              }}>
                <Feather name="heart" size={20} color={isBookmarked ? colors.primary : "#fff"} />
              </Pressable>
              <Pressable style={styles.backCircle}>
                <Feather name="share" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
          {property.featured && (
            <View style={[styles.featuredBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.featuredText, { color: colors.primaryForeground }]}>{t("featured")}</Text>
            </View>
          )}
          {galleryImages.length > 1 ? (
            <View style={[styles.imageCounter, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
              <Text style={styles.imageCounterText}>{activeImageIndex + 1} / {galleryImages.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoSection}>
          <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(property.price, property.listingType, language === "so" ? "so-SO" : "en-US", t("perMonth"))}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{property.title}</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text style={[styles.location, { color: colors.mutedForeground }]}>{property.address}, {property.city}</Text>
          </View>
          <Pressable
            style={styles.ownerProfileLink}
            onPress={() => router.push({ pathname: "/user/[id]", params: { id: property.ownerId } })}
          >
            <Feather name="user" size={14} color={colors.primary} />
            <Text style={[styles.ownerProfileText, { color: colors.primary }]}>{t("viewSellerProfile")}</Text>
            {ownerVerified && <Feather name="check-circle" size={15} color={colors.primary} />}
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </Pressable>
          {publicPhone && isAvailable ? (
            <View style={styles.directContactRow}>
              <Pressable onPress={() => void handlePhoneContact("call")} style={[styles.directContactButton, { borderColor: colors.border }]}>
                <Feather name="phone" size={15} color={colors.primary} />
                <Text style={[styles.directContactText, { color: colors.foreground }]}>{t("callSeller")}</Text>
              </Pressable>
              <Pressable onPress={() => void handlePhoneContact("whatsapp")} style={[styles.directContactButton, { borderColor: colors.border }]}>
                <Feather name="message-circle" size={15} color={colors.primary} />
                <Text style={[styles.directContactText, { color: colors.foreground }]}>{t("whatsappSeller")}</Text>
              </Pressable>
            </View>
          ) : null}

          {property.latitude !== undefined && property.longitude !== undefined && (
            <MapView
              style={styles.map}
              initialRegion={{ latitude: property.latitude, longitude: property.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
              scrollEnabled={false}
            >
              <Marker coordinate={{ latitude: property.latitude, longitude: property.longitude }} title={property.title} />
            </MapView>
          )}

          <View style={[styles.typeBadge, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
            <Text style={[styles.typeLabel, { color: colors.foreground }]}>
              {t(property.type)} · {property.listingType === "rent" ? t("forRent") : t("forSale")}
            </Text>
          </View>
          <View style={styles.safetyRow}>
            <Text style={[styles.availabilityText, { color: isAvailable ? colors.primary : colors.mutedForeground }]}>{t(property.availabilityStatus ?? "available")}</Text>
            <Pressable onPress={handleReport} accessibilityLabel={t("reportListing")} style={styles.reportButton}>
              <Feather name="flag" size={14} color={colors.mutedForeground} />
              <Text style={[styles.reportText, { color: colors.mutedForeground }]}>{t("reportListing")}</Text>
            </Pressable>
          </View>

          {property.type !== "land" && (
            <View style={[styles.statsGrid, { borderColor: colors.border }]}>
              <View style={styles.statItem}>
                <Feather name="home" size={20} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bedrooms}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("bedrooms")}</Text>
              </View>
              <View style={[styles.statVertDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Feather name="droplet" size={20} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bathrooms}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("bathrooms")}</Text>
              </View>
              <View style={[styles.statVertDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Feather name="maximize" size={20} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{property.area.toLocaleString(language === "so" ? "so-SO" : "en-US")}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("sqm")}</Text>
              </View>
            </View>
          )}

          <View style={styles.descSection}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t("aboutProperty")}</Text>
            <Text style={[styles.description, { color: colors.charcoalLight }]}>{property.description}</Text>
          </View>

          <View style={styles.amenitiesSection}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t("amenities")}</Text>
            <View style={styles.amenitiesGrid}>
              {property.amenities.map((a) => (
                <View key={a} style={[styles.amenityTag, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
                  <Text style={[styles.amenityText, { color: colors.foreground }]}>{translateAmenity(a, t)}</Text>
                </View>
              ))}
              {property.petFriendly && (
                <View style={[styles.amenityTag, { backgroundColor: "rgba(46,204,113,0.1)", borderRadius: colors.radius }]}>
                  <Text style={[styles.amenityText, { color: "#2ECC71" }]}>{t("petFriendly")}</Text>
                </View>
              )}
            </View>
          </View>

          <PropertyReviews propertyId={property.id} ownerId={property.ownerId} />

          <View style={[styles.viewsRow, { borderTopColor: colors.border }]}>
            <Feather name="eye" size={14} color={colors.mutedForeground} />
            <Text style={[styles.viewsText, { color: colors.mutedForeground }]}>{property.views.toLocaleString(language === "so" ? "so-SO" : "en-US")} {t("views")}</Text>
          </View>
        </View>
      </ScrollView>

      {isAvailable ? <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
        <Pressable
          style={({ pressed }) => [styles.contactBtn, { borderColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleContact}
        >
          <Feather name="message-circle" size={18} color={colors.primary} />
          <Text style={[styles.contactBtnText, { color: colors.primary }]}>{t("message")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.scheduleBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleSchedule}
        >
          <Feather name="calendar" size={18} color={colors.primaryForeground} />
          <Text style={[styles.scheduleBtnText, { color: colors.primaryForeground }]}>{t("scheduleViewing")}</Text>
        </Pressable>
      </View> : <View style={[styles.unavailableBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <Text style={[styles.availabilityText, { color: colors.mutedForeground }]}>{t(property.availabilityStatus ?? "unavailable")}</Text>
      </View>}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.reportBackdrop}>
          <View style={[styles.reportModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t("reportListing")}</Text>
            <Text style={[styles.reportText, { color: colors.mutedForeground }]}>{t("reportReason")}</Text>
            {([
              ["incorrect_information", "incorrectInformation"],
              ["unavailable", "listingUnavailable"],
              ["fraud_suspicion", "fraudSuspicion"],
              ["inappropriate", "inappropriateListing"],
              ["other", "otherReason"],
            ] as const).map(([reason, label]) => (
              <Pressable key={reason} onPress={() => { setReportOpen(false); void submitReport(reason); }} style={[styles.reportOption, { borderBottomColor: colors.border }]}>
                <Text style={[styles.contactBtnText, { color: colors.foreground }]}>{t(label)}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setReportOpen(false)} style={styles.reportCancel}>
              <Text style={[styles.contactBtnText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageSection: { position: "relative", height: 320 },
  heroImage: { height: 320 },
  imageCounter: { position: "absolute", right: 16, bottom: 14, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  imageCounterText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageActions: { flexDirection: "row", gap: 10 },
  featuredBadge: { position: "absolute", bottom: 16, left: 16, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  featuredText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  infoSection: { padding: 20 },
  price: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  title: { fontSize: 22, fontFamily: "Inter_600SemiBold", marginTop: 6, letterSpacing: 0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  location: { fontSize: 14, fontFamily: "Inter_400Regular" },
  ownerProfileLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 10 },
  ownerProfileText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  directContactRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  directContactButton: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  directContactText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  safetyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  availabilityText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  reportButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  reportText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  reportBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  reportModal: { borderWidth: 1, borderRadius: 14, padding: 20 },
  reportOption: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  reportCancel: { alignItems: "flex-end", paddingTop: 14 },
  map: { height: 190, width: "100%", marginTop: 16 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, marginTop: 14 },
  typeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  statsGrid: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 20 },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statVertDivider: { width: 1, alignSelf: "stretch" },
  descSection: { marginTop: 28 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 12 },
  description: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  amenitiesSection: { marginTop: 28 },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityTag: { paddingHorizontal: 14, paddingVertical: 8 },
  amenityText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  viewsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  viewsText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unavailableBar: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1.5 },
  contactBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scheduleBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  scheduleBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
