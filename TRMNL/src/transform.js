// Poll Xiaomi's coordinate lookup or city search, then fetch its forecast.
// TRMNL Serverless (Node) awaits run(input); transform keeps formatting separate.
async function run(input) {
  const fields = input.trmnl?.plugin_settings?.custom_fields_values || {};
  const location = String(fields.location || 'Barcelona, Spain').trim();
  const coordinates = String(fields.coordinates ?? '').trim();
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const qualifiers = location.split(',').slice(1).map(normalize).filter(Boolean);
  const unavailable = message => ({ ...transform({ trmnl: input.trmnl }), error_message: message });
  let point;
  if (coordinates) {
    const parts = coordinates.split(',').map(part => part.trim());
    if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part)) || Math.abs(Number(parts[0])) > 90 || Math.abs(Number(parts[1])) > 180) {
      return unavailable('Invalid coordinates. Use latitude, longitude; e.g. 48.8584, 2.2945.');
    }
    point = parts.map(Number);
  }
  if (!Array.isArray(input.data)) return unavailable('Xiaomi location lookup is unavailable. Try the next refresh.');
  // ponytail: the first result can be a namesake; refine Location or use Coordinates.
  const city = input.data.find(city => {
    const affiliation = String(city?.affiliation || '').split(',').map(normalize);
    return city?.status === 0 && (point || qualifiers.every(part => affiliation.includes(part)));
  });
  if (!city) {
    if (point) return unavailable('Xiaomi could not resolve these coordinates. Try a nearby location.');
    return unavailable('No matching city. Try a full city name with an optional country or region.');
  }
  const key = city.locationKey;
  if (!/^(accu|weathercn):[A-Za-z0-9_-]+$/.test(key || '')) return unavailable('Xiaomi returned an unsupported location. Try another nearby city.');
  const url = new URL('https://weatherapi.market.xiaomi.com/wtr-v3/weather/all');
  url.search = new URLSearchParams({
    latitude: String(point?.[0] ?? 0), longitude: String(point?.[1] ?? 0), locationKey: key, days: '7',
    appKey: 'weather20151024', sign: 'zUFJoAR2ZVrDy1vF3D07',
    isGlobal: String(key.startsWith('accu:')), locale: 'en_us'
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return unavailable('Xiaomi weather is unavailable. Try the next refresh.');
    const weather = await response.json();
    if (!weather || typeof weather !== 'object' || Array.isArray(weather)) return unavailable('Xiaomi returned an invalid forecast. Try the next refresh.');
    return transform({ ...weather, trmnl: input.trmnl }, city.name);
  } catch {
    return unavailable('Xiaomi weather could not be reached. Try the next refresh.');
  }
}

function transform(input, locationName) {
  const fields = input.trmnl?.plugin_settings?.custom_fields_values || {};
  const label = String(fields.coordinates ?? '').trim() ? 'Coordinate location' : String(fields.location || 'Barcelona, Spain').split(',')[0];
  const city = String(locationName || label).trim().slice(0, 60);
  const fahrenheit = fields.temperature_unit === 'fahrenheit';
  const number = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const degrees = value => {
    const n = number(value);
    return n === null ? '—' : `${Math.round(fahrenheit ? n * 9 / 5 + 32 : n)}°`;
  };
  const metric = (value, unit = '') => {
    const n = number(value);
    return n === null ? '—' : `${Math.round(n)}${unit}`;
  };
  const time = iso => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso || '') ? iso.slice(11, 16) : '—';
  const epoch = iso => iso ? Date.parse(iso) : NaN;
  const values = block => block && (block.status === undefined || block.status === 0) && Array.isArray(block.value) ? block.value : [];
  const names = ['Clear sky', 'Partly cloudy', 'Overcast', 'Showers', 'Thunderstorms', 'Storms with hail',
    'Sleet', 'Light rain', 'Rain', 'Heavy rain', 'Torrential rain', 'Torrential rain', 'Torrential rain',
    'Snow showers', 'Light snow', 'Snow', 'Heavy snow', 'Blizzard', 'Fog', 'Freezing rain', 'Dust storm',
    'Rain', 'Heavy rain', 'Heavy rain', 'Torrential rain', 'Torrential rain', 'Snow', 'Heavy snow',
    'Blizzard', 'Dust', 'Blowing sand', 'Severe dust storm', 'Squall', 'Tornado', 'Blowing snow', 'Mist'];
  const icons = ['day-sunny', 'day-cloudy', 'cloudy', 'showers', 'thunderstorm', 'hail',
    'rain-mix', 'sprinkle', 'rain', 'rain', 'rain', 'rain', 'rain',
    'snow', 'snow', 'snow', 'snow', 'snow-wind', 'fog', 'sleet', 'sandstorm',
    'rain', 'rain', 'rain', 'rain', 'rain', 'snow', 'snow', 'snow-wind',
    'dust', 'sandstorm', 'sandstorm', 'strong-wind', 'tornado', 'snow-wind', 'fog'];
  function condition(value, night = false) {
    const code = number(value);
    const icon = code === 0 && night ? 'night-clear' : code === 1 && night ? 'night-alt-cloudy' : code === 53 ? 'smog' : icons[code] || 'na';
    return {
      text: code === 0 && night ? 'Clear night' : code === 53 ? 'Haze' : names[code] || 'Conditions unavailable',
      icon_url: `https://trmnl.com/images/plugins/weather/wi-${icon}.svg`
    };
  }
  const current = input.current || {};
  const daily = input.forecastDaily?.status === 0 ? input.forecastDaily : {};
  const hourly = input.forecastHourly?.status === 0 ? input.forecastHourly : {};
  const observed = epoch(current.pubTime);
  const renderTime = input.trmnl?.system?.timestamp_utc;
  const renderEpoch = /^\d+(\.\d+)?$/.test(String(renderTime)) ? Number(renderTime) * 1000 : epoch(renderTime);
  // The hosted transform receives no trmnl.system namespace; use its clock.
  const reference = Number.isFinite(renderEpoch) ? renderEpoch : Date.now();
  const sunTimes = values(daily.sunRiseSet);
  const sunrise = epoch(sunTimes[0]?.from), sunset = epoch(sunTimes[0]?.to);
  const night = Number.isFinite(observed) && Number.isFinite(sunrise) && Number.isFinite(sunset) && (observed < sunrise || observed >= sunset);
  const weather = condition(current.weather, night);
  const temperatures = values(daily.temperature), dailyWeather = values(daily.weather);
  const rain = values(daily.precipitationProbability);
  const dayBase = (daily.pubTime || current.pubTime || '').slice(0, 10);
  const days = temperatures.slice(0, Math.min(5, dailyWeather.length)).map((range, i) => {
    const first = number(range?.from), second = number(range?.to);
    if (first === null || second === null) return null;
    const stamp = Date.parse(`${dayBase}T12:00:00Z`) + i * 86400000;
    const date = new Date(stamp);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
    const state = condition(dailyWeather[i]?.from);
    const probability = number(rain[i]);
    return {
      label, date: Number.isFinite(stamp) ? `${date.getUTCDate()}/${date.getUTCMonth() + 1}` : '—',
      high: degrees(Math.max(first, second)), low: degrees(Math.min(first, second)),
      low_value: Math.min(first, second), high_value: Math.max(first, second),
      condition: state.text, icon_url: state.icon_url,
      rain: probability !== null && probability >= 0 && probability <= 100 ? `${Math.round(probability)}%` : '—'
    };
  }).filter(Boolean);
  const hourTemps = values(hourly.temperature), hourWeather = values(hourly.weather);
  const hourWind = values(hourly.wind);
  const startIso = hourly.temperature?.pubTime || hourly.weather?.pubTime;
  const start = epoch(startIso);
  const offsetMatch = (startIso || '').match(/([+-])(\d{2}):(\d{2})$/);
  const offset = offsetMatch ? (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * (offsetMatch[1] === '-' ? -1 : 1) : 0;
  const hours = hourTemps.slice(0, hourWeather.length).map((temperature, i) => {
    const n = number(temperature), stamp = start + i * 3600000;
    if (n === null || !Number.isFinite(stamp) || (Number.isFinite(reference) && stamp < reference)) return null;
    const local = hourWind[i]?.datetime || new Date(stamp + offset * 60000).toISOString();
    const sun = sunTimes.find(s => s?.from?.slice(0, 10) === local.slice(0, 10));
    const rise = epoch(sun?.from), set = epoch(sun?.to);
    const isNight = Number.isFinite(rise) && Number.isFinite(set) && (stamp < rise || stamp >= set);
    const state = condition(hourWeather[i], isNight);
    return { time: time(local), timestamp: stamp, temperature: degrees(n), value: fahrenheit ? n * 9 / 5 + 32 : n, icon_url: state.icon_url, condition: state.text };
  }).filter(Boolean).slice(0, 12);
  const minimum = hours.length ? Math.min(...hours.map(h => h.value)) - 1 : 0;
  const maximum = hours.length ? Math.max(...hours.map(h => h.value)) + 1 : 1;
  const span = hours.length > 1 ? hours[hours.length - 1].timestamp - hours[0].timestamp : 1;
  const chart = hours.map(h => ({ ...h, x: Math.round(16 + (h.timestamp - hours[0].timestamp) * 408 / span), y: Math.round(70 - (h.value - minimum) * 54 / (maximum - minimum)) }));
  const direction = number(current.wind?.direction?.value);
  const windDirection = direction === null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((direction % 360 + 360) % 360) / 45) % 8];
  const brands = input.brandInfo?.brands || [];
  const source = brands.map(b => b.names?.en_US || b.brandId).filter(Boolean).join(' / ') || 'Xiaomi Weather';
  const sourceUrl = input.url?.accu || brands[0]?.url || '';
  const alerts = (Array.isArray(input.alerts) ? input.alerts : []).filter(a => a && a.title).map(a => ({ title: String(a.title), detail: String(a.detail || ''), time: time(a.pubTime), url: /^https?:\/\//.test(a.link?.link || '') ? a.link.link : '' }));
  const available = number(current.temperature?.value) !== null;
  const stale = Number.isFinite(observed) && Number.isFinite(reference) && reference - observed > 3 * 3600000;
  const daylight = Number.isFinite(sunrise) && Number.isFinite(sunset) && sunset > sunrise ? Math.round((sunset - sunrise) / 60000) : null;
  return {
    city, unit: fahrenheit ? '°F' : '°C', available, stale,
    status: !available ? 'Weather unavailable' : stale ? 'Old observation' : 'Observed',
    observed_at: time(current.pubTime), observed_date: (current.pubTime || '').slice(0, 10),
    date_label: Number.isFinite(observed) ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${current.pubTime.slice(0, 10)}T12:00:00Z`).getUTCDay()]} · ${Number(current.pubTime.slice(8, 10))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(current.pubTime.slice(5, 7)) - 1]}` : 'Waiting for weather',
    now: { temperature: degrees(current.temperature?.value), feels_like: degrees(current.feelsLike?.value), condition: weather.text, icon_url: weather.icon_url,
      humidity: metric(current.humidity?.value, '%'), wind: metric(current.wind?.speed?.value), wind_unit: current.wind?.speed?.unit || 'km/h', wind_direction: windDirection,
      uv: metric(current.uvIndex), pressure: metric(current.pressure?.value), pressure_unit: current.pressure?.unit || 'hPa' },
    days, hours: hours.filter((_, i) => i % 2 === 0).slice(0, 6),
    chart: { points: chart.map(p => `${p.x},${p.y}`).join(' '), markers: chart.filter((_, i) => i % 2 === 0), low: `${Math.round(minimum + 1)}°`, high: `${Math.round(maximum - 1)}°`, from: hours[0]?.time || '—', to: hours[hours.length - 1]?.time || '—' },
    sunrise: time(sunTimes[0]?.from), sunset: time(sunTimes[0]?.to),
    daylight: daylight === null ? '—' : `${Math.floor(daylight / 60)}h ${daylight % 60}m`,
    alerts, alert_count: alerts.length, alert_title: alerts[0]?.title || '',
    source, source_url: /^https?:\/\//.test(sourceUrl) ? sourceUrl.replace(/^http:/, 'https:') : '',
    error_message: available ? '' : 'Xiaomi returned no current temperature. Try the next refresh.'
  };
}
