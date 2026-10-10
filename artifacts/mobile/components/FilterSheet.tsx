import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FilterOptions, Property } from "@/constants/types";

const PROPERTY_TYPES: Property["type"][] = ["apartment", "house", "villa", "penthouse", "land"];

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApply: (f: FilterOptions) => void;
}

export function FilterSheet({ visible, onClose, filters, onApply }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const [local, setLocal] = useState<FilterOptions>(filters);

  const toggleType = (type: Property["type"]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = local.type || [];
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setLocal({ ...local, type: updated.length > 0 ? updated : undefined });
  };

  const apply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(local);
    onClose();
  };

  const clear = () => {
    setLocal({});
    onApply({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("filters")}</Text>
          <Pressable onPress={clear}>
            <Text style={[styles.clearText, { color: colors.primary }]}>{t("clear")}</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("listingType")}</Text>
          <View style={styles.row}>
            {(["sale", "rent"] as const).map((lt) => (
              <Pressable
                key={lt}
                style={[
                  styles.chip,
                  { borderColor: local.listingType === lt ? colors.foreground : colors.border, backgroundColor: local.listingType === lt ? colors.foreground : "transparent", borderRadius: 22 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLocal({ ...local, listingType: local.listingType === lt ? undefined : lt });
                }}
              >
                <Text style={[styles.chipText, { color: local.listingType === lt ? colors.background : colors.foreground }]}>
                  {lt === "sale" ? t("forSale") : t("forRent")}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("propertyType")}</Text>
          <View style={styles.row}>
            {PROPERTY_TYPES.map((pt) => {
              const selected = local.type?.includes(pt);
              return (
                <Pressable
                  key={pt}
                  style={[styles.chip, { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : "transparent" }]}
                  onPress={() => toggleType(pt)}
                >
                  <Text style={[styles.chipText, { color: selected ? colors.background : colors.foreground }]}>{t(pt)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("priceRange")}</Text>
          <View style={styles.priceRow}>
            <View style={[styles.priceInput, { borderColor: colors.border }]}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{t("minimum")}</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="$0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={local.minPrice?.toString() || ""}
                onChangeText={(t) => setLocal({ ...local, minPrice: t ? Number(t) : undefined })}
              />
            </View>
            <View style={[styles.priceDash, { backgroundColor: colors.border }]} />
            <View style={[styles.priceInput, { borderColor: colors.border }]}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{t("maximum")}</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder={t("noLimit")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={local.maxPrice?.toString() || ""}
                onChangeText={(t) => setLocal({ ...local, maxPrice: t ? Number(t) : undefined })}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("bedroomsFilter")}</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = local.minBedrooms === n;
              return (
                <Pressable
                  key={n}
                  style={[styles.numChip, { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : "transparent" }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLocal({ ...local, minBedrooms: selected ? undefined : n });
                  }}
                >
                  <Text style={[styles.chipText, { color: selected ? colors.background : colors.foreground }]}>{n}+</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("bathroomsFilter")}</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4].map((n) => {
              const selected = local.minBathrooms === n;
              return (
                <Pressable key={`bath-${n}`} style={[styles.numChip, { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : "transparent" }]} onPress={() => setLocal({ ...local, minBathrooms: selected ? undefined : n })}>
                  <Text style={[styles.chipText, { color: selected ? colors.background : colors.foreground }]}>{n}+</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("petFriendlyFilter")}</Text>
          <Pressable
            style={[styles.chip, { borderColor: local.petFriendly ? colors.foreground : colors.border, backgroundColor: local.petFriendly ? colors.foreground : "transparent", alignSelf: "flex-start", borderRadius: 22 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setLocal({ ...local, petFriendly: local.petFriendly ? undefined : true });
            }}
          >
            <Text style={[styles.chipText, { color: local.petFriendly ? colors.background : colors.foreground }]}>{t("petFriendlyOnly")}</Text>
          </Pressable>

          <Pressable
            style={[styles.chip, { borderColor: local.parking ? colors.foreground : colors.border, backgroundColor: local.parking ? colors.foreground : "transparent", alignSelf: "flex-start", marginTop: 8, borderRadius: 22 }]}
            onPress={() => setLocal({ ...local, parking: local.parking ? undefined : true })}
          >
            <Text style={[styles.chipText, { color: local.parking ? colors.background : colors.foreground }]}>{t("parkingAvailable")}</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("city")}</Text>
          <View style={[styles.cityInput, { borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.cityTextInput, { color: colors.foreground }]}
              placeholder={t("searchCity")}
              placeholderTextColor={colors.mutedForeground}
              value={local.city || ""}
              onChangeText={(t) => setLocal({ ...local, city: t || undefined })}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable style={[styles.applyBtn, { backgroundColor: colors.foreground, borderRadius: 28 }]} onPress={apply}>
            <Text style={[styles.applyText, { color: colors.background }]}>{t("applyFilters")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  clearText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, marginTop: 24, marginBottom: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1 },
  numChip: { width: 48, height: 42, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  priceInput: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  priceLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 1, marginBottom: 4 },
  input: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  priceDash: { width: 16, height: 1 },
  cityInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  cityTextInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 36 },
  applyBtn: { paddingVertical: 16, alignItems: "center" },
  applyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
});
