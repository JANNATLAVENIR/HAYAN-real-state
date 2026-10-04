import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BiometricGate } from "@/components/BiometricGate";
import { AuthProvider } from "@/contexts/AuthContext";
import { ListingsProvider } from "@/contexts/ListingsContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { AlertsProvider } from "@/contexts/AlertsContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function RootLayoutNav() {
  const router = useRouter();
  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { propertyId?: string };
      if (data?.propertyId) router.push(`/property/${data.propertyId}`);
      else router.push("/(tabs)/alerts");
    });
    return () => responseSubscription.remove();
  }, [router]);

  return (
    <BiometricGate>
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="property/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="conversation/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="create-listing" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="schedule-viewing" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="edit-profile" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="change-password" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="reset-password" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="collections" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="viewings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notification-settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="security-settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="agents" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="mortgage-calculator" options={{ animation: "slide_from_right" }} />
    </Stack>
    </BiometricGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthProvider>
                  <ListingsProvider>
                    <ChatProvider>
                      <AlertsProvider>
                        <RootLayoutNav />
                      </AlertsProvider>
                    </ChatProvider>
                  </ListingsProvider>
                </AuthProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
