import { vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

export const debug = (...args: any[]): void => {
  console.log('[Test Debug]', ...args)
}

export const createTempDir = (prefix: string): string => {
  const tempPath = mkdtempSync(path.join(tmpdir(), `${prefix}-`))
  debug(`Created temp directory: ${tempPath}`)
  return tempPath
}

export const cleanupTempDir = (dirPath: string): void => {
  debug(`Cleaning up temp directory: ${dirPath}`)
  rmSync(dirPath, { recursive: true, force: true })
}

globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
globalThis.Response = vi.fn() as unknown as typeof globalThis.Response

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  vi.resetAllMocks()
})
