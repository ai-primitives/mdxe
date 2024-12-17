import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 180000, // Increased timeout for server tests
    hookTimeout: 180000  // Increased hook timeout for setup
  }
})
