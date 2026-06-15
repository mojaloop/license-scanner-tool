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

const fs = require('node:fs')
const path = require('node:path')

const FILE_NAME = '.license-scanner.json'

function toolError (message) {
  const e = new Error(message)
  e.exitCode = 2
  return e
}

/**
 * Resolve which local exceptions file to use.
 * Precedence: explicit `exceptions` path > `<target dir>/.license-scanner.json`
 * (when target is a directory) > `<cwd>/.license-scanner.json`.
 * @returns {string|null} absolute path, or null when none is found via discovery.
 */
function resolveLocalExceptionsPath ({ exceptions, target, cwd = process.cwd() } = {}) {
  if (exceptions) return path.resolve(exceptions) // explicit: must exist (load throws if not)
  let base = cwd
  try {
    if (target && fs.statSync(target).isDirectory()) base = target
  } catch { /* target is not a dir (e.g. an SBOM file or missing) — use cwd */ }
  const p = path.join(base, FILE_NAME)
  return fs.existsSync(p) ? p : null
}

/**
 * Load + validate a local exceptions file. Fails closed (throws, exitCode 2) on
 * any structural problem. Expired or centrally-overridden entries are dropped
 * (not applied) and surfaced as warnings, not errors.
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {number} [opts.now]          epoch ms for expiry checks
 * @param {Set<string>} [opts.bundledKeys] central exception keys (bundled wins)
 * @returns {{ exceptions: object, warnings: { skippedExpired: string[], droppedCollision: string[] } }}
 */
function loadLocalExceptions (filePath, { now = Date.now(), bundledKeys = new Set() } = {}) {
  let raw
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw toolError(`cannot read local exceptions file ${filePath}: ${e.message}`)
  }

  let doc
  try {
    doc = JSON.parse(raw)
  } catch (e) {
    throw toolError(`local exceptions file ${filePath} is not valid JSON: ${e.message}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw toolError(`local exceptions file ${filePath} must be a JSON object`)
  }

  // Security boundary: a repo may waive specific packages, never expand the
  // org-wide allowlist or alias map.
  for (const key of ['allowed', 'aliases']) {
    if (key in doc) {
      throw toolError(`local exceptions file ${filePath} may not define "${key}" — the allowlist and aliases are central policy (data.json) only`)
    }
  }

  const rawExceptions = doc.exceptions || {}
  if (typeof rawExceptions !== 'object' || Array.isArray(rawExceptions)) {
    throw toolError(`local "exceptions" in ${filePath} must be an object of "name@version" -> { reason, expires }`)
  }

  const exceptions = {}
  const skippedExpired = []
  const droppedCollision = []
  for (const [key, val] of Object.entries(rawExceptions)) {
    if (!/^.+@.+$/.test(key)) {
      throw toolError(`local exception key "${key}" must be "name@version"`)
    }
    if (!val || typeof val !== 'object' || typeof val.reason !== 'string' || !val.reason.trim()) {
      throw toolError(`local exception "${key}" needs a non-empty "reason"`)
    }
    const expiresMs = typeof val.expires === 'string' ? Date.parse(`${val.expires}T00:00:00Z`) : NaN
    if (Number.isNaN(expiresMs)) {
      throw toolError(`local exception "${key}" needs an "expires" date in YYYY-MM-DD form`)
    }
    if (bundledKeys.has(key)) { droppedCollision.push(key); continue } // bundled (central) wins
    if (expiresMs < now) { skippedExpired.push(key); continue } // expired waiver no longer applies
    exceptions[key] = { reason: val.reason, expires: val.expires }
  }

  return { exceptions, warnings: { skippedExpired, droppedCollision } }
}

module.exports = { FILE_NAME, resolveLocalExceptionsPath, loadLocalExceptions }
