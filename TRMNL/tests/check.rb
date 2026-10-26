# Run with the official TRMNLP image; see README.md. No transform or network required.
require 'digest'
require 'fileutils'
require 'json'
require 'time'
require 'yaml'
require 'trmnl/liquid'

ROOT = File.expand_path('..', __dir__)
LAYOUTS = %w[full half_horizontal half_vertical quadrant].freeze
DISPLAY_KEYS = %w[city unit available stale observed_at observed_date date_label now days hours chart sunrise sunset alert_count alert_title source error_message].freeze
SHARED = File.read(File.join(ROOT, 'src/shared.liquid'))
DISPLAY = '{' + DISPLAY_KEYS.map { |key| "\"#{key}\":{{ #{key} | json }}" }.join(',') + '}'

def render(source, data)
  template = Liquid::Template.parse(source, environment: TRMNL::Liquid.new { |env| env.error_mode = :strict })
  template.render!(data, strict_filters: true)
end

def difference(expected, actual, path = '$')
  if expected.is_a?(Hash) && actual.is_a?(Hash)
    return "#{path}: keys #{actual.keys.inspect} != #{expected.keys.inspect}" unless expected.keys.sort == actual.keys.sort
    expected.each do |key, value|
      diff = difference(value, actual[key], "#{path}.#{key}")
      return diff if diff
    end
  elsif expected.is_a?(Array) && actual.is_a?(Array)
    return "#{path}: length #{actual.length} != #{expected.length}" unless expected.length == actual.length
    expected.each_with_index do |value, i|
      diff = difference(value, actual[i], "#{path}[#{i}]")
      return diff if diff
    end
  elsif expected != actual
    return "#{path}: #{actual.inspect} != #{expected.inspect}"
  end
  nil
end

def fixture_input(baseline, fixture)
  input = JSON.parse(JSON.generate(baseline.fetch('base_input')))
  fixture.fetch('input_changes').each do |change|
    path = change.fetch('path')
    parent = path[0...-1].reduce(input) { |object, key| object.fetch(key) }
    change['remove'] ? parent.delete(path.last) : parent[path.last] = change.fetch('value')
  end
  input
end

baseline = JSON.parse(File.read(File.join(ROOT, 'tests/baseline.json')))
failures = []
renders = 0
valid_times = %w[2026-10-05T10:17:00+02:00 2026-10-05T10:17:00Z 2026-10-05T10:17:00-04:00 2026-10-05T10:17:00.123+02:00 2028-02-29T10:17:00+02:00]
valid_times += %w[1970-01-01T00:00:00Z 1969-12-31T23:59:59Z 2026-10-05T10:17:00+05:45]
invalid_times = %w[2026-10-05T25:17:00+02:00 2026-10-05T10:99:00+02:00 2026-02-30T10:17:00+02:00 2026-04-31T10:17:00+02:00 2026-10-05T10:17:00+99:00]
# Failed date filters return the input unchanged; a malformed 16-character prefix must still fail.
invalid_times += %w[2026-10-05Txx:17 2026-aa-05T10:17 2026-10-05T24:00:00Z]
invalid_times += [nil, false, true, 0, [], {}, '', 'now', 'today', '2026-10-05 10:17:00Z']
time_probe = %q({"epoch":{% render 'weather_epoch', value: probe_value %},"time":{% capture text %}{% render 'weather_time', value: probe_value %}{% endcapture %}{{ text | json }}})
(valid_times + invalid_times).each do |value|
  actual = JSON.parse(render(SHARED + time_probe, { 'probe_value' => value }))
  expected = if valid_times.include?(value)
    { 'epoch' => Time.iso8601(value).to_i * 1000, 'time' => value[11, 5] }
  else
    { 'epoch' => nil, 'time' => '—' }
  end
  diff = difference(expected, actual)
  failures << "timestamp #{value.inspect}: #{diff}" if diff
end

value_cases = [
  [nil, false, '°', '—'], ['20oops', false, '°', '—'],
  [0, false, '°', '0°'], [-1.5, false, '°', '-1°'],
  [false, false, nil, '0'], [10.25, true, '°', '50°'],
  [2, false, "\"<&\n", "2\"<&\n"]
]
value_probe = %q({% render 'weather_value', value: probe_value, fahrenheit: probe_fahrenheit, suffix: probe_suffix %})
value_cases.each do |value, fahrenheit, suffix, expected|
  actual = JSON.parse(render(SHARED + value_probe, {
    'probe_value' => value, 'probe_fahrenheit' => fahrenheit, 'probe_suffix' => suffix
  }))
  diff = difference(expected, actual)
  failures << "formatted JSON value #{value.inspect}: #{diff}" if diff
end

ignored_alerts = [{}, { 'title' => nil }, { 'title' => false }, { 'title' => '' }, { 'title' => [] }, { 'title' => {} }]
alert_cases = [
  ['empty titles', ignored_alerts, true, 0, ''],
  ['zero first', ignored_alerts + [{ 'title' => 0 }, { 'title' => true }, { 'title' => 'Rain' }], true, 3, '0'],
  ['true first', [{ 'title' => true }], true, 1, 'true'],
  ['whitespace title', [{ 'title' => ' ' }], true, 1, ' '],
  ['provider text', ignored_alerts + [{ 'title' => 'Rain "warning" <strong> & snow' }], true, 1, 'Rain "warning" <strong> & snow'],
  ['non-array', { 'title' => 'Ignored' }, true, 0, ''],
  ['invalid location', [{ 'title' => 'Ignored' }], false, 0, '']
]
alert_probe = %q({"count":{{ alert_count | json }},"title":{{ alert_title | json }}})
alert_cases.each do |name, alerts, location_valid, count, title|
  input = JSON.parse(JSON.generate(baseline.fetch('base_input')))
  input['alerts'] = alerts
  input.fetch('trmnl').fetch('plugin_settings').fetch('custom_fields_values')['lat_lon'] = '' unless location_valid
  actual = JSON.parse(render(SHARED + alert_probe, input))
  diff = difference({ 'count' => count, 'title' => title }, actual)
  failures << "alerts #{name}: #{diff}" if diff
end

baseline.fetch('condition_cases').each do |fixture|
  probe = %q({"day":{% render 'weather_condition', value: probe_value %},"night":{% render 'weather_condition', value: probe_value, night: true %}})
  actual = JSON.parse(render(SHARED + probe, { 'probe_value' => fixture.fetch('value') }))
  expected = fixture.slice('day', 'night')
  diff = difference(expected, actual)
  failures << "condition #{fixture['value'].inspect}: #{diff}" if diff
end
baseline.fetch('cases').each do |fixture|
  input = fixture_input(baseline, fixture)
  actual = JSON.parse(render(SHARED + DISPLAY, input))
  diff = difference(fixture.fetch('expected'), actual)
  failures << "#{fixture['id']}: #{diff}" if diff
  LAYOUTS.each do |layout|
    html = render(SHARED + File.read(File.join(ROOT, "src/#{layout}.liquid")), input)
    normalized = html.gsub(/\s+/, ' ').strip
    hash = Digest::SHA256.hexdigest(normalized)
    failures << "#{fixture['id']}/#{layout}: rendered HTML differs from recorded baseline" unless hash == fixture.fetch('html_sha256').fetch(layout)
    raise "#{fixture['id']}/#{layout}: Liquid render error" if html.include?('Liquid error:')
    if ENV['WEATHER_CHECK_OUTPUT']
      dir = File.join(ENV.fetch('WEATHER_CHECK_OUTPUT'), fixture.fetch('id'))
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, "#{layout}.html"), html)
    end
    renders += 1
  end
end

{ 'Balcony weather' => 'Balcony weather', 'Home & <weather>' => 'Home &amp; &lt;weather&gt;' }.each do |name, escaped|
  input = JSON.parse(JSON.generate(baseline.fetch('base_input')))
  input.fetch('trmnl').fetch('plugin_settings')['instance_name'] = name
  LAYOUTS.each do |layout|
    html = render(SHARED + File.read(File.join(ROOT, "src/#{layout}.liquid")), input)
    expected_title = %(<div class="title" data-clamp="1">#{escaped} · Accu Weather</div>)
    failures << "#{layout}: configured instance name missing or unescaped" unless html.include?(expected_title)
  end
end

settings = YAML.safe_load(File.read(File.join(ROOT, 'src/settings.yml')))
project = YAML.safe_load(File.read(File.join(ROOT, '.trmnlp.yml')))
raise 'Hosted Serverless removal must be explicit' unless settings['serverless_language'] == 'none'
raise 'Local transform runtime must be disabled' unless project['transform_runtime'] == 'disabled'
raise 'A runtime transform remains in the upload inputs' unless Dir.glob(File.join(ROOT, 'src/transform.*')).empty?
raise 'Framework version changed' unless settings['framework_version'] == '3.4.0'

unless failures.empty?
  warn failures.join("\n")
  abort "#{failures.length} regression(s)"
end
puts "#{baseline['cases'].length} display fixtures and #{renders} native layout renders match the recorded baseline."
puts "#{baseline['condition_cases'].length} condition inputs match in day and night modes."
puts "#{valid_times.length + invalid_times.length} timestamp validation cases passed."
puts "#{value_cases.length} formatted JSON values and #{alert_cases.length} alert edge cases passed."
puts 'Custom instance names and HTML escaping passed in all four layouts.'
puts 'Serverless removal and upload configuration checks passed.'
