'use strict';

const security = require('eslint-plugin-security');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  security.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // catch common correctness issues
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-globals': 'error',

      // async safety
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'require-await': 'error',

      // security plugin rules (subset most relevant to this codebase)
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'warn',
    },
  },
  {
    // relax rules that are noisy in test files
    files: ['test/**/*.js'],
    rules: {
      'security/detect-object-injection': 'off',
      'require-await': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'gen/', 'mta_archives/'],
  },
  // Must be last — disables ESLint rules that would conflict with Prettier.
  prettierConfig,
];
