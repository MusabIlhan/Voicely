/**
 * Business search handler — stub returning mock results.
 * Can be replaced with Google Places API or similar in the future.
 */

export interface BusinessResult {
  name: string;
  phone: string;
  rating: number;
  cuisine: string;
  address: string;
}

export interface SearchBusinessResponse {
  results: BusinessResult[];
  query: string;
  location: string;
}

const mockBusinesses: BusinessResult[] = [
  {
    name: "Bella Italia",
    phone: "+46737869515",
    rating: 4.5,
    cuisine: "Italian",
    address: "123 Main St",
  },
  {
    name: "Sakura Sushi",
    phone: "+46737869515",
    rating: 4.7,
    cuisine: "Japanese",
    address: "456 Oak Ave",
  },
  {
    name: "Le Petit Bistro",
    phone: "+46737869515",
    rating: 4.3,
    cuisine: "French",
    address: "789 Elm Blvd",
  },
];

/**
 * Search for businesses matching a query. Returns mock results for now.
 */
export function searchBusiness(
  query: string,
  location?: string,
): SearchBusinessResponse {
  return {
    results: mockBusinesses,
    query,
    location: location ?? "nearby",
  };
}
