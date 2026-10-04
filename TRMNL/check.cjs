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
  console.log('Location check passed, including forecast failures and the Serverless timeout budget.');
})().catch(error => { console.error(error); process.exitCode = 1; });
