#!/usr/bin/env node
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
 *   --warn         Report violations but always exit 0 (non-blocking mode).
 *   --syft <ver>   Syft version to install if missing (default: v1.45.0).
 *   -h, --help     Show help.
 *
 * Default target is ".". Requires `syft` on PATH only when scanning a directory.
 * Exit codes: 0 = pass (or --warn), 1 = violations, 2 = usage/tool error.
 */

const fs = require('fs')
const { execFileSync } = require('child_process')
const { evaluate } = require('./gate')

function parseArgs (argv) {
  const opts = { target: '.', warn: false, syft: 'v1.45.0' }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--warn') opts.warn = true
    else if (a === '--syft') opts.syft = argv[++i]
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
  const { npm, violations } = evaluate(sbom)

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
