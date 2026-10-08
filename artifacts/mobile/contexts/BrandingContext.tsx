import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type BrandingSettings = {
  logoUrl: string;
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
  save: () => Promise<{ error?: string }>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
  const save = useCallback(async () => {
    if (!user?.isAdmin) return { error: "Only an administrator can save app branding." };
    await AsyncStorage.setItem("@hayan_branding_settings", JSON.stringify(settings)).catch(() => undefined);
    if (!supabase) return { error: "Saved on this device. Supabase is not configured for shared app settings." };
    setIsSaving(true);
    const { error } = await supabase.from("site_settings").upsert({ id: "branding", value: settings, updated_by: user.id }, { onConflict: "id" });
    setIsSaving(false);
    setSyncError(error ? `Shared sync failed: ${error.message}` : null);
    return error ? { error: `Saved on this device only. Shared Supabase update failed: ${error.message}` } : {};
  }, [settings, user?.id, user?.isAdmin]);

  return <BrandingContext.Provider value={{ settings, isLoading, isSaving, syncError, updateDraft, save }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("useBranding must be used within BrandingProvider");
  return context;
}
