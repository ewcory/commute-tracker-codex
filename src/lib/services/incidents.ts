export type TrafficIncident = {
  title: string;
  description: string;
  location: string;
};

function looksLikeBayBridgeRoute(origin: string, destination: string): boolean {
  const routeText = `${origin} ${destination}`.toLowerCase();
  return (
    (routeText.includes("san francisco") && routeText.includes("emeryville")) ||
    routeText.includes("bay bridge")
  );
}

export async function getTrafficIncidents(origin: string, destination: string): Promise<TrafficIncident[]> {
  const apiKey = process.env.API_511_KEY;
  if (!apiKey || !looksLikeBayBridgeRoute(origin, destination)) {
    return [];
  }

  try {
    const url = new URL("https://api.511.org/traffic/events");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as unknown;
    const events = Array.isArray(data)
      ? data
      : Array.isArray((data as { events?: unknown[] })?.events)
        ? ((data as { events: unknown[] }).events ?? [])
        : [];

    return events
      .map((event): TrafficIncident | null => {
        const row = event as Record<string, unknown>;
        const title = String(row.headline ?? row.title ?? "Traffic incident");
        const description = String(row.description ?? row.details ?? "");
        const location = String(row.location ?? row.area ?? "Bay Area");
        const text = `${title} ${description} ${location}`.toLowerCase();
        if (!text.includes("bay bridge") && !text.includes("i-80")) {
          return null;
        }
        return { title, description, location };
      })
      .filter((item): item is TrafficIncident => item !== null);
  } catch {
    return [];
  }
}
