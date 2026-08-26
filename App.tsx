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
  Clock,
  CloudSun,
  Droplet,
  Droplets,
  Gauge,
  Info,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

const headerLogo = require('./assets/logo.png');
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import greetingPhrases from './frases.json';
import greetingPhrasesByDate from './frases-fechas.json';
import { useWeatherData } from './hooks/useWeatherData';
import type { DashboardData, DayForecast, HourlyDetail, LocationChoice, TideEvent, WeatherIconKey } from './types/weather';
import {
  degreesToCompass,
  formatElapsedSince,
  formatForecastDayLabel,
  formatHourlyDayLabel,
  formatTideClock,
  getMoonPhase,
  getSeaState,
  getBeaufortLabel,
  getHourlyDetailForDay,
  getTideForHour,
  getTideSize,
  getTodayUvMax,
  getUvLabel,
  getUpcomingHourlyDetail,
  groupHoursByDay,
  getTodayHourlyRain,
  getTodayHourlyWaves,
  getTodayHourlyWeather,
  getTodayHourlyWind,
  getTodayPrecipitationSum,
  getWeatherInfo,
} from './types/weather';
import { ThemeProvider, useTheme, type ThemeColors } from './theme';

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
type HourlyLayout = 'compact' | 'grouped';

const HOURLY_LAYOUT_KEY = 'climareo-hourly-layout';

function useHourlyLayout() {
  const [layout, setLayout] = useState<HourlyLayout>('grouped');

  useEffect(() => {
    AsyncStorage.getItem(HOURLY_LAYOUT_KEY)
      .then((stored) => {
        if (stored === 'compact' || stored === 'grouped') {
          setLayout(stored);
        }
      })
      .catch(() => {});
  }, []);

  const selectLayout = useCallback((next: HourlyLayout) => {
    setLayout(next);
    AsyncStorage.setItem(HOURLY_LAYOUT_KEY, next).catch(() => {});
  }, []);

  return { layout, selectLayout };
}

function todayMonthDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function pickFromList(list: string[]): string {
  if (list.length === 0) {
    return 'Hola.';
  }
  return list[Math.floor(Math.random() * list.length)];
}

function pickGreeting(): string {
  const dated = (greetingPhrasesByDate as Record<string, string[]>)[todayMonthDay()];
  if (dated && dated.length > 0) {
    return pickFromList(dated);
  }
  return pickFromList(greetingPhrases);
}

function formatMetric(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function formatRainAmount(value: number | null | undefined): string {
  const formatted = formatMetric(value);
  return formatted === '0.0' ? '-' : formatted;
}

type AppChrome = {
  mode: 'light' | 'dark';
  COLORS: ThemeColors;
  styles: any;
  toggleTheme: () => void;
  layout: HourlyLayout;
  selectLayout: (next: HourlyLayout) => void;
};

const AppChromeContext = createContext<AppChrome | null>(null);

function useAppChrome() {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error('useAppChrome debe usarse dentro de App');
  }
  return ctx;
}

function ThemeToggle() {
  const { mode, toggleTheme, COLORS, styles } = useAppChrome();
  const nextMode = mode === 'dark' ? 'claro' : 'oscuro';
  const Icon = mode === 'dark' ? Sun : Moon;

  return (
    <Pressable
      onPress={toggleTheme}
      style={styles.themeToggle}
      accessibilityRole="button"
      accessibilityLabel={`Cambiar a modo ${nextMode}`}
    >
      <Icon size={20} color={COLORS.accent} />
    </Pressable>
  );
}

const INFO_SOURCES: Array<{ title: string; body: string }> = [
  {
    title: 'Clima',
    body: 'Tiempo, temperatura, lluvia, viento, humedad y presión. Previsión de Open-Meteo.',
  },
  {
    title: 'Mar',
    body: 'Olas, periodo y temperatura del agua. Open-Meteo.',
  },
  {
    title: 'Mareas',
    body: 'Anuario de Mareas del Instituto Hidrográfico de la Marina (IHM).',
  },
  {
    title: 'Luna',
    body: 'Cálculo local a partir del ciclo lunar.',
  },
];

const BEAUFORT_SCALE: Array<{ name: string; range: string }> = [
  { name: 'Calma', range: '< 1 km/h' },
  { name: 'Ventolina', range: '1–5' },
  { name: 'Flojito', range: '6–11' },
  { name: 'Flojo', range: '12–19' },
  { name: 'Bonancible', range: '20–28' },
  { name: 'Fresquito', range: '29–38' },
  { name: 'Fresco', range: '39–49' },
  { name: 'Frescachón', range: '50–61' },
  { name: 'Temporal', range: '62–74' },
  { name: 'Temporal fuerte', range: '75–88' },
  { name: 'Temporal duro', range: '89–102' },
  { name: 'Temporal muy duro', range: '103–117' },
  { name: 'Huracán', range: '≥ 118' },
];

const DOUGLAS_SCALE: Array<{ name: string; range: string }> = [
  { name: 'Calma', range: '< 0,1 m' },
  { name: 'Rizada', range: '0,1–0,5 m' },
  { name: 'Marejadilla', range: '0,5–1,25 m' },
  { name: 'Marejada', range: '1,25–2,5 m' },
  { name: 'Fuerte marejada', range: '2,5–4 m' },
  { name: 'Mar gruesa', range: '4–6 m' },
  { name: 'Mar muy gruesa', range: '6–9 m' },
  { name: 'Mar arbolada', range: '≥ 9 m' },
];

const UV_SCALE: Array<{ name: string; range: string }> = [
  { name: 'Bajo', range: '0–2' },
  { name: 'Moderado', range: '3–5' },
  { name: 'Alto', range: '6–7' },
  { name: 'Muy alto', range: '8–10' },
  { name: 'Extremo', range: '≥ 11' },
];

const TIDE_SCALE: Array<{ name: string; range: string }> = [
  { name: 'Pequeña', range: '< 1,8 m' },
  { name: 'Mediana', range: '1,8–2,8 m' },
  { name: 'Grande', range: '≥ 2,8 m' },
];

function ScaleTable({ rows }: { rows: Array<{ name: string; range: string }> }) {
  const { styles } = useAppChrome();
  return (
    <View style={styles.infoScale}>
      {rows.map((row) => (
        <View key={row.name} style={styles.infoScaleRow}>
          <Text style={styles.infoScaleName}>{row.name}</Text>
          <Text style={styles.infoScaleRange}>{row.range}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { styles } = useAppChrome();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.infoSheet}>
          <Text style={styles.pickerTitle}>Información</Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.infoSheetScroll}
            contentContainerStyle={styles.infoSheetContent}
          >
            <Text style={styles.infoSectionTitle}>Fuentes de los datos</Text>
            {INFO_SOURCES.map((source) => (
              <View key={source.title} style={styles.infoSourceCard}>
                <Text style={styles.infoSourceTitle}>{source.title}</Text>
                <Text style={styles.infoSourceBody}>{source.body}</Text>
              </View>
            ))}

            <Text style={styles.infoSectionTitle}>Cómo se califica</Text>

            <Text style={styles.infoBlockTitle}>Tiempo</Text>
            <Text style={styles.infoBody}>
              Códigos WMO de Open-Meteo, por ejemplo: Despejado, Nublado, Llovizna, Lluvia,
              Chubascos, Nieve o Tormenta.
            </Text>

            <Text style={styles.infoBlockTitle}>Viento</Text>
            <Text style={styles.infoBody}>Escala Beaufort con el viento medio (km/h).</Text>
            <ScaleTable rows={BEAUFORT_SCALE} />
            <Text style={styles.infoNote}>Dirección: N, NE, E, SE, S, SO, O, NO.</Text>

            <Text style={styles.infoBlockTitle}>Mar</Text>
            <Text style={styles.infoBody}>
              Escala Douglas simplificada, según la altura significativa de ola.
            </Text>
            <ScaleTable rows={DOUGLAS_SCALE} />

            <Text style={styles.infoBlockTitle}>Índice UV</Text>
            <Text style={styles.infoBody}>
              Categorías de la OMS sobre el índice redondeado. Indica la intensidad de la
              radiación ultravioleta solar.
            </Text>
            <ScaleTable rows={UV_SCALE} />
            <Text style={styles.infoNote}>
              Desde «Alto» conviene protección solar, sombra y gafas; en «Muy alto» y «Extremo»,
              evita la exposición en las horas centrales del día.
            </Text>

            <Text style={styles.infoBlockTitle}>Marea del día</Text>
            <Text style={styles.infoBody}>
              Amplitud (pleamar máxima − bajamar mínima), orientada a la costa cantábrica.
            </Text>
            <ScaleTable rows={TIDE_SCALE} />
          </ScrollView>
          <Pressable onPress={onClose} style={styles.infoClose} accessibilityRole="button">
            <Text style={styles.infoCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HeaderActions({ greeting }: { greeting?: boolean }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { COLORS, styles } = useAppChrome();

  return (
    <View style={[styles.headerActions, greeting ? styles.headerActionsGreeting : null]}>
      <Pressable
        onPress={() => setInfoOpen(true)}
        style={styles.themeToggle}
        accessibilityRole="button"
        accessibilityLabel="Información sobre fuentes y criterios"
      >
        <Info size={20} color={COLORS.accent} />
      </Pressable>
      <ThemeToggle />
      <InfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppScreen />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function AppScreen() {
  const { data, refreshing, error, refresh, locationChoice, selectLocation } =
    useWeatherData();
  const [tab, setTab] = useState<AppTab>('resumen');
  const [showGreeting, setShowGreeting] = useState(true);
  const greeting = useMemo(() => pickGreeting(), []);
  const { mode, colors, toggleTheme } = useTheme();
  const { layout, selectLayout } = useHourlyLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chrome = useMemo(
    () => ({ mode, COLORS: colors, styles, toggleTheme, layout, selectLayout }),
    [mode, colors, styles, toggleTheme, layout, selectLayout],
  );

  return (
    <AppChromeContext.Provider value={chrome}>
      <LinearGradient
        key={mode}
        colors={colors.gradient}
        style={[styles.flex, { backgroundColor: colors.gradient[0] }]}
      >
        <StatusBar style={colors.statusBar} />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          {showGreeting ? (
            <View style={styles.flex}>
              <Pressable
                style={styles.flex}
                onPress={() => setShowGreeting(false)}
                accessibilityRole="button"
                accessibilityLabel="Continuar a CliMarEo"
              >
                <View style={styles.greetingInner} pointerEvents="none">
                  <Image source={headerLogo} style={styles.greetingLogo} />
                  <Text style={styles.greetingTitle}>CliMarEo</Text>
                  <Text style={styles.greetingPhrase}>{greeting}</Text>
                  <Text style={styles.greetingHint}>Toca para continuar</Text>
                </View>
              </Pressable>
              <HeaderActions greeting />
            </View>
          ) : (
            <ScrollView
              key={tab}
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
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
        {showGreeting ? null : (
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.tabBarSafe}>
            <BottomNav tab={tab} onChange={setTab} />
          </SafeAreaView>
        )}
      </LinearGradient>
    </AppChromeContext.Provider>
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
  const { COLORS, styles } = useAppChrome();

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Image source={headerLogo} style={styles.headerLogo} accessibilityLabel="Logo de CliMarEo" />
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>Climatología y estado de la mar</Text>
          <Text style={styles.title}>CliMarEo</Text>
        </View>
        <HeaderActions />
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
  const { COLORS, styles } = useAppChrome();
  const [windOpen, setWindOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [rainOpen, setRainOpen] = useState(false);
  const [seaOpen, setSeaOpen] = useState(false);
  const [tidesOpen, setTidesOpen] = useState(false);
  const hourlyWind = useMemo(() => getTodayHourlyWind(data.weather), [data.weather]);
  const hourlyWeather = useMemo(() => getTodayHourlyWeather(data.weather), [data.weather]);
  const hourlyRain = useMemo(() => getTodayHourlyRain(data.weather), [data.weather]);
  const hourlyWaves = useMemo(
    () => getTodayHourlyWaves(data.marine, data.weather.current.time),
    [data.marine, data.weather.current.time],
  );
  const weather = getWeatherInfo(data.weather.current.weather_code);
  const WeatherIcon = WEATHER_ICONS[weather.icon];
  const current = data.weather.current;
  const marine = data.marine?.current;
  const nextTide = data.nextTide;
  const previousTide = data.previousTide;
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
  const tideHeadline =
    tideTrend && tideElapsed
      ? `${tideTrend} desde hace ${tideElapsed}`
      : tideTrend ?? 'Sin datos';
  const moon = getMoonPhase(data.weather.current.time);
  const waterTemp =
    marine?.sea_surface_temperature != null
      ? `${formatMetric(marine.sea_surface_temperature, 1)}°`
      : '—';
  const currentRain = current.precipitation ?? 0;
  const rainProbability = hourlyRain[0]?.probability ?? null;
  const rainToday = getTodayPrecipitationSum(data.weather);
  const rainHeadline =
    currentRain >= 0.1
      ? rainProbability != null
        ? `${formatMetric(currentRain)} mm · ${Math.round(rainProbability)}%`
        : `${formatMetric(currentRain)} mm`
      : rainToday != null && rainToday >= 0.1
        ? `No llueve · ${formatMetric(rainToday)} mm hoy`
        : 'Sin lluvia prevista hoy';
  const uvNow = current.uv_index ?? null;
  const uvMaxToday = getTodayUvMax(data.weather);
  const uvHeadline =
    uvNow != null ? `${Math.round(uvNow)} · ${getUvLabel(uvNow)}` : 'Sin datos';
  const uvDetail = uvMaxToday != null ? `Máx. hoy ${Math.round(uvMaxToday)}` : undefined;

  return (
    <View style={styles.cards}>
      <Card>
        <View style={styles.summaryList}>
          <SummaryRow
            icon={WeatherIcon}
            tint={COLORS.temp}
            label="Tiempo"
            value={`${Math.round(current.temperature_2m)}° · ${weather.label}`}
            expandable
            expanded={weatherOpen}
            onToggle={() => setWeatherOpen((open) => !open)}
            extra={
              hourlyWeather.length === 0 ? (
                <Text style={styles.summaryRowDetail}>Sin previsión horaria para hoy.</Text>
              ) : (
                <View style={styles.hourlyTable}>
                  <View style={styles.hourlyLabels}>
                    <View style={styles.hourlyLabelTime} />
                    <Text style={styles.hourlyLabel}>Tiempo</Text>
                    <Text style={styles.hourlyLabel}>Temp{'\n'}°C</Text>
                  </View>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourlyScroll}
                    contentContainerStyle={styles.hourlyScroller}
                  >
                    {hourlyWeather.map((hour) => {
                      const hourWeather = getWeatherInfo(hour.weatherCode);
                      const HourIcon = WEATHER_ICONS[hourWeather.icon];
                      return (
                        <View key={hour.time} style={styles.hourlyChip}>
                          <Text style={styles.hourlyTime}>{formatTideClock(hour.time)}</Text>
                          <View style={styles.hourlyIcon}>
                            <HourIcon size={16} color={COLORS.temp} />
                          </View>
                          <Text style={styles.hourlyValue}>{Math.round(hour.temperature)}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )
            }
          />
          <SummaryRow
            icon={CloudRain}
            tint={COLORS.accent}
            label="Lluvia"
            value={rainHeadline}
            expandable
            expanded={rainOpen}
            onToggle={() => setRainOpen((open) => !open)}
            extra={
              hourlyRain.length === 0 ? (
                <Text style={styles.summaryRowDetail}>Sin previsión horaria para hoy.</Text>
              ) : (
                <View style={styles.hourlyTable}>
                  <View style={styles.hourlyLabels}>
                    <View style={styles.hourlyLabelTime} />
                    <Text style={styles.hourlyLabel}>Lluvia{'\n'}mm</Text>
                    <Text style={styles.hourlyLabel}>Prob.{'\n'}%</Text>
                  </View>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourlyScroll}
                    contentContainerStyle={styles.hourlyScroller}
                  >
                    {hourlyRain.map((hour) => (
                      <View key={hour.time} style={styles.hourlyChip}>
                        <Text style={styles.hourlyTime}>{formatTideClock(hour.time)}</Text>
                        <Text style={styles.hourlyValue}>{formatRainAmount(hour.amount)}</Text>
                        <Text style={styles.hourlyGusts}>{Math.round(hour.probability)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )
            }
          />
          <SummaryRow
            icon={Wind}
            leading={<WindCompass degrees={current.wind_direction_10m} size={34} />}
            tint={COLORS.wind}
            label="Viento"
            value={getBeaufortLabel(current.wind_speed_10m)}
            accessibilityValue={`${formatMetric(current.wind_speed_10m, 0)} km/h ${degreesToCompass(current.wind_direction_10m)}. Rachas de ${formatMetric(current.wind_gusts_10m, 0)} km/h`}
            expandable
            expanded={windOpen}
            onToggle={() => setWindOpen((open) => !open)}
            extra={
              hourlyWind.length === 0 ? (
                <Text style={styles.summaryRowDetail}>Sin previsión horaria para hoy.</Text>
              ) : (
                <View style={styles.hourlyTable}>
                  <View style={styles.hourlyLabels}>
                    <View style={styles.hourlyLabelTime} />
                    <Text style={styles.hourlyLabel}>Viento{'\n'}km/h</Text>
                    <Text style={styles.hourlyLabel}>Rachas{'\n'}km/h</Text>
                    <Text style={styles.hourlyLabel}>Dir.</Text>
                  </View>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourlyScroll}
                    contentContainerStyle={styles.hourlyScroller}
                  >
                    {hourlyWind.map((hour) => (
                      <View key={hour.time} style={styles.hourlyChip}>
                        <Text style={styles.hourlyTime}>{formatTideClock(hour.time)}</Text>
                        <Text style={styles.hourlyValue}>{formatMetric(hour.speed, 0)}</Text>
                        <Text style={styles.hourlyGusts}>{formatMetric(hour.gusts, 0)}</Text>
                        <View style={styles.hourlyIcon}>
                          <WindCompass degrees={hour.direction} size={22} />
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )
            }
          />
          <SummaryRow
            icon={Waves}
            tint={COLORS.sea}
            label="Mar"
            value={getSeaState(marine?.wave_height ?? null)}
            trailing={
              <View style={styles.summaryRowTrailing}>
                <Thermometer size={14} color={COLORS.sea} />
                <Text style={styles.summaryRowTrailingValue}>{waterTemp}</Text>
              </View>
            }
            accessibilityValue={`${getSeaState(marine?.wave_height ?? null)}. Agua ${waterTemp}`}
            expandable
            expanded={seaOpen}
            onToggle={() => setSeaOpen((open) => !open)}
            extra={
              hourlyWaves.length === 0 ? (
                <Text style={styles.summaryRowDetail}>Sin previsión horaria para hoy.</Text>
              ) : (
                <View style={styles.hourlyTable}>
                  <View style={styles.hourlyLabels}>
                    <View style={styles.hourlyLabelTime} />
                    <Text style={styles.hourlyLabel}>Olas{'\n'}m</Text>
                    <Text style={styles.hourlyLabel}>Periodo{'\n'}s</Text>
                  </View>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourlyScroll}
                    contentContainerStyle={styles.hourlyScroller}
                  >
                    {hourlyWaves.map((hour) => (
                      <View key={hour.time} style={styles.hourlyChip}>
                        <Text style={styles.hourlyTime}>{formatTideClock(hour.time)}</Text>
                        <Text style={styles.hourlyValue}>{formatMetric(hour.height)}</Text>
                        <Text style={styles.hourlyGusts}>{formatMetric(hour.period, 0)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )
            }
          />
          <SummaryRow
            icon={tideTrend === 'Subiendo' ? ArrowUp : ArrowDown}
            tint={COLORS.sea}
            label="Marea"
            value={tideHeadline}
            expandable
            expanded={tidesOpen}
            onToggle={() => setTidesOpen((open) => !open)}
            extra={
              <TideEventsList tides={data.tidesToday} nextTide={nextTide} nested />
            }
          />
          <View style={styles.airGroup}>
            <Text style={styles.airGroupTitle}>Aire</Text>
            <View style={styles.airRow}>
              <AirMetric
                icon={Droplets}
                tint={COLORS.accent}
                label="Humedad"
                value={
                  current.relative_humidity_2m != null
                    ? `${Math.round(current.relative_humidity_2m)}%`
                    : '—'
                }
              />
              <AirMetric
                icon={Gauge}
                tint={COLORS.wind}
                label="Presión"
                value={
                  current.pressure_msl != null
                    ? `${formatMetric(current.pressure_msl, 0)} hPa`
                    : '—'
                }
              />
              <AirMetric
                icon={Sun}
                tint={COLORS.temp}
                label="UV"
                value={uvHeadline}
                detail={uvDetail}
                weight={1.3}
              />
            </View>
          </View>
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

function AirMetric({
  icon: Icon,
  tint,
  label,
  value,
  detail,
  weight = 1,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  detail?: string;
  /** Reparte el ancho según lo que ocupa cada valor. */
  weight?: number;
}) {
  const { styles } = useAppChrome();
  return (
    <View style={[styles.airItem, { flex: weight }]}>
      <View style={styles.airItemHead}>
        <Icon size={13} color={tint} />
        <Text style={styles.airLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.airValue} numberOfLines={2}>
        {value}
      </Text>
      {detail ? (
        <Text style={styles.airDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function Forecast({ data }: { data: DashboardData }) {
  const { styles } = useAppChrome();
  const todayIso = data.weather.current.time.slice(0, 10);
  const [openDate, setOpenDate] = useState<string | null>(null);

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
          nowIso={data.weather.current.time}
          weather={data.weather}
          marine={data.marine}
          expanded={openDate === day.date}
          onToggle={() => setOpenDate((current) => (current === day.date ? null : day.date))}
        />
      ))}
    </View>
  );
}

function ForecastMetric({
  icon: Icon,
  tint,
  value,
}: {
  icon: LucideIcon;
  tint: string;
  value: string;
}) {
  const { styles } = useAppChrome();
  return (
    <View style={styles.forecastMetric}>
      <Icon size={14} color={tint} />
      <Text style={styles.forecastMetricText}>{value}</Text>
    </View>
  );
}

function ForecastDayCard({
  day,
  todayIso,
  nowIso,
  weather,
  marine,
  expanded,
  onToggle,
}: {
  day: DayForecast;
  todayIso: string;
  nowIso: string;
  weather: DashboardData['weather'];
  marine: DashboardData['marine'];
  expanded: boolean;
  onToggle: () => void;
}) {
  const weatherInfo = getWeatherInfo(day.weatherCode);
  const WeatherIcon = WEATHER_ICONS[weatherInfo.icon];
  const { COLORS, styles, layout } = useAppChrome();
  const rainLabel = formatRainAmount(day.precipitationSum);
  const rainText = rainLabel === '-' ? '-' : `${rainLabel} mm`;
  const windText = getBeaufortLabel(day.windSpeedMax);
  const seaText = getSeaState(day.waveHeightMax);
  const hours = useMemo(() => {
    if (!expanded) {
      return [];
    }
    return getHourlyDetailForDay(
      weather,
      marine,
      day.date,
      day.date === todayIso ? nowIso : null,
    );
  }, [expanded, weather, marine, day.date, todayIso, nowIso]);

  return (
    <Card>
      <Pressable
        onPress={onToggle}
        style={styles.forecastHeader}
        accessibilityRole="button"
        accessibilityLabel={`${formatForecastDayLabel(day.date, todayIso)}. ${weatherInfo.label}. Lluvia ${rainText}. Viento ${windText}. Mar ${seaText}. ${expanded ? 'Ocultar detalle' : 'Ver detalle'}`}
      >
        <View style={[styles.iconBadge, { backgroundColor: `${COLORS.temp}22` }]}>
          <WeatherIcon size={18} color={COLORS.temp} />
        </View>
        <View style={styles.forecastHeaderText}>
          <Text style={styles.forecastDay}>{formatForecastDayLabel(day.date, todayIso)}</Text>
          <Text style={styles.forecastSummary}>{weatherInfo.label}</Text>
          <View style={styles.forecastMetrics}>
            <ForecastMetric icon={Droplet} tint={COLORS.accent} value={rainText} />
            <ForecastMetric icon={Wind} tint={COLORS.wind} value={windText} />
            <ForecastMetric icon={Waves} tint={COLORS.sea} value={seaText} />
          </View>
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
          <HourlyBoard
            grouped={layout === 'grouped'}
            hours={hours}
            tides={day.tides}
            emptyMessage="Sin previsión horaria para este día."
            marineMissing={marine == null}
          />
        </View>
      ) : null}
    </Card>
  );
}

function SummaryRow({
  icon: Icon,
  leading,
  trailing,
  tint,
  label,
  value,
  details,
  expandable,
  expanded,
  onToggle,
  extra,
  accessibilityValue,
  style,
}: {
  icon: LucideIcon;
  leading?: ReactNode;
  trailing?: ReactNode;
  tint: string;
  label: string;
  value: ReactNode;
  details?: string[];
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  extra?: ReactNode;
  accessibilityValue?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { COLORS, styles } = useAppChrome();
  const valueText = accessibilityValue ?? (typeof value === 'string' ? value : '');
  const header = (
    <>
      {leading ?? (
        <View style={[styles.iconBadge, { backgroundColor: `${tint}22` }]}>
          <Icon size={16} color={tint} />
        </View>
      )}
      <View style={styles.tideInfo}>
        <Text style={styles.metricLabel}>{label}</Text>
        {typeof value === 'string' ? <Text style={styles.summaryRowValue}>{value}</Text> : value}
        {details?.map((line) => (
          <Text key={line} style={styles.summaryRowDetail}>
            {line}
          </Text>
        ))}
      </View>
      {trailing}
      {expandable ? (
        <ChevronDown
          size={18}
          color={COLORS.accent}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      ) : null}
    </>
  );

  if (expandable) {
    return (
      <View style={[styles.summaryRowStack, style]}>
        <Pressable
          onPress={onToggle}
          style={styles.summaryRowHeader}
          accessibilityRole="button"
          accessibilityLabel={`${label}${valueText ? `. ${valueText}` : ''}. ${expanded ? 'Ocultar detalle' : 'Ver detalle'}`}
        >
          {header}
        </Pressable>
        {expanded ? extra : null}
      </View>
    );
  }

  return <View style={[styles.summaryRow, style]}>{header}</View>;
}

function Dashboard({ data }: { data: DashboardData }) {
  const { COLORS, styles, layout, selectLayout } = useAppChrome();
  const hours = useMemo(
    () => getUpcomingHourlyDetail(data.weather, data.marine),
    [data.weather, data.marine],
  );
  const tides = useMemo(
    () => data.forecastDays.flatMap((day) => day.tides),
    [data.forecastDays],
  );
  const todayIso = data.weather.current.time.slice(0, 10);

  return (
    <View style={styles.cards}>
      <View
        style={styles.hourlyLayoutToggle}
        accessibilityRole="tablist"
        accessibilityLabel="Formato de la tira horaria"
      >
        <Pressable
          onPress={() => selectLayout('compact')}
          style={[
            styles.hourlyLayoutOption,
            layout === 'compact' ? styles.hourlyLayoutOptionActive : null,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: layout === 'compact' }}
          accessibilityLabel="Formato compacto"
        >
          <List size={16} color={layout === 'compact' ? COLORS.accent : COLORS.muted} />
          <Text
            style={[
              styles.hourlyLayoutLabel,
              { color: layout === 'compact' ? COLORS.accent : COLORS.muted },
            ]}
          >
            Compacta
          </Text>
        </Pressable>
        <Pressable
          onPress={() => selectLayout('grouped')}
          style={[
            styles.hourlyLayoutOption,
            layout === 'grouped' ? styles.hourlyLayoutOptionActive : null,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: layout === 'grouped' }}
          accessibilityLabel="Formato agrupado"
        >
          <LayoutGrid size={16} color={layout === 'grouped' ? COLORS.accent : COLORS.muted} />
          <Text
            style={[
              styles.hourlyLayoutLabel,
              { color: layout === 'grouped' ? COLORS.accent : COLORS.muted },
            ]}
          >
            Agrupada
          </Text>
        </Pressable>
      </View>
      <Card>
        <HourlyBoard
          grouped={layout === 'grouped'}
          hours={hours}
          tides={tides}
          todayIso={todayIso}
          emptyMessage="Sin previsión horaria disponible."
          marineMissing={data.marine == null}
        />
      </Card>
    </View>
  );
}

function HourlyGroup({
  title,
  tint,
  flush,
  children,
}: {
  title?: string;
  tint: string;
  flush?: boolean;
  children: ReactNode;
}) {
  const { styles } = useAppChrome();
  return (
    <View
      style={[
        styles.hourlyGroup,
        { backgroundColor: `${tint}22` },
        title || flush ? styles.hourlyGroupLabeled : null,
      ]}
    >
      {flush ? null : title ? (
        <Text style={[styles.hourlyGroupTitle, { color: tint }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.hourlyGroupTitleSlot} />
      )}
      {children}
    </View>
  );
}

function HourlyBoard({
  hours,
  tides,
  emptyMessage,
  marineMissing,
  grouped = false,
  todayIso,
}: {
  hours: HourlyDetail[];
  tides: TideEvent[];
  emptyMessage: string;
  marineMissing?: boolean;
  grouped?: boolean;
  /** Si se indica, la tira se parte en bloques por día con su propia cabecera. */
  todayIso?: string;
}) {
  const { COLORS, styles } = useAppChrome();
  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const days = useMemo(
    () => (todayIso != null ? groupHoursByDay(hours) : null),
    [todayIso, hours],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!days) {
        return;
      }
      const scrolled = event.nativeEvent.contentOffset.x + 8;
      let reached = days[0]?.date ?? null;
      for (const day of days) {
        const offset = dayOffsets.current[day.date];
        if (offset != null && offset <= scrolled) {
          reached = day.date;
        }
      }
      setActiveDay((current) => (current === reached ? current : reached));
    },
    [days],
  );

  const jumpToDay = useCallback((date: string) => {
    const offset = dayOffsets.current[date];
    if (offset == null) {
      return;
    }
    scrollRef.current?.scrollTo({ x: offset, animated: true });
    setActiveDay(date);
  }, []);

  if (hours.length === 0) {
    return <Text style={styles.fallbackHint}>{emptyMessage}</Text>;
  }

  const visibleDay = days?.some((day) => day.date === activeDay)
    ? activeDay
    : days?.[0]?.date ?? null;

  const labels = grouped ? (
    <View style={styles.hourlyBoardLabelsGrouped}>
      {days ? <View style={styles.hourlyDayHeaderSlot} /> : null}
      <View style={styles.hourlyLabelTime} />
      <HourlyGroup title="Tiempo" tint={COLORS.temp}>
        <Text style={styles.hourlyBoardLabel} />
        <Text style={styles.hourlyBoardLabel} />
      </HourlyGroup>
      <HourlyGroup title="Lluvia" tint={COLORS.accent}>
        <Text style={styles.hourlyBoardLabel} />
        <Text style={styles.hourlyBoardLabel} />
        <Text style={styles.hourlyBoardLabel}>mm</Text>
      </HourlyGroup>
      <HourlyGroup title="Viento" tint={COLORS.wind}>
        <Text style={styles.hourlyBoardLabel}>Dir.</Text>
        <Text style={styles.hourlyBoardLabel}>Viento{'\n'}km/h</Text>
        <Text style={styles.hourlyBoardLabel}>Rachas{'\n'}km/h</Text>
      </HourlyGroup>
      <HourlyGroup title="Mar" tint={COLORS.sea}>
        <Text style={styles.hourlyBoardLabel} numberOfLines={1}>
          Olas (m)
        </Text>
        <Text style={styles.hourlyBoardLabel}>Periodo</Text>
      </HourlyGroup>
      <HourlyGroup flush tint={COLORS.sea}>
        <View style={styles.hourlyTideTitle}>
          <Text style={[styles.hourlyGroupTitle, { color: COLORS.sea }]} numberOfLines={1}>
            Mareas
          </Text>
        </View>
      </HourlyGroup>
      <HourlyGroup title="Aire" tint={COLORS.moon}>
        <Text style={styles.hourlyBoardLabel}>Humedad</Text>
      </HourlyGroup>
    </View>
  ) : (
    <View style={styles.hourlyBoardLabels}>
      {days ? <View style={styles.hourlyDayHeaderSlot} /> : null}
      <View style={styles.hourlyLabelTime} />
      <Text style={styles.hourlyBoardLabel} />
      <Text style={styles.hourlyBoardLabel}>Temp</Text>
      <Text style={styles.hourlyBoardLabel}>Prob.</Text>
      <Text style={styles.hourlyBoardLabel} />
      <Text style={styles.hourlyBoardLabel}>mm</Text>
      <Text style={styles.hourlyBoardLabel}>Dir.</Text>
      <Text style={styles.hourlyBoardLabel}>Viento{'\n'}km/h</Text>
      <Text style={styles.hourlyBoardLabel}>Rachas{'\n'}km/h</Text>
      <Text style={styles.hourlyBoardLabel} numberOfLines={1}>
        Olas (m)
      </Text>
      <Text style={styles.hourlyBoardLabel}>Periodo</Text>
      <Text style={styles.hourlyBoardTideLabel}>Mareas</Text>
      <Text style={styles.hourlyBoardLabel}>Humedad</Text>
    </View>
  );

  return (
    <>
      {days && days.length > 1 && todayIso ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourlyDayNav}
          accessibilityRole="tablist"
          accessibilityLabel="Días con previsión horaria"
        >
          {days.map((day) => {
            const active = day.date === visibleDay;
            return (
              <Pressable
                key={day.date}
                onPress={() => jumpToDay(day.date)}
                style={[styles.hourlyDayChip, active ? styles.hourlyDayChipActive : null]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Ir a ${formatForecastDayLabel(day.date, todayIso)}`}
              >
                <Text
                  style={[
                    styles.hourlyDayChipLabel,
                    { color: active ? COLORS.accent : COLORS.muted },
                  ]}
                  numberOfLines={1}
                >
                  {formatHourlyDayLabel(day.date, todayIso)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={[styles.hourlyTable, grouped ? styles.hourlyTableGrouped : null]}>
        {labels}
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.hourlyScroll}
          contentContainerStyle={[
            styles.hourlyScroller,
            grouped ? styles.hourlyScrollerGrouped : null,
          ]}
          onScroll={days ? handleScroll : undefined}
          scrollEventThrottle={64}
        >
          {days && todayIso
            ? days.map((day, index) => (
                <View
                  key={day.date}
                  onLayout={(event) => {
                    dayOffsets.current[day.date] = event.nativeEvent.layout.x;
                  }}
                  style={[
                    styles.hourlyDayBlock,
                    grouped ? styles.hourlyDayBlockGrouped : null,
                    index > 0 ? styles.hourlyDayBlockSplit : null,
                  ]}
                >
                  <Text style={styles.hourlyDayHeader} numberOfLines={1}>
                    {formatForecastDayLabel(day.date, todayIso)}
                  </Text>
                  <View
                    style={[
                      styles.hourlyDayHours,
                      grouped ? styles.hourlyDayHoursGrouped : null,
                    ]}
                  >
                    {day.hours.map((hour) => (
                      <HourlyBoardHour
                        key={hour.time}
                        hour={hour}
                        tides={tides}
                        grouped={grouped}
                      />
                    ))}
                  </View>
                </View>
              ))
            : hours.map((hour) => (
                <HourlyBoardHour key={hour.time} hour={hour} tides={tides} grouped={grouped} />
              ))}
        </ScrollView>
      </View>
      {marineMissing ? (
        <Text style={styles.fallbackHint}>
          Sin datos marinos para esta ubicación (posible zona interior).
        </Text>
      ) : null}
    </>
  );
}

const HourlyBoardHour = memo(function HourlyBoardHour({
  hour,
  tides,
  grouped,
}: {
  hour: HourlyDetail;
  tides: TideEvent[];
  grouped: boolean;
}) {
  const { COLORS, styles } = useAppChrome();
  const hourWeather = getWeatherInfo(hour.weatherCode);
  const HourIcon = WEATHER_ICONS[hourWeather.icon];

  const weatherIcon = (
    <View style={styles.hourlyIcon}>
      <HourIcon size={16} color={COLORS.temp} />
    </View>
  );
  const temperature = (
    <Text style={styles.hourlyBoardValue}>{Math.round(hour.temperature)}º</Text>
  );
  const rainProbability = (
    <Text style={styles.hourlyBoardValue}>{Math.round(hour.rainProbability)}%</Text>
  );
  const rainDrop = (
    <View
      style={styles.hourlyIcon}
      accessibilityLabel={`Probabilidad de lluvia ${Math.round(hour.rainProbability)}%`}
    >
      <RainDrop
        percent={hour.rainProbability}
        color={COLORS.accent}
        clipId={`d${hour.time.replace(/\W/g, '')}`}
      />
    </View>
  );
  const rainAmount = (
    <Text style={styles.hourlyBoardValue}>{formatRainAmount(hour.rain)}</Text>
  );
  const windDir = (
    <View style={styles.hourlyIcon}>
      <WindCompass degrees={hour.windDirection} size={22} />
    </View>
  );
  const windSpeed = (
    <Text style={styles.hourlyBoardValue}>{formatMetric(hour.windSpeed, 0)}</Text>
  );
  const windGusts = (
    <Text style={styles.hourlyBoardValue}>{formatMetric(hour.windGusts, 0)}</Text>
  );
  const waves = <Text style={styles.hourlyBoardValue}>{formatMetric(hour.waveHeight)}</Text>;
  const period = (
    <Text style={styles.hourlyBoardValue}>
      {hour.wavePeriod != null ? `${formatMetric(hour.wavePeriod, 0)}s` : '—'}
    </Text>
  );
  const tide = <HourlyTideMark tide={getTideForHour(tides, hour.time)} />;
  const humidity = (
    <Text style={styles.hourlyBoardValue}>{Math.round(hour.humidity)}%</Text>
  );

  if (!grouped) {
    return (
      <View style={styles.hourlyChip}>
        <Text style={styles.hourlyBoardTime}>{formatTideClock(hour.time)}</Text>
        {weatherIcon}
        {temperature}
        {rainProbability}
        {rainDrop}
        {rainAmount}
        {windDir}
        {windSpeed}
        {windGusts}
        {waves}
        {period}
        {tide}
        {humidity}
      </View>
    );
  }

  return (
    <View style={styles.hourlyChipGrouped}>
      <Text style={styles.hourlyBoardTime}>{formatTideClock(hour.time)}</Text>
      <HourlyGroup tint={COLORS.temp}>
        {weatherIcon}
        {temperature}
      </HourlyGroup>
      <HourlyGroup tint={COLORS.accent}>
        {rainProbability}
        {rainDrop}
        {rainAmount}
      </HourlyGroup>
      <HourlyGroup tint={COLORS.wind}>
        {windDir}
        {windSpeed}
        {windGusts}
      </HourlyGroup>
      <HourlyGroup tint={COLORS.sea}>
        {waves}
        {period}
      </HourlyGroup>
      <HourlyGroup flush tint={COLORS.sea}>{tide}</HourlyGroup>
      <HourlyGroup tint={COLORS.moon}>{humidity}</HourlyGroup>
    </View>
  );
});

function HourlyTideMark({ tide }: { tide: TideEvent | null }) {
  const { COLORS, styles } = useAppChrome();
  if (tide == null) {
    return <View style={styles.hourlyTideMark} />;
  }

  const isHigh = tide.kind === 'pleamar';
  const color = isHigh ? COLORS.wind : COLORS.temp;
  const Icon = isHigh ? ArrowUp : ArrowDown;

  return (
    <View
      style={styles.hourlyTideMark}
      accessibilityLabel={`${isHigh ? 'Pleamar' : 'Bajamar'} ${formatTideClock(tide.time)} · ${formatMetric(tide.height, 2)} m`}
    >
      <Icon size={12} color={color} />
      <Text style={[styles.hourlyTideClock, { color }]}>{formatTideClock(tide.time)}</Text>
    </View>
  );
}

function TideEventsList({
  tides,
  nextTide,
  nested,
}: {
  tides: TideEvent[];
  nextTide?: TideEvent | null;
  nested?: boolean;
}) {
  const { COLORS, styles } = useAppChrome();
  const tideSize = getTideSize(tides);

  if (tides.length === 0) {
    return <Text style={styles.fallbackHint}>No hay datos de marea para este día.</Text>;
  }

  return (
    <View style={styles.tideList}>
      {tides.map((tide) => {
        const isNext =
          nextTide != null && nextTide.time === tide.time && nextTide.kind === tide.kind;
        const isHigh = tide.kind === 'pleamar';
        return (
          <View
            key={`${tide.kind}-${tide.time}`}
            style={[
              styles.tideRow,
              nested ? styles.tideRowNested : null,
              isNext ? styles.tideRowNext : null,
            ]}
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
                {isNext ? ` · próxima${tideSize ? ` (${tideSize})` : ''}` : ''}
              </Text>
            </View>
            <Text style={styles.tideHeight}>{formatMetric(tide.height, 2)} m</Text>
          </View>
        );
      })}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { styles } = useAppChrome();
  return <View style={styles.card}>{children}</View>;
}

const DROPLET_PATH =
  'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z';

function RainDrop({
  percent,
  color,
  clipId,
  size = 16,
}: {
  percent: number;
  color: string;
  clipId: string;
  size?: number;
}) {
  const fill = Math.max(0, Math.min(100, percent));
  const clipY = 24 * (1 - fill / 100);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={DROPLET_PATH}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {fill > 0 ? (
        <>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={clipY} width={24} height={24 - clipY} />
            </ClipPath>
          </Defs>
          <Path d={DROPLET_PATH} fill={color} clipPath={`url(#${clipId})`} />
        </>
      ) : null}
    </Svg>
  );
}

function WindCompass({ degrees, size = 48 }: { degrees: number; size?: number }) {
  const { COLORS, styles } = useAppChrome();
  const rotation = useMemo(() => [{ rotate: `${degrees + 180}deg` }], [degrees]);
  const iconSize = Math.round(size * 0.58);

  return (
    <View
      style={[
        styles.compass,
        { width: size, height: size, borderRadius: size / 2, transform: rotation },
      ]}
    >
      <Navigation2 size={iconSize} color={COLORS.wind} />
    </View>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { styles } = useAppChrome();
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
  const { styles } = useAppChrome();
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
        icon={Clock}
        label="Horaria"
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
  const { COLORS, styles } = useAppChrome();
  const color = active ? COLORS.accent : COLORS.muted;
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Icon size={20} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(COLORS: ThemeColors) {
  return StyleSheet.create({
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
  greetingHint: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 8,
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
  hourlyLayoutToggle: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 6,
    padding: 4,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hourlyLayoutOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hourlyLayoutOptionActive: {
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  hourlyLayoutLabel: {
    fontSize: 13,
    fontWeight: '700',
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
  tideRowNested: {
    backgroundColor: COLORS.card,
  },
  tideRowNext: {
    borderWidth: 1,
    borderColor: COLORS.sea,
    backgroundColor: COLORS.tideNextBg,
  },
  tideInfo: {
    flex: 1,
    minWidth: 0,
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
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.errorBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 14,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.retryBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryLabel: {
    color: COLORS.retryText,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  pickerSheet: {
    backgroundColor: COLORS.sheet,
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
  summaryList: {
    gap: 10,
  },
  airGroup: {
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  airGroupTitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  airRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  airItem: {
    minWidth: 0,
    alignItems: 'center',
    gap: 1,
  },
  airItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  airLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  airValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  airDetail: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    padding: 12,
  },
  summaryRowStack: {
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  summaryRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryRowValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  summaryRowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
  },
  summaryRowTrailingValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  summaryRowValueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryRowDetail: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  hourlyTable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  hourlyTableGrouped: {
    gap: 4,
  },
  hourlyDayNav: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 12,
    paddingRight: 4,
  },
  hourlyDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hourlyDayChipActive: {
    backgroundColor: COLORS.chip,
    borderColor: COLORS.accent,
  },
  hourlyDayChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  hourlyDayBlock: {
    gap: 2,
  },
  hourlyDayBlockGrouped: {
    gap: 3,
  },
  hourlyDayBlockSplit: {
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  hourlyDayHours: {
    flexDirection: 'row',
    gap: 6,
  },
  hourlyDayHoursGrouped: {
    gap: 2,
  },
  hourlyDayHeader: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    height: 18,
  },
  hourlyDayHeaderSlot: {
    height: 18,
  },
  hourlyLabels: {
    width: 52,
    gap: 2,
    paddingTop: 0,
  },
  hourlyBoardLabels: {
    width: 76,
    gap: 2,
    paddingTop: 0,
  },
  hourlyBoardLabelsGrouped: {
    width: 76,
    gap: 3,
    paddingTop: 0,
  },
  hourlyChipGrouped: {
    minWidth: 44,
    alignItems: 'center',
    gap: 3,
  },
  hourlyGroup: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 1,
    borderRadius: 6,
    paddingBottom: 1,
    paddingHorizontal: 1,
    overflow: 'hidden',
  },
  hourlyGroupLabeled: {
    alignItems: 'stretch',
  },
  hourlyGroupTitle: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    height: 14,
    paddingHorizontal: 2,
  },
  hourlyGroupTitleSlot: {
    height: 14,
    alignSelf: 'stretch',
  },
  hourlyBoardLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
    height: 28,
  },
  hourlyBoardTideLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
    height: 36,
  },
  hourlyTideTitle: {
    height: 36,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  hourlyTideMark: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourlyTideClock: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
  },
  hourlyBoardTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '400',
    height: 16,
  },
  hourlyBoardValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    height: 28,
    textAlign: 'center',
  },
  hourlyScroll: {
    flex: 1,
  },
  hourlyLabelTime: {
    height: 16,
  },
  hourlyLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    height: 28,
  },
  hourlyScroller: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
    flexGrow: 1,
  },
  hourlyScrollerGrouped: {
    gap: 2,
  },
  hourlyChip: {
    minWidth: 48,
    alignItems: 'center',
    gap: 2,
  },
  hourlyTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    height: 16,
  },
  hourlyIcon: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourlyValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    height: 28,
    textAlign: 'center',
  },
  hourlyGusts: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    height: 28,
    textAlign: 'center',
  },
  tabBarSafe: {
    backgroundColor: COLORS.tabBar,
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
  forecastMetrics: {
    marginTop: 8,
    gap: 4,
  },
  forecastMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forecastMetricText: {
    color: COLORS.muted,
    fontSize: 13,
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
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionsGreeting: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  infoSheet: {
    backgroundColor: COLORS.sheet,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    maxHeight: '85%',
  },
  infoSheetScroll: {
    flexGrow: 0,
  },
  infoSheetContent: {
    gap: 8,
    paddingBottom: 4,
  },
  infoSectionTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 8,
    marginBottom: 4,
  },
  infoSourceCard: {
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  infoSourceTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  infoSourceBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  infoBlockTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  infoBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  infoNote: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  infoScale: {
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  infoScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  infoScaleName: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  infoScaleRange: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  infoClose: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoCloseLabel: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  });
}
