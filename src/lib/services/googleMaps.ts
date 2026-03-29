export type CommuteSnapshot = {
  baselineMinutes: number;
  trafficMinutes: number;
  delayMinutes: number;
};

type DistanceMatrixResponse = {
  status: string;
  rows: Array<{
    elements: Array<{
      status: string;
      duration?: { value: number };
      duration_in_traffic?: { value: number };
    }>;
  }>;
};

export async function getCommuteSnapshot(origin: string, destination: string): Promise<CommuteSnapshot> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google Maps call failed (${res.status})`);
  }

  const data = (await res.json()) as DistanceMatrixResponse;
  if (data.status !== "OK" || !data.rows[0]?.elements[0]) {
    throw new Error(`Google Maps returned status ${data.status}`);
  }

  const element = data.rows[0].elements[0];
  if (element.status !== "OK" || !element.duration?.value || !element.duration_in_traffic?.value) {
    throw new Error(`Route lookup failed with element status ${element.status}`);
  }

  const baselineMinutes = Math.round(element.duration.value / 60);
  const trafficMinutes = Math.round(element.duration_in_traffic.value / 60);

  return {
    baselineMinutes,
    trafficMinutes,
    delayMinutes: Math.max(0, trafficMinutes - baselineMinutes)
  };
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google geocode failed (${res.status})`);
  }

  const data = (await res.json()) as {
    status: string;
    results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Unable to geocode address: ${address}`);
  }

  return data.results[0].geometry.location;
}
