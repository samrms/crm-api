import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
    },
    // The SQLite engine (node// The SQLite engine (node:sqlite / bun:sqlite)) isis loaded through
    // createRequire at runtimeloaded through
    // createRequire at runtime, so Vite never resolves it statically and no
    // dependency inlining or externalization rule is needed.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/shared/database/migrations/**'],
    },
  },
  resolve: {
    alias: {
      '@': `${root}/src`,
      '@shared': `${root}/src/shared`,
    },
    extensions: ['.ts', '.js', '.json'],
  },
})
