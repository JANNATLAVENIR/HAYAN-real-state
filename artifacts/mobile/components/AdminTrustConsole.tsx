import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ListingReport = {
  id: string;
  propertyId: string;
  reporterId: string;
  propertyTitle: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};
type VerificationRequest = { id: string; userId: string; userName: string; userEmail: string; message: string; createdAt: string; status: string };
type AuditEntry = { id: number; action: string; targetType: string; targetId: string | null; createdAt: string };

export function AdminTrustConsole() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.isAdmin || !supabase || !isSupabaseConfigured) return;
    setLoading(true);
    setLoadError("");
    try {
      const [reportsResult, verificationResult, historyResult] = await Promise.all([
        supabase.from("property_reports").select("id,property_id,reporter_id,reason,details,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("seller_verification_requests").select("id,user_id,message,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("admin_action_logs").select("id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      const error = reportsResult.error ?? verificationResult.error ?? historyResult.error;
      if (error) throw new Error(error.message);
      const reportRows = reportsResult.data ?? [];
      const requestRows = verificationResult.data ?? [];
      const propertyIds = [...new Set(reportRows.map((row: any) => row.property_id))];
      const profileIds = [...new Set([
        ...reportRows.map((row: any) => row.reporter_id),
        ...requestRows.map((row: any) => row.user_id),
      ])];
      const [{ data: properties, error: propertyError }, { data: profiles, error: profileError }] = await Promise.all([
        propertyIds.length ? supabase.from("properties").select("id,title").in("id", propertyIds) : Promise.resolve({ data: [], error: null }),
        profileIds.length ? supabase.from("profiles").select("id,name,email").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (propertyError) throw new Error(propertyError.message);
      if (profileError) throw new Error(profileError.message);
      const propertyById = new Map((properties ?? []).map((row: any) => [row.id, row.title]));
      const profileById = new Map((profiles ?? []).map((row: any) => [row.id, row]));
      setReports(reportRows.map((row: any) => ({
        id: row.id, propertyId: row.property_id, reporterId: row.reporter_id,
        propertyTitle: propertyById.get(row.property_id) ?? row.property_id.slice(0, 8),
        reason: row.reason, details: row.details ?? "", status: row.status, createdAt: row.created_at,
      })));
      setVerificationRequests(requestRows.map((row: any) => {
        const profile = profileById.get(row.user_id);
        return { id: row.id, userId: row.user_id, userName: profile?.name ?? row.user_id.slice(0, 8), userEmail: profile?.email ?? "", message: row.message, createdAt: row.created_at, status: row.status };
      }));
      setHistory((historyResult.data ?? []).map((row: any) => ({
        id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, createdAt: row.created_at,
      })));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("verificationRequired"));
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, t]);

  useEffect(() => { void load(); }, [load]);

  const updateReport = async (report: ListingReport, status: "reviewing" | "resolved" | "dismissed") => {
    if (!supabase) return;
    const { error } = await supabase.from("property_reports").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", report.id);
    if (error) return Alert.alert(t("updateFailed"), error.message);
    setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item));
    void load();
  };

  const decideVerification = async (request: VerificationRequest, status: "approved" | "rejected") => {
    if (!supabase) {
      setLoadError(t("verificationRequired"));
      return;
    }
    const { error } = await supabase.from("seller_verification_requests").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    if (error) {
      setLoadError(`${t("updateFailed")}: ${error.message}`);
      return;
    }
    setReviewingRequestId(null);
    setVerificationRequests((current) => current.filter((item) => item.id !== request.id));
    void load();
  };

  if (!user?.isAdmin) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("listingReports")} ({reports.filter((item) => item.status === "open" || item.status === "reviewing").length})</Text>
        <Pressable onPress={() => void load()} accessibilityLabel={t("refreshSchedule")}><Feather name="refresh-cw" size={17} color={colors.primary} /></Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : loadError ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>{loadError}</Text>
      ) : reports.length === 0 ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("noNotifications")}</Text> : reports.map((report) => (
        <View key={report.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardTop}>
            <View style={styles.copy}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{report.propertyTitle}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t(reportReasonKey(report.reason))} · {t(report.status as never)}</Text>
              {report.details ? <Text style={[styles.details, { color: colors.foreground }]}>{report.details}</Text> : null}
            </View>
            <Pressable onPress={() => router.push({ pathname: "/property/[id]", params: { id: report.propertyId } })}><Feather name="external-link" size={17} color={colors.primary} /></Pressable>
          </View>
          {report.status === "open" || report.status === "reviewing" ? (
            <View style={styles.actions}>
              {report.status === "open" ? <Pressable onPress={() => void updateReport(report, "reviewing")}><Text style={[styles.actionText, { color: colors.primary }]}>{t("markReviewing")}</Text></Pressable> : null}
              <Pressable onPress={() => void updateReport(report, "resolved")}><Text style={[styles.actionText, { color: colors.primary }]}>{t("resolveReport")}</Text></Pressable>
              <Pressable onPress={() => void updateReport(report, "dismissed")}><Text style={[styles.actionText, { color: colors.destructive }]}>{t("dismissReport")}</Text></Pressable>
            </View>
          ) : null}
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 22 }]}>{t("verificationRequests")} ({verificationRequests.length})</Text>
      {verificationRequests.filter((item) => item.status === "pending").map((request) => (
        <View key={request.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{request.userName}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{request.userEmail}</Text>
          <Text style={[styles.details, { color: colors.foreground }]}>{request.message}</Text>
          {reviewingRequestId === request.id ? (
            <>
              <Text style={[styles.details, { color: colors.mutedForeground }]}>{t("verificationChecklist")}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => setReviewingRequestId(null)}><Text style={[styles.actionText, { color: colors.mutedForeground }]}>{t("cancel")}</Text></Pressable>
                <Pressable onPress={() => void decideVerification(request, "rejected")}><Text style={[styles.actionText, { color: colors.destructive }]}>{t("rejected")}</Text></Pressable>
                <Pressable onPress={() => void decideVerification(request, "approved")}><Text style={[styles.actionText, { color: colors.primary }]}>{t("verifiedSeller")}</Text></Pressable>
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={() => setReviewingRequestId(request.id)}><Text style={[styles.actionText, { color: colors.primary }]}>{t("reviewing")}</Text></Pressable>
            </View>
          )}
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 22 }]}>{t("actionHistory")}</Text>
      {history.map((entry) => (
        <View key={entry.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.details, { color: colors.foreground, flex: 1 }]}>{entry.action.replaceAll("_", " ")}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{new Date(entry.createdAt).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  );
}

function reportReasonKey(reason: string): "incorrectInformation" | "listingUnavailable" | "fraudSuspicion" | "inappropriateListing" | "otherReason" {
  switch (reason) {
    case "incorrect_information": return "incorrectInformation";
    case "unavailable": return "listingUnavailable";
    case "fraud_suspicion": return "fraudSuspicion";
    case "inappropriate": return "inappropriateListing";
    default: return "otherReason";
  }
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 1.4, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 9 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  copy: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  muted: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  details: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 7 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 10 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  historyRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

