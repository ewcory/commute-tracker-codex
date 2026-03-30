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

type DistanceElement = {
  status: string;
  duration?: { value: number };
  duration_in_traffic?: { value: number };
};

async function requestDistanceElement(
  origin: string,
  destination: string,
  apiKey: string
): Promise<{ apiStatus: string; element: DistanceElement | null }> {
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
  return {
    apiStatus: data.status,
    element: data.rows[0]?.elements[0] ?? null
  };
}

export async function getCommuteSnapshot(origin: string, destination: string): Promise<CommuteSnapshot> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing");
  }

  const first = await requestDistanceElement(origin, destination, apiKey);
  if (first.apiStatus !== "OK" || !first.element) {
    throw new Error(`Google Maps returned status ${first.apiStatus}`);
  }

  let element = first.element;

  if (element.status === "NOT_FOUND") {
    const geocodedOrigin = await geocodeAddress(origin);
    const geocodedDestination = await geocodeAddress(destination);
    const originLatLng = `${geocodedOrigin.lat},${geocodedOrigin.lng}`;
    const destinationLatLng = `${geocodedDestination.lat},${geocodedDestination.lng}`;
    const second = await requestDistanceElement(originLatLng, destinationLatLng, apiKey);
    if (second.apiStatus !== "OK" || !second.element) {
      throw new Error(`Google Maps returned status ${second.apiStatus} after geocode fallback`);
    }
    element = second.element;
  }

  if (element.status !== "OK" || !element.duration?.value || !element.duration_in_traffic?.value) {
    throw new Error(
      `Route lookup failed (status ${element.status}). Check saved addresses for typos or missing city/state.`
    );
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
