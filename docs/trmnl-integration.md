# Consuming Xiaomi in this plugin

## Refresh flow

| Input | Native polling | Serverless fetch | Total Xiaomi requests |
| --- | --- | --- | --- |
| Required `lat_lon` picker | `location/city/geo` | Keyed `weather/all` | 2 |

TRMNL’s native picker turns a city/address/postal-code selection into comma-separated latitude and longitude. The plugin splits that value in its polling URL. Xiaomi’s geographic lookup supplies both the displayed locality name and the provider key. The previous separate city/Coordinates fields and city-search fallback are removed; existing installations must select Location again.

The forecast needs the key returned by that refresh’s geographic lookup. TRMNL renders dynamic polling URLs before issuing requests, so a second static polling URL cannot consume that key. See [Dynamic Polling URLs](https://help.trmnl.com/en/articles/12689499-dynamic-polling-urls). No extra backend or dependencies are required.

[TRMNL Serverless](https://help.trmnl.com/en/articles/14130649-serverless) provides Node 20, `fetch`, a five-second runtime and 128 MB. The async `run(input)` fetches the locality’s forecast with a 3.5-second abort signal covering fetch and response reading. Native polling’s platform timeout is not verified here. There are no retries inside a refresh; errors wait for the next configured 30-minute refresh.

## Responsibilities and unavailable data

`run` validates the picker’s coordinates, geographic-result shape, successful candidate
status, supported location keys, HTTP results and the fetched object's shape.
`transform` normalizes conditions, numbers, missing values, observation age,
forecast rows, temperature units, local times, chart coordinates and attribution.
It preserves valid optional data rather than demanding AQI or complete arrays.
The current temperature determines the existing whole-view availability state.
Missing current temperature shows a readable error; missing condition alone
keeps temperature/forecast data and an honest unavailable condition icon.

Liquid renders already prepared values. All four layouts call the shared
condition outputs; provider/user text uses `escape`. Shared markup supplies
the footer, unavailable state, notices and chart. Attribution comes from
returned brands and remains visible. Hosted official icons use
[TRMNL's documented assets](https://help.trmnl.com/en/articles/11823386-weather-icons).

The live API map does not prove every possible external shape is safe. Future
shape failures should be fixed at the parser boundary using captured evidence;
do not use this investigation as a reason for a general parser rewrite.

## Checks and limits

Use the [documented request examples](weather-endpoint.md) and
[verification cases](api-overview.md#live-verification-record) to repeat live
checks. Success status alone is not an assertion of correct weather. Live
values vary: compare publication times and the three weather blocks, not just
entire payload equality.

Run `node TRMNL/check.cjs` for dependency-free offline regressions. Keep the
minimal inline 301 current/daytime inputs, synthetic hourly coverage, extension codes,
unknown values, day/night variants, partial data, location selection and bounded
fetch failures. Synthetic condition variants are parser tests, not live API evidence.

Account-side polling, a scheduled refresh, physical e-ink output, API caching,
rare condition occurrence, redistribution terms and DST transitions remain
unverified. Changing a shared mapping does not require a new layout or service.
