/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>
- Shashikant Hirugade <shashi.mojaloop@gmail.com>

*****/
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
