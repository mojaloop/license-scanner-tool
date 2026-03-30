'use strict'

const Test = require('tape')
const proxyquire = require('proxyquire').noCallThru()

Test('Config module', t => {
  t.test('should parse config.toml and return allowedList and excludeList', t => {
    const mockConfig = {
      environment: {
        allowedList: ['MIT', 'Apache-2.0', 'ISC'],
        excludeList: [
          'some-package@1.0.0;Known safe',
          'other-package@2.0.0;Reviewed and approved'
        ]
      }
    }

    const Config = proxyquire('../../scripts/Config', {
      toml: {
        parse: () => mockConfig
      },
      fs: {
        readFileSync: () => 'mock toml content'
      }
    })

    t.ok(Array.isArray(Config.allowedList), 'allowedList is an array')
    t.deepEqual(Config.allowedList, ['MIT', 'Apache-2.0', 'ISC'], 'allowedList matches')

    t.ok(Array.isArray(Config.excludeList), 'excludeList is an array')
    t.equal(Config.excludeList.length, 2, 'excludeList has 2 entries')

    t.equal(Config.excludeList[0].pkg, 'some-package@1.0.0', 'first exclude pkg')
    t.equal(Config.excludeList[0].reason, 'Known safe', 'first exclude reason')

    t.equal(Config.excludeList[1].pkg, 'other-package@2.0.0', 'second exclude pkg')
    t.equal(Config.excludeList[1].reason, 'Reviewed and approved', 'second exclude reason')
    t.end()
  })

  t.test('should handle excludeList entries without reason', t => {
    const mockConfig = {
      environment: {
        allowedList: ['MIT'],
        excludeList: [
          'package-no-reason@1.0.0'
        ]
      }
    }

    const Config = proxyquire('../../scripts/Config', {
      toml: {
        parse: () => mockConfig
      },
      fs: {
        readFileSync: () => 'mock'
      }
    })

    t.equal(Config.excludeList[0].pkg, 'package-no-reason@1.0.0')
    t.equal(Config.excludeList[0].reason, undefined, 'reason is undefined when not provided')
    t.end()
  })

  t.end()
})
