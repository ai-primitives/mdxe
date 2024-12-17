import type { Plugin, OnLoadArgs, OnLoadResult } from 'esbuild'
import { extname } from 'path'
import mdx from '@mdx-js/esbuild'

export function mdxePlugin(): Plugin {
  return {
    name: 'mdxe',
    setup(build) {
      // Set up MDX plugin first
      const mdxPlugin = mdx()
      mdxPlugin.setup(build)

      // Handle HTTP imports
      build.onResolve({ filter: /^https?:\/\// }, args => {
        return { path: args.path, namespace: 'http-url' }
      })

      // Handle package imports that might need remote resolution
      build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, async (args) => {
        if (args.path === 'react' || args.path === 'react/jsx-runtime' || args.path.startsWith('@types/react')) {
          const url = `https://esm.sh/${args.path}`
          return { path: url, namespace: 'http-url' }
        }
        return null
      })

      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args: OnLoadArgs): Promise<OnLoadResult> => {
        try {
          // Use globalThis.fetch to ensure we get the mocked version in tests
          const response = await globalThis.fetch(args.path)

          // Handle undefined response
          if (!response) {
            throw new Error('Network request failed - no response')
          }

          // Handle non-ok response
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const contents = await response.text()

          // Determine loader based on file extension or content-type
          const ext = extname(args.path).toLowerCase()
          const contentType = response.headers.get('content-type') || ''
          let loader: OnLoadResult['loader'] = 'js'

          if (ext === '.mdx' || contentType.includes('mdx')) {
            loader = 'jsx'
          } else if (ext === '.jsx' || contentType.includes('jsx')) {
            loader = 'jsx'
          } else if (ext === '.tsx' || contentType.includes('typescript')) {
            loader = 'tsx'
          }

          return {
            contents,
            loader,
            resolveDir: '/'
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          throw new Error(`Failed to load ${args.path}: ${errorMessage}`)
        }
      })
    }
  }
}

// Export plugin type for external usage
export type { Plugin }
