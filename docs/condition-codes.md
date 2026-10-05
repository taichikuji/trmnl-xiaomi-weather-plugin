# Condition codes and TRMNL icons

## Proven Barcelona failure

Live direct-coordinate and geo-key requests both returned
`current.weather: "301"`, `forecastDaily.weather.value[0].from: "301"`, and
valid temperatures. The original plugin covered only `0–35` and `53`, so the
shared mapper returned `Conditions unavailable` / `wi-na.svg` for **301**.
This explains the reproduced current and daily failure. The captured hourly
codes were supported; the same mapper is also used for hourly conditions.

[ClassIsland's pinned Xiaomi network code table](https://github.com/ClassIsland/ClassIsland/blob/235914a2fac1733cc2a169457c7bad4edb2ca2f6/ClassIsland/Assets/XiaomiWeather/xiaomi_weather_status.json)
identifies **301 as Rain** and **302 as Snow**. 301 does not establish rain
intensity, even when a phone displays “Light rain.” Do not translate it to 7
or treat it as an HTTP redirect, AccuWeather icon ID or Android content-provider code.

## Table

Icon suffixes expand to `https://trmnl.com/images/plugins/weather/wi-<suffix>.svg`,
from [TRMNL's official pack](https://help.trmnl.com/en/articles/11823386-weather-icons).
English descriptions summarize source meanings; the existing display labels
group some rain/snow intensities. Icons are deliberate presentation choices.
**L** = live occurrence in the verification described in these docs, **S** = source-table
evidence only. Occurrence confirms the wire value, not its meaning independently.

| Code | English description | Icon suffix | Evidence |
| --- | --- | --- | --- |
| 0 | Clear sky | `day-sunny` / `night-clear` | L, S |
| 1 | Partly cloudy | `day-cloudy` / `night-alt-cloudy` | L, S |
| 2 | Overcast | `cloudy` | L, S |
| 3 | Showers | `showers` | L, S |
| 4 | Thunderstorms | `thunderstorm` | L, S |
| 5 | Storms with hail | `hail` | S |
| 6 | Sleet | `rain-mix` | S |
| 7 | Light rain | `sprinkle` | L, S |
| 8 | Rain | `rain` | S |
| 9 | Heavy rain | `rain` | S |
| 10–12 | Torrential rain, increasing severity | `rain` | S |
| 13 | Snow showers | `snow` | S |
| 14 | Light snow | `snow` | S |
| 15 | Snow | `snow` | S |
| 16 | Heavy snow | `snow` | S |
| 17 | Blizzard | `snow-wind` | S |
| 18 | Fog | `fog` | S |
| 19 | Freezing rain | `sleet` | S |
| 20 | Dust storm | `sandstorm` | S |
| 21 | Light to moderate rain | `rain` | S |
| 22 | Moderate to heavy rain | `rain` | S |
| 23 | Heavy rain to rainstorm | `rain` | S |
| 24–25 | Rainstorm to heavier rainstorm | `rain` | S |
| 26 | Light to moderate snow | `snow` | S |
| 27 | Moderate to heavy snow | `snow` | S |
| 28 | Heavy snow to blizzard | `snow-wind` | S |
| 29 | Dust | `dust` | S |
| 30 | Blowing sand | `sandstorm` | S |
| 31 | Severe dust storm | `sandstorm` | S |
| 32 | Squall | `strong-wind` | S |
| 33 | Tornado | `tornado` | S |
| 34 | Blowing snow | `snow-wind` | S |
| 35 | Mist | `fog` | S |
| 49 | Strong fog | `fog` | S |
| 53 | Haze | `smog` | L, S |
| 54 | Moderate haze | `smog` | S |
| 55 | Heavy haze | `smog` | S |
| 56 | Severe haze | `smog` | S |
| 57 | Heavy fog | `fog` | S |
| 58 | Extra heavy fog | `fog` | S |
| 99 | Unknown | `na` | S |
| 301 | Rain, intensity unspecified | `rain` | L, S |
| 302 | Snow, intensity unspecified | `snow` | S |

The pinned ClassIsland table supports `0–35`, `53`, `99`, `301`, `302`.
Extension codes `49`, `54–58` are recognized by
[SmartisanWeather-Revived's network parser](https://github.com/Mangi-11/SmartisanWeather-Revived/blob/f6b21ec549f1700ed5cf80d4f6a402eb1a11ba29/app/src/main/kotlin/com/smartisan/weather/data/weather/XiaomiWeatherParser.kt)
and described by its [resources](https://github.com/Mangi-11/SmartisanWeather-Revived/blob/f6b21ec549f1700ed5cf80d4f6a402eb1a11ba29/app/src/main/res/values/strings.xml).
That app remaps some older codes into its own UI namespace: do not copy that
internal mapping as this network API's table. These sources are implementations,
not official Xiaomi specifications. Rare codes were not forced through live weather.

## Fallback and day/night rules

Accept numeric strings and integer numbers for supported codes, including 0.
Null, empty, malformed, fractional and unrecognized codes retain
`Conditions unavailable` / `wi-na.svg`; do not substitute another condition.
Infer night only from valid observation and same-date sunrise/sunset timestamps.
Clear and partly cloudy use night icons; rain, snow, fog and haze keep neutral
icons. Daily `from` describes the displayed daytime forecast, not the current
observation. The regression check exercises all three condition callers.
