import { vi, beforeEach } from 'vitest'

// Mock global fetch and Response for test environment
globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
globalThis.Response = vi.fn() as unknown as typeof globalThis.Response

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks()
})
