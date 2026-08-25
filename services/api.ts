import type {
  Coordinates,
  DayForecast,
  MarineApiResponse,
  TideEvent,
  WeatherApiResponse,
} from '../types/weather';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/** Costa de Colunga (Asturias). */
export const COLUNGA_COORDS: Coordinates = {
  latitude: 43.4849,
  longitude: -5.2712,
};

export const COLUNGA_LABEL = 'Colunga';

export const GIJON_COORDS: Coordinates = {
  latitude: 43.545,
  longitude: -5.6635,
};

export const GIJON_LABEL = 'Gijón';

export const DEFAULT_COASTAL_COORDS = COLUNGA_COORDS;
export const DEFAULT_COASTAL_LABEL = COLUNGA_LABEL;

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

export const FORECAST_DAYS = 7;

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
      'precipitation',
      'relative_humidity_2m',
      'pressure_msl',
      'uv_index',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'uv_index_max',
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'precipitation',
      'precipitation_probability',
      'relative_humidity_2m',
      'pressure_msl',
    ].join(','),
    forecast_days: String(FORECAST_DAYS),
    timezone: 'auto',
  });

  return fetchJson<WeatherApiResponse>(`${WEATHER_URL}?${params.toString()}`);
}

function marineParams(
  coords: Coordinates,
  fields: { current: string; daily: string; hourly: string },
  models?: string,
): string {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: fields.current,
    daily: fields.daily,
    hourly: fields.hourly,
    forecast_days: String(FORECAST_DAYS),
    timezone: 'auto',
    cell_selection: 'sea',
  });
  if (models) {
    params.set('models', models);
  }
  return `${MARINE_URL}?${params.toString()}`;
}

function mergeMarineTemperature(
  waves: MarineApiResponse,
  water: MarineApiResponse,
): MarineApiResponse {
  const hourlyTemp = new Map<string, number | null>();
  water.hourly?.time.forEach((time, index) => {
    hourlyTemp.set(time, water.hourly?.sea_surface_temperature[index] ?? null);
  });
  const dailyTemp = new Map<string, number | null>();
  water.daily?.time.forEach((time, index) => {
    dailyTemp.set(time, water.daily?.sea_surface_temperature_max[index] ?? null);
  });

  return {
    ...waves,
    current: {
      ...waves.current,
      sea_surface_temperature: water.current.sea_surface_temperature,
    },
    current_units: {
      ...waves.current_units,
      sea_surface_temperature: water.current_units.sea_surface_temperature,
    },
    hourly: waves.hourly
      ? {
          ...waves.hourly,
          sea_surface_temperature: waves.hourly.time.map((time) => hourlyTemp.get(time) ?? null),
        }
      : waves.hourly,
    daily: waves.daily
      ? {
          ...waves.daily,
          sea_surface_temperature_max: waves.daily.time.map((time) => dailyTemp.get(time) ?? null),
        }
      : waves.daily,
  };
}

export async function fetchMarine(coords: Coordinates): Promise<MarineApiResponse> {
  const waveFields = {
    current: ['wave_height', 'wave_direction', 'wave_period'].join(','),
    daily: ['wave_height_max', 'wave_direction_dominant', 'wave_period_max'].join(','),
    hourly: ['wave_height', 'wave_period'].join(','),
  };
  const waterFields = {
    current: 'sea_surface_temperature',
    daily: 'sea_surface_temperature_max',
    hourly: 'sea_surface_temperature',
  };

  const [wavesResult, waterResult] = await Promise.allSettled([
    fetchJson<MarineApiResponse>(marineParams(coords, waveFields, 'ncep_gfswave025')),
    fetchJson<MarineApiResponse>(marineParams(coords, waterFields)),
  ]);

  if (wavesResult.status === 'rejected') {
    if (waterResult.status === 'rejected') {
      throw wavesResult.reason instanceof Error
        ? wavesResult.reason
        : new Error('No se pudieron obtener los datos marinos');
    }
    return waterResult.value;
  }
  if (waterResult.status === 'rejected') {
    return wavesResult.value;
  }
  return mergeMarineTemperature(wavesResult.value, waterResult.value);
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

const GIJON_STATION_ID = '6';
const GIJON_PREFERRED_RADIUS_KM = 40;

/**
 * Nivel medio del mar local sobre el cero hidrográfico (m), según fichas IHM
 * (NMM y CH referidos a la misma señal de tierra).
 * altura_NM = altura_CH − este valor.
 */
const MEAN_SEA_LEVEL_ABOVE_CH: Record<string, number> = {
  '4': 2.412, // Llanes: CH 6,347 m − NMM 3,935 m
  '5': 2.615, // Ribadesella: CH 4,976 m − NMM 2,361 m
  '6': 2.424, // Gijón: CH 5,706 m − NMM 3,282 m (NGU 83, 2018)
  '7': 2.46, // Avilés / San Juan de Nieva: CH 6,066 m − NMM 3,606 m
  '8': 2.348, // Cudillero: CH 5,499 m − NMM 3,151 m
  '10': 2.345, // Tapia: CH 5,623 m − NMM 3,278 m
};

const DEFAULT_MEAN_SEA_LEVEL_ABOVE_CH = MEAN_SEA_LEVEL_ABOVE_CH[GIJON_STATION_ID];

function heightAboveMeanSeaLevel(stationId: string, heightOnChartDatum: number): number {
  const meanSeaLevel =
    MEAN_SEA_LEVEL_ABOVE_CH[stationId] ?? DEFAULT_MEAN_SEA_LEVEL_ABOVE_CH;
  return Math.round((heightOnChartDatum - meanSeaLevel) * 100) / 100;
}

function pickTideStation(coords: Coordinates, stations: IhmStation[]): IhmStation | null {
  const gijon = stations.find((station) => station.id === GIJON_STATION_ID);
  if (gijon && distanceKm(coords, gijon) <= GIJON_PREFERRED_RADIUS_KM) {
    return gijon;
  }
  return nearestStation(coords, stations);
}

function shiftIsoDate(dayIso: string, days: number): string {
  const [year, month, day] = dayIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** El Anuario IHM devuelve horas en UTC; en pantalla usamos hora peninsular. */
function ihmUtcToMadridIso(utcDayIso: string, hora: string): string | null {
  const match = hora.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const utcMillis = Date.UTC(
    Number(utcDayIso.slice(0, 4)),
    Number(utcDayIso.slice(5, 7)) - 1,
    Number(utcDayIso.slice(8, 10)),
    Number(match[1]),
    Number(match[2]),
  );

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMillis));

  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}T${valueOf('hour')}:${valueOf('minute')}`;
}

async function fetchIhmTideRows(stationId: string, utcDayIso: string): Promise<IhmTideRow[]> {
  const dateParam = utcDayIso.split('-').join('');
  const payload = await fetchJson<IhmTideResponse>(
    `${IHM_TIDES_URL}?request=gettide&id=${encodeURIComponent(stationId)}&format=json&date=${dateParam}`,
  );
  return asTideRows(payload.mareas.datos?.marea);
}

export async function fetchOfficialTides(
  coords: Coordinates,
  startDayIso: string,
  dayCount = 1,
): Promise<{ tidesByDay: Record<string, TideEvent[]>; stationName: string | null }> {
  try {
    const stations = await fetchIhmStations();
    const station = pickTideStation(coords, stations);
    if (!station) {
      return { tidesByDay: {}, stationName: null };
    }

    const utcDays: string[] = [];
    for (let offset = -1; offset < dayCount; offset += 1) {
      utcDays.push(shiftIsoDate(startDayIso, offset));
    }

    const dailyRows = await Promise.all(
      utcDays.map(async (utcDay) => ({
        utcDay,
        rows: await fetchIhmTideRows(station.id, utcDay),
      })),
    );

    const minDayIso = shiftIsoDate(startDayIso, -1);
    const endDayIso = shiftIsoDate(startDayIso, dayCount);
    const tidesByDay: Record<string, TideEvent[]> = {};

    for (const { utcDay, rows } of dailyRows) {
      for (const row of rows) {
        const height = Number(row.altura.replace(',', '.'));
        const localTime = ihmUtcToMadridIso(utcDay, row.hora);
        if (Number.isNaN(height) || !localTime) {
          continue;
        }
        const localDay = localTime.slice(0, 10);
        if (localDay < minDayIso || localDay >= endDayIso) {
          continue;
        }
        if (!tidesByDay[localDay]) {
          tidesByDay[localDay] = [];
        }
        tidesByDay[localDay].push({
          kind: row.tipo === 'pleamar' ? 'pleamar' : 'bajamar',
          time: localTime,
          height: heightAboveMeanSeaLevel(station.id, height),
        });
      }
    }

    for (const day of Object.keys(tidesByDay)) {
      tidesByDay[day].sort((left, right) => left.time.localeCompare(right.time));
    }

    return {
      tidesByDay,
      stationName: station.puerto,
    };
  } catch {
    return { tidesByDay: {}, stationName: null };
  }
}

function marineValueForDay(
  daily: MarineApiResponse['daily'],
  date: string,
  key:
    | 'wave_height_max'
    | 'wave_direction_dominant'
    | 'wave_period_max'
    | 'sea_surface_temperature_max',
): number | null {
  if (!daily) {
    return null;
  }
  const index = daily.time.indexOf(date);
  if (index < 0) {
    return null;
  }
  const value = daily[key][index];
  return value == null || Number.isNaN(value) ? null : value;
}

export function buildDayForecasts(
  weather: WeatherApiResponse,
  marine: MarineApiResponse | null,
  tidesByDay: Record<string, TideEvent[]>,
): DayForecast[] {
  const daily = weather.daily;
  if (!daily) {
    return [];
  }

  return daily.time.map((date, index) => ({
    date,
    weatherCode: daily.weather_code[index],
    temperatureMax: daily.temperature_2m_max[index],
    temperatureMin: daily.temperature_2m_min[index],
    precipitationSum: daily.precipitation_sum[index],
    windSpeedMax: daily.wind_speed_10m_max[index],
    windGustsMax: daily.wind_gusts_10m_max[index],
    windDirectionDominant: daily.wind_direction_10m_dominant[index],
    waveHeightMax: marineValueForDay(marine?.daily, date, 'wave_height_max'),
    waveDirectionDominant: marineValueForDay(marine?.daily, date, 'wave_direction_dominant'),
    wavePeriodMax: marineValueForDay(marine?.daily, date, 'wave_period_max'),
    waterTemperature: marineValueForDay(marine?.daily, date, 'sea_surface_temperature_max'),
    tides: tidesByDay[date] ?? [],
  }));
}
