/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { resolveLocalExceptionsPath, loadLocalExceptions, FILE_NAME } = require('../src/local-exceptions')

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lst-'))
const writeFile = (dir, contents, name = FILE_NAME) => {
  const p = path.join(dir, name)
  fs.writeFileSync(p, typeof contents === 'string' ? contents : JSON.stringify(contents))
  return p
}

// --- resolveLocalExceptionsPath -------------------------------------------

test('resolve: explicit path wins', () => {
  assert.strictEqual(resolveLocalExceptionsPath({ exceptions: '/x/y.json' }), path.resolve('/x/y.json'))
})

test('resolve: discovers file in target directory', () => {
  const dir = tmpdir()
  const p = writeFile(dir, { exceptions: {} })
  assert.strictEqual(resolveLocalExceptionsPath({ target: dir, cwd: os.tmpdir() }), p)
})

test('resolve: falls back to cwd when target is a file (e.g. an SBOM)', () => {
  const dir = tmpdir()
  const p = writeFile(dir, { exceptions: {} })
  assert.strictEqual(resolveLocalExceptionsPath({ target: '/tmp/sbom.cdx.json', cwd: dir }), p)
})

test('resolve: returns null when no file is present', () => {
  assert.strictEqual(resolveLocalExceptionsPath({ cwd: tmpdir() }), null)
})

// --- loadLocalExceptions: happy path --------------------------------------

test('load: returns validated exceptions', () => {
  const dir = tmpdir()
  const p = writeFile(dir, { exceptions: { 'seq-queue@0.0.5': { reason: 'MIT in LICENSE', expires: '2999-01-01' } } })
  const { exceptions } = loadLocalExceptions(p)
  assert.deepStrictEqual(exceptions, { 'seq-queue@0.0.5': { reason: 'MIT in LICENSE', expires: '2999-01-01' } })
})

// --- loadLocalExceptions: fail-closed (exit 2) ----------------------------

const expectExit2 = (fn, re) => {
  assert.throws(fn, (e) => {
    assert.strictEqual(e.exitCode, 2)
    if (re) assert.match(e.message, re)
    return true
  })
}

test('load: rejects allowed/aliases (central policy only)', () => {
  const dir = tmpdir()
  const p = writeFile(dir, { allowed: ['GPL-3.0-only'], exceptions: {} })
  expectExit2(() => loadLocalExceptions(p), /may not define "allowed"/)
  const p2 = writeFile(tmpdir(), { aliases: { Foo: 'MIT' } })
  expectExit2(() => loadLocalExceptions(p2), /may not define "aliases"/)
})

test('load: rejects malformed JSON', () => {
  const p = writeFile(tmpdir(), '{ not json')
  expectExit2(() => loadLocalExceptions(p), /not valid JSON/)
})

test('load: rejects a non-object document', () => {
  const p = writeFile(tmpdir(), '[]')
  expectExit2(() => loadLocalExceptions(p), /must be a JSON object/)
})

test('load: rejects a bad key, missing reason, and bad expires', () => {
  expectExit2(() => loadLocalExceptions(writeFile(tmpdir(), { exceptions: { 'noversion': { reason: 'r', expires: '2999-01-01' } } })), /must be "name@version"/)
  expectExit2(() => loadLocalExceptions(writeFile(tmpdir(), { exceptions: { 'a@1': { expires: '2999-01-01' } } })), /needs a non-empty "reason"/)
  expectExit2(() => loadLocalExceptions(writeFile(tmpdir(), { exceptions: { 'a@1': { reason: 'r', expires: 'soon' } } })), /YYYY-MM-DD/)
})

test('load: errors when an explicit file is missing', () => {
  expectExit2(() => loadLocalExceptions(path.join(tmpdir(), 'nope.json')), /cannot read/)
})

// --- loadLocalExceptions: drop-with-warning (not an error) ----------------

test('load: drops expired entries (warns, does not apply)', () => {
  const p = writeFile(tmpdir(), { exceptions: { 'a@1': { reason: 'r', expires: '2000-01-01' } } })
  const { exceptions, warnings } = loadLocalExceptions(p)
  assert.deepStrictEqual(exceptions, {})
  assert.deepStrictEqual(warnings.skippedExpired, ['a@1'])
})

test('load: drops entries that collide with bundled keys (bundled wins)', () => {
  const p = writeFile(tmpdir(), { exceptions: { 'a@1': { reason: 'r', expires: '2999-01-01' } } })
  const { exceptions, warnings } = loadLocalExceptions(p, { bundledKeys: new Set(['a@1']) })
  assert.deepStrictEqual(exceptions, {})
  assert.deepStrictEqual(warnings.droppedCollision, ['a@1'])
})
