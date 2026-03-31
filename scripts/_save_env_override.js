#!/usr/bin/env node

/**
 * Save certain environment variables to an .env_override file to allow us
 * to override settings in the config.toml
 */

const fs = require('fs')
const OVERRIDE_FILENAME = '.env_override'

/* A list of env vars we want to override */
const overrideVars = [
  'mode',
  'pathToRepo',
  'dockerImage',
  'dockerImages'
]

const generateOverrideContent = (env) => {
  let output = ''
  Object.keys(env)
    .filter(k => overrideVars.indexOf(k) > -1)
    .forEach(k => {
      const value = env[k]
      output += `export ${k}='${value}'\n`
    })
  return output
}

/* istanbul ignore next */
if (require.main === module) {
  const output = generateOverrideContent(process.env)
  fs.writeFileSync(OVERRIDE_FILENAME, output)
}

module.exports = {
  generateOverrideContent,
  overrideVars,
  OVERRIDE_FILENAME
}
