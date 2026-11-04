const js = require('@eslint/js');
const globals = require('globals');
const n = require('eslint-plugin-n');

module.exports = [
  { ignores: ['node_modules/', 'data/', 'logs/'] },
  js.configs.recommended,
  n.configs['flat/recommended-script'],
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'n/no-process-exit': 'off',
      // Aplicación, no paquete publicado: las herramientas de desarrollo son válidas
      'n/no-unpublished-require': 'off',
    },
  },
];
