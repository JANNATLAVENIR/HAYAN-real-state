import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isLoading } = useAuth();

  if (isLoading) return null;

  return <Redirect href="/(tabs)" />;
}
