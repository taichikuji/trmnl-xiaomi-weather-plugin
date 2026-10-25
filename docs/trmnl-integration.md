# Consuming Xiaomi in this plugin

## Refresh flow

TRMNL's native `lat_lon` picker stores comma-separated coordinates. Native polling
renders the latitude/longitude into one direct `weather/all` request per refresh.
No location lookup, Serverless function, external middleware or client-side API
request is required. The refresh interval remains 30 minutes.

The [recorded coordinate/key comparison](location-resolution.md) supports this
direct path. Search and geo remain API research references, rather than plugin
dependencies. The forecast has no city name, so the heading remains **Weather**.

## Shared Liquid responsibilities

[Shared markup runs before each layout](https://help.trmnl.com/en/articles/13216853-reusing-markup-with-shared).
It validates coordinates and prepares the existing display variables from the raw
response: current conditions, daily/hourly rows, units, local times, observation
age, attribution, provider alerts and numeric SVG chart coordinates. The four
layout templates consume the same variables and retain their existing markup.

Reusable helpers use TRMNL's documented `template`/`render` tags, with all context
passed explicitly. Use plain `{% endtemplate %}` tags; the pinned parser does not
recognize whitespace-trimmed closing tags. JSON captures use `json` for string
escaping and `parse_json` to preserve structured arrays, nulls and numeric zero.
These are [native TRMNL filters](https://help.trmnl.com/en/articles/10347358-custom-plugin-filters),
not custom Ruby filters that would need a separate hosted runtime.

Validate numeric input before Liquid arithmetic, which otherwise coerces bad
strings to zero. Round with `plus: 0.5 | floor` to preserve the former JavaScript
behavior for negative half values. Keep unrounded temperatures for chart scaling,
and use floating-point divisions. Convert numeric epochs to integers before the
Liquid `date` filter. Observation age and future-hour filtering use the native
`trmnl.system.timestamp_utc` render clock, with `now` as a local fallback.

Nonzero child statuses disable only that child. Missing optional values remain
em dashes, including missing precipitation. A missing current temperature shows
the unavailable view. Unknown conditions retain the unavailable icon without
hiding valid temperature or forecast data. Provider titles/counts are reported
without inferring warning expiration. Provider text is escaped when rendered.

Hourly timestamps retain the response's offset, preferring hourly wind datetime
labels when present. The existing fixed-offset fallback has the same DST limit:
without those datetime values, a later refresh may be needed to correct labels.
The SVG chart still uses up to twelve eligible future entries, with every other
entry shown in the six hourly labels. Daily views use up to five returned rows.

## Migrating an existing installation

Upload settings and all markup together. `serverless_language: none` explicitly
removes the hosted transform, including with the existing forced CI upload;
omitting the local file alone would leave the hosted copy running. Local preview
sets `transform_runtime: disabled`. For manual dashboard updates, disable
Serverless and clear its script, then Force Refresh. Existing picker and unit
settings require no migration. See [setup](../TRMNL/README.md#setup).

## Checks and limits

The [offline native Liquid checks](../TRMNL/README.md#verification-and-references)
compare display values and all four rendered layouts against fixed pre-removal
baselines. The [fixture notes](../TRMNL/tests/README.md) explain their provenance.
Use the [documented API examples](weather-endpoint.md) to repeat live checks;
publication times and weather blocks matter more than full payload equality.

Raw polling data now reaches Liquid directly and must fit TRMNL's 100 KiB merge
data limit. The public Paris response checked during this refactor was about
7.5 KB. That observation does not establish a maximum size for future responses.
Account-side polling, scheduled refreshes, CHEF and physical e-ink output still
require verification on TRMNL after publishing.
