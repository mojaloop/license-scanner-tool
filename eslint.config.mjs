import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,

  // Application code
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'warn'
    }
  },

  // Test files
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },

  // Global ignores
  {
    ignores: ['node_modules/**', 'lib/**', 'coverage/**', '.nyc_output/**']
  }
]
