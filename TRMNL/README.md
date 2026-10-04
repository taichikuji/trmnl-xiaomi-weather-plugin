# TRMNL Xiaomi Weather Plugin

Atmosphere displays Xiaomi's current conditions and forecasts with native TRMNL typography and authored monochrome SVGs. It polls Xiaomi directly using the public client parameters in the [API reference](https://github.com/saving/China-Apps-Api/blob/master/XiaomiWeather.md); no separate server or personal weather API key is required.

## Icon

The plugin icon is stored in the TRMNL bundle and referenced from `settings.yml`.

<div align="center">
  <img src="media/icon.svg" alt="Plugin Icon" width="90">
</div>

## Previews

Previews use a recorded Barcelona response from **4 October 2026**, not a current forecast. OG images use a 1-bit palette; X images use 16 grayscale levels.

| Full View | Half Horizontal View |
|------------|----------------------|
| ![Full View](media/preview_full.webp) | ![Half Horizontal View](media/preview_half_horizontal.webp) |

| Half Vertical View | Quadrant View |
|-------------------|----------------|
| ![Half Vertical View](media/preview_half_vertical.webp) | ![Quadrant View](media/preview_quadrant.webp) |

| TRMNL X Full View | TRMNL X Half Horizontal |
|------------------|------------------------|
| ![TRMNL X Full View](media/preview_trmnl_x.webp) | ![TRMNL X Half Horizontal](media/preview_trmnl_x_half_horizontal.webp) |

| TRMNL X Half Vertical | TRMNL X Quadrant |
|----------------------|-----------------|
| ![TRMNL X Half Vertical](media/preview_trmnl_x_half_vertical.webp) | ![TRMNL X Quadrant](media/preview_trmnl_x_quadrant.webp) |

## Setup

Create a TRMNL Private Plugin with Polling / GET, Framework **3.4.0**, screen padding enabled and a **30-minute** refresh interval. Private plugins require Developer or BYOD access.

Use a current [TRMNLP](https://github.com/usetrmnl/trmnlp) release, open this directory and run:

```sh
trmnlp serve
```

`.trmnlp.yml` contains the local custom-field values. The JavaScript transform runs automatically. Once ready to upload, authenticate and push to your own plugin:

```sh
trmnlp login
trmnlp push --id YOUR_PLUGIN_SETTING_ID
```

Alternatively, copy `src/settings.yml` into the matching dashboard settings, paste `shared.liquid` into Shared and each layout into its matching markup tab, then paste `transform.js` into the JavaScript transform editor. The adapter exposes `transform(input)` and is compatible with the current TRMNLP Node wrapper. Force Refresh, check the preview and add the plugin to your playlist.

The GitHub **Publish to TRMNL** workflow runs manually. Configure repository secrets `TRMNL_API_KEY` and `TRMNL_PLUGIN_SETTING_ID`, then run it from Actions. The setting ID is the number in `/plugin_settings/<ID>/edit`. Publishing the GitHub repository alone does not run this workflow.

## Templates

- **transform.js**: Converts Xiaomi's nested responses into small display-ready variables, condition SVGs and numeric chart coordinates.
- **shared.liquid**: Attribution, unavailable-data state, provider notices and hourly chart.
- **full.liquid**: Current conditions, hourly temperatures, five daily forecasts, wind, humidity, sun times and UV.
- **half_horizontal.liquid**: Current weather beside three daily forecasts and a provider notice.
- **half_vertical.liquid**: Large current temperature, sun times, three daily forecasts and a provider notice.
- **quadrant.liquid**: Current temperature, condition, feels-like temperature and alert count.

All four layouts use Framework 3.4.0 utilities without custom CSS. Their OG areas are 800 × 480, 800 × 240, 400 × 480 and 400 × 240; X uses the corresponding portions of 1040 × 780. Platform margins and title bars reduce the usable content area.

## Choose a city

Update both `city_name` and `location_key`; changing the display name alone does not change the forecast. `temperature_unit` accepts `celsius` or `fahrenheit`.

| City | Country | Xiaomi location key |
|------|---------|---------------------|
| Barcelona | Spain | `accu:307297` |
| Paris | France | `accu:623` |

Resolve another location through [Xiaomi city search](https://weatherapi.market.xiaomi.com/wtr-v3/location/city/search?name=Barcelona&locale=en_us), replacing `name`. Check the returned country and city name because namesakes are common. Use the complete `accu:` key for European cities. The polling URL chooses `isGlobal=true` for `accu:` and `false` for `weathercn:`. Live Barcelona and Paris requests confirmed that the location key works with zero latitude/longitude.

## Data behavior

- Xiaomi supplied five daily forecasts and 23 hourly entries for Barcelona despite a seven-day request. The plugin shows returned data only, sampling up to six points across the next 12 hours.
- The observation time remains visible. Observations older than three hours are marked as old data when rendered; elapsed hourly entries are removed.
- Missing optional values display an em dash. Missing current temperature produces an explicit unavailable state. Missing precipitation is never reported as 0%.
- European air-quality fields were unavailable and are omitted. Attribution follows the returned provider, AccuWeather via Xiaomi in the tested cities.
- Alerts are **provider-reported** titles/counts. Xiaomi supplied no structured expiration fields, so the plugin does not determine whether a warning is still in effect. Consult the provider for details.
- Local times preserve the API's UTC offset and hourly wind timestamps when supplied. Without those timestamps, a forecast crossing a DST transition may need a subsequent refresh for corrected hour labels.
- Condition codes follow the network API's [weather-code table](https://github.com/JoinChen/Api/blob/master/xiaomi_weather_status.json). Xiaomi's Android content-provider code table describes a different interface.

## Verification and references

Live city lookup and weather fetches succeeded for Barcelona and Paris. Transform checks covered missing and zero values, partial forecasts, old observations, local timestamps, night icons and Fahrenheit. All four Liquid templates compiled against real responses and unavailable data. Chromium renders with the pinned official framework fitted all eight OG/X areas; unavailable, stale Fahrenheit and missing-hourly variants were also checked. The committed WebP previews preserve the verified e-ink palettes losslessly.

The local rendering checks used LiquidJS. Account-side import, scheduled refresh and a physical e-ink panel remain unverified.

Design research included [Weather Glance](https://trmnl.com/recipes/181200), the [Extended Weather Dashboard](https://github.com/Baszert/trmnl-extended-weather-dashboard), TRMNL's [native weather fixture](https://github.com/usetrmnl/trmnl-framework/blob/main/public/framework/example_fixtures/weather/full.html), and the [official TRMNL agent skill](https://github.com/usetrmnl/trmnl-agent-skills). Reference application source was not copied.

The official skill can be used directly from its upstream repository. Optional MCP access uses `https://trmnl.com/mcp` with OAuth, or a plugin MCP key from its MCP tab. The account REST API key is not an MCP key. No MCP credentials are stored in this project.
