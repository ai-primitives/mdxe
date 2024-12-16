import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRemoteImport, fetchRemoteComponent } from '../remote'
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

    expect(result).toBe(mockContent)
    expect(fs.mkdir).toHaveBeenCalledWith(CACHE_DIR, { recursive: true })
    expect(fs.writeFile).toHaveBeenCalled()
  })

  it('should use cached content when available and fresh', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      mtimeMs: Date.now() - 1000, // 1 second old
    } as Stats)
    vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent)

    const result = await fetchRemoteComponent(url)

    expect(result).toBe(mockContent)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('should refetch when cache is stale', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({
      mtimeMs: Date.now() - 25 * 60 * 60 * 1000, // 25 hours old
    } as Stats)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockContent),
    } as Response)

    await fetchRemoteComponent(url)

    expect(globalThis.fetch).toHaveBeenCalledWith(url)
  })

  it('should throw error on failed fetch', async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found'))
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
    } as Response)

    await expect(fetchRemoteComponent(url)).rejects.toThrow('Failed to fetch remote component')
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
    const extensions = ['.tsx', '.jsx', '.ts', '.js']

    // Simulate file not found for first few extensions
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found')) // .tsx
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('not found')) // .jsx
    vi.mocked(fs.stat).mockResolvedValueOnce({ // .ts
      isFile: () => true,
      mtimeMs: Date.now(),
    } as unknown as Stats)

    const localContent = 'export const Button = () => <button>Click</button>'
    vi.mocked(fs.readFile).mockResolvedValueOnce(localContent)

    const result = await fetchRemoteComponent(relativePath, baseDir)

    expect(result).toBe(localContent)
    expect(fs.readFile).toHaveBeenCalledWith(
      path.join(baseDir, 'components/Button.ts'),
      'utf-8'
    )
  })
})
