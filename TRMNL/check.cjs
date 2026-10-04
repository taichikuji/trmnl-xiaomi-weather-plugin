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
    ['Barcelo', '', [spain, venezuela], spain],
    ['Barcelona, Venezuela', '48.8584,2.2945', [spain, venezuela], spain]
  ]) {
    requests = [];
    const result = await context.run({ data, trmnl: { plugin_settings: { custom_fields_values: { location, coordinates } } } });
    assert.equal(result.available, true);
    assert.equal(result.city, expected.name);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get('locationKey'), expected.locationKey);
    assert.equal(requests[0].searchParams.get('latitude'), coordinates ? '48.8584' : '0');
    assert.equal(requests[0].searchParams.get('longitude'), coordinates ? '2.2945' : '0');
  }
  for (const [location, coordinates, data] of [
    ['Barcelona', '', []],
    ['Barcelona, France', '', [spain, venezuela]],
    ['Barcelona', '91,2', [spain]],
    ['Barcelona', '', [{ ...spain, locationKey: 'https://other.example' }]]
  ]) {
    requests = [];
    const result = await context.run({ data, trmnl: { plugin_settings: { custom_fields_values: { location, coordinates } } } });
    assert.equal(result.available, false);
    assert.ok(result.error_message);
    assert.equal(requests.length, 0);
  }
  console.log('Location check passed: provider order, qualifiers, canonical name, coordinate priority and invalid inputs.');
})().catch(error => { console.error(error); process.exitCode = 1; });
