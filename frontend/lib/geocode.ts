// Reverse geocoding via OpenStreetMap Nominatim. Used by the clinic-location
// settings so "Use my current location" can fill the address/city/country
// fields, not just the raw coordinates.
//
// Nominatim's usage policy asks for a descriptive User-Agent/Referer and low
// request volumes — this is only hit on an explicit button click, so occasional
// lookups are well within the acceptable-use limits.

export interface ReverseGeocodeResult {
  address: string;
  city: string;
  country: string;
}

// Reverse-geocode a coordinate into a best-effort street address, city, and
// country. Resolves to `null` on any failure (network, rate limit, no match) so
// the caller can silently fall back to coordinates-only.
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language?: string,
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requires an identifying header; browsers forbid setting
        // User-Agent, so Accept-Language localises the returned names.
        "Accept-Language": language || "en",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address ?? {};

    // Compose a street line from the most specific parts available.
    const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
    const address =
      street ||
      a.neighbourhood ||
      a.suburb ||
      a.pedestrian ||
      (data.display_name ? data.display_name.split(",")[0] : "") ||
      "";

    const city =
      a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const country = a.country || "";

    if (!address && !city && !country) return null;
    return { address, city, country };
  } catch {
    return null;
  }
}
