import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

export interface PublicProfile {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  bio?: string;
  publicPhone?: string;
  isVerified?: boolean;
}

interface FollowStats {
  followerCount: number;
  followingCount: number;
}

export function useFollowProfile(profileId: string) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<FollowStats>({ followerCount: 0, followingCount: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) throw new Error("Follow profiles requires a configured Supabase project.");
    const [profileResult, statsResult] = await Promise.all([
      supabase.from("public_profiles").select("id,name,role,avatar_url,bio,public_phone,is_verified").eq("id", profileId).maybeSingle(),
      supabase.rpc("get_public_follow_stats", { p_profile_id: profileId }),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (statsResult.error) throw new Error(statsResult.error.message);
    if (!profileResult.data) {
      setProfile(null);
      return;
    }

    const profileData = profileResult.data;
    setProfile({
      id: profileData.id,
      name: profileData.name ?? t("unknownUser"),
      role: profileData.role,
      avatarUrl: profileData.avatar_url ?? undefined,
      bio: profileData.bio ?? undefined,
      publicPhone: profileData.public_phone ?? undefined,
      isVerified: Boolean(profileData.is_verified),
    });
    const statsRow = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
    setStats({
      followerCount: Number(statsRow?.follower_count ?? 0),
      followingCount: Number(statsRow?.following_count ?? 0),
    });

    if (user && user.id !== profileId) {
      const { data, error: followError } = await supabase
        .from("profile_follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("followed_id", profileId)
        .maybeSingle();
      if (followError) throw new Error(followError.message);
      setIsFollowing(Boolean(data));
    } else {
      setIsFollowing(false);
    }
  }, [profileId, user?.id]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");
    void refresh()
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : t("profileUnavailable"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [refresh]);

  const toggleFollow = useCallback(async () => {
    if (!user || !supabase) throw new Error("Sign in to follow a seller or agent.");
    if (user.id === profileId) throw new Error("You cannot follow your own profile.");
    setIsSaving(true);
    try {
      const result = isFollowing
        ? await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("followed_id", profileId)
        : await supabase.from("profile_follows").insert({ follower_id: user.id, followed_id: profileId });
      if (result.error) throw new Error(result.error.message);
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }, [isFollowing, profileId, refresh, user?.id]);

  const getFollowList = useCallback(async (kind: "followers" | "following"): Promise<PublicProfile[]> => {
    if (!supabase) throw new Error("Follow profiles requires a configured Supabase project.");
    const column = kind === "followers" ? "followed_id" : "follower_id";
    const idColumn = kind === "followers" ? "follower_id" : "followed_id";
    const { data: followRows, error: followError } = await supabase
      .from("profile_follows")
      .select(idColumn)
      .eq(column, profileId)
      .order("created_at", { ascending: false });
    if (followError) throw new Error(followError.message);
    const profileIds = (followRows ?? []).map((row: any) => row[idColumn]);
    if (!profileIds.length) return [];
    const { data, error: profilesError } = await supabase
      .from("public_profiles")
      .select("id,name,role,avatar_url,bio,public_phone,is_verified")
      .in("id", profileIds);
    if (profilesError) throw new Error(profilesError.message);
    const profilesById = new Map((data ?? []).map((row) => [row.id, row]));
    return profileIds.flatMap((id: string) => {
      const row = profilesById.get(id);
      return row ? [{
        id: row.id,
        name: row.name ?? t("unknownUser"),
        role: row.role,
        avatarUrl: row.avatar_url ?? undefined,
        bio: row.bio ?? undefined,
        publicPhone: row.public_phone ?? undefined,
        isVerified: Boolean(row.is_verified),
      }] : [];
    });
  }, [profileId]);

  return { profile, stats, isFollowing, isLoading, isSaving, error, refresh, toggleFollow, getFollowList };
}
