export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationChoice = 'gijon' | 'colunga' | 'gps';

export type WeatherIconKey =
  | 'sun'
  | 'cloudSun'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export type WeatherCurrent = {
  time: string;
  interval: number;
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
};

export type WeatherApiResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  current: WeatherCurrent;
  current_units: {
    temperature_2m: string;
    apparent_temperature: string;
    weather_code: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
    wind_gusts_10m: string;
  };
  daily?: WeatherDaily;
};

export type WeatherDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
};

export type MarineCurrent = {
  time: string;
  interval: number;
  wave_height: number | null;
  wave_direction: number | null;
  wave_period: number | null;
  sea_surface_temperature: number | null;
};

export type MarineApiResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: MarineCurrent;
  current_units: {
    wave_height: string;
    wave_direction: string;
    wave_period: string;
    sea_surface_temperature: string;
  };
  daily?: MarineDaily;
};

export type MarineDaily = {
  time: string[];
  wave_height_max: Array<number | null>;
  wave_direction_dominant: Array<number | null>;
  wave_period_max: Array<number | null>;
  sea_surface_temperature_max: Array<number | null>;
};

export type TideKind = 'pleamar' | 'bajamar';

export type TideEvent = {
  kind: TideKind;
  time: string;
  height: number;
};

export type DayForecast = {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  waveHeightMax: number | null;
  waveDirectionDominant: number | null;
  wavePeriodMax: number | null;
  waterTemperature: number | null;
  tides: TideEvent[];
};

export type DashboardData = {
  weather: WeatherApiResponse;
  marine: MarineApiResponse | null;
  tidesToday: TideEvent[];
  previousTide: TideEvent | null;
  nextTide: TideEvent | null;
  tideStationName: string | null;
  forecastDays: DayForecast[];
  coordinates: Coordinates;
  placeLabel: string;
  locationChoice: LocationChoice;
  usingGps: boolean;
};

export type WeatherInfo = {
  label: string;
  icon: WeatherIconKey;
};

const WMO_WEATHER: Record<number, WeatherInfo> = {
  0: { label: 'Despejado', icon: 'sun' },
  1: { label: 'Mayormente despejado', icon: 'cloudSun' },
  2: { label: 'Parcialmente nublado', icon: 'cloudSun' },
  3: { label: 'Nublado', icon: 'cloud' },
  45: { label: 'Niebla', icon: 'fog' },
  48: { label: 'Niebla con escarcha', icon: 'fog' },
  51: { label: 'Llovizna ligera', icon: 'drizzle' },
  53: { label: 'Llovizna', icon: 'drizzle' },
  55: { label: 'Llovizna intensa', icon: 'drizzle' },
  56: { label: 'Llovizna helada ligera', icon: 'drizzle' },
  57: { label: 'Llovizna helada', icon: 'drizzle' },
  61: { label: 'Lluvia ligera', icon: 'rain' },
  63: { label: 'Lluvia', icon: 'rain' },
  65: { label: 'Lluvia intensa', icon: 'rain' },
  66: { label: 'Lluvia helada ligera', icon: 'rain' },
  67: { label: 'Lluvia helada', icon: 'rain' },
  71: { label: 'Nieve ligera', icon: 'snow' },
  73: { label: 'Nieve', icon: 'snow' },
  75: { label: 'Nieve intensa', icon: 'snow' },
  77: { label: 'Granizo menudo', icon: 'snow' },
  80: { label: 'Chubascos ligeros', icon: 'rain' },
  81: { label: 'Chubascos', icon: 'rain' },
  82: { label: 'Chubascos fuertes', icon: 'rain' },
  85: { label: 'Chubascos de nieve', icon: 'snow' },
  86: { label: 'Chubascos de nieve fuertes', icon: 'snow' },
  95: { label: 'Tormenta', icon: 'storm' },
  96: { label: 'Tormenta con granizo', icon: 'storm' },
  99: { label: 'Tormenta con granizo fuerte', icon: 'storm' },
};

export function getWeatherInfo(weatherCode: number): WeatherInfo {
  return WMO_WEATHER[weatherCode] ?? { label: `Código ${weatherCode}`, icon: 'cloud' };
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

export function degreesToCompass(degrees: number): string {
  const index = Math.round(degrees / 45) % 8;
  return COMPASS_POINTS[index];
}

/** Escala Douglas simplificada a partir de la altura significativa de oleaje. */
export function getSeaState(waveHeight: number | null): string {
  if (waveHeight == null) {
    return 'Sin datos marinos';
  }
  if (waveHeight < 0.1) return 'Calma';
  if (waveHeight < 0.5) return 'Rizada';
  if (waveHeight < 1.25) return 'Marejadilla';
  if (waveHeight < 2.5) return 'Marejada';
  if (waveHeight < 4) return 'Fuerte marejada';
  if (waveHeight < 6) return 'Mar gruesa';
  if (waveHeight < 9) return 'Mar muy gruesa';
  return 'Mar arbolada';
}

/** Clasifica la marea del día por amplitud (pleamar − bajamar), típica de la costa cantábrica. */
export function getTideSize(tides: TideEvent[]): 'pequeña' | 'mediana' | 'grande' | null {
  if (tides.length === 0) {
    return null;
  }

  const highs = tides.filter((tide) => tide.kind === 'pleamar').map((tide) => tide.height);
  const lows = tides.filter((tide) => tide.kind === 'bajamar').map((tide) => tide.height);

  let range: number;
  if (highs.length > 0 && lows.length > 0) {
    range = Math.max(...highs) - Math.min(...lows);
  } else {
    range = Math.max(...tides.map((tide) => Math.abs(tide.height))) * 2;
  }

  if (range < 1.8) {
    return 'pequeña';
  }
  if (range < 2.8) {
    return 'mediana';
  }
  return 'grande';
}

export function formatUpdatedAt(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }
  return date.toLocaleString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  });
}

export function formatTideClock(isoTime: string): string {
  const timePart = isoTime.split('T')[1] ?? isoTime;
  return timePart.slice(0, 5);
}

export function formatForecastDayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) {
    return 'Hoy';
  }

  const [year, month, day] = todayIso.split('-').map(Number);
  const tomorrowIso = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  if (dateIso === tomorrowIso) {
    return 'Mañana';
  }

  const date = new Date(`${dateIso}T12:00:00`);
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' });
  const dayLabel = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayLabel}`;
}

/** Interpreta horas locales sin zona (Open-Meteo / Anuario de Mareas). */
function naiveMinutes(isoTime: string): number | null {
  const match = isoTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) / 60000;
}

const MOON_PHASES = [
  'Luna nueva',
  'Creciente',
  'Cuarto creciente',
  'Gibosa creciente',
  'Luna llena',
  'Gibosa menguante',
  'Cuarto menguante',
  'Menguante',
] as const;

export type MoonPhaseInfo = {
  label: string;
  illumination: number;
};

/** Fase lunar aproximada a partir de la fecha (ciclo sinódico). */
export function getMoonPhase(isoTime: string): MoonPhaseInfo {
  const synodicDays = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const now = naiveMinutes(isoTime) ?? Date.now() / 60000;
  const ageDays = ((now * 60000 - knownNewMoon) / 86400000) % synodicDays;
  const cycle = ((ageDays % synodicDays) + synodicDays) % synodicDays / synodicDays;
  const illumination = Math.round(((1 - Math.cos(cycle * 2 * Math.PI)) / 2) * 100);
  const index = Math.round(cycle * 8) % 8;

  return {
    label: MOON_PHASES[index],
    illumination,
  };
}

export function getSurroundingTides(
  tides: TideEvent[],
  nowIso: string,
): { previous: TideEvent | null; next: TideEvent | null } {
  const now = naiveMinutes(nowIso);
  if (now == null) {
    return { previous: null, next: tides[0] ?? null };
  }

  let previous: TideEvent | null = null;
  let next: TideEvent | null = null;

  for (const tide of tides) {
    const tideMinutes = naiveMinutes(tide.time);
    if (tideMinutes == null) {
      continue;
    }
    if (tideMinutes <= now) {
      previous = tide;
    } else {
      next = tide;
      break;
    }
  }

  return { previous, next };
}

export function formatElapsedSince(fromIso: string, nowIso: string): string | null {
  const from = naiveMinutes(fromIso);
  const now = naiveMinutes(nowIso);
  if (from == null || now == null) {
    return null;
  }

  const minutes = Math.max(0, now - from);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  if (rest === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${rest} min`;
}

export function getNextTide(tides: TideEvent[], nowIso: string): TideEvent | null {
  return getSurroundingTides(tides, nowIso).next;
}
