// Run from anywhere: node TRMNL/check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let requests = 0;
const context = vm.createContext({
  fetch: () => { requests++; throw new Error('Serverless must not make network requests'); }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'src/transform.js'), 'utf8'), context);

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
  const trmnl = { system: { timestamp_utc: fixture.current.pubTime }, plugin_settings: { custom_fields_values: { lat_lon: '41.3851,2.1734' } } };
  const recorded = await context.run({ ...fixture, trmnl });
  assert.equal(recorded.now.condition, 'Rain');
  assert.equal(recorded.days[0].condition, 'Rain');
  assert.equal(recorded.available, true);
  assert.equal(recorded.city, 'Weather');
  assert.equal(requests, 0);
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
  assert.equal(partial.chart.low, '—');
  assert.equal(partial.chart.high, '—');
  const zero = context.transform({ current: { temperature: { value: '0' } }, trmnl: { plugin_settings: { custom_fields_values: { temperature_unit: 'fahrenheit' } } } });
  assert.equal(zero.available, true);
  assert.equal(zero.now.temperature, '32°');
  // Native polling supplies the forecast directly; Serverless only formats it.
  for (const lat_lon of ['41.3851,2.1734', ' 41.3851, 2.1734 ', '0,0', '-90,-180', '90,180']) {
    const result = await context.run({ ...fixture, trmnl: { ...trmnl, plugin_settings: { custom_fields_values: { lat_lon, location: 'Ignored legacy label', temperature_unit: 'fahrenheit' } } } });
    assert.equal(result.available, true);
    assert.equal(result.city, 'Weather');
    assert.equal(result.now.temperature, '68°');
    assert.equal(result.days[0].high, '77°');
    assert.equal(result.days[0].low, '64°');
    assert.equal(requests, 0);
  }
  for (const lat_lon of ['', '   ', null, undefined, '91,2', '41,181', '41,', '41,2,3', 'NaN,2', 'Infinity,2', '1e1,2', 'Paris, France']) {
    const result = await context.run({ ...fixture, trmnl: { plugin_settings: { custom_fields_values: { lat_lon } } } });
    assert.equal(result.available, false);
    assert.equal(result.city, 'Weather');
    assert.match(result.error_message, /[Ll]ocation|coordinates/);
    assert.equal(requests, 0);
  }
  for (const input of [{}, { data: [] }, { data: [{ status: 0, name: 'Old geo response', locationKey: 'accu:307297' }] }, { current: null }, { current: { temperature: { value: '' } } }]) {
    const result = await context.run({ ...input, trmnl });
    assert.equal(result.available, false);
    assert.match(result.error_message, /no current temperature/);
    assert.equal(requests, 0);
  }
  console.log('Condition and direct-coordinate weather checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
