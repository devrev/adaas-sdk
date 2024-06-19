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
};
