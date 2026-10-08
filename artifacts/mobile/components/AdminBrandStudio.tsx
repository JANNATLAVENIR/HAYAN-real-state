import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { DEFAULT_BRANDING, useBranding, type BrandingSettings } from "@/contexts/BrandingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPropertyImage } from "@/lib/supabase";

const logoAsset = require("@/assets/images/hayan-logo.png");

export function AdminBrandStudio() {
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { settings, isLoading, isSaving, updateDraft, save } = useBranding();
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  const change = (key: keyof BrandingSettings, amount: number) => {
    const value = settings[key];
    if (typeof value === "number") updateDraft({ ...settings, [key]: value + amount });
  };
  const toggle = (key: keyof BrandingSettings) => {
    const value = settings[key];
    if (typeof value === "boolean") updateDraft({ ...settings, [key]: !value });
  };
  const saveSettings = async () => {
    const result = await save();
    if (result.error) Alert.alert(t("updateFailed"), result.error);
    else Alert.alert("Saved", "Your app layout has been updated.");
  };
  const uploadLogo = async () => {
    if (!user) return;
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.9 });
    if (selection.canceled || !selection.assets[0]) return;
    setUploadingLogo(true);
    try {
      const logoUrl = await uploadPropertyImage(selection.assets[0].uri, user.id);
      updateDraft({ ...settings, logoUrl });
    } catch (error) {
      Alert.alert("Logo upload failed", error instanceof Error ? error.message : "Choose another image and try again.");
    } finally { setUploadingLogo(false); }
  };

  const numberControl = (label: string, key: keyof BrandingSettings, unit = "px") => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]} key={String(key)}>
      <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => change(key, -4)} style={[styles.stepButton, { borderColor: colors.border }]}><Feather name="minus" size={16} color={colors.foreground} /></Pressable>
        <Text style={[styles.valueText, { color: colors.foreground }]}>{settings[key]} {unit}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => change(key, 4)} style={[styles.stepButton, { borderColor: colors.border }]}><Feather name="plus" size={16} color={colors.foreground} /></Pressable>
      </View>
    </View>
  );

  const toggleRow = (label: string, key: keyof BrandingSettings) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]} key={String(key)}>
      <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch value={Boolean(settings[key])} onValueChange={() => toggle(key)} trackColor={{ false: colors.border, true: colors.primary }} />
    </View>
  );

  const navEditor = (index: number) => (
    <View key={`nav-${index}`} style={[styles.navEditRow, { borderBottomColor: colors.border }]}>
      <Switch value={settings.navVisible[index]} onValueChange={() => {
        const navVisible = [...settings.navVisible]; navVisible[index] = !navVisible[index]; updateDraft({ ...settings, navVisible });
      }} trackColor={{ false: colors.border, true: colors.primary }} />
      <TextInput value={settings.navLabels[index]} onChangeText={(value) => {
        const navLabels = [...settings.navLabels]; navLabels[index] = value; updateDraft({ ...settings, navLabels });
      }} placeholder={["Discover", "Chat", "Alerts", "Profile"][index]} placeholderTextColor={colors.mutedForeground} style={[styles.navInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
    </View>
  );

  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.sectionHeading}>
        <View style={[styles.headingIcon, { backgroundColor: colors.secondary }]}><Feather name="layout" size={18} color={colors.primary} /></View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Brand & layout</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Preview and adjust the app without editing code.</Text>
        </View>
      </View>

      <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: "#F3F4F6" }]}>
        <View style={styles.previewTopline}><Feather name="smartphone" size={14} color={colors.mutedForeground} /><Text style={[styles.previewCaption, { color: colors.mutedForeground }]}>LIVE MOBILE PREVIEW</Text></View>
        <View style={styles.phone}>
          <View style={[styles.phoneHeader, { minHeight: settings.headerPadding * 2 + Math.min(settings.logoHeight, 88), paddingHorizontal: 16 }]}>
            <View style={styles.previewBrand}>
              {settings.showLogo ? <Image source={settings.logoUrl ? { uri: settings.logoUrl } : logoAsset} contentFit="contain" style={{ width: Math.min(settings.logoWidth, 190), height: Math.min(settings.logoHeight, 88) }} /> : null}
              {settings.showWelcome ? <Text style={styles.previewWelcome}>{settings.welcomeText}, Hayan</Text> : null}
            </View>
            <Feather name="sliders" size={18} color="#27292D" />
          </View>
          <View style={styles.previewContent}>
            <Text style={styles.previewDiscover}>Discover</Text>
            <View style={styles.searchMock}><Feather name="search" size={14} color="#898B8F" /><Text style={styles.searchText}>Search properties...</Text></View>
            <View style={styles.propertyMock}><View style={styles.propertyPhoto} /><View style={styles.propertyLines}><View style={styles.mockLineWide} /><View style={styles.mockLine} /><View style={styles.mockLineShort} /></View></View>
            <View style={styles.propertyMock}><View style={[styles.propertyPhoto, { backgroundColor: "#DFD7CC" }]} /><View style={styles.propertyLines}><View style={styles.mockLineWide} /><View style={styles.mockLine} /><View style={styles.mockLineShort} /></View></View>
          </View>
          {settings.showFooter ? <View style={[styles.previewNav, { height: settings.navHeight, paddingBottom: settings.footerHeight / 4 }]}>
          {["search", "message-circle", "bell", "user"].map((icon, index) => settings.navVisible[index] ? <View key={icon} style={styles.previewNavItem}><Feather name={icon as any} size={16} color={index === 0 ? "#B89967" : "#85878B"} />{settings.showNavLabels ? <Text style={[styles.previewNavLabel, index === 0 && { color: "#B89967" }]}>{settings.navLabels[index]}</Text> : null}</View> : null)}
          </View> : null}
        </View>
      </View>

      <View style={[styles.controlsCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.groupTitle, { color: colors.foreground }]}>LOGO & HEADER</Text>
        <Pressable disabled={uploadingLogo} onPress={() => void uploadLogo()} style={[styles.uploadButton, { borderColor: colors.border }]}>
          {uploadingLogo ? <ActivityIndicator color={colors.primary} /> : <Feather name="upload" size={15} color={colors.primary} />}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>{uploadingLogo ? "UPLOADING LOGO..." : "UPLOAD A LOGO IMAGE"}</Text>
        </Pressable>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Custom logo image URL</Text>
        <TextInput value={settings.logoUrl} onChangeText={(logoUrl) => updateDraft({ ...settings, logoUrl })} placeholder="Paste a public image URL (optional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.urlInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Welcome text</Text>
        <TextInput value={settings.welcomeText} onChangeText={(welcomeText) => updateDraft({ ...settings, welcomeText })} placeholder="Welcome" placeholderTextColor={colors.mutedForeground} style={[styles.urlInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
        {numberControl("Logo width", "logoWidth")}
        {numberControl("Logo height", "logoHeight")}
        {numberControl("Header spacing", "headerPadding")}
        {toggleRow("Show logo", "showLogo")}
        {toggleRow("Show welcome text", "showWelcome")}

        <Text style={[styles.groupTitle, { color: colors.foreground, marginTop: 18 }]}>NAVIGATION & FOOTER</Text>
        {numberControl("Navigation height", "navHeight")}
        {numberControl("Footer safe spacing", "footerHeight")}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Navigation labels and visibility</Text>
        {[0, 1, 2, 3].map(navEditor)}
        {toggleRow("Show navigation labels", "showNavLabels")}
        {toggleRow("Show bottom navigation", "showFooter")}

        <Pressable disabled={isSaving || isLoading} onPress={() => void saveSettings()} style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving || isLoading ? 0.7 : 1 }]}>
          {isSaving || isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="save" size={16} color={colors.primaryForeground} />}
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{isLoading ? "LOADING SETTINGS" : isSaving ? "SAVING..." : "SAVE APP DESIGN"}</Text>
        </Pressable>
        <Pressable onPress={() => updateDraft(DEFAULT_BRANDING)} style={styles.resetButton}><Text style={[styles.resetText, { color: colors.mutedForeground }]}>Reset preview to defaults</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 24 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 18 },
  headingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1 }, title: { fontSize: 17, fontFamily: "Inter_600SemiBold" }, subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  previewCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginHorizontal: 16, marginBottom: 16 },
  previewTopline: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 }, previewCaption: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1.1 },
  phone: { width: "100%", maxWidth: 330, alignSelf: "center", height: 425, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 5, borderColor: "#26282C" },
  phoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8E8E8" }, previewBrand: { gap: 3 }, previewWelcome: { color: "#77797D", fontSize: 10, fontFamily: "Inter_400Regular" },
  previewContent: { flex: 1, paddingHorizontal: 14, paddingTop: 12 }, previewDiscover: { color: "#26282C", fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  searchMock: { height: 35, borderWidth: 1, borderColor: "#ECEDEF", borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 9, marginBottom: 11 }, searchText: { color: "#9A9B9E", fontSize: 10 },
  propertyMock: { height: 94, borderRadius: 9, backgroundColor: "#F8F7F5", marginBottom: 9, flexDirection: "row", padding: 7, gap: 9 }, propertyPhoto: { width: 96, borderRadius: 6, backgroundColor: "#D8D2C7" }, propertyLines: { flex: 1, gap: 7, paddingTop: 8 }, mockLineWide: { width: "88%", height: 8, borderRadius: 4, backgroundColor: "#C9CBCD" }, mockLine: { width: "68%", height: 6, borderRadius: 4, backgroundColor: "#E1E2E3" }, mockLineShort: { width: "44%", height: 6, borderRadius: 4, backgroundColor: "#E1E2E3" },
  previewNav: { borderTopWidth: 1, borderTopColor: "#E8E8E8", flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 8 }, previewNavItem: { alignItems: "center", gap: 3 }, previewNavLabel: { fontSize: 8, color: "#85878B" },
  controlsCard: { borderWidth: 1, borderRadius: 14, marginHorizontal: 16, padding: 14, marginBottom: 20 }, groupTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.3, marginBottom: 8 }, fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 }, urlInput: { borderWidth: 1, borderRadius: 8, minHeight: 42, paddingHorizontal: 11, fontSize: 12, marginBottom: 8 }, uploadButton: { height: 42, borderWidth: 1, borderRadius: 8, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, uploadText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 }, navEditRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth }, navInput: { flex: 1, height: 36, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, fontSize: 12 },
  settingRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, settingLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" }, stepper: { flexDirection: "row", alignItems: "center", gap: 9 }, stepButton: { width: 30, height: 30, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" }, valueText: { minWidth: 50, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  saveButton: { minHeight: 46, borderRadius: 9, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, saveText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7 }, resetButton: { alignItems: "center", padding: 12 }, resetText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
