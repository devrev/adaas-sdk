import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/**', 'test/**', 'src/deprecated/**'] },

  // JavaScript files (CommonJS) - for worker.js and config files
  {
    files: ['**/*.{js,cjs}', '**/*.config.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // ES Module JavaScript files
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: 'module',
    },
  },

  // TypeScript files (without type checking)
  {
    files: ['**/*.{ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,mts,cts}'],
  })),
  prettierConfig,

  {
    files: ['**/*.{ts,mts,cts}'],
    ignores: ['**/*.config.*', '**/*.d.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',

      // Custom rules
      'require-await': 'off',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-await': 'error',
    },
  },
]);
