import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isLoading, user } = useAuth();

  if (isLoading) return null;

  return <Redirect href={(user ? "/(tabs)" : "/(auth)/get-started") as never} />;
}
