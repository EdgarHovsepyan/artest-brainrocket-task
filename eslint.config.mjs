import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/build-*/**', // Cocos build-output variants (build-qa, build-shaderfix, build-templates, build-ux2, …)
      '**/library/**',
      '**/temp/**',
      '**/.cache/**',
      '**/*.d.ts',
      'games/*/assets/**', // Cocos editor-managed sources are linted by their own project
      'games/shining-pop/**', // vendored single-file flagship — built & formatted by its own vite toolchain
      'games/*/extensions/**', // vendored Cocos editor extensions (cocos-mcp-server) — not our source
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: [
      '**/*.cjs',
      '**/*.config.{js,cjs}',
      'scripts/**/*.mjs',
      '**/scripts/**/*.mjs',
      '**/bin/**/*.mjs',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
  },
  prettier,
);
