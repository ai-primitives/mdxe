import { vi, beforeEach } from 'vitest'

// Mock global fetch and Response for test environment
globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
globalThis.Response = vi.fn() as unknown as typeof globalThis.Response

// Sleep utility for tests
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks()
})
