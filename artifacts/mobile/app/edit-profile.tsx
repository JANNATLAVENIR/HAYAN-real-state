import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { uploadPropertyImage } from "@/lib/supabase";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [phoneVisibleToPublic, setPhoneVisibleToPublic] = useState(user?.phoneVisibleToPublic ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone, bio, phoneVisibleToPublic });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(t("editProfile"), error instanceof Error ? error.message : t("tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("photoAccess"), t("allowPhotoAccess"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      setSaving(true);
      const imageUrl = await uploadPropertyImage(result.assets[0].uri, user.id);
      await updateProfile({ avatar: imageUrl });
      setAvatar(imageUrl);
    } catch (error) {
      Alert.alert(t("couldNotOpenPhotos"), error instanceof Error ? error.message : t("tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + webTopPad + 8, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("editProfile")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.avatarSection}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: colors.primary }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {name.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Pressable onPress={() => void handleChangePhoto()} disabled={saving} style={[styles.changeAvatarBtn, { borderColor: colors.primary, borderRadius: colors.radius }]}>
            <Text style={[styles.changeAvatarText, { color: colors.primary }]}>{t("changePhoto")}</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("fullName")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput style={[styles.textInput, { color: colors.foreground }]} value={name} onChangeText={setName} placeholder={t("yourName")} placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("email")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.secondary }]}>
            <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("phone")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput style={[styles.textInput, { color: colors.foreground }]} value={phone} onChangeText={setPhone} placeholder={t("phoneNumber")} placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />
          </View>
        </View>

        <View style={[styles.contactConsent, { borderColor: colors.border }]}>
          <Text style={[styles.contactConsentText, { color: colors.foreground }]}>{t("phoneVisibleToPublic")}</Text>
          <Switch value={phoneVisibleToPublic} onValueChange={setPhoneVisibleToPublic} trackColor={{ true: colors.primary }} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("description")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius, minHeight: 100, alignItems: "flex-start" }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, textAlignVertical: "top" }]}
              value={bio}
              onChangeText={setBio}
              placeholder={t("tellAboutYou")}
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("role")}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.secondary }]}>
            <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>
              {user?.role ? t(user.role === "buyer" ? "propertyBuyer" : user.role === "seller" ? "propertySeller" : user.role === "renter" ? "propertyRenter" : "realEstateAgent") : ""}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{saving ? t("saving") : t("saveChanges")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, marginBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  changeAvatarBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, marginTop: 12 },
  changeAvatarText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldGroup: { marginBottom: 18 },
  contactConsent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 18 },
  contactConsentText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  textInput: { fontSize: 15, fontFamily: "Inter_400Regular" },
  readOnlyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
});
