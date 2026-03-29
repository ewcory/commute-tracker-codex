import { geocodeAddress } from "@/lib/services/googleMaps";

export type WeatherAlert = {
  event: string;
  severity: string;
  headline: string;
};

export async function getSevereWeatherForAddress(address: string): Promise<WeatherAlert[]> {
  try {
    const { lat, lng } = await geocodeAddress(address);
    const url = new URL("https://api.weather.gov/alerts/active");
    url.searchParams.set("point", `${lat},${lng}`);

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "CommuteAlert/1.0 (contact: local-development)"
      }
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as {
      features?: Array<{
        properties?: {
          event?: string;
          severity?: string;
          headline?: string;
        };
      }>;
    };

    return (data.features ?? [])
      .map((item) => ({
        event: item.properties?.event ?? "Unknown event",
        severity: item.properties?.severity ?? "Unknown severity",
        headline: item.properties?.headline ?? "No headline"
      }))
      .filter((item) => {
        const sev = item.severity.toLowerCase();
        return sev.includes("severe") || sev.includes("extreme");
      });
  } catch {
    return [];
  }
}
