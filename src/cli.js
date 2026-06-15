#!/usr/bin/env node
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
 * @mojaloop/license-scanner-tool — SBOM-first license compliance gate.
 *
 * Generates a CycloneDX SBOM with Syft (or reads a pre-generated one), then
 * evaluates it against the bundled allowlist policy. Used by CI (the mojaloop
 * build orb), local pre-flight, and git pre-push hooks.
 *
 * Usage:
 *   license-scanner-tool [options] [<dir>|<sbom.cdx.json>]
 *
 * Options:
 *   --warn             Report violations but always exit 0 (non-blocking mode).
 *   --syft <ver>       Syft version to install if missing (default: v1.45.0).
 *   --exceptions <p>   Path to a project-local exceptions file (default:
 *                      ./.license-scanner.json if present). Waives UNDETERMINED
 *                      findings only; cannot define allowed/aliases.
 *   -h, --help         Show help.
 *
 * Default target is ".". Requires `syft` on PATH only when scanning a directory.
 * Exit codes: 0 = pass (or --warn), 1 = violations, 2 = usage/tool error.
 */

const fs = require('fs')
const { execFileSync } = require('child_process')
const { evaluate, DEFAULT_POLICY } = require('./gate')
const { resolveLocalExceptionsPath, loadLocalExceptions } = require('./local-exceptions')

function parseArgs (argv) {
  const opts = { target: '.', warn: false, syft: 'v1.45.0' }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--warn') opts.warn = true
    else if (a === '--syft') opts.syft = argv[++i]
    else if (a === '--exceptions') opts.exceptions = argv[++i]
    else if (a === '-h' || a === '--help') opts.help = true
    else rest.push(a)
  }
  if (rest[0]) opts.target = rest[0]
  return opts
}

function ensureSyft (version) {
  try {
    execFileSync('syft', ['version'], { stdio: 'ignore' })
    return
  } catch { /* syft not installed — fall through to guidance below */ }
  console.error('license-scanner-tool: Syft not found — install it once:')
  console.error('  brew install syft')
  console.error('  or: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin ' + version)
  process.exit(2)
}

function loadSbom (target, syftVersion) {
  if (target.endsWith('.json') && fs.existsSync(target)) {
    return JSON.parse(fs.readFileSync(target, 'utf8'))
  }
  ensureSyft(syftVersion)
  const out = execFileSync('syft', [`dir:${target}`, '-o', 'cyclonedx-json'], {
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore']
  })
  return JSON.parse(out.toString('utf8'))
}

function main () {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).join('\n').replace(/^ \* ?/gm, ''))
    process.exit(0)
  }

  const sbom = loadSbom(opts.target, opts.syft)

  // Project-local exceptions (optional, additive): a consuming repo may waive
  // its own UNDETERMINED findings via .license-scanner.json. Absent → unchanged.
  let policy = DEFAULT_POLICY
  const localPath = resolveLocalExceptionsPath({ exceptions: opts.exceptions, target: opts.target })
  if (localPath) {
    let local
    try {
      local = loadLocalExceptions(localPath, { bundledKeys: new Set(Object.keys(DEFAULT_POLICY.exceptions || {})) })
    } catch (e) {
      console.error(`license-scanner-tool: ${e.message}`)
      process.exit(e.exitCode || 2)
    }
    console.log(`license-scanner-tool: loaded ${Object.keys(local.exceptions).length} local exception(s) from ${localPath}`)
    for (const k of local.warnings.droppedCollision) {
      console.warn(`  - ignored local exception ${k}: defined centrally, bundled policy wins`)
    }
    for (const k of local.warnings.skippedExpired) {
      console.warn(`  - local exception ${k} has expired and will not apply`)
    }
    policy = { ...DEFAULT_POLICY, localExceptions: local.exceptions }
  }

  const { npm, violations, waived } = evaluate(sbom, policy)

  for (const w of waived) {
    console.log(`license-scanner-tool: WAIVED (local exception) ${w.key} — ${w.reason} (expires ${w.expires})`)
  }

  if (violations.length === 0) {
    console.log(`license-scanner-tool: PASS (${npm} npm components, 0 violations)`)
    process.exit(0)
  }

  const level = opts.warn ? 'WARN' : 'FAIL'
  console.error(`license-scanner-tool: ${level} (${npm} npm components, ${violations.length} violation(s))`)
  for (const v of violations) console.error(`  - ${v}`)
  console.error('\nFix the dependency, or (if the licence is genuinely fine) add a vetted alias/exception to the policy via PR.')
  process.exit(opts.warn ? 0 : 1)
}

main()
