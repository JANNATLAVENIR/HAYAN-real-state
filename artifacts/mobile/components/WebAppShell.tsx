import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { BrandLockup } from "@/components/BrandLockup";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useBranding } from "@/contexts/BrandingContext";

type Destination = { href: string; title: string; icon: React.ComponentProps<typeof Feather>["name"]; activePaths: string[] };

export function WebAppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const { t } = useLanguage();
  const { settings } = useBranding();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const desktop = Platform.OS === "web" && width >= 1000;
  const primary: Destination[] = [
    { href: "/(tabs)", title: t("discover"), icon: "search", activePaths: ["/", "/(tabs)"] },
    { href: "/(tabs)/chat", title: t("chat"), icon: "message-circle", activePaths: ["/chat"] },
    { href: "/(tabs)/alerts", title: t("alerts"), icon: "bell", activePaths: ["/alerts"] },
    { href: "/collections", title: t("collections"), icon: "heart", activePaths: ["/collections"] },
    { href: "/saved-searches", title: t("savedSearches"), icon: "bookmark", activePaths: ["/saved-searches"] },
  ];
  const manage: Destination[] = [
    { href: "/create-listing", title: t("createListing"), icon: "plus-square", activePaths: ["/create-listing"] },
    { href: "/viewings", title: t("myViewings"), icon: "calendar", activePaths: ["/viewings", "/schedule-viewing"] },
    { href: "/map-search", title: t("mapSearch"), icon: "map-pin", activePaths: ["/map-search"] },
    { href: "/agents", title: t("agentDirectory"), icon: "users", activePaths: ["/agents"] },
    { href: "/mortgage-calculator", title: t("mortgageCalculator"), icon: "percent", activePaths: ["/mortgage-calculator"] },
    { href: "/(tabs)/profile", title: t("profile"), icon: "user", activePaths: ["/profile", "/edit-profile", "/change-password", "/security-settings", "/notification-settings"] },
  ];
  const mobileItems = [primary[0], primary[1], primary[2], manage[5]].map((item, index) => ({
    ...item,
    title: settings.navLabels[index]?.trim() || item.title,
    visible: settings.navVisible[index] !== false,
  })).filter((item) => item.visible);
  const navItem = (item: Destination, compact = false) => {
    const active = item.activePaths.some((part) => part === "/" ? pathname === "/" || pathname === "/(tabs)" : pathname.startsWith(part));
    const navIndex = ["/(tabs)", "/(tabs)/chat", "/(tabs)/alerts", "/(tabs)/profile"].indexOf(item.href);
    const title = navIndex >= 0 ? settings.navLabels[navIndex]?.trim() || item.title : item.title;
    return (
      <Pressable
        key={item.href}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => router.push(item.href as never)}
        style={({ pressed }) => [compact ? styles.mobileItem : styles.sideItem, { backgroundColor: active ? "rgba(201,169,110,0.14)" : "transparent", opacity: pressed ? 0.78 : 1 }]}
      >
        <Feather name={item.icon} size={compact ? 20 : 18} color={active ? colors.primary : colors.mutedForeground} />
        {!compact && <Text numberOfLines={1} style={[styles.sideLabel, { color: active ? colors.primary : colors.foreground }]}>{title}</Text>}
        {compact && settings.showNavLabels && <Text numberOfLines={1} style={[styles.mobileLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{title}</Text>}
      </Pressable>
    );
  };

  const mobileNav = (
    <View style={[styles.mobileNav, { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: settings.navHeight, paddingBottom: settings.footerHeight / 4 }]}>
      {mobileItems.map((item) => navItem(item, true))}
    </View>
  );

  if (Platform.OS !== "web") return <>{children}</>;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {desktop ? (
        <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="HAYÁN Real Estate" onPress={() => router.push("/(tabs)" as never)} style={[styles.brand, { paddingHorizontal: settings.headerPadding }]}>
            <BrandLockup settings={settings} foreground={colors.foreground} muted={colors.mutedForeground} />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sideScroll}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("discover")}</Text>
            {primary.map((item, index) => settings.navVisible[index] === false ? null : navItem(item))}
            <Text style={[styles.sectionLabel, styles.secondSection, { color: colors.mutedForeground }]}>{t("profile")}</Text>
            {manage.map((item, index) => index === 5 && settings.navVisible[3] === false ? null : navItem(item))}
            {user?.isAdmin && navItem({ href: "/admin", title: t("masterAdmin"), icon: "shield", activePaths: ["/admin"] })}
          </ScrollView>
          <View style={[styles.account, { borderTopColor: colors.border }]}>
            {user ? (
              <>
                <Text numberOfLines={1} style={[styles.accountName, { color: colors.foreground }]}>{user.name}</Text>
                <Pressable onPress={() => void logout()} style={styles.signOut}>
                  <Feather name="log-out" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.accountAction, { color: colors.mutedForeground }]}>{t("signOut")}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => router.push("/(auth)/login" as never)} style={styles.signOut}>
                <Feather name="log-in" size={16} color={colors.primary} />
                <Text style={[styles.accountAction, { color: colors.primary }]}>{t("signIn")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      <View style={styles.main}>{children}</View>
      {!desktop && settings.showFooter && mobileNav}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", minHeight: "100%" },
  sidebar: { width: 256, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 20, paddingHorizontal: 14 },
  brand: { paddingHorizontal: 10, paddingVertical: 8, marginBottom: 18, alignItems: "center" },
  brandLogo: { width: 144, height: 114 },
  sideScroll: { paddingBottom: 20 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  secondSection: { paddingTop: 24 },
  sideItem: { minHeight: 44, paddingHorizontal: 14, borderRadius: 9, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 3 },
  sideLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  account: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  accountName: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  signOut: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 9 },
  accountAction: { fontFamily: "Inter_500Medium", fontSize: 12 },
  main: { flex: 1, minWidth: 0 },
  mobileNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 68, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 10, paddingBottom: 6 },
  mobileItem: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10 },
  mobileLabel: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 0.2 },
});
