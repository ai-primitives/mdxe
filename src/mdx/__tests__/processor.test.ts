import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest'
import { processMDX } from '../processor'
import { resolveRemoteImport, fetchRemoteComponent } from '../remote'

vi.mock('../remote', () => ({
  resolveRemoteImport: vi.fn(),
  fetchRemoteComponent: vi.fn()
}))

describe('processMDX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should process MDX with remote components', async () => {
    const mockContent = `
---
title: Test
---
# Hello World
    `
    const mockComponents = {
      Button: 'react-button'
    }

    ;(resolveRemoteImport as MockedFunction<typeof resolveRemoteImport>).mockResolvedValueOnce('https://esm.sh/react-button@1.0.0')
    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function Button() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      components: mockComponents
    })

    expect(result.code).toContain('export default function Button()')
    expect(resolveRemoteImport).toHaveBeenCalledWith({ url: 'react-button' })
    expect(fetchRemoteComponent).toHaveBeenCalledWith('https://esm.sh/react-button@1.0.0')
  })

  it('should handle remote layout imports', async () => {
    const mockContent = '# Hello World'
    const mockLayout = '@layouts/blog'

    ;(resolveRemoteImport as MockedFunction<typeof resolveRemoteImport>).mockResolvedValueOnce('https://esm.sh/@layouts/blog@1.0.0')
    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function BlogLayout() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      layout: mockLayout
    })

    expect(result.code).toContain('export default function BlogLayout()')
    expect(resolveRemoteImport).toHaveBeenCalledWith({ url: '@layouts/blog' })
    expect(fetchRemoteComponent).toHaveBeenCalledWith('https://esm.sh/@layouts/blog@1.0.0')
  })

  it('should handle direct URLs for components', async () => {
    const mockContent = '# Hello World'
    const mockComponents = {
      Button: 'https://esm.sh/react-button@1.0.0'
    }

    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function Button() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      components: mockComponents
    })

    expect(result.code).toContain('export default function Button()')
    expect(resolveRemoteImport).not.toHaveBeenCalled()
    expect(fetchRemoteComponent).toHaveBeenCalledWith('https://esm.sh/react-button@1.0.0')
  })
})
