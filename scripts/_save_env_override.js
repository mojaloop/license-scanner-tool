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
  'dockerImages',
]

let output = ""
Object.keys(process.env)
  .filter(k => overrideVars.indexOf(k) > -1)
  .forEach(k => {
    const value = process.env[k]
    output += `export ${k}='${value}'\n`
  })


fs.writeFileSync(OVERRIDE_FILENAME, output)