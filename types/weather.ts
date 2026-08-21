export type Coordinates = {
  latitude: number;
  longitude: number;
};

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
};

export type MarineCurrent = {
  time: string;
  interval: number;
  wave_height: number | null;
  wave_direction: number | null;
  wave_period: number | null;
  sea_surface_temperature: number | null;
  sea_level_height_msl: number | null;
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
    sea_level_height_msl: string;
  };
};

export type DashboardData = {
  weather: WeatherApiResponse;
  marine: MarineApiResponse | null;
  coordinates: Coordinates;
  placeLabel: string;
  usingFallbackLocation: boolean;
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
