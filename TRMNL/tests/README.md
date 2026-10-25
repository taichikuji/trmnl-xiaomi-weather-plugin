# Native Liquid regression checks

Run the Docker command in [the plugin README](../README.md#verification-and-references).
The suite uses the real `trmnl-liquid` engine bundled in `trmnl/trmnlp:v0.16.0`,
with strict parsing and unknown-filter errors enabled. It makes no requests.

`baseline.json` contains synthetic API-shaped inputs and expected display values
captured from the original `run(input)` at commit `e5f2daa`, before deleting the
runtime script. Every case has a fixed native render timestamp. The condition
cases were captured from the same original mapper, including unsupported types
and malformed codes. They are regression evidence, not live weather captures.
The common `base_input` is stored once; each case's `input_changes` sets or
removes values at explicit key paths to reproduce its original input exactly.

Each layout's SHA-256 covers its original rendered HTML after collapsing
whitespace. This checks markup, text, icon URLs, escaping and SVG geometry while
allowing harmless whitespace differences. The expected values separately check
data that may be hidden at smaller screen sizes. Update these baselines only
when intentionally changing visible behavior, after reviewing the old/new output.

Set `WEATHER_CHECK_OUTPUT` to a writable directory to retain the rendered HTML
for browser/image inspection. Generated previews belong outside `src/` so they
are not uploaded as plugin source. The existing four checked-in layout previews
remain valid because the layout markup and displayed information are unchanged.

Migration verification on 25 October 2026 also compared 60 before/after image
pairs: all four layouts on OG landscape, X landscape and X portrait, using
Celsius, Fahrenheit, stale observations, missing temperature and long provider
text. All pairs had zero changed pixels with cached Framework 3.4.0 assets in
headless Firefox. Screen dimensions and padding were checked explicitly. A fresh
public Paris response matched the original display values in both units, and
TRMNLP lint passed. Account-side refresh and physical e-ink output remain checks
for publishing; this migration does not deploy the branch to TRMNL.
