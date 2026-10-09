import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type BrandingSettings = {
  logoUrl: string;
  appIconUrl: string;
  logoWidth: number;
  logoHeight: number;
  headerPadding: number;
  navHeight: number;
  footerHeight: number;
  showLogo: boolean;
  brandName: string;
  brandTagline: string;
  showBrandName: boolean;
  showBrandTagline: boolean;
  showWelcome: boolean;
  showNavLabels: boolean;
  showFooter: boolean;
  welcomeText: string;
  navLabels: string[];
  navVisible: boolean[];
};

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: "",
  appIconUrl: "",
  logoWidth: 84,
  logoHeight: 66,
  headerPadding: 20,
  navHeight: 68,
  footerHeight: 28,
  showLogo: true,
  brandName: "HAYAN",
  brandTagline: "REAL ESTATE",
  showBrandName: true,
  showBrandTagline: true,
  showWelcome: true,
  showNavLabels: true,
  showFooter: true,
  welcomeText: "Welcome",
  navLabels: ["Discover", "Chat", "Alerts", "Profile"],
  navVisible: [true, true, true, true],
};

function normalize(value: unknown): BrandingSettings {
  if (!value || typeof value !== "object") return DEFAULT_BRANDING;
  const input = value as Partial<BrandingSettings>;
  const number = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  return {
    logoUrl: typeof input.logoUrl === "string" ? input.logoUrl.slice(0, 1000) : "",
    appIconUrl: typeof input.appIconUrl === "string" ? input.appIconUrl.slice(0, 1000) : "",
    logoWidth: number(input.logoWidth, 84, 40, 240),
    logoHeight: number(input.logoHeight, 66, 32, 180),
    headerPadding: number(input.headerPadding, 20, 8, 40),
    navHeight: number(input.navHeight, 68, 52, 100),
    footerHeight: number(input.footerHeight, 28, 20, 80),
    showLogo: input.showLogo !== false,
    brandName: typeof input.brandName === "string" ? input.brandName.slice(0, 32) : DEFAULT_BRANDING.brandName,
    brandTagline: typeof input.brandTagline === "string" ? input.brandTagline.slice(0, 48) : DEFAULT_BRANDING.brandTagline,
    showBrandName: input.showBrandName !== false,
    showBrandTagline: input.showBrandTagline !== false,
    showWelcome: input.showWelcome !== false,
    showNavLabels: input.showNavLabels !== false,
    showFooter: input.showFooter !== false,
    welcomeText: typeof input.welcomeText === "string" ? input.welcomeText.slice(0, 48) : "Welcome",
    navLabels: Array.from({ length: 4 }, (_, index) => typeof input.navLabels?.[index] === "string" ? input.navLabels[index].slice(0, 20) : DEFAULT_BRANDING.navLabels[index]),
    navVisible: Array.from({ length: 4 }, (_, index) => input.navVisible?.[index] !== false),
  };
}

type BrandingContextValue = {
  settings: BrandingSettings;
  isLoading: boolean;
  isSaving: boolean;
  syncError: string | null;
  updateDraft: (settings: BrandingSettings) => void;
  save: (draft?: BrandingSettings) => Promise<{ error?: string }>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    let active = true;
    const iconUrl = settings.appIconUrl || "/hayan-home-icon-v2-512.png";
    const ensureLink = (rel: string, sizes?: string) => {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ""}`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    };
    ensureLink("apple-touch-icon", "180x180");
    ensureLink("icon", "192x192");

    let manifestUrl: string | null = null;
    void fetch("/manifest.webmanifest").then((response) => response.json()).then((manifest) => {
      if (!active) return;
      manifest.icons = settings.appIconUrl
        ? [
            { src: settings.appIconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: settings.appIconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: settings.appIconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ]
        : [
            { src: "/hayan-home-icon-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/hayan-home-icon-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/hayan-home-icon-v2-maskable.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
          ];
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      manifestUrl = URL.createObjectURL(blob);
      const link = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (link) link.href = manifestUrl;
    }).catch(() => undefined);
    return () => {
      active = false;
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    };
  }, [settings.appIconUrl]);

  useEffect(() => {
    let active = true;
    if (!supabase) { setIsLoading(false); return; }
    void (async () => {
      try {
        const [local, remote] = await Promise.all([
          AsyncStorage.getItem("@hayan_branding_settings").catch(() => null),
          supabase.from("site_settings").select("value").eq("id", "branding").maybeSingle(),
        ]);
        if (!active) return;
        if (!remote.error && remote.data?.value) {
          const shared = normalize(remote.data.value);
          setSettings(shared);
          setSyncError(null);
          void AsyncStorage.setItem("@hayan_branding_settings", JSON.stringify(shared)).catch(() => undefined);
        } else if (local) {
          const localSettings = normalize(JSON.parse(local));
          setSettings(localSettings);
          // Migrate the admin's previous device-only design into shared storage
          // the first time the new shared settings table is available.
          if (user?.isAdmin && user.id) {
            const { error } = await supabase.from("site_settings").upsert(
              { id: "branding", value: localSettings, updated_by: user.id },
              { onConflict: "id" },
            );
            setSyncError(error ? `Shared sync failed: ${error.message}` : null);
          }
        } else if (remote.error) {
          setSyncError(`Shared settings could not be loaded: ${remote.error.message}`);
        }
      } catch {
        // Keep the built-in defaults if neither storage is available.
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id, user?.isAdmin]);

  const updateDraft = useCallback((draft: BrandingSettings) => setSettings(normalize(draft)), []);
  const save = useCallback(async (draft = settings) => {
    if (!user?.isAdmin) return { error: "Only an administrator can save app branding." };
    if (!supabase) {
      const message = "Supabase is not configured for shared app settings.";
      setSyncError(message);
      return { error: `App design was not saved: ${message}` };
    }
    setIsSaving(true);
    try {
      const nextSettings = normalize(draft);
      const { error } = await supabase.from("site_settings").upsert(
        { id: "branding", value: nextSettings, updated_by: user.id },
        { onConflict: "id" },
      );
      if (error) {
        setSyncError(`Shared sync failed: ${error.message}`);
        return { error: `App design was not saved: ${error.message}` };
      }
      await AsyncStorage.setItem("@hayan_branding_settings", JSON.stringify(nextSettings)).catch(() => undefined);
      setSettings(nextSettings);
      setSyncError(null);
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : "The shared settings request failed.";
      setSyncError(`Shared sync failed: ${message}`);
      return { error: `App design was not saved: ${message}` };
    } finally {
      setIsSaving(false);
    }
  }, [settings, user?.id, user?.isAdmin]);

  return <BrandingContext.Provider value={{ settings, isLoading, isSaving, syncError, updateDraft, save }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("useBranding must be used within BrandingProvider");
  return context;
}
