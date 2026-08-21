import type { Coordinates, MarineApiResponse, WeatherApiResponse } from '../types/weather';

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
      'sea_level_height_msl',
    ].join(','),
    hourly: 'sea_level_height_msl',
    forecast_days: '2',
    past_days: '1',
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
