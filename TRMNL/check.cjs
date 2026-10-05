// Run from anywhere: node TRMNL/check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let requests = [];
const context = vm.createContext({
  URL, URLSearchParams, AbortSignal,
  fetch: async url => {
    requests.push(url);
    return { ok: true, json: async () => ({ current: { temperature: { value: '21' } } }) };
  }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'src/transform.js'), 'utf8'), context);
const spain = { status: 0, name: 'Barcelona', affiliation: 'Catalonia, Spain', locationKey: 'accu:307297' };
const venezuela = { status: 0, name: 'Barcelona', affiliation: 'Anzoátegui, Venezuela', locationKey: 'accu:351847' };

(async () => {
  // Captured 301 current/daytime codes; only fields needed by these checks.
  const fixture = {
    current: { pubTime: '2026-10-05T10:17:00+02:00', temperature: { value: '20' }, weather: '301' },
    forecastDaily: {
      status: 0, pubTime: '2026-10-05T07:00:00+02:00',
      temperature: { status: 0, value: [{ from: '25', to: '18' }] },
      weather: { status: 0, value: [{ from: '301', to: '1' }] },
      sunRiseSet: { status: 0, value: [{ from: '2026-10-05T07:52:00+02:00', to: '2026-10-05T19:27:00+02:00' }] }
    },
    forecastHourly: {
      status: 0,
      temperature: { status: 0, pubTime: '2026-10-05T11:00:00+02:00', value: Array(12).fill(21) },
      weather: { status: 0, pubTime: '2026-10-05T11:00:00+02:00', value: Array(12).fill(3) }
    },
    brandInfo: { brands: [{ brandId: 'accu', names: { en_US: 'Accu Weather' } }] },
    alerts: [{ title: 'Orange Warning for Rain' }]
  };
  const trmnl = { system: { timestamp_utc: fixture.current.pubTime }, plugin_settings: { custom_fields_values: { coordinates: '48.8584,2.2945' } } };
  const recorded = await context.run({ ...fixture, trmnl });
  assert.equal(recorded.now.condition, 'Rain');
  assert.equal(recorded.days[0].condition, 'Rain');
  assert.equal(recorded.available, true);
  assert.equal(recorded.source, 'Accu Weather');
  assert.equal(recorded.alert_count, fixture.alerts.length);
  const icon = name => `https://trmnl.com/images/plugins/weather/wi-${name}.svg`;
  for (const [code, text, asset] of [
    [0, 'Clear sky', 'day-sunny'], [1, 'Partly cloudy', 'day-cloudy'], [7, 'Light rain', 'sprinkle'],
    [49, 'Strong fog', 'fog'], [53, 'Haze', 'smog'], [54, 'Moderate haze', 'smog'],
    [55, 'Heavy haze', 'smog'], [56, 'Severe haze', 'smog'], [57, 'Heavy fog', 'fog'],
    [58, 'Extra heavy fog', 'fog'], [301, 'Rain', 'rain'], [302, 'Snow', 'snow'],
    [99, 'Conditions unavailable', 'na'], [999, 'Conditions unavailable', 'na'],
    [null, 'Conditions unavailable', 'na'], ['', 'Conditions unavailable', 'na'],
    ['bad', 'Conditions unavailable', 'na'], [1.5, 'Conditions unavailable', 'na'],
    [true, 'Conditions unavailable', 'na'], [[], 'Conditions unavailable', 'na'],
    ['1e0', 'Conditions unavailable', 'na'], ['0x1', 'Conditions unavailable', 'na']
  ]) {
    const input = JSON.parse(JSON.stringify(fixture));
    input.current.weather = code === null ? null : String(code);
    input.forecastDaily.sunRiseSet.value = input.forecastDaily.sunRiseSet.value.map(sun => ({
      from: sun.from.slice(0, 10) + 'T00:00:00+02:00', to: sun.to.slice(0, 10) + 'T23:59:00+02:00'
    }));
    input.forecastDaily.weather.value = input.forecastDaily.weather.value.map(() => ({ from: code, to: code }));
    input.forecastHourly.weather.value = input.forecastHourly.weather.value.map(() => code);
    const result = context.transform({ ...input, trmnl });
    assert.ok(result.days.length && result.hours.length);
    for (const state of [result.now, ...result.days, ...result.hours]) {
      assert.equal(state.condition, text);
      assert.equal(state.icon_url, icon(asset));
    }
  }
  for (const [code, text, asset] of [[0, 'Clear night', 'night-clear'], [1, 'Partly cloudy', 'night-alt-cloudy']]) {
    const input = JSON.parse(JSON.stringify(fixture));
    input.current.pubTime = input.forecastDaily.sunRiseSet.value[0].to;
    input.current.weather = code;
    input.forecastHourly.weather.value.fill(code);
    const result = context.transform({ ...input, trmnl });
    assert.equal(result.now.condition, text);
    assert.equal(result.now.icon_url, icon(asset));
    const nightHours = result.hours.filter(hour => hour.time >= input.current.pubTime.slice(11, 16));
    assert.ok(nightHours.length);
    for (const hour of nightHours) assert.equal(hour.icon_url, icon(asset));
  }
  const partial = context.transform({ ...fixture, forecastDaily: { status: -1 }, forecastHourly: null, trmnl });
  assert.equal(partial.now.condition, 'Rain');
  assert.equal(partial.available, true);
  assert.equal(partial.days.length, 0);
  assert.equal(partial.hours.length, 0);
  for (const [location, coordinates, data, expected] of [
    ['Barcelona', '', [spain, venezuela], spain],
    ['Barcelona', '', [venezuela, spain], venezuela],
    ['Barcelona, Spain', '', [venezuela, spain], spain],
    ['Barcelona, anzoategui, VENEZUELA', '', [spain, venezuela], venezuela],
    ['Barcelona', '', [null, { ...venezuela, status: 1 }, spain], spain],
    ['Barcelo', '', [spain, venezuela], spain]
  ]) {
    requests = [];
    const result = await context.run({ data, trmnl: { plugin_settings: { custom_fields_values: { location, coordinates } } } });
    assert.equal(result.available, true);
    assert.equal(result.city, expected.name);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get('locationKey'), expected.locationKey);
    assert.equal(requests[0].searchParams.get('latitude'), '0');
    assert.equal(requests[0].searchParams.get('longitude'), '0');
  }
  for (const location of ['', '   ', null, undefined]) {
    requests = [];
    const result = await context.run({ data: [spain], trmnl: { plugin_settings: { custom_fields_values: { location } } } });
    assert.equal(result.available, false);
    assert.equal(result.city, 'Weather');
    assert.match(result.error_message, /Enter Location or Coordinates/);
    assert.equal(requests.length, 0);
    const forecast = await context.run({ current: { temperature: { value: '21' } }, trmnl: { plugin_settings: { custom_fields_values: { location, coordinates: '48.8584,2.2945' } } } });
    assert.equal(forecast.available, true);
    assert.equal(forecast.city, 'Weather');
    assert.equal(requests.length, 0);
  }
  // Coordinates arrive as a forecast from native polling; no lookup or fetch.
  for (const coordinates of ['48.8584,2.2945', ' 48.8584, 2.2945 ', '0,0', '-90,-180', '90,180']) {
    requests = [];
    const result = await context.run({ current: { temperature: { value: '0' } }, trmnl: { plugin_settings: { custom_fields_values: { location: 'My Barcelona, Spain', coordinates, temperature_unit: 'fahrenheit' } } } });
    assert.equal(result.available, true);
    assert.equal(result.city, 'My Barcelona');
    assert.equal(result.now.temperature, '32°');
    assert.equal(requests.length, 0);
  }
  const missing = await context.run({ trmnl: { plugin_settings: { custom_fields_values: { coordinates: '48.8584,2.2945' } } } });
  assert.equal(missing.available, false);
  assert.ok(missing.error_message);
  for (const [location, coordinates, data] of [
    ['Barcelona', '', []],
    [', Spain', '', [spain]],
    ['Barcelona, France', '', [spain, venezuela]],
    ['Barcelona', '91,2', [spain]],
    ['Barcelona', '41,181', [spain]],
    ['Barcelona', '41,', [spain]],
    ['Barcelona', '41,2,3', [spain]],
    ['Barcelona', 'NaN,2', [spain]],
    ['Barcelona', '', [{ ...spain, locationKey: 'https://other.example' }]]
  ]) {
    requests = [];
    const result = await context.run({ data, trmnl: { plugin_settings: { custom_fields_values: { location, coordinates } } } });
    assert.equal(result.available, false);
    assert.ok(result.error_message);
    assert.equal(requests.length, 0);
  }
  for (const failure of ['http', 'json', 'network', 'timeout']) {
    let fetchSignal;
    context.fetch = async (_, { signal }) => {
      fetchSignal = signal;
      if (failure === 'http') return { ok: false };
      if (failure === 'json') return { ok: true, json: async () => [] };
      if (failure === 'network') throw new Error('Network unavailable');
      return { ok: true, json: () => new Promise((_, reject) => {
        const deadline = setTimeout(() => reject(new Error('Abort did not fire')), 4500);
        signal.addEventListener('abort', () => { clearTimeout(deadline); reject(signal.reason); }, { once: true });
      }) };
    };
    const start = Date.now();
    const result = await context.run({ data: [spain], trmnl: { plugin_settings: { custom_fields_values: { location: 'Barcelona' } } } });
    assert.ok(fetchSignal instanceof AbortSignal);
    assert.equal(result.available, false);
    assert.match(result.error_message, /Xiaomi/);
    if (failure === 'timeout') {
      assert.equal(fetchSignal.reason.name, 'TimeoutError');
      assert.ok(Date.now() - start < 4500, 'Abort must leave time within the five-second runtime');
    }
  }
  console.log('Condition and location checks passed, including the live 301 regression, partial forecasts and timeout budget.');
})().catch(error => { console.error(error); process.exitCode = 1; });
