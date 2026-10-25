# Run with the official TRMNLP image; see README.md. No transform or network required.
require 'digest'
require 'fileutils'
require 'json'
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
    failures << "#{fixture['id']}/#{layout}: rendered HTML differs from pre-removal baseline" unless hash == fixture.fetch('html_sha256').fetch(layout)
    raise "#{fixture['id']}/#{layout}: Liquid render error" if html.include?('Liquid error:')
    if ENV['WEATHER_CHECK_OUTPUT']
      dir = File.join(ENV.fetch('WEATHER_CHECK_OUTPUT'), fixture.fetch('id'))
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, "#{layout}.html"), html)
    end
    renders += 1
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
puts "#{baseline['cases'].length} display fixtures and #{renders} native layout renders match the pre-removal baseline."
puts "#{baseline['condition_cases'].length} condition inputs match in day and night modes."
puts 'Serverless removal and upload configuration checks passed.'
