import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { User } from "@/constants/types";
import { isPasswordRecoveryActive, isSupabaseConfigured, setPasswordRecoveryActive, supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; needsMfa?: boolean; needsAdminApproval?: boolean; accountRejected?: boolean; error?: string }>;
  startMfaChallenge: () => Promise<{ factorId: string; challengeId: string }>;
  verifyMfa: (factorId: string, challengeId: string, code: string) => Promise<{ success: boolean; needsAdminApproval?: boolean; accountRejected?: boolean; error?: string }>;
  register: (data: { email: string; password: string; name: string; phone: string; role: User["role"] }) => Promise<{ success: boolean; needsEmailConfirmation?: boolean; needsAdminApproval?: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  toggleBookmark: (propertyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const UNCONFIGURED_ERROR = "Authentication is unavailable until the Supabase project is configured.";
const biometricKey = (userId: string) => `@dalka_biometric_lock_${userId}`;

async function loadSupabaseUser(id: string, email: string, metadata: Record<string, unknown>): Promise<User> {
  if (!supabase) throw new Error(UNCONFIGURED_ERROR);
  const [{ data: profile, error: profileError }, { data: bookmarkRows, error: bookmarksError }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookmarks").select("property_id").eq("user_id", id),
    supabase.from("admin_users").select("is_active").eq("user_id", id).maybeSingle(),
  ]);
  if (profileError) throw new Error(profileError.message);
  if (bookmarksError) throw new Error(bookmarksError.message);
  if (!profile) throw new Error("Your account profile is missing. Contact HAYAN support to restore access.");
  if (profile.approval_status !== "pending" && profile.approval_status !== "approved" && profile.approval_status !== "rejected") {
    throw new Error("Your account approval status is unavailable. Contact HAYAN support.");
  }
  return {
    id,
    email,
    name: profile?.name ?? String(metadata.name ?? email.split("@")[0]),
    phone: profile?.phone ?? String(metadata.phone ?? ""),
    role: (profile?.role ?? "buyer") as User["role"],
    avatar: profile?.avatar_url ?? undefined,
    bio: profile?.bio ?? undefined,
    phoneVisibleToPublic: Boolean(profile?.phone_visible_to_public),
    isVerified: Boolean(profile?.is_verified),
    savedSearches: [],
    bookmarks: (bookmarkRows ?? []).map((bookmark) => bookmark.property_id),
    isAdmin: Boolean(adminRow?.is_active),
    isSuspended: Boolean(profile?.is_suspended),
    approvalStatus: profile.approval_status,
  };
}

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true, isAuthenticated: false });
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  const refreshSessionUser = useCallback(async (): Promise<User | null> => {
    if (!supabase) {
      setBiometricEnabledState(false);
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      setBiometricEnabledState(false);
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    }
    const authUser = data.session.user;
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      setBiometricEnabledState(false);
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    }
    const user = await loadSupabaseUser(authUser.id, authUser.email ?? "", authUser.user_metadata ?? {});
    const localBiometric = await SecureStore.getItemAsync(biometricKey(authUser.id)).catch(() => null);
    setBiometricEnabledState(localBiometric === "enabled");
    if (user.approvalStatus !== "approved") {
      setBiometricEnabledState(false);
      setState({ user: null, isLoading: false, isAuthenticated: false });
      void supabase.auth.signOut().catch(() => undefined);
      return user;
    }
    if (user.isSuspended) {
      setBiometricEnabledState(false);
      setState({ user: null, isLoading: false, isAuthenticated: false });
      void supabase.auth.signOut().catch(() => undefined);
      return null;
    }
    setState({ user, isLoading: false, isAuthenticated: true });
    return user;
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !supabase) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // Keep the temporary recovery session alive for the reset form. Normal
      // profile approval checks resume after updateUser emits USER_UPDATED.
      if (event === "PASSWORD_RECOVERY" || isPasswordRecoveryActive()) {
        setBiometricEnabledState(false);
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }
      if (!session?.user) {
        setBiometricEnabledState(false);
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }
      // Defer Supabase queries so they do not run inside its auth event lock.
      setTimeout(() => {
        if (active) void refreshSessionUser().catch(() => setState((current) => ({ ...current, isLoading: false })));
      }, 0);
    });
    void refreshSessionUser().catch(() => setState({ user: null, isLoading: false, isAuthenticated: false }));
    return () => { active = false; subscription.unsubscribe(); };
  }, [refreshSessionUser]);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) return { success: false, error: UNCONFIGURED_ERROR };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return { success: false, error: error.message };
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) return { success: false, error: assuranceError.message };
      if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") return { success: true, needsMfa: true };
      const user = await refreshSessionUser();
      if (user?.approvalStatus === "pending") return { success: false, needsAdminApproval: true };
      if (user?.approvalStatus === "rejected") return { success: false, accountRejected: true };
      if (!user) return { success: false, error: "This account has been suspended. Contact HAYÁN support." };
      return { success: true };
    } catch (error) { return { success: false, error: friendlyError(error) }; }
  }, [refreshSessionUser]);

  const startMfaChallenge = useCallback(async () => {
    if (!supabase) throw new Error(UNCONFIGURED_ERROR);
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const factor = factors.totp.find((item) => item.status === "verified");
    if (!factor) throw new Error("No verified authenticator factor is available for this account.");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) throw challengeError;
    return { factorId: factor.id, challengeId: challenge.id };
  }, []);

  const verifyMfa = useCallback(async (factorId: string, challengeId: string, code: string) => {
    if (!supabase) return { success: false, error: UNCONFIGURED_ERROR };
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
    if (error) return { success: false, error: error.message };
    const user = await refreshSessionUser();
    if (user?.approvalStatus === "pending") return { success: false, needsAdminApproval: true };
    if (user?.approvalStatus === "rejected") return { success: false, accountRejected: true };
    return user ? { success: true } : { success: false, error: "Second-factor verification could not complete sign-in." };
  }, [refreshSessionUser]);

  const register = useCallback(async (data: { email: string; password: string; name: string; phone: string; role: User["role"] }) => {
    if (!supabase) return { success: false, error: UNCONFIGURED_ERROR };
    try {
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(), password: data.password,
        options: { data: { name: data.name.trim(), phone: data.phone.trim(), role: data.role } },
      });
      if (error) return { success: false, error: error.message };
      if (!result.session) return { success: true, needsEmailConfirmation: true };
      const user = await refreshSessionUser();
      if (user?.approvalStatus === "pending") return { success: true, needsAdminApproval: true };
      if (user?.approvalStatus === "rejected") return { success: false, error: "This account request was declined." };
      return user ? { success: true } : { success: false, error: "Your account could not be loaded. Please try signing in." };
    } catch (error) { return { success: false, error: friendlyError(error) }; }
  }, [refreshSessionUser]);

  const forgotPassword = useCallback(async (email: string) => {
    if (!supabase) return { success: false, error: UNCONFIGURED_ERROR };
    const redirectTo = Platform.OS === "web" && typeof window !== "undefined"
      ? new URL("/reset-password", window.location.origin).toString()
      : "dalka://reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    return error ? { success: false, error: error.message } : { success: true };
  }, []);

  const resetPassword = useCallback(async (newPassword: string) => {
    if (!supabase) return { success: false, error: UNCONFIGURED_ERROR };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    setPasswordRecoveryActive(false);
    try { await refreshSessionUser(); } catch { /* The password has been updated; sign-in can reload the profile. */ }
    return { success: true };
  }, [refreshSessionUser]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!supabase || !state.user) return { success: false, error: state.user ? UNCONFIGURED_ERROR : "Not authenticated" };
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: state.user.email, password: oldPassword });
    if (verifyError) return { success: false, error: "Current password is incorrect" };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { success: false, error: error.message } : { success: true };
  }, [state.user]);

  const logout = useCallback(async () => {
    setBiometricEnabledState(false);
    setState({ user: null, isLoading: false, isAuthenticated: false });
    if (supabase) {
      void supabase.auth.signOut().catch(() => undefined);
    }
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (!state.user) throw new Error("Not authenticated");
    if (enabled) await SecureStore.setItemAsync(biometricKey(state.user.id), "enabled");
    else await SecureStore.deleteItemAsync(biometricKey(state.user.id));
    setBiometricEnabledState(enabled);
  }, [state.user?.id]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!state.user || !supabase) throw new Error(!state.user ? "Not authenticated" : UNCONFIGURED_ERROR);
    const allowed = {
      name: updates.name,
      phone: updates.phone,
      bio: updates.bio,
      avatar_url: updates.avatar,
      phone_visible_to_public: updates.phoneVisibleToPublic,
    };
    const payload = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
    const { error } = await supabase.from("profiles").update(payload).eq("id", state.user.id);
    if (error) throw new Error(error.message);
    setState((current) => current.user ? { ...current, user: { ...current.user, ...updates } } : current);
  }, [state.user]);

  const toggleBookmark = useCallback(async (propertyId: string) => {
    if (!state.user || !supabase) throw new Error(!state.user ? "Not authenticated" : UNCONFIGURED_ERROR);
    const isBookmarked = state.user.bookmarks.includes(propertyId);
    const result = isBookmarked
      ? await supabase.from("bookmarks").delete().eq("user_id", state.user.id).eq("property_id", propertyId)
      : await supabase.from("bookmarks").insert({ user_id: state.user.id, property_id: propertyId });
    if (result.error) throw new Error(result.error.message);
    const bookmarks = isBookmarked ? state.user.bookmarks.filter((id) => id !== propertyId) : [...state.user.bookmarks, propertyId];
    setState((current) => current.user ? { ...current, user: { ...current.user, bookmarks } } : current);
  }, [state.user]);

  return <AuthContext.Provider value={{ ...state, biometricEnabled, setBiometricEnabled, login, startMfaChallenge, verifyMfa, register, forgotPassword, resetPassword, changePassword, logout, updateProfile, toggleBookmark }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
