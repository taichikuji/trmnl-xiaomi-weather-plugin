# Xiaomi Weather review verification

Verified locally on 15 October 2026 against repository base `effd0f7`. These checks precede the publication workflow; hosted TRMNL verification remains a separate step.

## Review changes

- Replaced the separate city and Coordinates fields with the required native `lat_lon` Location picker. The polling URL splits the stored coordinates and calls Xiaomi's geographic lookup. The existing bounded Serverless request then fetches weather with the returned provider key and displays its locality name.
- Added `lg:` sizes to the full view's labels and hourly temperatures.
- Added the half-vertical portrait grid and forecast wrapper requested by Mario, with spacing that also fits OG portrait.
- Added wind, humidity, high/low, precipitation and sun times to X quadrants using `hidden lg:visible`.
- Reduced portrait chart height after browser checks found the full view's last forecast row overflowing. Added temperature containers so native text fitting reserves space for the weather icon, and reserved footer space for observation time and units.

Existing installations must choose Location again after upgrading. Old city/Coordinates values are no longer read. Xiaomi may name a neighborhood, such as Muette, rather than the city entered in the picker. Every valid refresh now uses geographic lookup plus a forecast request.

## Unsupported-code audit

Every class token in all four layouts and Shared was checked against selectors parsed by Chromium from the actual [Framework 3.4.0 stylesheet](https://trmnl.com/css/3.4.0/plugins.css), matching `settings.yml`. The three unsupported classes found were:

| Unsupported class | Replacement |
| --- | --- |
| `text--uppercase` | Uppercase literal headings; neither use contains dynamic text |
| `description--small` | Supported base `description` |
| `border` | Supported `outline` on the old-observation notice |

The final markup uses **110 distinct classes, all present in that stylesheet**. No custom CSS or application dependencies were added.

The audit also checked runtime attributes and Liquid filters. `data-clamp` and text fitting exist in the [versioned JavaScript](https://trmnl.com/js/3.4.0/plugins.js). The old `data-fit-value` spelling is a real compatibility alias; templates now use the documented `data-value-fit` spelling. `base64_encode` is a [standard Liquid filter](https://github.com/Shopify/liquid/blob/v5.13.0/lib/liquid/standardfilters.rb), also available in the Liquid version pinned by TRMNLP 0.16.0. The `lat_lon` format and Serverless globals/network support match TRMNL's [form builder](https://help.trmnl.com/en/articles/10513740-custom-plugin-form-builder#h_07a70ff721) and [Serverless documentation](https://help.trmnl.com/en/articles/14130649-serverless). Local `transform_runtime` configuration was checked against [TRMNLP 0.16.0 source](https://github.com/usetrmnl/trmnlp/blob/v0.16.0/lib/trmnlp/config/project.rb).

The missing-forecast check exposed fabricated chart limits (`1° — 0°`) from placeholder arithmetic. Those now display em dashes and have an offline regression check. No further unsupported classes, filters or platform APIs were identified in this review; this is not a claim that every possible upstream payload is covered.

## Verification results

- `node TRMNL/check.cjs` passes. Coverage includes valid/invalid/empty coordinates, whitespace, zero and boundary coordinates, canonical locality names, both provider key types, Fahrenheit and zero temperatures, existing condition-code regressions, partial forecasts, missing chart limits, HTTP/JSON/network failures and the 3.5-second abort.
- Live read-only checks through the new polling URL and `run(input)` passed for Barcelona, Paris and Beijing: six Xiaomi requests in total. Returned names were `la Dreta de l'Eixample`, `Muette` and `Dongcheng`; all supplied current weather, five daily rows and six sampled hourly points. Forecast requests completed in 274–527 ms in these checks.
- **112 final Chromium renders passed:** four layouts × four device/orientation combinations × seven scenarios. Devices were OG landscape/portrait and X landscape/portrait. Scenarios were normal Celsius, Fahrenheit, long location name, stale observation, missing forecasts, unavailable current temperature and an extended alert title.
- Browser checks waited for fonts and TRMNL's terminalize pipeline, then checked content boundaries, actual text collisions, footer overlap, image decoding and JavaScript errors. They also asserted that quadrant extras are visible on X and hidden on OG.
- Captures use a live Barcelona response from this review, with synthetic variants for edge cases. Before/after captures use identical weather variables. They are cropped to the native view area; X's default framework scale is 1.8. The original repository WebP previews remain historical.

The local logic checks used Node 24.19.0; rendering used Chromium, LiquidJS and official Framework assets. LiquidJS rendering is not a hosted TRMNL runtime test. Account-side autocomplete, saving the new form, scheduled refresh, CHEF and a physical e-ink panel remain unverified.

Asset SHA-256 hashes for this review:

```text
CSS  5af69265e3ae6ad39f72ee5580aa32d14142cabacbf807df20e1cf18a83ea6c8
JS   ec87b696b96b7cc0499a3741d534fe1c148a9ce690886788f9e33e679445a705
```
