import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardTypeOptions, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";

function NumericField({ label, value, onChangeText, keyboardType, colors }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType: KeyboardTypeOptions; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.field}>
    <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    <TextInput value={value} onChangeText={(text) => onChangeText(text.replace(/[^0-9.]/g, ""))} keyboardType={keyboardType} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
  </View>;
}

export default function MortgageCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { language, t } = useLanguage();
  const [price, setPrice] = useState("150000");
  const [downPayment, setDownPayment] = useState("20");
  const [interest, setInterest] = useState("7");
  const [term, setTerm] = useState("20");
  const locale = language === "so" ? "so-SO" : "en-US";
  const values = useMemo(() => {
    const total = Math.max(0, Number(price) || 0);
    const down = Math.min(100, Math.max(0, Number(downPayment) || 0));
    const principal = total * (1 - down / 100);
    const months = Math.max(1, (Number(term) || 1) * 12);
    const monthlyRate = Math.max(0, Number(interest) || 0) / 1200;
    const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    return { principal, payment };
  }, [price, downPayment, interest, term]);
  const currency = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel={t("goHome")} onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("mortgageCalculator")}</Text><View style={{ width: 22 }} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
      <NumericField label={t("homePrice")} value={price} onChangeText={setPrice} keyboardType="decimal-pad" colors={colors} />
      <NumericField label={t("downPaymentPercent")} value={downPayment} onChangeText={setDownPayment} keyboardType="decimal-pad" colors={colors} />
      <NumericField label={t("annualInterest")} value={interest} onChangeText={setInterest} keyboardType="decimal-pad" colors={colors} />
      <NumericField label={t("loanTermYears")} value={term} onChangeText={setTerm} keyboardType="number-pad" colors={colors} />
      <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{t("monthlyPaymentEstimate")}</Text>
        <Text style={[styles.payment, { color: colors.primary }]}>{currency(values.payment)}</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.loanLabel, { color: colors.mutedForeground }]}>{t("loanAmount")}</Text>
        <Text style={[styles.loan, { color: colors.foreground }]}>{currency(values.principal)}</Text>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontFamily: "Inter_600SemiBold", fontSize: 14, letterSpacing: 1.5 },
  field: { marginBottom: 18 }, label: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, marginBottom: 7 }, input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 11, fontSize: 16, fontFamily: "Inter_500Medium" },
  result: { borderWidth: 1, padding: 22, alignItems: "center", marginTop: 12 }, resultLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.2, textAlign: "center" }, payment: { fontFamily: "Inter_700Bold", fontSize: 34, marginTop: 10 }, divider: { height: 1, alignSelf: "stretch", marginVertical: 20 }, loanLabel: { fontFamily: "Inter_500Medium", fontSize: 12 }, loan: { fontFamily: "Inter_600SemiBold", fontSize: 20, marginTop: 6 },
});
