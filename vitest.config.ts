import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Allow .ts files to be imported with .js extension
    server: {
      deps: {
        inline: [],
      },
    },
  },
  // Resolve .js to .ts for source files
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
})
