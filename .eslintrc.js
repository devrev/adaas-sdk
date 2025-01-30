module.exports = {
  root: true,
  extends: 'airbnb-typescript/base',
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // Makes ESLint and Prettier play nicely together
  ],
  ignorePatterns: ['**/dist/*'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'require-await': 'off',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
  },
};
