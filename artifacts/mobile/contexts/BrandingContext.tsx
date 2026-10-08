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
  updateDraft: (settings: BrandingSettings) => void;
  save: () => Promise<{ error?: string }>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        if (!remote.error && remote.data?.value) setSettings(normalize(remote.data.value));
        else if (local) setSettings(normalize(JSON.parse(local)));
      } catch {
        // Keep the built-in defaults if neither storage is available.
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const updateDraft = useCallback((draft: BrandingSettings) => setSettings(normalize(draft)), []);
  const save = useCallback(async () => {
    if (!user?.isAdmin) return { error: "Only an administrator can save app branding." };
    await AsyncStorage.setItem("@hayan_branding_settings", JSON.stringify(settings)).catch(() => undefined);
    if (!supabase) return { error: "Saved on this device. Supabase is not configured for shared app settings." };
    setIsSaving(true);
    const { error } = await supabase.from("site_settings").upsert({ id: "branding", value: settings, updated_by: user.id }, { onConflict: "id" });
    setIsSaving(false);
    return error ? { error: `Saved on this device only. Apply the site-settings database migration to publish changes to everyone. ${error.message}` } : {};
  }, [settings, user?.id, user?.isAdmin]);

  return <BrandingContext.Provider value={{ settings, isLoading, isSaving, updateDraft, save }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("useBranding must be used within BrandingProvider");
  return context;
}
