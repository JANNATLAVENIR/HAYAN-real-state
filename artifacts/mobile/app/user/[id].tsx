import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { AgentReviews } from "@/components/AgentReviews";
import { useFollowProfile, type PublicProfile } from "@/hooks/useFollowProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

type FollowListKind = "followers" | "following";

function getRoleLabel(role: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (role === "seller") return t("propertySeller");
  if (role === "agent") return t("realEstateAgent");
  return role;
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { profile, stats, isFollowing, isLoading, isSaving, error, toggleFollow, getFollowList } = useFollowProfile(id);
  const [listKind, setListKind] = useState<FollowListKind | null>(null);
  const [listProfiles, setListProfiles] = useState<PublicProfile[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const isOwnProfile = user?.id === id;
  const canFollow = Boolean(user && !isOwnProfile && (profile?.role === "seller" || profile?.role === "agent"));
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const openFollowList = async (kind: FollowListKind) => {
    setListKind(kind);
    setListLoading(true);
    try {
      setListProfiles(await getFollowList(kind));
    } catch (caught) {
      setListKind(null);
      Alert.alert(t("publicProfile"), caught instanceof Error ? caught.message : t("tryAgain"));
    } finally {
      setListLoading(false);
    }
  };

  if (isLoading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{error || t("profileUnavailable")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + webTopPad + 8, paddingBottom: insets.bottom + 32 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("goHome")}>
            <Feather name="arrow-left" size={23} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("publicProfile")}</Text>
          <View style={{ width: 23 }} />
        </View>

        <View style={styles.profileHeader}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={[styles.avatar, { borderColor: colors.primary }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
              <Text style={[styles.avatarInitials, { color: colors.primary }]}>{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
          <Text style={[styles.role, { color: colors.primary }]}>{getRoleLabel(profile.role, t)}</Text>
          {profile.isVerified ? <Text style={[styles.verified, { color: colors.primary }]}><Feather name="check-circle" size={14} color={colors.primary} /> {t("verifiedSeller")}</Text> : null}
          {profile.bio ? <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text> : null}
          {profile.publicPhone ? (
            <View style={styles.contactActions}>
              <Pressable onPress={() => void Linking.openURL(`tel:${profile.publicPhone}`)} style={[styles.contactButton, { borderColor: colors.border }]}>
                <Feather name="phone" size={15} color={colors.primary} /><Text style={[styles.personRole, { color: colors.foreground }]}>{t("callSeller")}</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(`https://wa.me/${profile.publicPhone?.replace(/\D/g, "")}`)} style={[styles.contactButton, { borderColor: colors.border }]}>
                <Feather name="message-circle" size={15} color={colors.primary} /><Text style={[styles.personRole, { color: colors.foreground }]}>{t("whatsappSeller")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <Pressable style={styles.stat} onPress={() => void openFollowList("followers")}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.followerCount}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("followers")}</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.stat} onPress={() => void openFollowList("following")}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.followingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("following")}</Text>
            </Pressable>
          </View>

          {canFollow ? (
            <Pressable
              onPress={() => void toggleFollow().catch((caught: unknown) => Alert.alert(t("couldNotFollow"), caught instanceof Error ? caught.message : t("tryAgain")))}
              disabled={isSaving}
              style={[styles.followButton, { backgroundColor: isFollowing ? colors.secondary : colors.primary, borderRadius: colors.radius }]}
            >
              {isSaving ? <ActivityIndicator color={isFollowing ? colors.foreground : colors.primaryForeground} /> : (
                <Text style={[styles.followButtonText, { color: isFollowing ? colors.foreground : colors.primaryForeground }]}>
                  {isFollowing ? t("unfollow") : t("follow")}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {profile.role === "agent" ? <AgentReviews agentId={profile.id} /> : null}
      </ScrollView>

      <Modal visible={listKind !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setListKind(null)}>
        <View style={[styles.listModal, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setListKind(null)} hitSlop={10} accessibilityLabel={t("cancel")}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{listKind === "followers" ? t("followers") : t("following")}</Text>
            <View style={{ width: 22 }} />
          </View>
          {listLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : (
            <FlatList
              data={listProfiles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.personRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setListKind(null); router.push({ pathname: "/user/[id]", params: { id: item.id } }); }}
                >
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.personAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.personAvatar, styles.personAvatarFallback, { backgroundColor: colors.secondary }]}>
                      <Feather name="user" size={18} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={styles.personCopy}>
                    <Text style={[styles.personName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.personRole, { color: colors.mutedForeground }]}>{getRoleLabel(item.role, t)}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={[styles.emptyList, { color: colors.mutedForeground }]}>{listKind === "followers" ? t("noFollowers") : t("noFollowing")}</Text>}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  headerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
  profileHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 32 },
  avatar: { width: 96, height: 96, borderWidth: 2, borderRadius: 48 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 30, fontFamily: "Inter_700Bold" },
  name: { fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 16, textAlign: "center" },
  role: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 5 },
  verified: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  contactActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  contactButton: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  bio: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
  statsRow: { width: "100%", flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 24, paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  divider: { width: StyleSheet.hairlineWidth },
  followButton: { minWidth: 180, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 13, marginTop: 20 },
  followButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  listModal: { flex: 1, paddingHorizontal: 20 },
  listHeader: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  loading: { marginTop: 32 },
  personRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  personAvatar: { width: 42, height: 42, borderRadius: 21 },
  personAvatarFallback: { alignItems: "center", justifyContent: "center" },
  personCopy: { flex: 1 },
  personName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  personRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  emptyList: { paddingTop: 48, textAlign: "center", fontSize: 14, fontFamily: "Inter_400Regular" },
});
