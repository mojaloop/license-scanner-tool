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
/**
 * SPDX normalization, shared by the gate (gate.js) and the policy validator
 * (validate-policy.js). One implementation keeps the allowlist and the scanned
 * SBOM canonicalised identically.
 *
 * DESIGN: reject-by-default. We do NOT use open-ended fuzzy correction
 * (e.g. spdx-correct): it maps ANY string to its nearest SPDX id by edit
 * distance, which silently turns npm's proprietary "UNLICENSED" into the
 * permissive "Unlicense" (a one-character, meaning-inverting match). Instead we
 * resolve ONLY an explicit, reviewed alias map (data.json -> licenses.aliases).
 * Anything not a valid SPDX id and not on that map stays unresolved -> the gate
 * treats it as undetermined and fails closed.
 */

// Proprietary / no-grant markers that must never be aliased to a licence, even
// if one is mistakenly added to the map. validate-policy.js also rejects these
// as alias keys at lint time.
const PROPRIETARY = /^(unlicensed|unlicenced|see[\s-]?license|custom|proprietary)$/i

function key (name) {
  // Match aliases on a trimmed, whitespace-collapsed form (case-sensitive).
  return String(name).replace(/\s+/g, ' ').trim()
}

/**
 * Canonicalise an SPDX expression so equivalent forms compare equal: strip
 * parentheses, collapse whitespace, and sort the operands of a pure-OR or
 * pure-AND expression (so "MIT OR WTFPL" === "WTFPL OR MIT"). Mixed AND/OR is
 * left order-preserved (documented limitation).
 */
function canonicaliseExpression (expr) {
  const s = String(expr).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  const hasOr = /\sOR\s/i.test(s)
  const hasAnd = /\sAND\s/i.test(s)
  if (hasOr && !hasAnd) return s.split(/\s+OR\s+/i).map((x) => x.trim()).sort().join(' OR ')
  if (hasAnd && !hasOr) return s.split(/\s+AND\s+/i).map((x) => x.trim()).sort().join(' AND ')
  return s
}

/**
 * Normalise one CycloneDX license entry to canonical SPDX where possible.
 * @param entry   a CycloneDX license entry ({license:{id|name}} or {expression})
 * @param aliases curated map of vetted free-text strings -> SPDX id
 */
function normaliseEntry (entry, aliases) {
  const map = aliases || {}
  if (entry.expression) {
    return { expression: canonicaliseExpression(entry.expression) }
  }
  if (entry.license && entry.license.id) {
    return entry // already a valid SPDX id
  }
  if (entry.license && entry.license.name) {
    const name = key(entry.license.name)
    if (PROPRIETARY.test(name)) return entry // never alias proprietary -> undetermined
    if (Object.prototype.hasOwnProperty.call(map, name)) {
      return { license: { id: map[name] } } // vetted alias only
    }
    return entry // unknown free text -> stays a name -> undetermined (fail closed)
  }
  return entry
}

module.exports = { canonicaliseExpression, normaliseEntry, PROPRIETARY }
