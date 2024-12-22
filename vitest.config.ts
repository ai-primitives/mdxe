import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 180000, // Further increased timeout for CI environment
    hookTimeout: 180000, // Further increased hook timeout for CI environment
    maxConcurrency: 1, // Run tests serially to prevent resource contention
    isolate: true, // Ensure clean test environment for each test
    logHeapUsage: true // Monitor memory usage during tests
  }
})
