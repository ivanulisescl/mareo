import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { madridNowIso } from '../types/weather';

const MINUTE_MS = 60_000;

function msUntilNextMinute(now = Date.now()): number {
  return MINUTE_MS - (now % MINUTE_MS) + 50;
}

/** Hora peninsular actual, actualizada al cambio de minuto y al volver a primer plano. */
export function useMadridNow(): string {
  const [nowIso, setNowIso] = useState(() => madridNowIso());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = () => {
      setNowIso(madridNowIso());
    };

    const startAligned = () => {
      clearTimers();
      tick();
      timeoutId = setTimeout(() => {
        tick();
        intervalId = setInterval(tick, MINUTE_MS);
        timeoutId = null;
      }, msUntilNextMinute());
    };

    startAligned();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startAligned();
      }
    });

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, []);

  return nowIso;
}
