import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Review = { id: string; user_id: string; rating: number; comment: string; created_at: string; reviewerName: string };

export function AgentReviews({ agentId }: { agentId: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error: queryError } = await supabase.from("agent_reviews").select("id,user_id,rating,comment,created_at").eq("agent_id", agentId).order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); setLoading(false); return; }
    const rows = data ?? [];
    const ids = [...new Set(rows.map((row) => row.user_id))];
    const { data: profiles } = ids.length ? await supabase.from("public_profiles").select("id,name").in("id", ids) : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]));
    setReviews(rows.map((row) => ({ ...row, reviewerName: names.get(row.user_id) ?? t("reviewer") })));
    const own = rows.find((row) => row.user_id === user?.id);
    if (own) { setRating(own.rating); setComment(own.comment); }
    setLoading(false);
  }, [agentId, user?.id, t]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!user || !supabase) { Alert.alert(t("signInRequired"), t("reviewSignIn")); return; }
    const trimmed = comment.trim();
    if (!trimmed) { Alert.alert(t("reviewTitle"), t("reviewRequired")); return; }
    setSaving(true);
    const { error: saveError } = await supabase.from("agent_reviews").upsert({ agent_id: agentId, user_id: user.id, rating, comment: trimmed }, { onConflict: "agent_id,user_id" });
    setSaving(false);
    if (saveError) Alert.alert(t("reviewTitle"), saveError.message);
    else { setError(""); await load(); }
  };

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  return <View style={[styles.container, { borderTopColor: colors.border }]}>
    <View style={styles.headingRow}><Text style={[styles.heading, { color: colors.foreground }]}>{t("agentReviews")}</Text>
      {average ? <View style={styles.average}><Feather name="star" size={15} color={colors.primary} /><Text style={[styles.averageText, { color: colors.foreground }]}>{average} ({reviews.length})</Text></View> : null}
    </View>
    {user && user.id !== agentId ? <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.foreground }]}>{t("yourRating")}</Text>
      <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityLabel={`${value} ${t("stars")}`} onPress={() => setRating(value)} hitSlop={5}><Feather name="star" size={24} color={value <= rating ? colors.primary : colors.muted} /></Pressable>)}</View>
      <TextInput value={comment} onChangeText={setComment} multiline maxLength={1200} placeholder={t("writeReview")} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
      <Pressable disabled={saving} onPress={() => void submit()} style={[styles.submit, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]}>
        {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{t("submitReview")}</Text>}
      </Pressable>
    </View> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 18 }} /> : null}
    {error ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{error}</Text> : null}
    {!loading && reviews.length === 0 && !error ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("noReviews")}</Text> : null}
    {reviews.map((review) => <View key={review.id} style={[styles.review, { borderBottomColor: colors.border }]}>
      <View style={styles.reviewHeader}><Text style={[styles.reviewer, { color: colors.foreground }]}>{review.reviewerName}</Text><View style={styles.starsSmall}>{Array.from({ length: review.rating }, (_, index) => <Feather key={index} name="star" size={12} color={colors.primary} />)}</View></View>
      <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>{review.comment}</Text>
      <Text style={[styles.date, { color: colors.mutedForeground }]}>{new Date(review.created_at).toLocaleDateString()}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { marginTop: 24, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  heading: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 2 },
  average: { flexDirection: "row", alignItems: "center", gap: 5 }, averageText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  form: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 }, label: { fontFamily: "Inter_500Medium", fontSize: 13 },
  stars: { flexDirection: "row", gap: 8, marginVertical: 10 }, starsSmall: { flexDirection: "row", gap: 2 },
  input: { minHeight: 76, borderWidth: 1, borderRadius: 8, padding: 10, textAlignVertical: "top", fontFamily: "Inter_400Regular", fontSize: 13 },
  submit: { alignSelf: "flex-end", minWidth: 120, marginTop: 10, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 7, alignItems: "center" },
  submitText: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 0.5 },
  muted: { fontFamily: "Inter_400Regular", fontSize: 13, paddingVertical: 12 },
  review: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth }, reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewer: { fontFamily: "Inter_600SemiBold", fontSize: 13 }, reviewText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 8 }, date: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 6 },
});
