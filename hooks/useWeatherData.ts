import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  COLUNGA_COORDS,
  COLUNGA_LABEL,
  GIJON_COORDS,
  GIJON_LABEL,
  fetchOfficialTides,
  fetchPlaceName,
  fetchWeatherAndMarine,
} from '../services/api';
import {
  getNextTide,
  type Coordinates,
  type DashboardData,
  type LocationChoice,
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

export function useWeatherData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice>('colunga');

  const load = useCallback(async (isRefresh: boolean, choice: LocationChoice) => {
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
      const dayIso = weather.current.time.slice(0, 10);
      const { tides: tidesToday, stationName } = await fetchOfficialTides(coords, dayIso);
      const nextTide = getNextTide(tidesToday, weather.current.time);

      setLocationChoice(choice);
      setData({
        weather,
        marine,
        tidesToday,
        nextTide,
        tideStationName: stationName,
        coordinates: coords,
        placeLabel,
        locationChoice: choice,
        usingGps,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudieron cargar las condiciones actuales';
      setError(
        choice === 'gps'
          ? 'No se pudo obtener la ubicación actual. Revisa el permiso de localización.'
          : message,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
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
