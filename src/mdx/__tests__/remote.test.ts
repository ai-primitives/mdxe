import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRemoteImport, fetchRemoteComponent } from '../remote'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// Add type for global fetch
declare global {
  var fetch: (url: string) => Promise<Response>
}

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}))

global.fetch = vi.fn()

describe('resolveRemoteImport', () => {
  it('should return existing esm.sh URLs unchanged', async () => {
    const url = 'https://esm.sh/react@18.2.0'
    expect(await resolveRemoteImport({ url })).toBe(url)
  })

  it('should convert package names to esm.sh URLs', async () => {
    const result = await resolveRemoteImport({ url: 'react', version: '18.2.0' })
    expect(result).toBe('https://esm.sh/react@18.2.0')
  })

  it('should handle scoped packages', async () => {
    const result = await resolveRemoteImport({ url: '@mdx-js/react' })
    expect(result).toBe('https://esm.sh/@mdx-js/react')
  })
})

describe('fetchRemoteComponent', () => {
  const CACHE_DIR = path.join(os.tmpdir(), 'mdxe-remote-cache')
  const url = 'https://esm.sh/react@18.2.0'
  const mockContent = 'export default function Component() {}'

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockReset()
  })

  it('should fetch and cache remote components', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockContent)
    })

    // Simulate cache miss
    ;(fs.stat as any).mockRejectedValueOnce(new Error('not found'))

    const result = await fetchRemoteComponent(url)

    expect(result).toBe(mockContent)
    expect(fs.mkdir).toHaveBeenCalledWith(CACHE_DIR, { recursive: true })
    expect(fs.writeFile).toHaveBeenCalled()
  })

  it('should use cached content when available and fresh', async () => {
    ;(fs.stat as any).mockResolvedValueOnce({
      mtimeMs: Date.now() - 1000 // 1 second old
    })
    ;(fs.readFile as any).mockResolvedValueOnce(mockContent)

    const result = await fetchRemoteComponent(url)

    expect(result).toBe(mockContent)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should refetch when cache is stale', async () => {
    ;(fs.stat as any).mockResolvedValueOnce({
      mtimeMs: Date.now() - 25 * 60 * 60 * 1000 // 25 hours old
    })
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockContent)
    })

    await fetchRemoteComponent(url)

    expect(global.fetch).toHaveBeenCalledWith(url)
  })

  it('should throw error on failed fetch', async () => {
    ;(fs.stat as any).mockRejectedValueOnce(new Error('not found'))
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false
    })

    await expect(fetchRemoteComponent(url)).rejects.toThrow('Failed to fetch remote component')
  })
})
