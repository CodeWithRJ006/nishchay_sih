import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-console': 'error',
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Do not use alert. Use Toast component instead.' },
        { name: 'confirm', message: 'Do not use confirm.' },
        { name: 'prompt', message: 'Do not use prompt.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Raw fetch is forbidden outside web/src/lib/api.ts. Use the api client.',
        },
      ],
    },
  },
  {
    files: ['web/src/lib/api.ts', 'server/**', 'shared/**', 'scripts/**', 'tests/**'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
);
