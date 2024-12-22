module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  globals: {
    setTimeout: true,
    clearTimeout: true
  },
  extends: [
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 
      'varsIgnorePattern': '^_',
      'argsIgnorePattern': '^_',
      'destructuredArrayIgnorePattern': '^_'
    }]
  }
}
