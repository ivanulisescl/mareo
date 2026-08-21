import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  MapPin,
  Navigation2,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useWeatherData } from './hooks/useWeatherData';
import type { DashboardData, TideEvent, WeatherIconKey } from './types/weather';
import {
  degreesToCompass,
  formatTideClock,
  formatUpdatedAt,
  getSeaState,
  getWeatherInfo,
} from './types/weather';

const COLORS = {
  text: '#E8F4FC',
  muted: '#8BA3B8',
  accent: '#38BDF8',
  wind: '#67E8F9',
  sea: '#2DD4BF',
  temp: '#FBBF24',
  card: 'rgba(14, 36, 58, 0.82)',
  border: 'rgba(56, 189, 248, 0.18)',
  chip: 'rgba(56, 189, 248, 0.12)',
};

const WEATHER_ICONS: Record<WeatherIconKey, LucideIcon> = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function formatMetric(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

export default function App() {
  const { data, loading, refreshing, error, refresh } = useWeatherData();

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#04101C', '#0B1F33', '#06303A']} style={styles.flex}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          {loading && !data ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={styles.loadingLabel}>Consultando condiciones...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={COLORS.accent}
                  colors={[COLORS.accent]}
                />
              }
            >
              <Header data={data} />
              {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
              {data ? <Dashboard data={data} /> : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

function Header({ data }: { data: DashboardData | null }) {
  return (
    <View style={styles.header}>
      <Text style={styles.kicker}>DASHBOARD MARINO</Text>
      <Text style={styles.title}>Mareo</Text>
      <View style={styles.locationRow}>
        <MapPin size={16} color={COLORS.accent} />
        <Text style={styles.locationText}>
          {data?.placeLabel ?? 'Obteniendo ubicación...'}
        </Text>
      </View>
      {data?.usingFallbackLocation ? (
        <Text style={styles.fallbackHint}>
          GPS no disponible. Mostrando Colunga (Asturias).
        </Text>
      ) : null}
      {data ? (
        <Text style={styles.updated}>
          Actualizado {formatUpdatedAt(data.weather.current.time)}
        </Text>
      ) : null}
    </View>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const weather = getWeatherInfo(data.weather.current.weather_code);
  const WeatherIcon = WEATHER_ICONS[weather.icon];
  const current = data.weather.current;
  const marine = data.marine?.current;

  return (
    <View style={styles.cards}>
      <Card>
        <CardHeader icon={WeatherIcon} tint={COLORS.temp} title="Clima" />
        <Text style={styles.heroValue}>{Math.round(current.temperature_2m)}°</Text>
        <Text style={styles.heroCaption}>{weather.label}</Text>
        <View style={styles.metricsRow}>
          <Metric
            icon={Thermometer}
            label="Sensación"
            value={`${Math.round(current.apparent_temperature)}°`}
            tint={COLORS.temp}
          />
          <Metric
            icon={Droplets}
            label="Código WMO"
            value={String(current.weather_code)}
            tint={COLORS.accent}
          />
        </View>
      </Card>

      <Card>
        <CardHeader icon={Wind} tint={COLORS.wind} title="Viento" />
        <Text style={styles.heroValue}>
          {formatMetric(current.wind_speed_10m, 0)}
          <Text style={styles.heroUnit}> km/h</Text>
        </Text>
        <WindDirection degrees={current.wind_direction_10m} />
        <View style={styles.metricsRow}>
          <Metric
            icon={Navigation2}
            label="Dirección"
            value={`${degreesToCompass(current.wind_direction_10m)} · ${Math.round(current.wind_direction_10m)}°`}
            tint={COLORS.wind}
          />
          <Metric
            icon={Wind}
            label="Rachas"
            value={`${formatMetric(current.wind_gusts_10m, 0)} km/h`}
            tint={COLORS.wind}
          />
        </View>
      </Card>

      <Card>
        <CardHeader icon={Waves} tint={COLORS.sea} title="Estado del mar" />
        <Text style={styles.heroValue}>
          {formatMetric(marine?.wave_height)}
          <Text style={styles.heroUnit}> m</Text>
        </Text>
        <Text style={styles.heroCaption}>{getSeaState(marine?.wave_height ?? null)}</Text>
        <View style={styles.metricsRow}>
          <Metric
            icon={Navigation2}
            label="Dirección"
            value={
              marine?.wave_direction != null
                ? `${degreesToCompass(marine.wave_direction)} · ${Math.round(marine.wave_direction)}°`
                : '—'
            }
            tint={COLORS.sea}
          />
          <Metric
            icon={Waves}
            label="Periodo"
            value={`${formatMetric(marine?.wave_period, 0)} s`}
            tint={COLORS.sea}
          />
        </View>
        <View style={styles.metricsRow}>
          <Metric
            icon={Thermometer}
            label="Agua"
            value={
              marine?.sea_surface_temperature != null
                ? `${formatMetric(marine.sea_surface_temperature, 1)}°`
                : '—'
            }
            tint={COLORS.sea}
          />
          <Metric
            icon={Droplets}
            label="Nivel / marea"
            value={
              marine?.sea_level_height_msl != null
                ? `${formatMetric(marine.sea_level_height_msl, 2)} m`
                : '—'
            }
            tint={COLORS.sea}
          />
        </View>
        {data.marine == null ? (
          <Text style={styles.fallbackHint}>
            Sin datos marinos para esta ubicación (posible zona interior).
          </Text>
        ) : null}
      </Card>

      <TidesCard tides={data.tidesToday} nextTide={data.nextTide} />
    </View>
  );
}

function TidesCard({
  tides,
  nextTide,
}: {
  tides: TideEvent[];
  nextTide: TideEvent | null;
}) {
  return (
    <Card>
      <CardHeader icon={Waves} tint={COLORS.sea} title="Mareas de hoy" />
      {nextTide ? (
        <Text style={styles.heroCaption}>
          Próxima {nextTide.kind === 'pleamar' ? 'pleamar' : 'bajamar'}: {formatTideClock(nextTide.time)} ·{' '}
          {formatMetric(nextTide.height, 2)} m
        </Text>
      ) : (
        <Text style={styles.heroCaption}>Sin más mareas previstas hoy</Text>
      )}

      {tides.length === 0 ? (
        <Text style={styles.fallbackHint}>No hay datos de marea para este día.</Text>
      ) : (
        <View style={styles.tideList}>
          {tides.map((tide) => {
            const isNext =
              nextTide != null && nextTide.time === tide.time && nextTide.kind === tide.kind;
            const isHigh = tide.kind === 'pleamar';
            return (
              <View
                key={`${tide.kind}-${tide.time}`}
                style={[styles.tideRow, isNext ? styles.tideRowNext : null]}
              >
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: isHigh ? `${COLORS.wind}22` : `${COLORS.temp}22` },
                  ]}
                >
                  {isHigh ? (
                    <ArrowUp size={16} color={COLORS.wind} />
                  ) : (
                    <ArrowDown size={16} color={COLORS.temp} />
                  )}
                </View>
                <View style={styles.tideInfo}>
                  <Text style={styles.tideKind}>{isHigh ? 'Pleamar' : 'Bajamar'}</Text>
                  <Text style={styles.tideMeta}>
                    {formatTideClock(tide.time)}
                    {isNext ? ' · próxima' : ''}
                  </Text>
                </View>
                <Text style={styles.tideHeight}>{formatMetric(tide.height, 2)} m</Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={styles.fallbackHint}>
        Altura respecto al nivel medio del mar (Open-Meteo). Orientativa, no usar para navegación.
      </Text>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function CardHeader({
  icon: Icon,
  tint,
  title,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={[styles.iconBadge, { backgroundColor: `${tint}22` }]}>
        <Icon size={18} color={tint} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={styles.metric}>
      <Icon size={14} color={tint} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function WindDirection({ degrees }: { degrees: number }) {
  const rotation = useMemo(() => [{ rotate: `${degrees + 180}deg` }], [degrees]);

  return (
    <View style={styles.windDirection}>
      <View style={[styles.compass, { transform: rotation }]}>
        <Navigation2 size={28} color={COLORS.wind} />
      </View>
      <Text style={styles.heroCaption}>
        Desde {degreesToCompass(degrees)} hacia {degreesToCompass((degrees + 180) % 360)}
      </Text>
    </View>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryLabel}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingLabel: {
    color: COLORS.muted,
    fontSize: 15,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  kicker: {
    color: COLORS.accent,
    letterSpacing: 2.4,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  locationText: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
  },
  fallbackHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 8,
  },
  updated: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 6,
  },
  cards: {
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroValue: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.muted,
  },
  heroCaption: {
    color: COLORS.muted,
    fontSize: 15,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  metric: {
    flex: 1,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tideList: {
    gap: 8,
  },
  tideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    padding: 12,
  },
  tideRowNext: {
    borderWidth: 1,
    borderColor: COLORS.sea,
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  tideInfo: {
    flex: 1,
    gap: 2,
  },
  tideKind: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  tideMeta: {
    color: COLORS.muted,
    fontSize: 13,
  },
  tideHeight: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  windDirection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  compass: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryLabel: {
    color: '#FECACA',
    fontWeight: '700',
  },
});
