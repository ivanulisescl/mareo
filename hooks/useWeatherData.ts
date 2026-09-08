import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  COLUNGA_COORDS,
  COLUNGA_LABEL,
  FORECAST_DAYS,
  GIJON_COORDS,
  GIJON_LABEL,
  buildDayForecasts,
  fetchOfficialTides,
  fetchPlaceName,
  fetchWeatherAndMarine,
} from '../services/api';
import {
  getSurroundingTides,
  type Coordinates,
  type DashboardData,
  type LocationChoice,
  type TideEvent,
} from '../types/weather';

function looksLikeCoordinates(value: string): boolean {
  return /^-?\d+(?:[.,]\d+)?\s*,\s*-?\d+(?:[.,]\d+)?$/.test(value.trim());
}

function formatExpoPlace(place: Location.LocationGeocodedAddress | null): string | null {
  if (!place) {
    return null;
  }

  const locality = [place.city, place.district, place.subregion, place.name].find(
    (value) => value && !looksLikeCoordinates(value),
  );

  if (!locality) {
    return null;
  }

  return locality.split(',')[0]?.trim() || locality;
}

async function resolveGpsPlaceName(coords: Coordinates): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    const fromDevice = formatExpoPlace(place ?? null);
    if (fromDevice) {
      return fromDevice;
    }
  } catch {
    // En web el geocódigo de Expo suele fallar; se usa la API pública.
  }

  try {
    const fromApi = await fetchPlaceName(coords);
    if (fromApi) {
      return fromApi.split(',')[0]?.trim() || fromApi;
    }
  } catch {
    // Si tampoco hay nombre, no mostramos coordenadas.
  }

  return 'Ubicación actual';
}

async function readGpsCoordinates(): Promise<Coordinates> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permiso de ubicación denegado');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function tidesByDayFromForecast(days: DashboardData['forecastDays']): Record<string, TideEvent[]> {
  return Object.fromEntries(days.map((day) => [day.date, day.tides]));
}

function applyTides(
  current: DashboardData,
  tidesByDay: Record<string, TideEvent[]>,
  stationName: string | null,
): DashboardData {
  const dayIso = current.weather.current.time.slice(0, 10);
  const tidesToday = tidesByDay[dayIso] ?? [];
  const tideTimeline = Object.values(tidesByDay)
    .flat()
    .sort((left, right) => left.time.localeCompare(right.time));
  const { previous: previousTide, next: nextTide } = getSurroundingTides(
    tideTimeline,
    current.weather.current.time,
  );

  return {
    ...current,
    tidesToday,
    previousTide,
    nextTide,
    tideStationName: stationName,
    forecastDays: buildDayForecasts(current.weather, current.marine, tidesByDay),
    tidesLoading: false,
  };
}

export function useWeatherData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice>('colunga');
  const loadGeneration = useRef(0);

  const load = useCallback(async (isRefresh: boolean, choice: LocationChoice) => {
    const generation = ++loadGeneration.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let coords: Coordinates;
      let placeLabel: string;
      let usingGps = false;

      if (choice === 'gijon') {
        coords = GIJON_COORDS;
        placeLabel = GIJON_LABEL;
      } else if (choice === 'colunga') {
        coords = COLUNGA_COORDS;
        placeLabel = COLUNGA_LABEL;
      } else {
        coords = await readGpsCoordinates();
        usingGps = true;
        const locality = await resolveGpsPlaceName(coords);
        placeLabel = `${locality} (ubicación actual)`;
      }

      const { weather, marine } = await fetchWeatherAndMarine(coords);
      if (generation !== loadGeneration.current) {
        return;
      }

      const dayIso = weather.current.time.slice(0, 10);
      setLocationChoice(choice);
      setData((prev) => {
        const keepTides = isRefresh && prev != null;
        return {
          weather,
          marine,
          tidesToday: keepTides ? prev.tidesToday : [],
          previousTide: keepTides ? prev.previousTide : null,
          nextTide: keepTides ? prev.nextTide : null,
          tideStationName: keepTides ? prev.tideStationName : null,
          forecastDays: buildDayForecasts(
            weather,
            marine,
            keepTides ? tidesByDayFromForecast(prev.forecastDays) : {},
          ),
          coordinates: coords,
          placeLabel,
          locationChoice: choice,
          usingGps,
          tidesLoading: true,
        };
      });

      void fetchOfficialTides(coords, dayIso, FORECAST_DAYS)
        .then(({ tidesByDay, stationName }) => {
          if (generation !== loadGeneration.current) {
            return;
          }
          setData((prev) => (prev == null ? prev : applyTides(prev, tidesByDay, stationName)));
        })
        .catch(() => {
          if (generation !== loadGeneration.current) {
            return;
          }
          setData((prev) => (prev == null ? prev : { ...prev, tidesLoading: false }));
        });
    } catch (err) {
      if (generation !== loadGeneration.current) {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'No se pudieron cargar las condiciones actuales';
      setError(
        choice === 'gps'
          ? 'No se pudo obtener la ubicación actual. Revisa el permiso de localización.'
          : message,
      );
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false, 'colunga');
  }, [load]);

  const refresh = useCallback(() => {
    void load(true, locationChoice);
  }, [load, locationChoice]);

  const selectLocation = useCallback(
    (choice: LocationChoice) => {
      void load(true, choice);
    },
    [load],
  );

  return { data, loading, refreshing, error, refresh, locationChoice, selectLocation };
}
