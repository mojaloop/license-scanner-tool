'use strict'
// ESLint 9 flat config. Lints the new tool (src/, test/) only — the legacy bash
// tool (lib/, scripts/) is excluded.
const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
  {
    ignores: ['lib/**', 'scripts/**', 'checked_out/**', 'results/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
]
