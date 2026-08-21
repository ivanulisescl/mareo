import type { Coordinates, MarineApiResponse, WeatherApiResponse } from '../types/weather';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/** Costa de Cádiz: fallback si el usuario deniega el GPS. */
export const DEFAULT_COASTAL_COORDS: Coordinates = {
  latitude: 36.5297,
  longitude: -6.2926,
};

export const DEFAULT_COASTAL_LABEL = 'Cádiz (costa por defecto)';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar Open-Meteo`);
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
