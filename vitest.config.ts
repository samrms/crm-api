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
    deps: { inline: [] },
    server: { deps: { external: [/bun:sqlite/] } },
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
