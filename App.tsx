import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Navigation2,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const headerLogo = require('./assets/logo.png');
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useWeatherData } from './hooks/useWeatherData';
import type { DashboardData, DayForecast, LocationChoice, TideEvent, WeatherIconKey } from './types/weather';
import {
  degreesToCompass,
  formatElapsedSince,
  formatForecastDayLabel,
  formatTideClock,
  getMoonPhase,
  getSeaState,
  getTideSize,
  getWeatherInfo,
} from './types/weather';

const COLORS = {
  text: '#E8F4FC',
  muted: '#8BA3B8',
  accent: '#38BDF8',
  wind: '#67E8F9',
  sea: '#2DD4BF',
  temp: '#FBBF24',
  moon: '#C7D2FE',
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

type AppTab = 'resumen' | 'completa' | 'prediccion';

const GREETING_PHRASES = [
  'Buenos días, gordi. Que el mar te mire con cariño.',
  'Hola, pichurrina. Hoy también hay marea para nosotros.',
  'Ceci, que tengas un día suave, como mar llana.',
  'Te quiero, gordi. Mira el cielo un momento por mí.',
  'Pichurrina, que el viento te traiga solo cosas buenas.',
  'Ceci, la luna y la mar van contigo.',
  'Gordi, que no te falte ni brisa ni abrigo.',
  'Hola, pichurrina. Un saludo desde la orilla, para ti.',
  'Ceci, hoy el Cantábrico también piensa en ti.',
  'Te echo de menos, gordi. Que la marea te dé un rato bonito.',
  'Pichurrina, que el día te trate tan bien como tú me tratas.',
  'Ceci, eres mi puerto. Que hoy haya calma.',
  'Gordi, un beso antes de mirar el parte.',
  'Pichurrina, que encuentres un claro entre nubes.',
  'Ceci, te quiero más que a las pleamares de septiembre.',
];

function pickGreeting(): string {
  return GREETING_PHRASES[Math.floor(Math.random() * GREETING_PHRASES.length)];
}

function formatMetric(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

export default function App() {
  const { data, loading, refreshing, error, refresh, locationChoice, selectLocation } =
    useWeatherData();
  const [tab, setTab] = useState<AppTab>('resumen');
  const greeting = useMemo(() => pickGreeting(), []);
  const waitingForData = loading && !data;

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#04101C', '#0B1F33', '#06303A']} style={styles.flex}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          {waitingForData ? (
            <View style={styles.greetingInner}>
              <Image source={headerLogo} style={styles.greetingLogo} />
              <Text style={styles.greetingTitle}>CliMarEo</Text>
              <Text style={styles.greetingPhrase}>{greeting}</Text>
            </View>
          ) : (
            <ScrollView
              key={tab}
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
              <Header
                data={data}
                locationChoice={locationChoice}
                onSelectLocation={selectLocation}
              />
              {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
              {data ? (
                tab === 'resumen' ? (
                  <Summary data={data} />
                ) : tab === 'completa' ? (
                  <Dashboard data={data} />
                ) : (
                  <Forecast data={data} />
                )
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
        {waitingForData ? null : (
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.tabBarSafe}>
            <BottomNav tab={tab} onChange={setTab} />
          </SafeAreaView>
        )}
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const LOCATION_OPTIONS: Array<{ id: LocationChoice; label: string }> = [
  { id: 'gijon', label: 'Gijón' },
  { id: 'colunga', label: 'Colunga' },
  { id: 'gps', label: 'Ubicación actual' },
];

function Header({
  data,
  locationChoice,
  onSelectLocation,
}: {
  data: DashboardData | null;
  locationChoice: LocationChoice;
  onSelectLocation: (choice: LocationChoice) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Image source={headerLogo} style={styles.headerLogo} accessibilityLabel="Logo de CliMarEo" />
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>Climatología y estado de la mar</Text>
          <Text style={styles.title}>CliMarEo</Text>
        </View>
      </View>
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={styles.locationRow}
        accessibilityRole="button"
        accessibilityLabel="Cambiar localidad"
      >
        <MapPin size={16} color={COLORS.accent} />
        <Text style={styles.locationText}>
          {data?.placeLabel ?? 'Obteniendo ubicación...'}
        </Text>
        <ChevronDown size={18} color={COLORS.accent} />
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Elegir localidad</Text>
            {LOCATION_OPTIONS.map((option) => {
              const selected = locationChoice === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelectLocation(option.id);
                    setPickerOpen(false);
                  }}
                  style={[styles.pickerOption, selected ? styles.pickerOptionActive : null]}
                >
                  <Text style={[styles.pickerOptionLabel, selected ? styles.pickerOptionLabelActive : null]}>
                    {option.label}
                  </Text>
                  {selected ? <Check size={18} color={COLORS.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Summary({ data }: { data: DashboardData }) {
  const weather = getWeatherInfo(data.weather.current.weather_code);
  const WeatherIcon = WEATHER_ICONS[weather.icon];
  const current = data.weather.current;
  const marine = data.marine?.current;
  const nextTide = data.nextTide;
  const previousTide = data.previousTide;
  const tideSize = getTideSize(data.tidesToday);
  const tideTrend =
    previousTide == null
      ? null
      : previousTide.kind === 'bajamar'
        ? 'Subiendo'
        : 'Bajando';
  const tideElapsed =
    previousTide == null
      ? null
      : formatElapsedSince(previousTide.time, data.weather.current.time);
  const tideKindLabel = (kind: 'pleamar' | 'bajamar') =>
    kind === 'pleamar' ? 'Pleamar' : 'Bajamar';
  const tideHeadline =
    tideTrend && tideElapsed
      ? `${tideTrend} desde hace ${tideElapsed}`
      : tideTrend ?? 'Sin datos';
  const tideDetails = [
    previousTide
      ? `Anterior ${tideKindLabel(previousTide.kind)} ${formatTideClock(previousTide.time)}`
      : null,
    nextTide
      ? `Próxima ${tideKindLabel(nextTide.kind)} ${formatTideClock(nextTide.time)}`
      : 'Sin más mareas previstas',
    tideSize ? `Marea ${tideSize}` : null,
  ].filter((line): line is string => Boolean(line));
  const moon = getMoonPhase(data.weather.current.time);

  return (
    <View style={styles.cards}>
      <Card>
        <View style={styles.summaryHero}>
          <WeatherIcon size={28} color={COLORS.temp} />
          <Text style={styles.summaryTemp}>{Math.round(current.temperature_2m)}°</Text>
          <Text style={styles.summaryWeather}>{weather.label}</Text>
        </View>
        <View style={styles.summaryList}>
          <SummaryRow
            icon={Wind}
            tint={COLORS.wind}
            label="Viento"
            value={`${formatMetric(current.wind_speed_10m, 0)} km/h ${degreesToCompass(current.wind_direction_10m)} · Rachas de ${formatMetric(current.wind_gusts_10m, 0)} km/h`}
          />
          <SummaryRow
            icon={Waves}
            tint={COLORS.sea}
            label="Mar"
            value={`${getSeaState(marine?.wave_height ?? null)} · Olas de ${formatMetric(marine?.wave_height)} m`}
          />
          <SummaryRow
            icon={Thermometer}
            tint={COLORS.sea}
            label="Agua"
            value={
              marine?.sea_surface_temperature != null
                ? `${formatMetric(marine.sea_surface_temperature, 1)}°`
                : '—'
            }
          />
          <SummaryRow
            icon={tideTrend === 'Subiendo' ? ArrowUp : ArrowDown}
            tint={COLORS.sea}
            label="Marea"
            value={tideHeadline}
            details={tideDetails}
          />
          <SummaryRow
            icon={Moon}
            tint={COLORS.moon}
            label="Luna"
            value={`${moon.label} · ${moon.illumination}%`}
          />
        </View>
      </Card>
    </View>
  );
}

function Forecast({ data }: { data: DashboardData }) {
  const todayIso = data.weather.current.time.slice(0, 10);
  const [openDate, setOpenDate] = useState(data.forecastDays[0]?.date ?? null);

  if (data.forecastDays.length === 0) {
    return (
      <View style={styles.cards}>
        <Card>
          <Text style={styles.fallbackHint}>No hay predicción disponible ahora mismo.</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.cards}>
      {data.forecastDays.map((day) => (
        <ForecastDayCard
          key={day.date}
          day={day}
          todayIso={todayIso}
          expanded={openDate === day.date}
          onToggle={() => setOpenDate((current) => (current === day.date ? null : day.date))}
        />
      ))}
      <Text style={styles.fallbackHint}>
        Clima y mar: Open-Meteo · Mareas IHM
        {data.tideStationName ? ` · estación ${data.tideStationName}` : ''}
        . Alturas sobre el nivel medio del mar.
      </Text>
    </View>
  );
}

function ForecastDayCard({
  day,
  todayIso,
  expanded,
  onToggle,
}: {
  day: DayForecast;
  todayIso: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const weather = getWeatherInfo(day.weatherCode);
  const WeatherIcon = WEATHER_ICONS[weather.icon];

  return (
    <Card>
      <Pressable
        onPress={onToggle}
        style={styles.forecastHeader}
        accessibilityRole="button"
        accessibilityLabel={`${formatForecastDayLabel(day.date, todayIso)}. ${expanded ? 'Ocultar detalle' : 'Ver detalle'}`}
      >
        <View style={[styles.iconBadge, { backgroundColor: `${COLORS.temp}22` }]}>
          <WeatherIcon size={18} color={COLORS.temp} />
        </View>
        <View style={styles.forecastHeaderText}>
          <Text style={styles.forecastDay}>{formatForecastDayLabel(day.date, todayIso)}</Text>
          <Text style={styles.forecastSummary}>{weather.label}</Text>
          <Text style={styles.forecastSummary}>
            {`${formatMetric(day.windSpeedMax, 0)} km/h`}
            {day.waveHeightMax != null ? ` · ${getSeaState(day.waveHeightMax)}` : ''}
            {day.wavePeriodMax != null ? ` · ${formatMetric(day.wavePeriodMax, 0)} s` : ''}
          </Text>
        </View>
        <Text style={styles.forecastTemps}>
          {Math.round(day.temperatureMax)}°
          <Text style={styles.forecastTempMin}> / {Math.round(day.temperatureMin)}°</Text>
        </Text>
        <ChevronDown
          size={18}
          color={COLORS.accent}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.forecastBody}>
          <SummaryRow
            icon={Wind}
            tint={COLORS.wind}
            label="Viento"
            value={`${formatMetric(day.windSpeedMax, 0)} km/h ${degreesToCompass(day.windDirectionDominant)} · rachas ${formatMetric(day.windGustsMax, 0)}`}
          />
          <SummaryRow
            icon={Waves}
            tint={COLORS.sea}
            label="Mar"
            value={`${formatMetric(day.waveHeightMax)} m · ${getSeaState(day.waveHeightMax)}${
              day.wavePeriodMax != null ? ` · ${formatMetric(day.wavePeriodMax, 0)} s` : ''
            }`}
          />
          <SummaryRow
            icon={Thermometer}
            tint={COLORS.sea}
            label="Agua"
            value={
              day.waterTemperature != null ? `${formatMetric(day.waterTemperature, 1)}°` : '—'
            }
          />
          {day.tides.length === 0 ? (
            <Text style={styles.fallbackHint}>Sin datos de marea para este día.</Text>
          ) : (
            <View style={styles.tideList}>
              {day.tides.map((tide) => {
                const isHigh = tide.kind === 'pleamar';
                return (
                  <View key={`${tide.kind}-${tide.time}`} style={styles.tideRow}>
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
                      <Text style={styles.tideMeta}>{formatTideClock(tide.time)}</Text>
                    </View>
                    <Text style={styles.tideHeight}>{formatMetric(tide.height, 2)} m</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function SummaryRow({
  icon: Icon,
  tint,
  label,
  value,
  details,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  details?: string[];
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.iconBadge, { backgroundColor: `${tint}22` }]}>
        <Icon size={16} color={tint} />
      </View>
      <View style={styles.tideInfo}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.summaryRowValue}>{value}</Text>
        {details?.map((line) => (
          <Text key={line} style={styles.summaryRowDetail}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const weather = getWeatherInfo(data.weather.current.weather_code);
  const WeatherIcon = WEATHER_ICONS[weather.icon];
  const current = data.weather.current;
  const marine = data.marine?.current;
  const moon = getMoonPhase(current.time);

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
            icon={Moon}
            label="Luna"
            value={`${moon.label} · ${moon.illumination}%`}
            tint={COLORS.moon}
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
              marine?.wave_direction != null ? degreesToCompass(marine.wave_direction) : '—'
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
        </View>
        {data.marine == null ? (
          <Text style={styles.fallbackHint}>
            Sin datos marinos para esta ubicación (posible zona interior).
          </Text>
        ) : null}
      </Card>

      <TidesCard
        tides={data.tidesToday}
        nextTide={data.nextTide}
        stationName={data.tideStationName}
      />
    </View>
  );
}

function TidesCard({
  tides,
  nextTide,
  stationName,
}: {
  tides: TideEvent[];
  nextTide: TideEvent | null;
  stationName: string | null;
}) {
  return (
    <Card>
      <CardHeader icon={Waves} tint={COLORS.sea} title="Mareas de hoy" />
      {stationName ? (
        <Text style={styles.heroCaption}>Estación: {stationName}</Text>
      ) : null}
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
        Predicción IHM · hora peninsular. Alturas sobre el nivel medio del mar.
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

function BottomNav({ tab, onChange }: { tab: AppTab; onChange: (next: AppTab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TabButton
        active={tab === 'resumen'}
        icon={LayoutGrid}
        label="Resumen"
        onPress={() => onChange('resumen')}
      />
      <TabButton
        active={tab === 'completa'}
        icon={List}
        label="Completa"
        onPress={() => onChange('completa')}
      />
      <TabButton
        active={tab === 'prediccion'}
        icon={CalendarDays}
        label="Predicción"
        onPress={() => onChange('prediccion')}
      />
    </View>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const color = active ? COLORS.accent : COLORS.muted;
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Icon size={20} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greetingInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  greetingLogo: {
    width: 96,
    height: 96,
  },
  greetingTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '800',
  },
  greetingPhrase: {
    color: COLORS.accent,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '600',
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 64,
    height: 64,
  },
  titleBlock: {
    flex: 1,
  },
  kicker: {
    color: COLORS.accent,
    letterSpacing: 0.4,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 4,
    paddingRight: 8,
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 16, 28, 0.72)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  pickerSheet: {
    backgroundColor: '#0B1F33',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerOptionActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  pickerOptionLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOptionLabelActive: {
    color: COLORS.accent,
  },
  summaryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  summaryTemp: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  summaryWeather: {
    color: COLORS.muted,
    fontSize: 15,
    flex: 1,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    padding: 12,
  },
  summaryRowValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  summaryRowDetail: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  tabBarSafe: {
    backgroundColor: 'rgba(4, 16, 28, 0.96)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  forecastHeaderText: {
    flex: 1,
  },
  forecastDay: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  forecastSummary: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  forecastTemps: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  forecastTempMin: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  forecastBody: {
    marginTop: 14,
    gap: 10,
  },
});
