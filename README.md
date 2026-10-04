# Xiaomi Weather for TRMNL

Atmosphere is a TRMNL weather plugin with full, half and quadrant layouts for TRMNL OG and TRMNL X. The default location is Barcelona, Spain.

![Full View](TRMNL/media/preview_full.webp)

## Features

- Large current temperature and TRMNL's official SVG weather icons
- Hourly temperature trend and five-day outlook
- Precipitation chances, wind, humidity, sun times and UV
- Celsius or Fahrenheit, automatic city lookup, and optional coordinates that take priority
- Provider-reported alerts and clear unavailable or old-data states
- Dedicated layouts for all four mashup sizes

## Local development

Open `TRMNL/` with [TRMNLP](https://github.com/usetrmnl/trmnlp), configure Location or optional Coordinates and the temperature unit in `.trmnlp.yml`, and preview all four layouts. Find coordinates at [latlong.net](https://www.latlong.net/). Use TRMNLP 0.16.0 or newer with asynchronous Node transforms.

See [the plugin README](TRMNL/README.md) for previews, setup, city lookup, data behavior and verification details.

Changes to the plugin source, media or publishing workflow pushed to `main` publish to TRMNL through GitHub Actions. Configure `TRMNL_API_KEY` with a scoped, Content-only account key and `TRMNL_PLUGIN_SETTING_ID` with your installed plugin setting ID as described in [setup](TRMNL/README.md#setup).

## References

- [Xiaomi weather API reference](https://github.com/saving/China-Apps-Api/blob/master/XiaomiWeather.md)
- [TRMNL Private Plugins](https://help.trmnl.com/en/articles/9510536-private-plugins)
- [TRMNL weather recipes](https://trmnl.com/recipes?search=weather&sort-by=popularity)
- [TRMNL Framework](https://trmnl.com/framework)
- [TRMNL weather icons](https://help.trmnl.com/en/articles/11823386-weather-icons)
- [Official TRMNL agent skill](https://github.com/usetrmnl/trmnl-agent-skills)
