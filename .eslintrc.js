module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true,
    commonjs: true,
    jest: true
  },
  globals: {
    window: true,
    document: true,
    fetch: true,
    URL: true,
    URLSearchParams: true,
    Blob: true,
    FileReader: true,
    FormData: true,
    XMLHttpRequest: true,
    console: true,
    setTimeout: true,
    clearTimeout: true,
    self: true,
    trustedTypes: true
  },
  parserOptions: {
    ecmaVersion: 'latest'
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { 
          'varsIgnorePattern': '^_',
          'argsIgnorePattern': '^_',
          'destructuredArrayIgnorePattern': '^_'
        }]
      }
    },
    {
      files: ['**/*.js', '**/*.jsx'],
      extends: ['eslint:recommended'],
      env: {
        node: true,
        commonjs: true
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    {
      files: ['**/next.config.js'],
      extends: ['eslint:recommended'],
      env: {
        node: true,
        commonjs: true
      },
      globals: {
        module: true,
        require: true,
        __dirname: true,
        process: true
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script'
      }
    }
  ],
  ignorePatterns: [
    '.eslintrc.js',
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    'src/integration/__tests__/next-dev/.next/**',
    'src/integration/__tests__/next-dev/.next/types/**',
    'src/integration/__tests__/next-dev/.next/static/**'
  ],
  rules: {
    'no-unused-vars': ['error', {
      'varsIgnorePattern': '^_',
      'argsIgnorePattern': '^_'
    }],
    'no-undef': 'error',
    'no-prototype-builtins': 'off',
    'no-control-regex': 'off',
    'no-cond-assign': ['error', 'except-parens']
  }
}
