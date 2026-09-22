import { defineConfig } from 'vitest/config'

const root = import.meta.dirname
const mod = (name: string) => `${root}/src/modules/${name}`

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': `${root}/src`,
      '@shared': `${root}/src/shared`,
      '@audit': mod('audit'),
      '@users': mod('users'),
      '@companies': mod('companies'),
      '@contacts': mod('contacts'),
      '@deals': mod('deals'),
      '@exports': mod('exports'),
      '@imports': mod('imports'),
      '@leads': mod('leads'),
      '@members': mod('members'),
      '@organizations': mod('organizations'),
      '@tasks': mod('tasks'),
      '@modules': `${root}/src/modules`,
    },
    extensions: ['.ts', '.js', '.json'],
  },
})
