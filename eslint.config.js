import eslint from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import local from './tools/eslint/sem-emoji.js';

const regrasTypeScript = {
  '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
  ],
  eqeqeq: ['error', 'always'],
  'no-console': 'error',
};

const regrasDeTeste = {
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
};

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/.angular/**', '**/node_modules/**', 'design/**'],
  },
  {
    plugins: { local },
    rules: { 'local/sem-emoji': 'error' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: regrasTypeScript,
  },
  {
    files: ['apps/web/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...regrasTypeScript,
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ms', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'ms', style: 'camelCase' },
      ],
      // Template e estilo sempre em arquivos próprios, inclusive em componentes triviais.
      '@angular-eslint/component-max-inline-declarations': [
        'error',
        { template: 0, styles: 0, animations: 0 },
      ],
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/computed-must-return': 'error',
    },
  },
  {
    files: ['apps/web/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/button-has-type': 'error',
      '@angular-eslint/template/prefer-at-empty': 'error',
      '@angular-eslint/template/eqeqeq': 'error',
    },
  },
  {
    files: ['apps/**/*.spec.ts', 'apps/**/*.e2e-spec.ts', 'apps/**/test/**/*.ts'],
    rules: regrasDeTeste,
  },
  {
    // Componentes hospedeiros de teste existem só para projetar conteúdo em um
    // componente real; três arquivos para cada um seriam ruído.
    files: ['apps/web/**/*.spec.ts'],
    rules: { '@angular-eslint/component-max-inline-declarations': 'off' },
  },
);
