# Location resolution

See [the live verification record](api-overview.md#live-verification-record). Search and geo return
a **top-level array**, not an object containing `data`. TRMNL's polling wrapper
supplies that array as `input.data` to Serverless.

Observed successful item:

```json
{
  "affiliation": "Ville de Paris, France",
  "key": "accu:2608421",
  "latitude": "48.863",
  "locationKey": "accu:2608421",
  "longitude": "2.26",
  "name": "Muette",
  "status": 0,
  "timeZoneShift": 7200
}
```

Coordinate fields are strings; `status` and the observed UTC offset in seconds
are numbers. Use a successful item's `locationKey`, not its display name or
array index. `key` matched `locationKey` in these captures; that is not a reason
to depend on the alias. Offsets describe these observations, not future DST rules.

## Search

`GET location/city/search?name=Barcelona&locale=en_us` returned 20 candidates,
including Spain, Venezuela and other countries. Provider order is not a
guarantee of user intent. The plugin searches the text before the first comma
and matches remaining country/region qualifiers against `affiliation`, ignoring
case and accents. Matching names can include provider aliases.

`La Sagrada Família` returned `accu:304344`; `Beijing` returned
`weathercn:101010100`. `BCN` returned `[]`. A deliberately nonsensical search
containing digits returned unrelated successful candidates, so neither a
nonempty array nor `status: 0` guarantees a sensible name match.

An empty name or missing locale returned HTTP 400, `errCode: 5` and a
parameter-specific `errDesc`. `es_es` localized affiliation strings, changed
the candidate list and kept the Spanish Barcelona key. `zh_cn` was accepted;
Barcelona results remained in English in the capture. Do not promise uniform
localization or stable ordering.

## Geo and forecast comparison

`GET location/city/geo?latitude=48.8584&longitude=2.2945&locale=en_us`
returned the successful item above. This is the repository's public Barcelona
example, **not La Sagrada Família's coordinates**. Different neighborhoods
can have different keys even within one city.

Beijing coordinates `39.9042,116.4074` resolved to the Dongcheng district,
`weathercn:101011600`, rather than the search result's city key.
Out-of-range `91,181` returned HTTP 200 with one empty item and `status: -2`.
Missing latitude, longitude or locale returned HTTP 400. Validate coordinates
locally; never mistake an empty item for a location.

These three Barcelona forecast requests returned equal **current, daily and
hourly blocks**, including current `"301"`, daily daytime `"301"` and the
hourly condition array:

1. Real coordinates without a location key.
2. Geo-resolved `accu:2608421` with `latitude=0&longitude=0`.
3. The same key with real coordinates.

`updateTime` differed; exact equality of the entire response is not expected.
The missing-condition failure is therefore not repaired by adding a geo
request in this case. Keep direct native polling unless another captured
failure proves a lookup is necessary. Resolving a key remains useful when a
canonical locality name is needed. Equivalence outside the tested cases is
unverified; do not generalize it to every provider. The additional conflicting
Beijing-coordinate request with the Barcelona key also retained equal Barcelona
weather blocks: the key prevailed in this capture. Near La Sagrada Família,
geo at `41.405,2.177` returned `accu:304345` (el Camp de l'Arpa del Clot), whereas
name search returned `accu:304344`. A geographic lookup is provider locality
resolution, not proof of an exact landmark match.

Only accept array items with `status === 0`, a supported key and usable
location data. Preserve names such as `accu:1-2238456_1_AL`; keys are not
necessarily plain decimal IDs. On no usable match, show a clear unavailable
state and let the next refresh retry.
