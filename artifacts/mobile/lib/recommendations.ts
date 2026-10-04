import type { Property, User } from "@/constants/types";

/** Rank approved listings against the user's saved-home pattern and role. */
export function recommendProperties(properties: Property[], user: User | null, limit = 6): Property[] {
  const approved = properties.filter((property) => !property.status || property.status === "approved");
  const saved = user ? approved.filter((property) => user.bookmarks.includes(property.id)) : [];
  const savedCities = new Set(saved.map((property) => property.city.toLocaleLowerCase()));
  const savedTypes = new Set(saved.map((property) => property.type));
  const savedListingTypes = new Set(saved.map((property) => property.listingType));
  const savedBedroomValues = saved.map((property) => property.bedrooms).filter((value) => value > 0);
  const preferredListingType = savedListingTypes.size
    ? undefined
    : user?.role === "renter" ? "rent" : user?.role === "buyer" ? "sale" : undefined;

  return approved
    .filter((property) => !user?.bookmarks.includes(property.id))
    .map((property) => {
      let score = 0;
      if (savedCities.has(property.city.toLocaleLowerCase())) score += 5;
      if (savedTypes.has(property.type)) score += 3;
      if (savedListingTypes.has(property.listingType)) score += 3;
      if (preferredListingType === property.listingType) score += 2;
      if (savedBedroomValues.length && Math.min(...savedBedroomValues.map((value) => Math.abs(value - property.bedrooms))) <= 1) score += 2;
      score += Math.min(property.views, 100) / 100;
      score += property.featured ? 0.25 : 0;
      return { property, score };
    })
    .sort((a, b) => b.score - a.score || b.property.createdAt.localeCompare(a.property.createdAt))
    .slice(0, limit)
    .map(({ property }) => property);
}
