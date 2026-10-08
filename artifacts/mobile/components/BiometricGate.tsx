import * as LocalAuthentication from "expo-local-authentication";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { user, biometricEnabled } = useAuth();
  const { t } = useLanguage();
  const colors = useColors();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const previousState = useRef(AppState.currentState);

  useEffect(() => {
    setReady(false);
    const shouldLock = Boolean(user && biometricEnabled);
    setLocked(shouldLock); setError(""); setReady(true);
  }, [user?.id, biometricEnabled]);

  const authenticate = useCallback(async () => {
    setError("");
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: t("biometricUnlock"), cancelLabel: t("cancel"), disableDeviceFallback: false });
    if (result.success) setLocked(false);
    else if (result.error !== "user_cancel" && result.error !== "app_cancel") setError(t("biometricUnavailable"));
  }, [t]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previous = previousState.current;
      previousState.current = nextState;
      if (biometricEnabled && nextState === "active" && (previous === "inactive" || previous === "background")) {
        setLocked(true); setError("");
      }
    });
    return () => subscription.remove();
  }, [biometricEnabled]);

  useEffect(() => {
    if (ready && locked) void authenticate();
  }, [ready, locked, authenticate]);

  if (!ready) return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />;
  if (!locked) return <>{children}</>;
  return <View style={[styles.lock, { backgroundColor: colors.background }]}>
    <Image source={require("@/assets/images/hayan-logo.png")} contentFit="contain" style={styles.brandLogo} accessibilityLabel="HAYÁN Real Estate" />
    <Text style={[styles.title, { color: colors.foreground }]}>{t("biometricUnlock")}</Text>
    {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    <Pressable onPress={() => void authenticate()} style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
      <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("unlockApp")}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  lock: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 999, alignItems: "center", justifyContent: "center", padding: 28 },
  brandLogo: { width: 126, height: 100 }, title: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 16 },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 }, button: { minWidth: 190, alignItems: "center", paddingVertical: 15, paddingHorizontal: 20, marginTop: 22 }, buttonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
