import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const webAuthStorage = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, value); } catch { /* Storage can be disabled by the browser. */ }
  },
  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(key); } catch { /* Storage can be disabled by the browser. */ }
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: Platform.OS === "web" ? webAuthStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function uploadPropertyImage(uri: string, userId: string) {
  if (!supabase) throw new Error("Photo upload requires a configured Supabase project.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) throw new Error("Sign in again before uploading listing photos.");
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Unable to read the selected photo.");
  const blob = await response.blob();
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" } as Record<string, string>)[contentType];
  if (!extension) throw new Error("Choose a JPEG, PNG, WebP, or HEIC image.");
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const { error } = await supabase.storage.from("property-images").upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;
}
