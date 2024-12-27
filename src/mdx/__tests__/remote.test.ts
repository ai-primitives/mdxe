import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRemoteImport, fetchRemoteComponent } from '../remote.js'
import { promises as fs, Stats } from 'fs'
import path from 'path'
import os from 'os'

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}))

describe('resolveRemoteImport', () => {
  it('should return existing esm.sh URLs unchanged', async () => {
    const url = 'https://esm.sh/react@18.2.0'
    expect(await resolveRemoteImport({ url })).toEqual({ url })
  })

  it('should convert package names to esm.sh URLs', async () => {
    const result = await resolveRemoteImport({ url: 'react', version: '18.2.0' })
    expect(result).toEqual({ url: 'https://esm.sh/react@18.2.0' })
  })

  it('should handle scoped packages', async () => {
    const result = await resolveRemoteImport({ url: '@mdx-js/react' })
    expect(result).toEqual({ url: 'https://esm.sh/@mdx-js/react' })
  })
})

describe('fetchRemoteComponent', () => {
  const CACHE_DIR = path.join(os.tmpdir(), 'mdxe-remote-cache')
  const url = 'https://esm.sh/react@18.2.0'
  const mockContent = `/* esm.sh - react@18.2.0 */
export * from "/stable/react@18.2.0/esnext/react.mjs";
export { default } from "/stable/react@18.2.0/esnext/react.mjs";`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(globalThis, 'fetch').mockReset()
  })

  it('should fetch and cache remote components', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockContent),
    } as Response)

    // Simulate cache miss
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found'))

    const result = await fetchRemoteComponent(url)

    expect(result).toContain('export * from "/stable/react@18.2.0/esnext/react.mjs"')
    expect(fs.mkdir).toHaveBeenCalledWith(CACHE_DIR, { recursive: true })
    expect(fs.writeFile).toHaveBeenCalled()
  })

  it('should use cached content when available and fresh', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      mtimeMs: Date.now() - 1000, // 1 second old,
      size: 1024, // Add non-zero size
    } as Stats)
    vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent)

    const result = await fetchRemoteComponent(url)

    expect(result).toContain('export * from "/stable/react@18.2.0/esnext/react.mjs"')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('should refetch when cache is stale', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      mtimeMs: Date.now() - 23.5 * 60 * 60 * 1000, // 23.5 hours old
      size: 1024, // Add non-zero size
    } as Stats)
    vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('new content'),
    } as Response)

    const content = await fetchRemoteComponent(url)

    // First we get cached content
    expect(content).toBe(mockContent)

    // Wait for background fetch to complete
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 100)
    })

    // Only verify that background fetch was triggered
    expect(fetchSpy).toHaveBeenCalledWith(url)
  })

  it('should throw error on failed fetch', async () => {
    // Simulate no cache and failed fetch
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found'))
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    // Should throw with URL and error message
    await expect(fetchRemoteComponent(url)).rejects.toThrow(`Failed to fetch component from ${url}: Network error`)
  })

  it('should handle relative file imports', async () => {
    const baseDir = '/test/dir'
    const relativePath = './components/Button'
    const absolutePath = path.join(baseDir, 'components/Button.tsx')
    const localContent = 'export default function Button() { return <button>Click me</button> }'

    vi.mocked(fs.stat).mockResolvedValueOnce({
      isFile: () => true,
      mtimeMs: Date.now(),
    } as unknown as Stats)
    vi.mocked(fs.readFile).mockResolvedValueOnce(localContent)

    const result = await fetchRemoteComponent(relativePath, baseDir)

    expect(result).toBe(localContent)
    expect(fs.readFile).toHaveBeenCalledWith(absolutePath, 'utf-8')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('should resolve local file extensions', async () => {
    const baseDir = '/test/dir'
    const relativePath = './components/Button'

    // Simulate file not found for first few extensions
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found')) // .tsx
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found')) // .jsx
    vi.mocked(fs.stat).mockResolvedValueOnce({
      // .ts
      isFile: () => true,
      mtimeMs: Date.now(),
    } as unknown as Stats)

    const localContent = 'export const Button = () => <button>Click</button>'
    vi.mocked(fs.readFile).mockResolvedValueOnce(localContent)

    const result = await fetchRemoteComponent(relativePath, baseDir)

    expect(result).toBe(localContent)
    expect(fs.readFile).toHaveBeenCalledWith(path.join(baseDir, 'components/Button.ts'), 'utf-8')
  })
})
