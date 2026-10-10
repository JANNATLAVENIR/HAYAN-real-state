import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Property, FilterOptions, ScheduledViewing } from "@/constants/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ListingsContextType {
  properties: Property[];
  filteredProperties: Property[];
  filters: FilterOptions;
  viewings: ScheduledViewing[];
  isLoading: boolean;
  loadError: string | null;
  refreshListings: () => Promise<void>;
  setFilters: (f: FilterOptions) => void;
  clearFilters: () => void;
  addProperty: (p: Omit<Property, "id" | "views" | "createdAt">) => Promise<string>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  getProperty: (id: string) => Property | undefined;
  incrementViews: (id: string) => Promise<void>;
  scheduleViewing: (v: Omit<ScheduledViewing, "id" | "status">) => Promise<void>;
  cancelViewing: (id: string) => Promise<void>;
  rescheduleViewing: (id: string, date: string, time: string) => Promise<void>;
  respondToViewing: (id: string, status: "confirmed" | "cancelled") => Promise<void>;
  getUserProperties: (userId: string) => Property[];
}

const ListingsContext = createContext<ListingsContextType | null>(null);

function mapProperty(row: Record<string, any>): Property {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    price: Number(row.price),
    type: row.type,
    listingType: row.listing_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: Number(row.area),
    address: row.address,
    city: row.city,
    images: row.images ?? [],
    amenities: row.amenities ?? [],
    petFriendly: row.pet_friendly ?? false,
    ownerId: row.owner_id,
    views: row.views ?? 0,
    createdAt: row.created_at,
    featured: row.featured ?? false,
    status: row.status ?? "approved",
    availabilityStatus: row.availability_status ?? "available",
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

function mapViewing(row: Record<string, any>, fallbackPropertyTitle = "Property viewing"): ScheduledViewing {
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyTitle: row.property_title ?? fallbackPropertyTitle,
    userId: row.user_id,
    requesterName: row.requester_name ?? undefined,
    agentId: row.agent_id ?? "",
    date: row.date,
    time: row.time,
    status: row.status,
  };
}

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [viewings, setViewings] = useState<ScheduledViewing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    void loadData();
  }, [authLoading, user?.id]);

  const loadData = async () => {
    setLoadError(null);
    try {
      if (!supabase) throw new Error("Supabase is not configured. Property and viewing data are unavailable.");
      const [propertiesResult, viewingsResult] = await Promise.all([
        supabase.from("properties").select("*").order("created_at", { ascending: false }),
        supabase.from("viewings").select("*, properties(title)").order("created_at", { ascending: false }),
      ]);
      if (propertiesResult.error) throw new Error(propertiesResult.error.message);
      if (viewingsResult.error) throw new Error(viewingsResult.error.message);
      setProperties((propertiesResult.data ?? []).map(mapProperty));
      const viewingRows = viewingsResult.data ?? [];
      const requesterIds = [...new Set(viewingRows.map((row: any) => row.user_id))];
      const { data: requesterProfiles, error: requesterError } = requesterIds.length
        ? await supabase.from("public_profiles").select("id,name").in("id", requesterIds)
        : { data: [], error: null };
      if (requesterError) throw new Error(requesterError.message);
      const requesterNames = Object.fromEntries((requesterProfiles ?? []).map((profile: any) => [profile.id, profile.name]));
      setViewings(viewingRows.map((row: any) => mapViewing({
        ...row,
        property_title: row.properties?.title,
        requester_name: requesterNames[row.user_id],
      }, t("propertyViewing"))));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("refreshError"));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshListings = async () => {
    setIsLoading(true);
    await loadData();
  };

  const filteredProperties = properties.filter((p) => {
    if (p.status && p.status !== "approved") return false;
    if (p.availabilityStatus && p.availabilityStatus !== "available") return false;
    if (filters.query) {
      const query = filters.query.trim().toLowerCase();
      if (query && ![p.title, p.city, p.address].some((value) => value.toLowerCase().includes(query))) return false;
    }
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    if (filters.type && filters.type.length > 0 && !filters.type.includes(p.type)) return false;
    if (filters.listingType && p.listingType !== filters.listingType) return false;
    if (filters.minBedrooms && p.bedrooms < filters.minBedrooms) return false;
    if (filters.maxBedrooms && p.bedrooms > filters.maxBedrooms) return false;
    if (filters.minBathrooms && p.bathrooms < filters.minBathrooms) return false;
    if (filters.petFriendly && !p.petFriendly) return false;
    if (filters.parking && !p.amenities.some((amenity) => amenity.toLowerCase() === "parking")) return false;
    if (filters.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    return true;
  });

  const clearFilters = useCallback(() => setFilters({}), []);

  const addProperty = useCallback(async (p: Omit<Property, "id" | "views" | "createdAt">) => {
    if (!supabase) throw new Error("Supabase is not configured. Property data cannot be saved.");
    const { data, error } = await supabase.from("properties").insert({
        owner_id: p.ownerId,
        title: p.title,
        description: p.description,
        price: p.price,
        type: p.type,
        listing_type: p.listingType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        address: p.address,
        city: p.city,
        images: p.images,
        amenities: p.amenities,
        pet_friendly: p.petFriendly,
        featured: p.featured,
        status: "pending",
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Unable to create property");
      const newProperty = { ...p, id: data.id, views: 0, createdAt: new Date().toISOString(), status: "pending" as const, availabilityStatus: p.availabilityStatus ?? "available" };
      setProperties((current) => [newProperty, ...current]);
    return data.id;
  }, []);

  const updateProperty = useCallback(async (id: string, updates: Partial<Property>) => {
    if (!supabase) throw new Error("Supabase is not configured. Property data cannot be updated.");
    const payload = {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.price !== undefined && { price: updates.price }),
        ...(updates.type !== undefined && { type: updates.type }),
        ...(updates.listingType !== undefined && { listing_type: updates.listingType }),
        ...(updates.bedrooms !== undefined && { bedrooms: updates.bedrooms }),
        ...(updates.bathrooms !== undefined && { bathrooms: updates.bathrooms }),
        ...(updates.area !== undefined && { area: updates.area }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.city !== undefined && { city: updates.city }),
        ...(updates.images !== undefined && { images: updates.images }),
        ...(updates.amenities !== undefined && { amenities: updates.amenities }),
        ...(updates.petFriendly !== undefined && { pet_friendly: updates.petFriendly }),
        ...(updates.featured !== undefined && { featured: updates.featured }),
        ...(updates.availabilityStatus !== undefined && { availability_status: updates.availabilityStatus }),
      };
      const currentProperty = properties.find((property) => property.id === id);
      const requiresReview = Boolean(currentProperty && [
        "title", "description", "price", "type", "listingType", "bedrooms", "bathrooms", "area",
        "address", "city", "images", "amenities", "petFriendly", "latitude", "longitude",
      ].some((key) => updates[key as keyof Property] !== undefined && updates[key as keyof Property] !== currentProperty[key as keyof Property]));
      const { data, error } = await supabase.from("properties").update(payload).eq("id", id)
        .select("status, availability_status").single();
      if (error) throw new Error(error.message);
      setProperties((current) => current.map((p) => (p.id === id ? {
        ...p,
        ...updates,
        status: data.status ?? (requiresReview ? "pending" : p.status),
        availabilityStatus: data.availability_status ?? updates.availabilityStatus ?? p.availabilityStatus ?? "available",
      } : p)));
  }, [properties]);

  const deleteProperty = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase is not configured. Property data cannot be deleted.");
    const { data, error } = await supabase.from("properties").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The listing was not deleted. It may no longer exist or you may not have permission.");
    setProperties((current) => current.filter((p) => p.id !== id));
  }, []);

  const getProperty = useCallback((id: string) => properties.find((p) => p.id === id), [properties]);

  const incrementViews = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase is not configured. Property views cannot be saved.");
    const { data, error } = await supabase.rpc("increment_property_views", { property_id: id });
    if (error) throw new Error(error.message);
    if (typeof data === "number") setProperties((current) => current.map((property) => property.id === id ? { ...property, views: data } : property));
  }, []);

  const scheduleViewing = useCallback(async (v: Omit<ScheduledViewing, "id" | "status">) => {
    if (!supabase) throw new Error("Supabase is not configured. Viewing requests cannot be saved.");
    const { data, error } = await supabase.from("viewings").insert({
        property_id: v.propertyId,
        user_id: v.userId,
        agent_id: v.agentId || null,
        date: v.date,
        time: v.time,
      }).select("*, properties(title)").single();
      if (error?.code === "23505" && error.message.includes("viewings_active_slot_unique")) {
        throw new Error(t("viewingSlotTaken"));
      }
      if (error || !data) throw new Error(error?.message ?? "Unable to schedule viewing");
      setViewings((current) => [...current, mapViewing({ ...data, property_title: data.properties?.title })]);
  }, [t]);

  const cancelViewing = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase is not configured. Viewing requests cannot be updated.");
    const { data, error } = await supabase.from("viewings").update({ status: "cancelled" }).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Viewing was not updated. Check your access or refresh the schedule.");
    setViewings((current) => current.map((v) => (v.id === id ? { ...v, status: "cancelled" as const } : v)));
  }, []);

  const rescheduleViewing = useCallback(async (id: string, date: string, time: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const dateCheck = new Date(year, month - 1, day);
    const proposedTime = Date.parse(`${date}T${time}:00`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      && dateCheck.getFullYear() === year && dateCheck.getMonth() === month - 1 && dateCheck.getDate() === day;
    const validTime = /^\d{2}:\d{2}$/.test(time) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    if (!validDate || !validTime || !Number.isFinite(proposedTime) || proposedTime <= Date.now()) {
      throw new Error(t("invalidViewingDate"));
    }
    if (!supabase) throw new Error("Supabase is not configured. Viewing requests cannot be updated.");
    const { error } = await supabase.from("viewings").update({ date, time }).eq("id", id);
    if (error?.code === "23505") throw new Error(t("viewingSlotTaken"));
    if (error) throw new Error(error.message);
    setViewings((current) => current.map((viewing) => viewing.id === id ? { ...viewing, date, time } : viewing));
  }, [t]);

  const respondToViewing = useCallback(async (id: string, status: "confirmed" | "cancelled") => {
    if (!supabase) throw new Error("Supabase is not configured. Viewing requests cannot be updated.");
    const { data, error } = await supabase.from("viewings").update({ status }).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Viewing was not updated. Check your access or refresh the schedule.");
    setViewings((current) => current.map((viewing) => viewing.id === id ? { ...viewing, status } : viewing));
  }, []);

  const getUserProperties = useCallback((userId: string) => properties.filter((p) => p.ownerId === userId), [properties]);

  return (
    <ListingsContext.Provider
      value={{
        properties,
        filteredProperties,
        filters,
        viewings,
        isLoading,
        loadError,
        refreshListings,
        setFilters,
        clearFilters,
        addProperty,
        updateProperty,
        deleteProperty,
        getProperty,
        incrementViews,
        scheduleViewing,
        cancelViewing,
        rescheduleViewing,
        respondToViewing,
        getUserProperties,
      }}
    >
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within ListingsProvider");
  return ctx;
}
