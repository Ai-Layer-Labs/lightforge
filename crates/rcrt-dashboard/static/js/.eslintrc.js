module.exports = {
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    // Code quality
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console for debugging
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Best practices
    'eqeqeq': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // ES6+
    'arrow-spacing': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    
    // Style
    'indent': ['error', 4],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    
    // Spacing
    'space-before-blocks': 'error',
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'keyword-spacing': 'error'
  },
  globals: {
    // Three.js globals
    'THREE': 'readonly',
    
    // Browser globals
    'EventSource': 'readonly',
    'localStorage': 'readonly',
    
    // Dashboard globals (for legacy compatibility)
    'dashboard': 'writable',
    'adminManager': 'writable',
    'crudManager': 'writable',
    'chatManager': 'writable',
    'eventStreamManager': 'writable'
  },
  overrides: [
    {
      files: ['webpack.config.js', '.eslintrc.js'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-undef': 'off'
      }
    }
  ]
};
