import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  DEFAULT_COASTAL_COORDS,
  DEFAULT_COASTAL_LABEL,
  fetchWeatherAndMarine,
} from '../services/api';
import type { Coordinates, DashboardData } from '../types/weather';

async function resolvePlaceLabel(coords: Coordinates, usingFallback: boolean): Promise<string> {
  if (usingFallback) {
    return DEFAULT_COASTAL_LABEL;
  }

  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) {
      return `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
    }

    const parts = [place.city ?? place.subregion, place.region, place.country].filter(Boolean);
    return parts.length > 0
      ? parts.join(', ')
      : `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
  } catch {
    return `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
  }
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

      setData({
        weather,
        marine,
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
