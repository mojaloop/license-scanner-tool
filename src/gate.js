'use strict'
/**
 * Core license gate logic (engine-agnostic, no I/O).
 * Evaluates a CycloneDX SBOM against the bundled policy (data.json) and returns
 * the list of violations. Used by cli.js and the test suite.
 *
 * Rules (mirrors the documented policy):
 *  - Only npm package components (purl pkg:npm/...) are gated. Syft also
 *    catalogues workflow YAMLs, lockfiles and binaries — those are ignored.
 *  - A licence is resolved to an SPDX id/expression via the curated alias map
 *    (normalize.js). Anything unresolved is UNDETERMINED (fail closed).
 *  - An id/expression not on the allowlist is DISALLOWED.
 *  - Per-package exceptions (name@version) waive a finding until their expiry.
 */

const path = require('path')
const { normaliseEntry } = require('./normalize')

const DEFAULT_POLICY = require(path.join(__dirname, '..', 'data.json')).licenses

function inScope (c) {
  return (c.purl || '').startsWith('pkg:npm/')
}

function declaredNames (c) {
  return (c.licenses || []).map((l) => l.license && l.license.name).filter(Boolean).join('; ')
}

/**
 * @param {object} sbom    CycloneDX SBOM
 * @param {object} policy  { allowed, aliases, exceptions } (defaults to data.json)
 * @param {number} now     epoch ms (for exception expiry; defaults to Date.now())
 * @returns {{ npm:number, violations:string[] }}
 */
function evaluate (sbom, policy = DEFAULT_POLICY, now = Date.now()) {
  const allowed = new Set(policy.allowed)
  const aliases = policy.aliases || {}
  const exceptions = policy.exceptions || {}

  const excepted = (c) => {
    const e = exceptions[`${c.name}@${c.version || ''}`]
    return !!e && now < Date.parse(`${e.expires}T00:00:00Z`)
  }
  const tokens = (c) => {
    const s = new Set()
    for (const l of (c.licenses || [])) {
      const n = normaliseEntry(l, aliases)
      if (n.license && n.license.id) s.add(n.license.id)
      else if (n.expression) s.add(n.expression)
    }
    return s
  }

  const violations = []
  let npm = 0
  for (const c of (sbom.components || [])) {
    if (!inScope(c)) continue
    npm++
    if (excepted(c)) continue
    const ts = tokens(c)
    if (ts.size === 0) {
      violations.push(`UNDETERMINED: npm package ${c.name}@${c.version || '?'} declares licence "${declaredNames(c)}", which is not a recognised SPDX id. Verify the real licence, then add a vetted alias (data.json -> aliases) or a dated exception.`)
      continue
    }
    for (const t of ts) {
      if (!allowed.has(t)) {
        violations.push(`DISALLOWED: npm package ${c.name}@${c.version || '?'} uses licence "${t}", which is not on the allowlist (data.json -> allowed).`)
      }
    }
  }
  return { npm, violations }
}

module.exports = { evaluate, DEFAULT_POLICY }
