# Xiaomi Weather API: verified project surface

Mapping captured on **5 October 2026**. This is an observed, undocumented API,
not a Xiaomi support contract. See [location resolution](location-resolution.md),
[weather responses](weather-endpoint.md), [condition codes](condition-codes.md),
and [TRMNL integration](trmnl-integration.md).

Base: `https://weatherapi.market.xiaomi.com/wtr-v3/`. All tested requests use
HTTPS GET and JSON. No user login, authorization header, or personal API key
was needed.

| Endpoint | Purpose | Required in tested requests |
| --- | --- | --- |
| `location/city/search` | City candidates | Nonempty `name`, `locale` |
| `location/city/geo` | Coordinate lookup | `latitude`, `longitude`, `locale` |
| `weather/all` | Current weather and forecasts | `latitude`, `longitude`, `appKey`, `sign`, `isGlobal`, `locale` |

Weather omission tests used a valid global location key. Each required weather
parameter omitted in those tests returned HTTP 400 with `errCode: 5`. Coordinates
are still required with a key; `0,0` works. A coordinate-only request works
without `locationKey` at the tested global point. Its coordinates and key are
omitted from the published record.

| Parameter | Live observation | Consumption rule |
| --- | --- | --- |
| `locationKey` | `accu:` global and `weathercn:` China keys returned by lookup | Preserve the entire key, including suffixes; do not invent IDs |
| `appKey` | `weather20151024`; omission rejected | Keep the public client constant |
| `sign` | `zUFJoAR2ZVrDy1vF3D07`; omission rejected; an invalid nonempty value also returned weather | Keep the public constant; authentication semantics remain unknown |
| `isGlobal` | Both boolean strings accepted; China `true` changed provider, forecast length and AQI availability | Use `true` for global keys, `false` for China keys |
| `locale` | `en_us`, `zh_cn`, `es_es` accepted; some text localized | Keep `en_us` for the plugin; accepted does not mean every field is translated |
| `days` | Omission and different values accepted; returned lengths did not follow requested length | Optional; consume actual arrays |
| `romVersion`, `appVersion`, `alpha`, `device`, `modDevice`, `isLocated` | A combined legacy-parameter request succeeded; normal requests succeeded without them | Do not add them; individual effects are unverified |

`sourceMaps.clientInfo` can contain values different from the request. It is
server diagnostic output, not proof that a parameter was ignored or that it
was validated. The invalid-sign observation likewise does not establish an
authentication policy.

## Live verification record

The mapping used **41 read-only requests on 5 October 2026, 10:47–10:48 CEST**.
The table records the tested cases; their findings appear here and in the
linked endpoint pages. Documentation retains selected raw values, not full
response archives. Regression inputs are kept inline in `TRMNL/check.cjs`.

| Cases | Count |
| --- | ---: |
| Search: Barcelona, La Sagrada Família, Beijing, nonsensical name, BCN | 5 |
| Geo: a global point, Beijing, out-of-range coordinates | 3 |
| Search: missing locale, `zh_cn`, `es_es`, empty name | 4 |
| Geo: omit latitude, longitude or locale individually | 3 |
| Weather: direct coordinates, key/zero coordinates, key/real coordinates, key/missing coordinates | 4 |
| Weather: omit appKey, sign, isGlobal, locale or days individually | 5 |
| Weather: days 1/15, global false, zh/es locales, invalid key/sign, combined legacy parameters | 8 |
| China: normal request, global true, days 1, omitted days | 4 |
| Global key with conflicting Beijing coordinates | 1 |
| Near La Sagrada Família: geo and resolved-key weather | 2 |
| Weather: invalid coordinates, no location parameters | 2 |

Two additional requests on 5 October 2026 verified the public Eiffel Tower
demo coordinates in Paris: geographic lookup and weather using its resolved key.
Shared examples use public cities or landmarks. Keep personal coordinates in
your installed plugin settings rather than committed configuration or documentation.

To repeat a check, use the [weather request example](weather-endpoint.md) or
the lookup parameters in [location resolution](location-resolution.md), changing
one parameter at a time. Compare publication times and current/daily/hourly
blocks; weather changes between requests. HTTP 200 alone does not establish
available weather. The observations above are recorded results, not a promise
that later responses will be identical.

## Evidence boundaries

Live observations cover Barcelona, La Sagrada Família and Beijing, selected
parameter omissions, invalid locations and three locales. Negative status
codes are recorded, not assigned universal meanings. Rare conditions, every
locale, rate limits, caching rules, uptime, DST transitions and attribution
license terms remain unverified. `location/city/info` and `location/city/hots`
appear in [ClassIsland's client](https://github.com/ClassIsland/ClassIsland/blob/235914a2fac1733cc2a169457c7bad4edb2ca2f6/ClassIsland/Services/WeatherService.cs)
but are outside this plugin's tested surface.

The repository's [legacy API reference](https://github.com/saving/China-Apps-Api/blob/master/XiaomiWeather.md)
is useful background. Its 2017 response and parameter claims do not replace
the live evidence here.
