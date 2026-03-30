'use strict'

const Test = require('tape')
const { generateOverrideContent, overrideVars, OVERRIDE_FILENAME } = require('../../scripts/_save_env_override')

Test('_save_env_override module', t => {
  t.test('should export overrideVars array', t => {
    t.ok(Array.isArray(overrideVars), 'overrideVars is an array')
    t.ok(overrideVars.includes('mode'), 'includes mode')
    t.ok(overrideVars.includes('pathToRepo'), 'includes pathToRepo')
    t.ok(overrideVars.includes('dockerImage'), 'includes dockerImage')
    t.ok(overrideVars.includes('dockerImages'), 'includes dockerImages')
    t.end()
  })

  t.test('should export OVERRIDE_FILENAME', t => {
    t.equal(OVERRIDE_FILENAME, '.env_override')
    t.end()
  })

  t.test('generateOverrideContent should filter matching env vars', t => {
    const env = {
      mode: 'local',
      pathToRepo: '/some/path',
      HOME: '/home/user',
      PATH: '/usr/bin'
    }

    const output = generateOverrideContent(env)
    t.ok(output.includes("export mode='local'"), 'includes mode')
    t.ok(output.includes("export pathToRepo='/some/path'"), 'includes pathToRepo')
    t.notOk(output.includes('HOME'), 'does not include HOME')
    t.notOk(output.includes('PATH'), 'does not include PATH')
    t.end()
  })

  t.test('generateOverrideContent should return empty string when no matching vars', t => {
    const env = {
      HOME: '/home/user',
      SHELL: '/bin/bash'
    }

    const output = generateOverrideContent(env)
    t.equal(output, '', 'returns empty string')
    t.end()
  })

  t.test('generateOverrideContent should handle all override vars', t => {
    const env = {
      mode: 'standalone',
      pathToRepo: '/repo',
      dockerImage: 'node:18',
      dockerImages: 'img1,img2'
    }

    const output = generateOverrideContent(env)
    const lines = output.trim().split('\n')
    t.equal(lines.length, 4, 'generates 4 lines')
    t.end()
  })

  t.end()
})
