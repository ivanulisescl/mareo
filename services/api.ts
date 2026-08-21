import type {
  Coordinates,
  MarineApiResponse,
  TideEvent,
  WeatherApiResponse,
} from '../types/weather';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/** Costa de Colunga (Asturias): fallback si el usuario deniega el GPS. */
export const DEFAULT_COASTAL_COORDS: Coordinates = {
  latitude: 43.4849,
  longitude: -5.2712,
};

export const DEFAULT_COASTAL_LABEL = 'Colunga (Asturias)';

type ReverseGeocodeResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
};

function uniqueJoined(parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const part of parts) {
    const value = part?.trim();
    if (!value) {
      continue;
    }
    const key = value.toLocaleLowerCase('es');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    labels.push(value);
  }

  return labels.length > 0 ? labels.join(', ') : null;
}

/** Nombre de localidad a partir de coordenadas (funciona también en web, sin API key). */
export async function fetchPlaceName(coords: Coordinates): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    localityLanguage: 'es',
  });

  const data = await fetchJson<ReverseGeocodeResponse>(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
  );

  const locality = data.city?.trim() || data.locality?.trim();
  const region = data.principalSubdivision?.split(',')[0]?.trim();

  return uniqueJoined([locality, region]);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar el servicio`);
  }
  return response.json() as Promise<T>;
}

export async function fetchWeather(coords: Coordinates): Promise<WeatherApiResponse> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    timezone: 'auto',
  });

  return fetchJson<WeatherApiResponse>(`${WEATHER_URL}?${params.toString()}`);
}

export async function fetchMarine(coords: Coordinates): Promise<MarineApiResponse> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: [
      'wave_height',
      'wave_direction',
      'wave_period',
      'sea_surface_temperature',
    ].join(','),
    timezone: 'auto',
    cell_selection: 'sea',
  });

  return fetchJson<MarineApiResponse>(`${MARINE_URL}?${params.toString()}`);
}

export async function fetchWeatherAndMarine(coords: Coordinates): Promise<{
  weather: WeatherApiResponse;
  marine: MarineApiResponse | null;
}> {
  const [weatherResult, marineResult] = await Promise.allSettled([
    fetchWeather(coords),
    fetchMarine(coords),
  ]);

  if (weatherResult.status === 'rejected') {
    throw weatherResult.reason instanceof Error
      ? weatherResult.reason
      : new Error('No se pudo obtener el clima');
  }

  return {
    weather: weatherResult.value,
    marine: marineResult.status === 'fulfilled' ? marineResult.value : null,
  };
}

const IHM_TIDES_URL = 'https://ideihm.covam.es/api-ihm/getmarea';

type IhmStation = {
  id: string;
  puerto: string;
  latitude: number;
  longitude: number;
};

type IhmTideRow = {
  hora: string;
  altura: string;
  tipo: string;
};

type IhmTideResponse = {
  mareas: {
    puerto: string;
    fecha: string;
    datos?: {
      marea?: IhmTideRow | IhmTideRow[];
    };
  };
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function asTideRows(value: IhmTideRow | IhmTideRow[] | undefined): IhmTideRow[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function fetchIhmStations(): Promise<IhmStation[]> {
  const payload = await fetchJson<{
    estaciones: { puertos: Array<{ id: string; puerto: string; lat: string; lon: string }> };
  }>(`${IHM_TIDES_URL}?request=getlist&format=json`);

  return payload.estaciones.puertos.map((station) => ({
    id: station.id,
    puerto: station.puerto,
    latitude: Number(station.lat),
    longitude: Number(station.lon),
  }));
}

function nearestStation(coords: Coordinates, stations: IhmStation[]): IhmStation | null {
  if (stations.length === 0) {
    return null;
  }

  let best = stations[0];
  let bestDistance = distanceKm(coords, best);

  for (const station of stations.slice(1)) {
    const distance = distanceKm(coords, station);
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }

  return best;
}

export async function fetchOfficialTides(
  coords: Coordinates,
  dayIso: string,
): Promise<{ tides: TideEvent[]; stationName: string | null }> {
  try {
    const stations = await fetchIhmStations();
    const station = nearestStation(coords, stations);
    if (!station) {
      return { tides: [], stationName: null };
    }

    const dateParam = dayIso.split('-').join('');
    const payload = await fetchJson<IhmTideResponse>(
      `${IHM_TIDES_URL}?request=gettide&id=${encodeURIComponent(station.id)}&format=json&date=${dateParam}`,
    );

    const tides: TideEvent[] = [];
    for (const row of asTideRows(payload.mareas.datos?.marea)) {
      const height = Number(row.altura.replace(',', '.'));
      if (Number.isNaN(height) || !row.hora) {
        continue;
      }
      tides.push({
        kind: row.tipo === 'pleamar' ? 'pleamar' : 'bajamar',
        time: `${dayIso}T${row.hora}`,
        height,
      });
    }

    return {
      tides,
      stationName: payload.mareas.puerto || station.puerto,
    };
  } catch {
    return { tides: [], stationName: null };
  }
}
