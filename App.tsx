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
  Droplets,
  Gauge,
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
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
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
  getBeaufortLabel,
  getTideSize,
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

const GREETING_PHRASES = [
  'Buenos días, gordi. Que el mar te mire con cariño.',
  'Si mi vida fuera una escalera, me la he pasado entera buscando el siguiente escalón, convencido de que estás en el tejado esperando a ver si llego yo.',
  'Ama, ama, ama y ensancha el alma.',
  'Hola, pichurrina. Hoy también hay marea para nosotros.',
  'Te quiero, gordi. Mira el cielo un momento por mí.',
  'Pichurrina, que el viento te traiga solo cosas buenas.',
  'Ceci, la luna y la mar van contigo.',
  'Gordi, que no te falte ni brisa ni abrigo.',
  'Hola, pichurrina. Un saludo desde la orilla, para ti.',
  'Pichurrina, que el día te trate tan bien como tú me tratas.',
  'Ceci, eres mi puerto. Que hoy haya calma.',
  'Gordi, un beso antes de mirar el parte.',
  'Pichurrina, que encuentres un claro entre nubes.',
  'Ceci, te quiero más que a las pleamares de septiembre.',
  'Sus soldados son flores de madera y mi ejército no tiene bandera.',
  'Tú por hacer, yo por quedarme tan parado y los dos juntos por tener nuestra cabeza en otro lado.',
  'Para algunos la vida es cabalgar un camino empedrado de horas, minutos y segundos. Y yo, que más humilde soy, solo pido que la ola que surge del último suspiro de un segundo me transporte mecido hasta el siguiente.',
  'Y verás el resurgir, poderoso, del guerrero, sin miedo a leyes ni a nostalgias; y caer mil veces más y levantarse de nuevo, sin más bandera que sus huevos.',
  'Busco un mundo mejor y escarbo en un cajón, por si aparece entre mis cosas.',
  'Ceci, si no fuera pa mirarte, ya no tendría cinco sentidos.',
  'Me levanté hasta los huevos de vivir, te vi pasar y ahora ya vuelvo a sonreír.',
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

type AppChrome = {
  mode: 'light' | 'dark';
  COLORS: ThemeColors;
  styles: any;
  toggleTheme: () => void;
};

const AppChromeContext = createContext<AppChrome | null>(null);

function useAppChrome() {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error('useAppChrome debe usarse dentro de App');
  }
  return ctx;
}

function ThemeToggle({ greeting }: { greeting?: boolean }) {
  const { mode, toggleTheme, COLORS, styles } = useAppChrome();
  const nextMode = mode === 'dark' ? 'claro' : 'oscuro';
  const Icon = mode === 'dark' ? Sun : Moon;

  return (
    <Pressable
      onPress={toggleTheme}
      style={[styles.themeToggle, greeting ? styles.themeToggleGreeting : null]}
      accessibilityRole="button"
      accessibilityLabel={`Cambiar a modo ${nextMode}`}
    >
      <Icon size={20} color={COLORS.accent} />
    </Pressable>
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chrome = useMemo(
    () => ({ mode, COLORS: colors, styles, toggleTheme }),
    [mode, colors, styles, toggleTheme],
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
              <ThemeToggle greeting />
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
        <ThemeToggle />
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
                        <Text style={styles.hourlyValue}>{formatMetric(hour.amount)}</Text>
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
          <View style={styles.summaryPair}>
            <SummaryRow
              icon={Thermometer}
              tint={COLORS.sea}
              label="Agua"
              style={styles.summaryPairItem}
              value={
                marine?.sea_surface_temperature != null
                  ? `${formatMetric(marine.sea_surface_temperature, 1)}°`
                  : '—'
              }
            />
            <SummaryRow
              icon={Moon}
              tint={COLORS.moon}
              label="Luna"
              style={styles.summaryPairItem}
              value={`${moon.label} · ${moon.illumination}%`}
            />
          </View>
          <View style={styles.summaryPair}>
            <SummaryRow
              icon={Droplets}
              tint={COLORS.accent}
              label="Humedad"
              style={styles.summaryPairItem}
              value={
                current.relative_humidity_2m != null
                  ? `${Math.round(current.relative_humidity_2m)}%`
                  : '—'
              }
            />
            <SummaryRow
              icon={Gauge}
              tint={COLORS.wind}
              label="Presión"
              style={styles.summaryPairItem}
              value={
                current.pressure_msl != null
                  ? `${formatMetric(current.pressure_msl, 0)} hPa`
                  : '—'
              }
            />
          </View>
        </View>
      </Card>
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
  const { COLORS, styles } = useAppChrome();

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
          <TideEventsList tides={day.tides} />
        </View>
      ) : null}
    </Card>
  );
}

function SummaryRow({
  icon: Icon,
  leading,
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
  const { COLORS, styles } = useAppChrome();
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

function TidesCard({
  tides,
  nextTide,
  stationName,
}: {
  tides: TideEvent[];
  nextTide: TideEvent | null;
  stationName: string | null;
}) {
  const { COLORS, styles } = useAppChrome();
  const tideSize = getTideSize(tides);
  return (
    <Card>
      <CardHeader icon={Waves} tint={COLORS.sea} title="Mareas de hoy" />
      {stationName ? (
        <Text style={styles.heroCaption}>Estación: {stationName}</Text>
      ) : null}
      {nextTide ? (
        <Text style={styles.heroCaption}>
          Próxima {nextTide.kind === 'pleamar' ? 'pleamar' : 'bajamar'}: {formatTideClock(nextTide.time)} ·{' '}
          {formatMetric(nextTide.height, 2)} m{tideSize ? ` (${tideSize})` : ''}
        </Text>
      ) : (
        <Text style={styles.heroCaption}>Sin más mareas previstas hoy</Text>
      )}

      <TideEventsList tides={tides} nextTide={nextTide} />
      <Text style={styles.fallbackHint}>
        Predicción IHM · hora peninsular. Alturas sobre el nivel medio del mar.
      </Text>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { styles } = useAppChrome();
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
  const { styles } = useAppChrome();
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
  const { styles } = useAppChrome();
  return (
    <View style={styles.metric}>
      <Icon size={14} color={tint} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
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

function WindDirection({ degrees }: { degrees: number }) {
  const { styles } = useAppChrome();

  return (
    <View style={styles.windDirection}>
      <WindCompass degrees={degrees} />
      <Text style={styles.heroCaption}>
        Desde {degreesToCompass(degrees)} hacia {degreesToCompass((degrees + 180) % 360)}
      </Text>
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
  summaryPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  summaryPairItem: {
    flex: 1,
    minWidth: 0,
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
  hourlyLabels: {
    width: 52,
    gap: 2,
    paddingTop: 0,
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
  themeToggleGreeting: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  });
}
