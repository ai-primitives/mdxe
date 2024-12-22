import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest'
import { processMDX } from '../processor.js'
import { resolveRemoteImport, fetchRemoteComponent } from '../remote.js'

vi.mock('../remote.js', () => ({
  resolveRemoteImport: vi.fn(),
  fetchRemoteComponent: vi.fn(),
}))

describe('processMDX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should process MDX with context-specific components', async () => {
    const mockContent = `
---
title: Test
$type: https://schema.org/BlogPosting
$context: https://mdx.org.ai/docs
---
# Hello World
    `
    const mockComponents = {
      Button: 'react-button',
    }

    ;(resolveRemoteImport as MockedFunction<typeof resolveRemoteImport>).mockResolvedValueOnce('https://esm.sh/@mdxui/docs/components/Button')
    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function Button() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      components: mockComponents,
      context: 'https://mdx.org.ai/docs',
      type: 'https://schema.org/BlogPosting'
    })

    expect(result.code).toContain('export { default as Button } from \'https://esm.sh/@mdxui/docs/components/Button\'')
    expect(result.yamlld).toEqual({
      $type: 'https://schema.org/BlogPosting',
      $context: 'https://mdx.org.ai/docs'
    })
    expect(resolveRemoteImport).toHaveBeenCalledWith({ 
      url: 'react-button',
      context: 'https://mdx.org.ai/docs'
    })
  })

  it('should handle context-specific layout resolution', async () => {
    const mockContent = `
---
$type: https://schema.org/BlogPosting
$context: https://mdx.org.ai/docs
---
# Hello World
    `
    const mockLayout = '@layouts/blog/simple'

    ;(resolveRemoteImport as MockedFunction<typeof resolveRemoteImport>).mockResolvedValueOnce('https://esm.sh/@mdxui/docs/layouts/blog')
    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function BlogLayout() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      layout: mockLayout,
      context: 'https://mdx.org.ai/docs',
      type: 'https://schema.org/BlogPosting'
    })

    expect(result.code).toContain('export { default as layout } from \'https://esm.sh/@mdxui/docs/layouts/blog\'')
    expect(result.yamlld).toEqual({
      $type: 'https://schema.org/BlogPosting',
      $context: 'https://mdx.org.ai/docs'
    })
    expect(resolveRemoteImport).toHaveBeenCalledWith({ 
      url: '@layouts/blog/simple',
      context: 'https://mdx.org.ai/docs'
    })
  })

  it('should auto-resolve layout based on type', async () => {
    const mockContent = `
---
$type: https://schema.org/BlogPosting
$context: https://mdx.org.ai/docs
---
# Hello World
    `

    ;(resolveRemoteImport as MockedFunction<typeof resolveRemoteImport>).mockResolvedValueOnce('https://esm.sh/@mdxui/docs/layouts/blog')
    ;(fetchRemoteComponent as MockedFunction<typeof fetchRemoteComponent>).mockResolvedValueOnce('export default function BlogLayout() {}')

    const result = await processMDX({
      filepath: 'test.mdx',
      content: mockContent,
      context: 'https://mdx.org.ai/docs',
      type: 'https://schema.org/BlogPosting'
    })

    expect(result.code).toContain('export { default as layout } from \'https://esm.sh/@mdxui/docs/layouts/blog\'')
    expect(result.yamlld).toEqual({
      $type: 'https://schema.org/BlogPosting',
      $context: 'https://mdx.org.ai/docs'
    })
    expect(resolveRemoteImport).toHaveBeenCalledWith({ 
      url: 'https://schema.org/BlogPosting',
      context: 'https://mdx.org.ai/docs'
    })
  })
})
