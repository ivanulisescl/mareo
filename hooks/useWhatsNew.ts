import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import novedades from '../novedades.json';

const SEEN_VERSION_KEY = 'climareo-seen-version';
/** Quien ya eligió ubicación ha usado la app; el tema se escribe siempre al arrancar. */
const PRIOR_USE_KEY = 'climareo-location';

type Changelog = Record<string, string[]>;

const CHANGELOG = novedades as Changelog;

function versionParts(value: string): number[] {
  return value.split('.').map((part) => {
    const parsed = Number(part);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function notesSince(fromVersion: string, toVersion: string): string[] {
  return Object.entries(CHANGELOG)
    .filter(
      ([version]) =>
        compareVersions(version, fromVersion) > 0 && compareVersions(version, toVersion) <= 0,
    )
    .sort(([left], [right]) => compareVersions(left, right))
    .flatMap(([, notes]) => notes);
}

export function useWhatsNew(currentVersion: string) {
  const [notes, setNotes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_VERSION_KEY);
        if (cancelled) {
          return;
        }

        if (seen == null) {
          const priorUse = await AsyncStorage.getItem(PRIOR_USE_KEY);
          if (cancelled) {
            return;
          }
          if (priorUse) {
            const currentNotes = CHANGELOG[currentVersion] ?? [];
            if (currentNotes.length === 0) {
              await AsyncStorage.setItem(SEEN_VERSION_KEY, currentVersion);
              setNotes([]);
              return;
            }
            setNotes(currentNotes);
            return;
          }
          await AsyncStorage.setItem(SEEN_VERSION_KEY, currentVersion);
          setNotes([]);
          return;
        }

        if (seen === currentVersion) {
          setNotes([]);
          return;
        }

        const collected = notesSince(seen, currentVersion);
        if (collected.length === 0) {
          await AsyncStorage.setItem(SEEN_VERSION_KEY, currentVersion);
          setNotes([]);
          return;
        }
        setNotes(collected);
      } catch {
        if (!cancelled) {
          setNotes([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentVersion]);

  const acknowledge = useCallback(() => {
    setNotes([]);
    void AsyncStorage.setItem(SEEN_VERSION_KEY, currentVersion).catch(() => {});
  }, [currentVersion]);

  return { notes, acknowledge };
}
