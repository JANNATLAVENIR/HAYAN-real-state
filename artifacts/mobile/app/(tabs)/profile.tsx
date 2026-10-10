import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PropertyCard } from "@/components/PropertyCard";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

function getRoleLabel(role: string, t: ReturnType<typeof useLanguage>["t"]) {
  switch (role) {
    case "buyer": return t("propertyBuyer");
    case "seller": return t("propertySeller");
    case "renter": return t("propertyRenter");
    case "agent": return t("realEstateAgent");
    default: return role;
  }
}

type ProfileMenuItem = {
  icon: string;
  label: string;
  onPress?: () => void;
  show?: boolean;
  subtitle?: string;
  badge?: number;
  destructive?: boolean;
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, toggleBookmark } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { properties, getUserProperties, viewings, respondToViewing, updateProperty, deleteProperty } = useListings();
  const { conversations } = useChat();
  const [verificationPending, setVerificationPending] = useState(false);
  const [verified, setVerified] = useState(user?.isVerified ?? false);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const bookmarkedProperties = properties.filter((p) => user?.bookmarks.includes(p.id));
  const myListings = user ? getUserProperties(user.id) : [];
  const myListingIds = new Set(myListings.map((property) => property.id));
  const incomingViewings = viewings.filter((viewing) =>
    viewing.agentId === user?.id || myListingIds.has(viewing.propertyId),
  );
  const myConversations = conversations.filter((conversation) => conversation.participants.includes(user?.id ?? ""));
  const isSeller = user?.role === "seller" || user?.role === "agent";

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    void Promise.all([
      supabase.from("seller_verification_requests").select("id").eq("user_id", user.id).eq("status", "pending").maybeSingle(),
      supabase.from("profiles").select("is_verified").eq("id", user.id).maybeSingle(),
    ]).then(([requestResult, profileResult]) => {
      if (!active) return;
      setVerificationPending(Boolean(requestResult.data));
      setVerified(Boolean(profileResult.data?.is_verified));
    });
    return () => { active = false; };
  }, [user?.id, isSeller]);

  const requestVerification = async () => {
    if (!user || !supabase) return Alert.alert(t("requestVerification"), t("verificationRequired"));
    const message = `${user.role === "agent" ? "Agent" : "Seller"} profile verification requested. I can provide supporting information when contacted.`;
    const { error } = await supabase.from("seller_verification_requests").insert({ user_id: user.id, message });
    if (error) return Alert.alert(t("requestVerification"), error.code === "23505" ? t("verificationPending") : error.message);
    setVerificationPending(true);
    Alert.alert(t("requestVerification"), t("verificationSent"));
  };

  const changeAvailability = (propertyId: string) => {
    const listing = myListings.find((property) => property.id === propertyId);
    const options = listing?.listingType === "rent" ? ["available", "rented", "unavailable"] as const : ["available", "sold", "unavailable"] as const;
    Alert.alert(t("availabilityStatus"), undefined, [
    ...options.map((status) => ({
      text: t(status), onPress: () => { void updateProperty(propertyId, { availabilityStatus: status }).catch((error: unknown) => Alert.alert(t("updateFailed"), error instanceof Error ? error.message : t("tryAgain"))); },
    })),
    { text: t("cancel"), style: "cancel" },
    ]);
  };

  const runDeleteProperty = (propertyId: string) => {
    void deleteProperty(propertyId).catch((error: unknown) => {
      const title = t("deleteFailed");
      const message = error instanceof Error ? error.message : t("tryAgain");
      if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
      else Alert.alert(title, message);
    });
  };

  const confirmDeleteProperty = (propertyId: string) => {
    const title = t("deleteMyListing");
    const message = t("deleteListingWarning");
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) runDeleteProperty(propertyId);
      return;
    }
    Alert.alert(title, message, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => runDeleteProperty(propertyId) },
    ]);
  };

  const menuItems: ProfileMenuItem[] = [
    { icon: "log-in", label: t("signIn"), onPress: () => router.push("/(auth)/login"), show: !user },
    { icon: "shield", label: t("masterAdmin"), onPress: () => router.push("/admin"), show: Boolean(user?.isAdmin) },
    { icon: "user", label: t("publicProfile"), onPress: () => { if (user) router.push({ pathname: "/user/[id]", params: { id: user.id } }); }, show: Boolean(user) },
    { icon: "edit-3", label: t("editProfile"), onPress: () => router.push("/edit-profile"), show: Boolean(user) },
    { icon: "lock", label: t("changePassword"), onPress: () => router.push("/change-password"), show: Boolean(user) },
    { icon: "plus-square", label: t("createListing"), onPress: () => router.push("/create-listing"), show: isSeller },
    { icon: "calendar", label: t("myViewings"), onPress: () => router.push("/viewings" as never), badge: viewings.filter((v) => v.status === "pending" && (v.userId === user?.id || v.agentId === user?.id)).length, show: Boolean(user) },
    { icon: "bookmark", label: t("savedSearches"), onPress: () => router.push("/saved-searches" as never), show: Boolean(user) },
    { icon: "folder", label: t("collections"), onPress: () => router.push("/collections" as never), show: Boolean(user) },
    { icon: "bell", label: t("notificationSettings"), onPress: () => router.push("/notification-settings" as never), show: Boolean(user) },
    { icon: "shield", label: t("securitySettings"), onPress: () => router.push("/security-settings" as never), show: Boolean(user) },
    { icon: "trash-2", label: language === "so" ? "Tirtir akoonka" : "Delete account", onPress: () => router.push("/delete-account" as never), destructive: true, show: Boolean(user) },
    { icon: "users", label: t("agentDirectory"), onPress: () => router.push("/agents" as never) },
    { icon: "dollar-sign", label: t("mortgageCalculator"), onPress: () => router.push("/mortgage-calculator" as never) },
    { icon: "log-out", label: t("signOut"), onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); void logout(); router.replace("/(auth)/login"); }, destructive: true, show: Boolean(user) },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 52 : 100) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileHeader, { paddingTop: insets.top + webTopPad + 16 }]}>
        <View pointerEvents="none" style={styles.profileCover}>
          <Image source={require("@/assets/images/welcome-house-reference.png")} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.profileCoverShade} />
        </View>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={[styles.avatarLarge, { borderColor: colors.primary }]} contentFit="cover" />
        ) : (
          <View style={[styles.avatarLarge, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
            </Text>
          </View>
        )}
        <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name || t("guest")}</Text>
        <View style={[styles.roleBadge, { backgroundColor: "rgba(201,169,110,0.1)", borderRadius: colors.radius }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{user ? getRoleLabel(user.role, t) : ""}</Text>
        </View>
        <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
        {verified ? <Text style={[styles.verifiedLabel, { color: colors.primary }]}><Feather name="check-circle" size={13} color={colors.primary} /> {t("verifiedSeller")}</Text> : null}

        {isSeller && (
          <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{myListings.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("listings")}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{myListings.reduce((s, p) => s + p.views, 0)}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("totalViews")}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{bookmarkedProperties.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("saved")}</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { marginTop: 12 }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{incomingViewings.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("viewingRequests")}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{myConversations.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("conversations")}</Text>
            </View>
          </View>
          </>
        )}
        {isSeller && !verified ? (
          <Pressable disabled={verificationPending} onPress={() => void requestVerification()} style={[styles.verificationButton, { borderColor: colors.primary, opacity: verificationPending ? 0.65 : 1 }]}>
            <Feather name={verificationPending ? "clock" : "check-circle"} size={15} color={colors.primary} />
            <Text style={[styles.verificationButtonText, { color: colors.primary }]}>{verificationPending ? t("verificationPending") : t("requestVerification")}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.menuSection, { borderTopColor: colors.border }]}>
        {menuItems.filter((m) => m.show !== false).map((item, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
            onPress={item.onPress}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.destructive ? "rgba(196,91,91,0.1)" : colors.secondary }]}>
              <Feather name={item.icon as any} size={18} color={item.destructive ? colors.destructive : colors.foreground} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={[styles.menuLabel, { color: item.destructive ? colors.destructive : colors.foreground }]}>{item.label}</Text>
              {item.subtitle && <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>}
            </View>
            {item.badge ? (
              <View style={[styles.menuBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.menuBadgeText, { color: colors.primaryForeground }]}>{item.badge}</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.preferencesSection, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("language")}</Text>
        <View style={[styles.languageControl, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
          {(["so", "en"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === option }}
              onPress={() => { void setLanguage(option); }}
              style={[
                styles.languageOption,
                language === option ? { backgroundColor: colors.card, borderColor: colors.primary } : { borderColor: "transparent" },
              ]}
            >
              <Text style={[styles.languageOptionText, { color: language === option ? colors.foreground : colors.mutedForeground }]}>
                {option === "so" ? t("somali") : t("english")}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.currencyLabel, { color: colors.mutedForeground }]}>{t("currency")}</Text>
        <Text style={[styles.currencyValue, { color: colors.foreground }]}>{t("usdOnly")}</Text>
      </View>

      {bookmarkedProperties.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("savedProperties")}</Text>
          {bookmarkedProperties.map((p) => (
            <PropertyCard key={p.id} property={p} isBookmarked onBookmark={() => toggleBookmark(p.id)} compact />
          ))}
        </View>
      )}

      {isSeller && myListings.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("myListings")}</Text>
          {myListings.map((p) => (
            <View key={p.id}>
              <PropertyCard property={p} compact />
              <View style={[styles.listingManageRow, { borderColor: colors.border }]}>
                <Text style={[styles.listingState, { color: p.status === "approved" ? colors.primary : colors.mutedForeground }]}>
                  {p.status === "pending" ? t("pending") : p.status === "rejected" ? t("rejected") : t(p.availabilityStatus ?? "available")}
                </Text>
                <Pressable onPress={() => changeAvailability(p.id)} hitSlop={8}><Feather name="refresh-cw" size={17} color={colors.primary} /></Pressable>
                <Pressable onPress={() => router.push({ pathname: "/create-listing", params: { id: p.id } })} hitSlop={8}><Feather name="edit-2" size={17} color={colors.primary} /></Pressable>
                <Pressable onPress={() => confirmDeleteProperty(p.id)} hitSlop={8}><Feather name="trash-2" size={17} color={colors.destructive} /></Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {isSeller && incomingViewings.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("viewingRequests")} ({incomingViewings.length})</Text>
          {incomingViewings.map((viewing) => (
            <View key={viewing.id} style={[styles.viewingRow, { borderBottomColor: colors.border }]}>
              <View style={styles.viewingInfo}>
                <Text style={[styles.viewingTitle, { color: colors.foreground }]}>{viewing.propertyTitle}</Text>
                <Text style={[styles.viewingSubtitle, { color: colors.mutedForeground }]}>
                  {t("requester")}: {viewing.requesterName ?? viewing.userId.slice(0, 8)} · {viewing.date} · {viewing.time}
                </Text>
                <Text style={[styles.viewingStatus, { color: viewing.status === "pending" ? colors.primary : colors.mutedForeground }]}>
                  {viewing.status === "pending" ? t("pending") : viewing.status === "confirmed" ? t("confirmedStatus") : t("cancelledStatus")}
                </Text>
              </View>
              {viewing.status === "pending" ? (
                <View style={styles.viewingActions}>
                  <Pressable
                    accessibilityLabel={t("confirm")}
                    onPress={() => { void respondToViewing(viewing.id, "confirmed").catch((error: unknown) => Alert.alert(t("couldNotSchedule"), error instanceof Error ? error.message : t("tryAgain"))); }}
                    hitSlop={10}
                  >
                    <Feather name="check" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={t("cancel")}
                    onPress={() => { void respondToViewing(viewing.id, "cancelled").catch((error: unknown) => Alert.alert(t("couldNotSchedule"), error instanceof Error ? error.message : t("tryAgain"))); }}
                    hitSlop={10}
                  >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 24, position: "relative" },
  profileCover: { position: "absolute", top: 0, left: 0, right: 0, height: 190, overflow: "hidden" },
  profileCoverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(250,248,245,0.56)" },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  verifiedLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  verificationButton: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, marginTop: 16 },
  verificationButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  listingManageRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 18, paddingHorizontal: 12, paddingVertical: 12, marginTop: -8, marginBottom: 12, borderWidth: 1 },
  listingState: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 14, letterSpacing: 0.3 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 4, marginTop: 8 },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 0 },
  statBox: { alignItems: "center", paddingHorizontal: 20 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32 },
  menuSection: { marginTop: 8, paddingBottom: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, marginHorizontal: 16, marginTop: 8 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  menuInfo: { flex: 1, marginLeft: 14 },
  menuLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  menuSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  menuBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 8 },
  menuBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  preferencesSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  languageControl: { flexDirection: "row", padding: 4, marginBottom: 18 },
  languageOption: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderRadius: 6 },
  languageOptionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  currencyLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  currencyValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  viewingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  viewingInfo: { flex: 1 },
  viewingTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  viewingSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  viewingStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  viewingActions: { flexDirection: "row", gap: 16, paddingLeft: 12 },
  savedSection: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 16 },
});
