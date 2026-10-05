# Weather response mapping

This map records the [41 live request cases](api-overview.md#live-verification-record).
HTTP success does not imply available weather; validate each block and value.

## Minimal tested requests

Global, with the resolved key for the public Paris demo point (verified on
5 October 2026):

```sh
curl --get 'https://weatherapi.market.xiaomi.com/wtr-v3/weather/all' \
  --data-urlencode 'latitude=0' --data-urlencode 'longitude=0' \
  --data-urlencode 'locationKey=accu:2608421' \
  --data-urlencode 'appKey=weather20151024' \
  --data-urlencode 'sign=zUFJoAR2ZVrDy1vF3D07' \
  --data-urlencode 'isGlobal=true' --data-urlencode 'locale=en_us'
```

China uses the same endpoint and public client parameters, with
`locationKey=weathercn:101010100`, `isGlobal=false`, `locale=zh_cn` and both
coordinate parameters set to zero. This request succeeded live. Direct global
polling uses real latitude/longitude and omits the key. `days` is optional.

## Fields observed

Selected raw global forecast fields from the recorded equivalent direct-coordinate
and keyed responses (5 October 2026). The original location is omitted; these
weather values are separate from the Paris request example above:

```json
{
  "current": {"pubTime": "2026-10-05T10:17:00+02:00", "weather": "301"},
  "forecastDaily": {"weather": {"status": 0, "value": [{"from": "301", "to": "1"}, {"from": "1", "to": "3"}, {"from": "3", "to": "1"}, {"from": "0", "to": "3"}, {"from": "1", "to": "0"}]}},
  "forecastHourly": {"weather": {"pubTime": "2026-10-05T11:00:00+02:00", "status": 0, "value": [3, 3, 1, 4, 4, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]}}
}
```

| Path | Shape / interpretation |
| --- | --- |
| `current.weather` | Numeric **string**, e.g. `"301"`; not an AccuWeather icon ID |
| `current.temperature`, `feelsLike`, `humidity`, `pressure`, `visibility` | `{unit, value}`; values are strings, sometimes empty or objects null |
| `current.uvIndex` | Numeric string; may be empty |
| `current.wind.direction`, `.speed` | `{unit, value}`; degrees and km/h in captures |
| `current.pubTime` | ISO timestamp with offset; no current-block `status` observed |
| `forecastDaily` | Parent `status`, `pubTime`, nested independently status-bearing blocks |
| `forecastDaily.weather.value` | Array of `{from, to}` **string** codes, interpreted by clients as daytime/nighttime |
| `forecastDaily.temperature.value` | Array of string-valued `{from, to}` ranges; captured `from` high, `to` low |
| `forecastDaily.sunRiseSet.value` | `{from, to}` offset timestamps: sunrise/sunset |
| `forecastDaily.precipitationProbability.value` | String percentages; independent length |
| `forecastDaily.wind` | Direction/speed blocks containing range arrays |
| `forecastHourly.temperature.value` | Numeric array; `unit: "C"` in global capture |
| `forecastHourly.weather.value` | Numeric code array with its own `pubTime` and `status` |
| `forecastHourly.wind.value` | Objects containing `datetime`, string `direction`, string `speed` |
| `aqi` | Global capture `{status: -2}`; China had `status: 0`, string AQI/pollutants, `pubTime`, `src`, attribution and descriptive fields |
| Daily/hourly `aqi` | Separate status and numeric arrays when available; unavailable globally |
| `alerts` | Array; captured `title`, `detail`, `type`, `level`, `pubTime`, `locationKey`, `alertId`, `link`, `images` |
| `brandInfo.brands` | Provider array of `brandId`, locale-keyed `names`, `logo`, `url`; may be empty |
| `url` | Provider links keyed by provider; optional display/navigation data |
| `indices` | Parent status, `pubTime`, array of `{type, value}`; not needed by plugin |
| `yesterday` | Flat strings and status; not needed by plugin |
| `sourceMaps` | Per-field provider diagnostics plus `clientInfo`; not a public contract |
| `updateTime` | Epoch milliseconds observed; may be absent; distinct from observation time |
| `chs`, `forecastDaily.moonPhase`, `forecastHourly.desc` | Extra fields; semantics not established here |

Current/daily units included `℃`, `%`, `hPa`, `km`, `°`, `km/h`; the hourly
temperature unit can differ. Empty visibility is missing, not zero.

Barcelona returned 5 daily entries and 23 hourly entries for `days=1`, `7`,
`15` and omitted days. China returned 15 temperature/weather/sun/AQI entries
but only 5 precipitation entries for `days=7`, `days=1` and omitted days. Use each
array's actual length and the intersection needed for a row. Never fill absent
precipitation with 0%. These are observed provider limits, not universal promises.

## Times, attribution and partial data

Keep timestamp offsets: Barcelona had `+02:00`, Beijing `+08:00`. Blocks can
have different publication times. Even Barcelona's `yesterday.date` had
`+08:00`; do not use it to infer the forecast timezone. Hourly wind timestamps
are preferable when available; reconstructing hours from a fixed offset is
not verified across a DST transition.

The Barcelona brand was `accu` / `Accu Weather`. China returned `caiyun` and
`weatherbj`, with separate AQI attribution to `CNEMC`. Switching the China
request to `isGlobal=true` returned AccuWeather, five daily entries and no AQI.
Do not hardcode global attribution or infer all field providers from one brand.
Keep provider attribution visible; legal redistribution requirements have not
been established from live responses alone.

Barcelona alerts included rain and storm warnings and human-readable timing
inside `detail`, but no explicit machine-readable start/end fields. Preserve
provider titles/counts; do not infer that every returned alert is active now.
No-warning responses can contain `[]`.

## Errors actually captured

Missing required query parameters: HTTP 400 and JSON `{errCode: 5, errDesc: ...}`.
Invalid nonempty key: HTTP 200, empty current strings/nulls, daily/hourly parent
`status: 0`, child `status: -1` and empty arrays; wind status also included `99`.
Invalid coordinates: HTTP 200, missing current values, null daily blocks and
empty hourly arrays. Global AQI used `status: -2` while weather remained valid.

Treat nonzero child statuses as unavailable for that child. A `status: 99`
on a block is separate from condition code `99`. Preserve valid siblings.
Do not assign undocumented meanings to negative statuses or require all blocks
to succeed together. Transport failures and malformed JSON should produce an
unavailable state; neither was induced at Xiaomi during these live tests.
