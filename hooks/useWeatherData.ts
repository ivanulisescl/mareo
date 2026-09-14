import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMadridNow } from './useMadridNow';

const LOCATION_STORAGE_KEY = 'climareo-location';
const DEFAULT_LOCATION: LocationChoice = 'colunga';

function isLocationChoice(value: string | null): value is LocationChoice {
  return value === 'gijon' || value === 'colunga' || value === 'gps';
}

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
  return {
    ...current,
    tideStationName: stationName,
    forecastDays: buildDayForecasts(current.weather, current.marine, tidesByDay),
    tidesLoading: false,
  };
}

function withLiveTides(current: DashboardData, nowIso: string): DashboardData {
  const tidesByDay = tidesByDayFromForecast(current.forecastDays);
  const tideTimeline = Object.values(tidesByDay)
    .flat()
    .sort((left, right) => left.time.localeCompare(right.time));
  const { previous: previousTide, next: nextTide } = getSurroundingTides(
    tideTimeline,
    nowIso,
  );
  const dayIso = nowIso.slice(0, 10);

  return {
    ...current,
    tidesToday: tidesByDay[dayIso] ?? [],
    previousTide,
    nextTide,
  };
}

export function useWeatherData() {
  const [snapshot, setSnapshot] = useState<DashboardData | null>(null);
  const nowIso = useMadridNow();
  const data = useMemo(
    () => (snapshot == null ? null : withLiveTides(snapshot, nowIso)),
    [snapshot, nowIso],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice>(DEFAULT_LOCATION);
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
      void AsyncStorage.setItem(LOCATION_STORAGE_KEY, choice).catch(() => {});
      setSnapshot((prev) => {
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
          setSnapshot((prev) => (prev == null ? prev : applyTides(prev, tidesByDay, stationName)));
        })
        .catch(() => {
          if (generation !== loadGeneration.current) {
            return;
          }
          setSnapshot((prev) => (prev == null ? prev : { ...prev, tidesLoading: false }));
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
    let cancelled = false;

    void (async () => {
      let initial: LocationChoice = DEFAULT_LOCATION;
      try {
        const stored = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
        if (isLocationChoice(stored)) {
          initial = stored;
        }
      } catch {
        // Si falla el storage, se usa Colunga.
      }

      if (!cancelled) {
        setLocationChoice(initial);
        void load(false, initial);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  return { data, nowIso, loading, refreshing, error, refresh, locationChoice, selectLocation };
}
