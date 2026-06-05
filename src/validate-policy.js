#!/usr/bin/env node
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
/**
 * Lint the bundled policy (data.json) at build time:
 *  - every allowlist entry is a canonical SPDX id or a parseable, canonical
 *    SPDX expression;
 *  - aliases resolve to valid SPDX ids, never to a proprietary marker;
 *  - exceptions are well-formed with a YYYY-MM-DD expiry.
 *
 *   node src/validate-policy.js [data.json]
 *   exit 0 = valid, 1 = problems.
 */

const fs = require('fs')
const path = require('path')
const ids = require('spdx-license-ids')
const deprecated = require('spdx-license-ids/deprecated.json')
const parse = require('spdx-expression-parse')
const { canonicaliseExpression, PROPRIETARY } = require('./normalize')

const dataPath = process.argv[2] || path.join(__dirname, '..', 'data.json')
const idSet = new Set(ids)
const deprecatedSet = new Set(deprecated)
const problems = []
const warnings = []

const { licenses } = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const allowedSet = new Set(licenses.allowed)

// --- allowlist -------------------------------------------------------------
for (const entry of licenses.allowed) {
  if (/\s/.test(entry)) {
    try {
      parse(entry)
    } catch (e) {
      problems.push(`allowed: "${entry}" is not a parseable SPDX expression (${e.message})`)
    }
    const canon = canonicaliseExpression(entry)
    if (entry !== canon) {
      problems.push(`allowed: "${entry}" is not in canonical form — use "${canon}" (paren-free, operands sorted)`)
    }
  } else if (entry.toUpperCase() === 'UNLICENSED') {
    problems.push('allowed: "UNLICENSED" is npm-proprietary and must never be allowlisted')
  } else if (!idSet.has(entry)) {
    problems.push(`allowed: "${entry}" is not a valid SPDX licence id`)
  } else if (deprecatedSet.has(entry)) {
    warnings.push(`allowed: "${entry}" is a DEPRECATED SPDX id — prefer the current form`)
  }
}

// --- aliases ---------------------------------------------------------------
for (const [name, id] of Object.entries(licenses.aliases || {})) {
  if (!name.trim()) problems.push('aliases: empty alias key')
  if (PROPRIETARY.test(name.trim())) {
    problems.push(`aliases: "${name}" is a proprietary marker and must never be aliased to a licence`)
  }
  if (typeof id !== 'string' || !idSet.has(id)) {
    problems.push(`aliases: "${name}" -> "${id}" is not a valid SPDX licence id`)
  } else if (id.toUpperCase() === 'UNLICENSED') {
    problems.push(`aliases: "${name}" must not resolve to UNLICENSED`)
  } else if (!allowedSet.has(id)) {
    warnings.push(`aliases: "${name}" -> "${id}" resolves to an id not on the allowlist (will still be DISALLOWED)`)
  } else if (deprecatedSet.has(id)) {
    warnings.push(`aliases: "${name}" -> "${id}" is a DEPRECATED SPDX id`)
  }
}

// --- exceptions ------------------------------------------------------------
const now = Date.now()
for (const [key, val] of Object.entries(licenses.exceptions || {})) {
  if (!/^.+@.+$/.test(key)) problems.push(`exceptions: key "${key}" must be "name@version"`)
  if (!val || typeof val.expires !== 'string') {
    problems.push(`exceptions: "${key}" needs an "expires" date`)
    continue
  }
  const t = Date.parse(`${val.expires}T00:00:00Z`)
  if (Number.isNaN(t)) problems.push(`exceptions: "${key}" expires "${val.expires}" is not YYYY-MM-DD`)
  else if (t < now) warnings.push(`exceptions: "${key}" expired on ${val.expires} — remove or renew`)
  if (!val.reason) warnings.push(`exceptions: "${key}" has no reason`)
}

for (const w of warnings) console.warn(`WARN  ${w}`)
for (const p of problems) console.error(`ERROR ${p}`)
console.log(`\nvalidate-policy: ${licenses.allowed.length} allowed, ${Object.keys(licenses.aliases || {}).length} aliases, ${Object.keys(licenses.exceptions || {}).length} exceptions, ${problems.length} error(s), ${warnings.length} warning(s)`)
process.exit(problems.length ? 1 : 0)
