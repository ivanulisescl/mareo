import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  DEFAULT_COASTAL_COORDS,
  DEFAULT_COASTAL_LABEL,
  fetchPlaceName,
  fetchWeatherAndMarine,
} from '../services/api';
import { extractDailyTides, getNextTide, type Coordinates, type DashboardData } from '../types/weather';

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

  const region = place.region && place.region !== locality ? place.region : null;
  return region ? `${locality}, ${region}` : locality;
}

async function resolvePlaceLabel(coords: Coordinates, usingFallback: boolean): Promise<string> {
  if (usingFallback) {
    return DEFAULT_COASTAL_LABEL;
  }

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
      return fromApi;
    }
  } catch {
    // Si tampoco hay nombre, no mostramos coordenadas.
  }

  return DEFAULT_COASTAL_LABEL;
}

async function resolveCoordinates(): Promise<{ coords: Coordinates; usingFallback: boolean }> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return { coords: DEFAULT_COASTAL_COORDS, usingFallback: true };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      usingFallback: false,
    };
  } catch {
    return { coords: DEFAULT_COASTAL_COORDS, usingFallback: true };
  }
}

export function useWeatherData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { coords, usingFallback } = await resolveCoordinates();
      const [{ weather, marine }, placeLabel] = await Promise.all([
        fetchWeatherAndMarine(coords),
        resolvePlaceLabel(coords, usingFallback),
      ]);

      const dayIso = weather.current.time.slice(0, 10);
      const tidesToday = extractDailyTides(marine?.hourly, dayIso);
      const nextTide = getNextTide(tidesToday, weather.current.time);

      setData({
        weather,
        marine,
        tidesToday,
        nextTide,
        coordinates: coords,
        placeLabel,
        usingFallbackLocation: usingFallback,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudieron cargar las condiciones actuales';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { data, loading, refreshing, error, refresh };
}
