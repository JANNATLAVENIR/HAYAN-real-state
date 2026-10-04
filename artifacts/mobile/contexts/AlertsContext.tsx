import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { DalkaAlert } from "@/constants/types";
import { SEED_ALERTS } from "@/constants/seed";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface AlertsContextType {
  alerts: DalkaAlert[];
  unreadCount: number;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  addAlert: (alert: Omit<DalkaAlert, "id" | "timestamp" | "read">) => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType | null>(null);

const STORAGE_KEY = "@dalka_alerts";

function mapAlert(row: Record<string, any>): DalkaAlert {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    propertyId: row.property_id ?? undefined,
    read: Boolean(row.read_at),
    timestamp: row.created_at,
  };
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<DalkaAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        setAlerts((data ?? []).map(mapAlert));
      } else {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setAlerts(JSON.parse(stored));
        } else {
          setAlerts(SEED_ALERTS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ALERTS));
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    setAlerts([]);
    void loadAlerts();
  }, [authLoading, user?.id, loadAlerts]);

  useEffect(() => {
    if (authLoading || !isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("dalka-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        async (payload) => {
          const { data: authData } = await client.auth.getUser();
          const alert = payload.new as Record<string, any>;
          if (authData.user?.id !== alert.user_id) return;
          setAlerts((current) => {
            if (current.some((item) => item.id === alert.id)) return current;
            return [mapAlert(alert), ...current];
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  const saveAlerts = async (updated: DalkaAlert[]) => {
    setAlerts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const markAsRead = useCallback(async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, read: true } : alert));
      return;
    }

    const updated = alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
    await saveAlerts(updated);
  }, [alerts]);

  const markAllAsRead = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!data.user) throw new Error("Sign in to manage notifications");
      const { error } = await supabase.from("alerts").update({ read_at: new Date().toISOString() }).eq("user_id", data.user.id).is("read_at", null);
      if (error) throw new Error(error.message);
      setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
      return;
    }

    const updated = alerts.map((a) => ({ ...a, read: true }));
    await saveAlerts(updated);
  }, [alerts]);

  const deleteAlert = useCallback(async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("alerts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setAlerts((current) => current.filter((alert) => alert.id !== id));
      return;
    }

    const updated = alerts.filter((a) => a.id !== id);
    await saveAlerts(updated);
  }, [alerts]);

  const addAlert = useCallback(async (alert: Omit<DalkaAlert, "id" | "timestamp" | "read">) => {
    if (isSupabaseConfigured && supabase) {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("You must be signed in to create an alert");
      const { data, error } = await supabase.from("alerts").insert({
        user_id: authData.user.id,
        type: alert.type,
        title: alert.title,
        body: alert.body,
        property_id: alert.propertyId ?? null,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "Unable to create alert");
      setAlerts((current) => [mapAlert(data), ...current]);
      return;
    }

    const newAlert: DalkaAlert = {
      ...alert,
      id: "alert-" + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newAlert, ...alerts];
    await saveAlerts(updated);
  }, [alerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <AlertsContext.Provider value={{ alerts, unreadCount, isLoading, loadError, reload: loadAlerts, markAsRead, markAllAsRead, deleteAlert, addAlert }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
