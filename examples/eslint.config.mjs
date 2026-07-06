import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  // ── Ignored paths ──────────────────────────────────────────────────────────
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'],
  },

  // ── Base recommended rules ─────────────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Core rules for all TS files ────────────────────────────────────────────
  {
    plugins: {
      '@stylistic': stylistic,
    },

    rules: {
      // --- Variable declarations ---
      'prefer-const': 'error',       // Use const when variable is never reassigned
      'no-var': 'error',             // Disallow var; use let or const

      // --- Code quality ---
      'eqeqeq': ['error', 'always'], // Enforce === over ==
      'no-console': 'warn',          // Warn on console.* calls
      'no-duplicate-imports': 'error', // No multiple imports from the same module

      // --- TypeScript-specific ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',   // Allow unused args prefixed with _
          varsIgnorePattern: '^_',   // Allow unused vars prefixed with _
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',  // Discourage any type
      '@typescript-eslint/consistent-type-imports': [ // Enforce `import type` for type-only imports
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-require-imports': 'error', // Prefer ES imports over require()

      // --- Blank lines & formatting ---
      '@stylistic/no-multiple-empty-lines': [
        'error',
        {
          max: 1,    // At most 1 blank line anywhere (keeps logical grouping in functions)
          maxBOF: 0, // No blank lines at start of file
          maxEOF: 1, // Allow 1 blank line at end of file
        },
      ],

      // Allow blank lines before/after blocks and between import groups,
      // but not between object properties
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any',    prev: 'import', next: 'import' }, // no blank between imports
        { blankLine: 'always', prev: '*',       next: 'return' }, // blank before return
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any',    prev: ['const', 'let'], next: ['const', 'let'] }, // consecutive decls OK
      ],
    },
  },

  // ── Relaxed rules for test files ───────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/playwright.config.ts'],
    rules: {
      'no-console': 'off',                       // console.log is fine in tests/config
      '@typescript-eslint/no-explicit-any': 'off', // test helpers often use any
    },
  }
)
