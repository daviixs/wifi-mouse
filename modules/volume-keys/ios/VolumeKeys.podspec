Pod::Spec.new do |s|
  s.name           = 'VolumeKeys'
  s.version        = '0.1.0'
  s.summary        = 'Forwards hardware volume key presses to JS (best effort on iOS).'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Remote Mouse'
  s.homepage       = 'https://example.invalid/volume-keys'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
