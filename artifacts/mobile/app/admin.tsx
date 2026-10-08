import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { AdminTrustConsole } from "@/components/AdminTrustConsole";
import { AdminBrandStudio } from "@/components/AdminBrandStudio";
import { useChat } from "@/contexts/ChatContext";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AdminUser = { id: string; name: string; email: string; role: string; isSuspended: boolean; approvalStatus: "pending" | "approved" | "rejected" };
type AdminProperty = { id: string; title: string; city: string; price: number; status: string; ownerId: string };
type AdminViewing = { id: string; propertyId: string; userId: string; date: string; time: string; status: string };

function rolesForDisplay(role: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (role === "buyer") return t("buyerRolePicker");
  if (role === "seller") return t("sellerRolePicker");
  if (role === "renter") return t("renterRolePicker");
  if (role === "agent") return t("agentRolePicker");
  return role;
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === "so" ? "so-SO" : "en-US";
  const { conversations } = useChat();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [listings, setListings] = React.useState<AdminProperty[]>([]);
  const [adminViewings, setAdminViewings] = React.useState<AdminViewing[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [listingFilter, setListingFilter] = React.useState("all");

  useEffect(() => {
    if (user && !user.isAdmin) router.replace("/(tabs)/profile");
  }, [router, user]);

  useEffect(() => {
    if (!user?.isAdmin || !isSupabaseConfigured || !supabase) return;
    setLoadingData(true);
    setLoadError("");
    Promise.all([
      supabase.from("profiles").select("id, name, email, role, is_suspended, approval_status").order("created_at", { ascending: false }).limit(1000),
      supabase.from("properties").select("id, title, city, price, status, owner_id").order("created_at", { ascending: false }).limit(1000),
      supabase.from("viewings").select("id, property_id, user_id, date, time, status").order("created_at", { ascending: false }).limit(1000),
    ]).then(async ([initialUsersResult, propertiesResult, viewingsResult]) => {
      let usersResult: any = initialUsersResult;
      if (usersResult.error?.message?.includes("approval_status")) {
        const fallback = await supabase!.from("profiles").select("id, name, email, role, is_suspended").order("created_at", { ascending: false }).limit(1000);
        usersResult = fallback.error ? fallback : { ...fallback, data: (fallback.data ?? []).map((profile) => ({ ...profile, approval_status: "approved" })) };
      }
      const error = usersResult.error ?? propertiesResult.error ?? viewingsResult.error;
      if (error) throw error;
      setUsers((usersResult.data ?? []).map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email ?? "",
        role: profile.role,
        isSuspended: Boolean(profile.is_suspended),
        approvalStatus: profile.approval_status ?? "approved",
      })));
      setListings((propertiesResult.data ?? []).map((property: any) => ({
        id: property.id,
        title: property.title,
        city: property.city,
        price: Number(property.price),
        status: property.status ?? "approved",
        ownerId: property.owner_id,
      })));
      setAdminViewings((viewingsResult.data ?? []).map((viewing: any) => ({
        id: viewing.id,
        propertyId: viewing.property_id,
        userId: viewing.user_id,
        date: viewing.date,
        time: viewing.time,
        status: viewing.status,
      })));
    }).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : t("loadAdminFailed"));
    }).finally(() => setLoadingData(false));
  }, [user?.isAdmin]);

  if (!user?.isAdmin) return null;

  const setListingStatus = async (id: string, status: "approved" | "rejected") => {
    if (!supabase) return;
    const { error } = await supabase.from("properties").update({ status }).eq("id", id);
    if (error) return Alert.alert(t("updateFailed"), error.message);
    setListings((current) => current.map((property) => property.id === id ? { ...property, status } : property));
  };

  const deleteListing = async (id: string) => {
    if (!supabase) return;
    Alert.alert(t("deleteListingPrompt"), t("deleteListingWarning"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => { void confirmDeleteListing(id); } },
    ]);
  };

  const confirmDeleteListing = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) return Alert.alert(t("deleteFailed"), error.message);
    setListings((current) => current.filter((property) => property.id !== id));
  };

  const changeUserRole = (profile: AdminUser) => {
    if (profile.id === user?.id) return Alert.alert(t("ownerAccount"), t("cannotChangeOwnRole"));
    const roles = [
      { value: "buyer", label: t("buyerRolePicker") },
      { value: "seller", label: t("sellerRolePicker") },
      { value: "renter", label: t("renterRolePicker") },
      { value: "agent", label: t("agentRolePicker") },
    ];
    Alert.alert(t("changeUserRole"), profile.email, [
      ...roles.map(({ value, label }) => ({
        text: value === profile.role ? `${label} (${t("currentRole")})` : label,
        onPress: () => { if (value !== profile.role) void updateUser(profile.id, { role: value }); },
      })),
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  const toggleUserSuspension = (profile: AdminUser) => {
    if (profile.id === user?.id) return Alert.alert(t("ownerAccount"), t("cannotSuspendOwnAccount"));
    const nextSuspended = !profile.isSuspended;
    Alert.alert(nextSuspended ? t("suspendAccount") : t("restoreAccount"), profile.email, [
      { text: t("cancel"), style: "cancel" },
      { text: nextSuspended ? t("suspend") : t("restore"), style: nextSuspended ? "destructive" : "default", onPress: () => { void updateUser(profile.id, { isSuspended: nextSuspended }); } },
    ]);
  };

  const updateUser = async (id: string, updates: { role?: string; isSuspended?: boolean; approvalStatus?: AdminUser["approvalStatus"] }) => {
    if (!supabase) return;
    const payload = {
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.isSuspended !== undefined ? { is_suspended: updates.isSuspended } : {}),
      ...(updates.approvalStatus !== undefined ? { approval_status: updates.approvalStatus } : {}),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", id);
    if (error) return Alert.alert(t("userUpdateFailed"), error.message);
    setUsers((current) => current.map((profile) => profile.id === id ? {
      ...profile,
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.isSuspended !== undefined ? { isSuspended: updates.isSuspended } : {}),
      ...(updates.approvalStatus !== undefined ? { approvalStatus: updates.approvalStatus } : {}),
    } : profile));
  };

  const updateViewingStatus = async (id: string, status: "confirmed" | "cancelled") => {
    if (!supabase) return;
    const { error } = await supabase.from("viewings").update({ status }).eq("id", id);
    if (error) return Alert.alert(t("viewingUpdateFailed"), error.message);
    setAdminViewings((current) => current.map((viewing) => viewing.id === id ? { ...viewing, status } : viewing));
  };

  const visibleUsers = users.filter((profile) => `${profile.name} ${profile.email} ${profile.role}`.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const visibleListings = listingFilter === "all" ? listings : listings.filter((listing) => listing.status === listingFilter);

  const stats = [
    { label: t("users").toUpperCase(), value: users.length, icon: "users" },
    { label: t("listings").toUpperCase(), value: listings.length, icon: "home" },
    { label: t("myViewings").toUpperCase(), value: adminViewings.length, icon: "calendar" },
    { label: t("conversations").toUpperCase(), value: conversations.length, icon: "message-circle" },
  ];
  const statusLabels: Record<string, string> = {
    all: t("all"), pending: t("pending"), approved: t("approved"), rejected: t("rejected"),
    confirmed: t("confirmedStatus"), cancelled: t("cancelledStatus"),
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>HAYÁN</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("masterAdmin")}</Text>
        </View>
        <Feather name="shield" size={22} color={colors.primary} />
      </View>

      <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{t("welcomeBack")}, {user.name}</Text>

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }] }>
            <Feather name={stat.icon as any} size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {loadError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{loadError}</Text> : null}

      <AdminBrandStudio />

      <View style={[styles.section, { borderTopColor: colors.border }] }>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("ownerControls")}</Text>
        <View style={[styles.controlRow, { borderBottomColor: colors.border }] }>
          <View style={[styles.controlIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
          </View>
          <View style={styles.controlCopy}>
            <Text style={[styles.controlTitle, { color: colors.foreground }]}>{t("listingModeration")}</Text>
            <Text style={[styles.controlSubtitle, { color: colors.mutedForeground }]}>{t("reviewProperties")}</Text>
          </View>
        </View>
        <View style={[styles.controlRow, { borderBottomColor: colors.border }] }>
          <View style={[styles.controlIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="users" size={18} color={colors.primary} />
          </View>
          <View style={styles.controlCopy}>
            <Text style={[styles.controlTitle, { color: colors.foreground }]}>{t("userManagement")}</Text>
            <Text style={[styles.controlSubtitle, { color: colors.mutedForeground }]}>{t("manageRoles")}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("propertyManagement")}</Text>
        <View style={styles.filterRow}>
          {["all", "pending", "approved", "rejected"].map((filter) => (
            <Pressable key={filter} onPress={() => setListingFilter(filter)} style={[styles.filterButton, { borderColor: listingFilter === filter ? colors.primary : colors.border, backgroundColor: listingFilter === filter ? colors.primary : "transparent" }]}>
              <Text style={[styles.filterText, { color: listingFilter === filter ? colors.primaryForeground : colors.foreground }]}>{statusLabels[filter]}</Text>
            </Pressable>
          ))}
        </View>
        {loadingData ? <ActivityIndicator color={colors.primary} /> : visibleListings.map((property) => (
          <View key={property.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.listIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="home" size={17} color={colors.primary} />
            </View>
            <View style={styles.listCopy}>
              <Text style={[styles.listTitle, { color: colors.foreground }]} numberOfLines={1}>{property.title}</Text>
              <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>{property.city} · {new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(property.price)} · {statusLabels[property.status] ?? property.status} · {property.ownerId.slice(0, 8)}</Text>
            </View>
            <View style={styles.actionRow}>
              {property.status !== "approved" && <Pressable onPress={() => setListingStatus(property.id, "approved")} hitSlop={8}><Feather name="check" size={18} color={colors.primary} /></Pressable>}
              {property.status !== "rejected" && <Pressable onPress={() => setListingStatus(property.id, "rejected")} hitSlop={8}><Feather name="x" size={18} color={colors.destructive} /></Pressable>}
              <Pressable onPress={() => deleteListing(property.id)} hitSlop={8}><Feather name="trash-2" size={17} color={colors.destructive} /></Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("userManagement")} ({users.length})</Text>
        <TextInput value={userSearch} onChangeText={setUserSearch} placeholder={t("searchUsers")} placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        {loadingData ? <ActivityIndicator color={colors.primary} /> : visibleUsers.map((profile) => (
          <View key={profile.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{profile.name?.charAt(0).toUpperCase() || "?"}</Text>
            </View>
            <View style={styles.listCopy}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>{profile.name}</Text>
              <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>{profile.email} · {rolesForDisplay(profile.role, t)} · {t(profile.approvalStatus)}{profile.isSuspended ? ` · ${t("suspended")}` : ""}</Text>
            </View>
            <View style={styles.userActions}>
              <Pressable onPress={() => changeUserRole(profile)} style={[styles.smallAction, { borderColor: colors.border }]}>
                <Text style={[styles.smallActionText, { color: colors.foreground }]}>{t("roleLabel")}</Text>
              </Pressable>
              {profile.approvalStatus === "pending" ? (
                <>
                  <Pressable onPress={() => void updateUser(profile.id, { approvalStatus: "approved" })} style={[styles.smallAction, { borderColor: colors.primary }]}>
                    <Text style={[styles.smallActionText, { color: colors.primary }]}>{t("approveAccount").toUpperCase()}</Text>
                  </Pressable>
                  <Pressable onPress={() => void updateUser(profile.id, { approvalStatus: "rejected" })} style={[styles.smallAction, { borderColor: colors.destructive }]}>
                    <Text style={[styles.smallActionText, { color: colors.destructive }]}>{t("rejectAccount").toUpperCase()}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => toggleUserSuspension(profile)} style={[styles.smallAction, { borderColor: profile.isSuspended ? colors.primary : colors.destructive }]}>
                  <Text style={[styles.smallActionText, { color: profile.isSuspended ? colors.primary : colors.destructive }]}>{profile.isSuspended ? t("restore").toUpperCase() : t("suspend").toUpperCase()}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("viewingRequests")} ({adminViewings.length})</Text>
        {adminViewings.map((viewing) => (
          <View key={viewing.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.listIcon, { backgroundColor: colors.secondary }]}><Feather name="calendar" size={17} color={colors.primary} /></View>
            <View style={styles.listCopy}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>{viewing.date} · {viewing.time}</Text>
              <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>{t("propertyLabel")} {viewing.propertyId.slice(0, 8)} · {t("userLabel")} {viewing.userId.slice(0, 8)} · {statusLabels[viewing.status] ?? viewing.status}</Text>
            </View>
            {viewing.status === "pending" && <View style={styles.actionRow}>
              <Pressable onPress={() => updateViewingStatus(viewing.id, "confirmed")} hitSlop={8}><Feather name="check" size={18} color={colors.primary} /></Pressable>
              <Pressable onPress={() => updateViewingStatus(viewing.id, "cancelled")} hitSlop={8}><Feather name="x" size={18} color={colors.destructive} /></Pressable>
            </View>}
          </View>
        ))}
      </View>
      <AdminTrustConsole />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 16 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 4 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 20, marginTop: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 20 },
  stat: { width: "47%", minHeight: 112, borderWidth: 1, padding: 14, justifyContent: "space-between" },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 8 },
  statLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 24 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8 },
  controlRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  controlIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  controlCopy: { marginLeft: 14 },
  controlTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  controlSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  listCopy: { flex: 1, marginLeft: 12 },
  listTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  listSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  errorText: { marginHorizontal: 20, marginBottom: 16, fontSize: 13, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterButton: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4 },
  filterText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  searchInput: { borderWidth: 1, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 4, fontSize: 14 },
  userActions: { alignItems: "flex-end", gap: 6 },
  smallAction: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 3 },
  smallActionText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
});
