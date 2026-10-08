export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "buyer" | "seller" | "renter" | "agent";
  avatar?: string;
  bio?: string;
  phoneVisibleToPublic?: boolean;
  isVerified?: boolean;
  savedSearches: string[];
  bookmarks: string[];
  isAdmin?: boolean;
  isSuspended?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
}

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "apartment" | "house" | "land" | "villa" | "penthouse";
  listingType: "sale" | "rent";
  bedrooms: number;
  bathrooms: number;
  area: number;
  address: string;
  city: string;
  images: string[];
  amenities: string[];
  petFriendly: boolean;
  ownerId: string;
  views: number;
  createdAt: string;
  featured: boolean;
  status?: "pending" | "approved" | "rejected";
  availabilityStatus?: "available" | "rented" | "sold" | "unavailable";
  latitude?: number;
  longitude?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars?: Record<string, string>;
  propertyId?: string;
  propertyTitle?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface DalkaAlert {
  id: string;
  type: "price_drop" | "new_listing" | "message" | "viewing";
  title: string;
  body: string;
  propertyId?: string;
  read: boolean;
  timestamp: string;
}

export interface ScheduledViewing {
  id: string;
  propertyId: string;
  propertyTitle: string;
  userId: string;
  requesterName?: string;
  agentId: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled";
}

export interface FilterOptions {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  type?: Property["type"][];
  listingType?: "sale" | "rent";
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  petFriendly?: boolean;
  parking?: boolean;
  city?: string;
}
