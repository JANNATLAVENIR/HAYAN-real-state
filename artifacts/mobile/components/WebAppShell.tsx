import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
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
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") return;

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const previousViewport = viewportMeta?.getAttribute("content");
    const viewportContent = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    if (viewportMeta) viewportMeta.setAttribute("content", viewportContent);

    const setMeta = (name: string, content: string) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    setMeta("apple-mobile-web-app-title", "HAYAN Real Estate");

    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest.webmanifest";
      document.head.appendChild(manifestLink);
    }

    const chatFocusStyle = document.createElement("style");
    chatFocusStyle.textContent = `
      html, body, #root {
        width: 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        margin: 0 !important;
        background-color: var(--hayan-app-background, #fff) !important;
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }
      body, #root {
        position: fixed !important;
        inset: 0 !important;
      }
      #hayan-app-shell {
        width: 100% !important;
        height: 100vh !important;
        height: 100dvh !important;
        min-height: 0 !important;
        overflow: hidden !important;
        overscroll-behavior: none !important;
        touch-action: pan-x pan-y;
      }
      @media (max-width: 999px) {
        input, textarea, select { font-size: 16px !important; }
        #hayan-mobile-nav {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          bottom: env(safe-area-inset-bottom, 0px) !important;
          z-index: 1000 !important;
          height: 52px !important;
          min-height: 52px !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background: var(--hayan-nav-background, #ffffff) !important;
        }
        #hayan-mobile-nav::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          height: env(safe-area-inset-bottom, 0px);
          background: var(--hayan-nav-background, #ffffff);
          pointer-events: none;
        }
      }
      #chat-message-input:focus { outline: none !important; box-shadow: none !important; }
      #hayan-login-email,
      #hayan-login-password,
      #hayan-login-email:focus,
      #hayan-login-password:focus,
      #hayan-login-email:focus-visible,
      #hayan-login-password:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none !important;
        appearance: none !important;
      }
      #hayan-login-email:-webkit-autofill,
      #hayan-login-password:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 1000px #fcfbf9 inset !important;
        box-shadow: 0 0 0 1000px #fcfbf9 inset !important;
        -webkit-text-fill-color: #262626 !important;
        caret-color: #262626 !important;
      }
      #hayan-chat-screen {
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        height: 100vh !important;
        height: 100dvh !important;
        height: var(--hayan-chat-viewport-height, 100dvh) !important;
      }
      @media (max-width: 999px) {
        #hayan-chat-screen {
          position: fixed !important;
          inset: var(--hayan-chat-viewport-top, 0px) 0 auto 0 !important;
          height: var(--hayan-chat-viewport-height, 100dvh) !important;
          max-height: none !important;
          z-index: 20 !important;
        }
        #hayan-chat-messages {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        #hayan-chat-composer {
          position: sticky !important;
          bottom: 0 !important;
          z-index: 1 !important;
          flex: 0 0 auto !important;
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px) !important;
        }
        html[data-hayan-keyboard-open="true"] #hayan-chat-composer {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          border-top-width: 0 !important;
        }
      }
    `;
    document.head.appendChild(chatFocusStyle);

    const preventGestureZoom = (event: Event) => event.preventDefault();
    const preventPinchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("touchmove", preventPinchZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("touchmove", preventPinchZoom);
      chatFocusStyle.remove();
      if (viewportMeta && previousViewport) viewportMeta.setAttribute("content", previousViewport);
    };
  }, []);

  const desktop = Platform.OS === "web" && width >= 1000;
  const isAuthRoute = segments[0] === "(auth)" || ["/login", "/register", "/forgot-password", "/verify-mfa", "/reset-password"].includes(pathname);
  const hideMobileNav = segments[0] !== "(tabs)";
  const showMobileFooter = !desktop && !isAuthRoute && !hideMobileNav && settings.showFooter;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.style.setProperty("--hayan-app-background", colors.background);
    document.documentElement.style.setProperty("--hayan-nav-background", colors.card);
  }, [colors.background, colors.card]);
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
        style={({ pressed }) => [compact ? styles.mobileItem : styles.sideItem, { backgroundColor: active && !compact ? "rgba(201,169,110,0.14)" : "transparent", opacity: pressed ? 0.78 : 1 }]}
      >
        <Feather name={item.icon} size={compact ? 20 : 18} color={active ? (compact ? colors.foreground : colors.primary) : colors.mutedForeground} />
        {!compact && <Text numberOfLines={1} style={[styles.sideLabel, { color: active ? colors.primary : colors.foreground }]}>{title}</Text>}
        {compact && settings.showNavLabels && <Text numberOfLines={1} style={[styles.mobileLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{title}</Text>}
      </Pressable>
    );
  };

  const mobileNav = (
    <View nativeID="hayan-mobile-nav" style={[styles.mobileNav, { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: Platform.OS === "web" ? 52 : settings.navHeight, paddingBottom: Platform.OS === "web" ? 0 : settings.footerHeight / 4 }]}>
      {mobileItems.map((item) => navItem(item, true))}
    </View>
  );

  if (Platform.OS !== "web") return <>{children}</>;

  return (
      <View nativeID="hayan-app-shell" style={[styles.root, { backgroundColor: colors.background }]}>
      {desktop && !isAuthRoute ? (
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
      {showMobileFooter && mobileNav}
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
  mobileItem: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10 },
  mobileLabel: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 0.2 },
});
