'use strict'
const { test } = require('node:test')
const assert = require('node:assert')
const { evaluate } = require('../src/gate')

const comp = (name, version, licenses, purl) => ({
  name, version, purl: purl || `pkg:npm/${name}@${version}`, licenses
})
const sbom = (components) => ({ components })

test('allows a permissive SPDX id', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ license: { id: 'MIT' } }])]))
  assert.strictEqual(violations.length, 0)
})

test('blocks a copyleft licence (DISALLOWED)', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ license: { id: 'GPL-3.0-only' } }])]))
  assert.strictEqual(violations.length, 1)
  assert.match(violations[0], /DISALLOWED.*GPL-3\.0-only/)
})

test('UNLICENSED is proprietary -> UNDETERMINED, never aliased to Unlicense', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ license: { name: 'UNLICENSED' } }])]))
  assert.strictEqual(violations.length, 1)
  assert.match(violations[0], /UNDETERMINED/)
})

test('curated alias resolves free-text "Apache 2.0" -> Apache-2.0', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ license: { name: 'Apache 2.0' } }])]))
  assert.strictEqual(violations.length, 0)
})

test('unknown free-text licence -> UNDETERMINED (reject-by-default)', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ license: { name: 'Weird Custom Thing' } }])]))
  assert.match(violations[0], /UNDETERMINED.*Weird Custom Thing/)
})

test('expression operand order does not matter', () => {
  const { violations } = evaluate(sbom([comp('a', '1.0.0', [{ expression: 'WTFPL OR MIT' }])]))
  assert.strictEqual(violations.length, 0)
})

test('non-npm components (noise) are ignored', () => {
  const { npm, violations } = evaluate(sbom([
    { name: 'x.yml', purl: '', licenses: [] },
    comp('ok', '1.0.0', [{ license: { id: 'MIT' } }])
  ]))
  assert.strictEqual(npm, 1)
  assert.strictEqual(violations.length, 0)
})

test('exception waives a finding until expiry', () => {
  const policy = { allowed: ['MIT'], aliases: {}, exceptions: { 'bad@1.0.0': { reason: 'r', expires: '2999-01-01' } } }
  const { violations } = evaluate(sbom([comp('bad', '1.0.0', [{ license: { name: 'Nonsense' } }])]), policy)
  assert.strictEqual(violations.length, 0)
})

test('expired exception no longer waives', () => {
  const policy = { allowed: ['MIT'], aliases: {}, exceptions: { 'bad@1.0.0': { reason: 'r', expires: '2000-01-01' } } }
  const { violations } = evaluate(sbom([comp('bad', '1.0.0', [{ license: { name: 'Nonsense' } }])]), policy)
  assert.strictEqual(violations.length, 1)
})
