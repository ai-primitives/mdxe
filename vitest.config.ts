import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 120000, // Increased timeout for watch mode tests
    hookTimeout: 120000 // Increased hook timeout for longer-running tests
  }
})
