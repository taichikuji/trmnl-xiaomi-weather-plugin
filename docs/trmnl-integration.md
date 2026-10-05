# Consuming Xiaomi in this plugin

## Refresh flow

| Input | Native polling | Serverless fetch | Total Xiaomi requests |
| --- | --- | --- | --- |
| Coordinates | Direct `weather/all` | None | 1 |
| City name | `location/city/search` | Keyed `weather/all` | 2 |

The [Barcelona comparison](location-resolution.md) supports the existing
coordinate path. Adding geo would add a request without fixing code 301.
City search needs a dependent weather request; TRMNL renders dynamic polling
URLs before issuing requests, so a second static polling URL cannot consume
the first response's key. See [Dynamic Polling URLs](https://help.trmnl.com/en/articles/12689499-dynamic-polling-urls).
No extra backend or dependencies are required.

[TRMNL Serverless](https://help.trmnl.com/en/articles/14130649-serverless)
provides Node 20, `fetch`, a five-second runtime and 128 MB. The existing async
`run(input)` makes the city-name weather request with a 3.5-second abort signal,
covering fetch and response reading. Native polling's platform timeout is not
verified here. There are no retries inside a refresh; clear errors wait for
the next configured 30-minute refresh.

## Responsibilities and unavailable data

`run` validates custom coordinates, search-array shape, successful candidate
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
