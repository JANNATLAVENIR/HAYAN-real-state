import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StepIndicator } from "@/components/StepIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { translateAmenity, useLanguage, type TranslationKey } from "@/contexts/LanguageContext";
import { useListings } from "@/contexts/ListingsContext";
import { useColors } from "@/hooks/useColors";
import type { Property } from "@/constants/types";
import { uploadPropertyImage } from "@/lib/supabase";

const STEP_KEYS: TranslationKey[] = ["detailsStep", "pricingStep", "featuresStep", "reviewStep"];
const PROPERTY_TYPES: Property["type"][] = ["apartment", "house", "villa", "penthouse", "land"];

export default function CreateListingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === "string" ? params.id : undefined;
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { addProperty, updateProperty, getProperty } = useListings();
  const existingProperty = editId ? getProperty(editId) : undefined;
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Property["type"]>("apartment");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [petFriendly, setPetFriendly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<Property["availabilityStatus"]>("available");

  useEffect(() => {
    if (!existingProperty || existingProperty.ownerId !== user?.id) return;
    setTitle(existingProperty.title);
    setDescription(existingProperty.description);
    setType(existingProperty.type);
    setListingType(existingProperty.listingType);
    setPrice(String(existingProperty.price));
    setBedrooms(String(existingProperty.bedrooms));
    setBathrooms(String(existingProperty.bathrooms));
    setArea(String(existingProperty.area));
    setAddress(existingProperty.address);
    setCity(existingProperty.city);
    setAmenities(existingProperty.amenities);
    setPetFriendly(existingProperty.petFriendly);
    setImages(existingProperty.images);
    setCoordinates(existingProperty.latitude !== undefined && existingProperty.longitude !== undefined
      ? { latitude: existingProperty.latitude, longitude: existingProperty.longitude }
      : null);
    setAvailabilityStatus(existingProperty.availabilityStatus ?? "available");
  }, [existingProperty?.id, user?.id]);

  useEffect(() => {
    if ((listingType === "rent" && availabilityStatus === "sold") || (listingType === "sale" && availabilityStatus === "rented")) {
      setAvailabilityStatus("available");
    }
  }, [listingType, availabilityStatus]);

  const AMENITY_OPTIONS = ["Pool", "Gym", "Concierge", "Parking", "Garden", "Terrace", "Wine Cellar", "Smart Home", "Fireplace", "Waterfront"];
  const toggleAmenity = (a: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const canNext = () => {
    if (step === 0) return !!title && !!description && !!address && !!city;
    if (step === 1) return !!price && !!area;
    return true;
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const useCurrentLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("locationPermission"));
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    setCoordinates({ latitude: current.coords.latitude, longitude: current.coords.longitude });
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert(t("signInRequired"), t("signInToContact"));
      return;
    }
    setLoading(true);
    try {
      if (!Number.isFinite(Number(price)) || Number(price) <= 0 || !Number.isFinite(Number(area)) || Number(area) <= 0) {
        Alert.alert(t("checkListing"), t("positiveNumbers"));
        return;
      }
      if (editId && (!existingProperty || existingProperty.ownerId !== user.id)) {
        Alert.alert(t("editListing"), t("propertyNotFound"));
        return;
      }
      if (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0 || !Number.isInteger(Number(bathrooms)) || Number(bathrooms) < 0) {
        Alert.alert(t("checkListing"), t("wholeNumbers"));
        return;
      }
      const propertyImages = images.length > 0
        ? await Promise.all(images.map((uri) => uri.startsWith("https://") || uri.startsWith("http://") ? uri : uploadPropertyImage(uri, user.id)))
        : [];
      const listing = {
        title: title.trim(), description: description.trim(), price: Number(price), type, listingType,
        bedrooms: Number(bedrooms), bathrooms: Number(bathrooms), area: Number(area),
        address: address.trim(), city: city.trim(), images: propertyImages, amenities, petFriendly,
        availabilityStatus: availabilityStatus ?? "available", latitude: coordinates?.latitude, longitude: coordinates?.longitude,
      };
      if (editId) {
        await updateProperty(editId, listing);
        Alert.alert(t("editListing"), t("listingUpdated"));
      } else {
        await addProperty({ ...listing, ownerId: user.id, featured: false });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(t("couldNotPublish"), error instanceof Error ? error.message : t("tryAgain"));
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("photoAccess"), t("allowPhotoAccess"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 10,
        quality: 0.85, allowsEditing: false,
      });
      if (!result.canceled) setImages(result.assets.map((asset) => asset.uri).slice(0, 10));
    } catch (error) {
      Alert.alert(t("couldNotOpenPhotos"), error instanceof Error ? error.message : t("tryAgain"));
    }
  };

  const renderField = (label: string, value: string, onChange: (t: string) => void, options?: { multiline?: boolean; keyboardType?: any; placeholder?: string }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrapper, { borderColor: colors.border, borderRadius: colors.radius }, options?.multiline && { minHeight: 100, alignItems: "flex-start" }]}>
        <TextInput
          style={[styles.textInput, { color: colors.foreground }, options?.multiline && { textAlignVertical: "top" }]}
          placeholder={options?.placeholder || ""}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChange}
          multiline={options?.multiline}
          keyboardType={options?.keyboardType || "default"}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + webTopPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editId ? t("editListing") : t("createListingTitle")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <StepIndicator currentStep={step} totalSteps={4} labels={STEP_KEYS.map(t)} />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              {renderField(t("title"), title, setTitle, { placeholder: t("modernFamilyHome") })}
              {renderField(t("description"), description, setDescription, { multiline: true, placeholder: t("descriptionHint") })}

              <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 8 }]}>{t("propertyType")}</Text>
              <View style={styles.chipRow}>
                {PROPERTY_TYPES.map((pt) => (
                  <Pressable
                    key={pt}
                    style={[styles.chip, { borderColor: type === pt ? colors.foreground : colors.border, backgroundColor: type === pt ? colors.foreground : "transparent" }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setType(pt); }}
                  >
                    <Text style={[styles.chipText, { color: type === pt ? colors.background : colors.foreground }]}>
                      {t(pt)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 8, marginTop: 20 }]}>{t("listingType")}</Text>
              <View style={styles.chipRow}>
                {(["sale", "rent"] as const).map((lt) => (
                  <Pressable
                    key={lt}
                    style={[styles.chip, { borderColor: listingType === lt ? colors.foreground : colors.border, backgroundColor: listingType === lt ? colors.foreground : "transparent" }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setListingType(lt); }}
                  >
                    <Text style={[styles.chipText, { color: listingType === lt ? colors.background : colors.foreground }]}>
                      {lt === "sale" ? t("forSale") : t("forRent")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {renderField(t("address"), address, setAddress, { placeholder: t("streetAddress") })}
              {renderField(t("city"), city, setCity, { placeholder: t("mogadishuHargeisa") })}
              <Pressable onPress={useCurrentLocation} style={[styles.locationPicker, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="navigation" size={18} color={colors.primary} />
                <Text style={[styles.locationPickerText, { color: colors.foreground }]}>{coordinates ? t("locationAdded") : t("useCurrentLocation")}</Text>
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              {renderField(t("priceUsd"), price, setPrice, { keyboardType: "numeric", placeholder: listingType === "rent" ? t("monthlyRent") : t("salePrice") })}
              {renderField(t("sizeSquareMeters"), area, setArea, { keyboardType: "numeric", placeholder: t("totalArea") })}
              {type !== "land" && (
                <>
                  {renderField(t("bedrooms"), bedrooms, setBedrooms, { keyboardType: "numeric", placeholder: t("numberBedrooms") })}
                  {renderField(t("bathrooms"), bathrooms, setBathrooms, { keyboardType: "numeric", placeholder: t("numberBathrooms") })}
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {editId && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 12 }]}>{t("availabilityStatus")}</Text>
                  <View style={[styles.chipRow, { marginBottom: 22 }]}>
                    {(["available", listingType === "rent" ? "rented" : "sold", "unavailable"] as const).map((status) => (
                      <Pressable key={status} onPress={() => setAvailabilityStatus(status)} style={[styles.chip, { borderColor: availabilityStatus === status ? colors.foreground : colors.border, backgroundColor: availabilityStatus === status ? colors.foreground : "transparent" }]}>
                        <Text style={[styles.chipText, { color: availabilityStatus === status ? colors.background : colors.foreground }]}>{t(status)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 12 }]}>{t("addAmenities")}</Text>
              <View style={styles.chipRow}>
                {AMENITY_OPTIONS.map((a) => {
                  const selected = amenities.includes(a);
                  return (
                    <Pressable
                      key={a}
                      style={[styles.chip, { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : "transparent" }]}
                      onPress={() => toggleAmenity(a)}
                    >
                      <Text style={[styles.chipText, { color: selected ? colors.background : colors.foreground }]}>{translateAmenity(a, t)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.switchRow, { marginTop: 24 }]}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t("petFriendlyLabel")}</Text>
                <Switch value={petFriendly} onValueChange={setPetFriendly} trackColor={{ true: colors.primary }} thumbColor="#fff" />
              </View>

              <View style={[styles.mediaSection, { borderColor: colors.border, borderRadius: colors.radius, marginTop: 24 }]}>
                <Feather name="camera" size={32} color={colors.mutedForeground} />
                <Text style={[styles.mediaTitle, { color: colors.foreground }]}>{t("addPhotosAndVideos")}</Text>
                <Text style={[styles.mediaSubtitle, { color: colors.mutedForeground }]}>{t("addPhotosHint")}</Text>
                <Pressable onPress={pickImages} style={[styles.uploadBtn, { borderColor: colors.primary, borderRadius: colors.radius }]}>
                  <Text style={[styles.uploadBtnText, { color: colors.primary }]}>{images.length ? `${t("choosePhotosCount")} (${images.length})` : t("choosePhotos")}</Text>
                </Pressable>
                {images.length > 0 && <ScrollView horizontal style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
                  {images.map((uri) => <Image key={uri} source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />)}
                </ScrollView>}
              </View>
            </>
          )}

          {step === 3 && (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("title")}</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("type")}</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{t(type)} - {listingType === "rent" ? t("forRent") : t("forSale")}</Text>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("price")}</Text>
              <Text style={[styles.reviewValue, { color: colors.primary }]}>{new Intl.NumberFormat(language === "so" ? "so-SO" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(price || 0))}{listingType === "rent" ? t("perMonth") : ""}</Text>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("location")}</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{address}, {city}</Text>
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("sizeSquareMeters")}</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{area} {t("sqm")} · {bedrooms} {t("bedrooms")} · {bathrooms} {t("bathrooms")}</Text>
              {amenities.length > 0 && (
                <>
                  <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("addAmenities")}</Text>
                  <Text style={[styles.reviewValue, { color: colors.foreground }]}>{amenities.map((amenity) => translateAmenity(amenity, t)).join(", ")}</Text>
                </>
              )}
              <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{t("description")}</Text>
              <Text style={[styles.reviewValue, { color: colors.foreground }]}>{description}</Text>
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
          <Pressable
            style={({ pressed }) => [styles.nextBtn, { backgroundColor: canNext() ? colors.foreground : colors.muted, borderRadius: 28, opacity: pressed ? 0.9 : 1 }]}
            onPress={handleNext}
            disabled={!canNext() || loading}
          >
            <Text style={[styles.nextBtnText, { color: canNext() ? colors.background : colors.mutedForeground }]}>
              {step === 3 ? (loading ? t("publishing") : editId ? t("saveListing") : t("publishListing")) : t("continue")}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 19, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginBottom: 8 },
  inputWrapper: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#FFFFFF" },
  textInput: { fontSize: 15, fontFamily: "Inter_400Regular" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  mediaSection: { borderWidth: 1, borderStyle: "dashed", padding: 28, alignItems: "center", gap: 8, backgroundColor: "#FFFFFF" },
  mediaTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  mediaSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  uploadBtn: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, marginTop: 8 },
  uploadBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationPicker: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, padding: 14, marginBottom: 20 },
  locationPickerText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  reviewSection: { gap: 4 },
  reviewLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginTop: 16 },
  reviewValue: { fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  nextBtn: { paddingVertical: 16, alignItems: "center" },
  nextBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5 },
});
