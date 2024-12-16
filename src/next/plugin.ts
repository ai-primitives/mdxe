import type { NextConfig } from 'next'
import type { WebpackConfigContext } from 'next/dist/server/config-shared'
import type { Configuration as WebpackConfig } from 'webpack'
import { processMDX } from '../mdx/processor'
import type { ProcessedMDX } from '../mdx/processor'
import { fileURLToPath } from 'url'

interface MDXEPluginOptions {
  /** Additional MDX compile options */
  mdxOptions?: Record<string, unknown>
  /** Watch mode configuration */
  watch?: {
    /** Enable watch mode */
    enabled?: boolean
    /** Patterns to ignore */
    ignore?: string[]
  }
}

/**
 * Next.js plugin for MDX processing with zero-config defaults
 * @param nextConfig Existing Next.js configuration
 * @param pluginOptions Optional MDXE plugin options
 * @returns Enhanced Next.js configuration
 */
export function withMDXE(nextConfig: NextConfig = {}, pluginOptions: MDXEPluginOptions = {}) {
  return {
    ...nextConfig,
    // Preserve existing pageExtensions or default to ['tsx', 'ts', 'jsx', 'js']
    pageExtensions: [...(nextConfig.pageExtensions || ['tsx', 'ts', 'jsx', 'js']), 'mdx', 'md'],

    webpack(config: WebpackConfig, options: WebpackConfigContext) {
      // Ensure module and rules exist
      if (!config.module) {
        config.module = { rules: [] }
      }
      if (!config.module.rules) {
        config.module.rules = []
      }

      // Add MDX loader configuration
      config.module.rules.push({
        test: /\.mdx?$/,
        use: [
          // Use Next.js babel loader first
          options.defaultLoaders.babel,
          {
            loader: '@mdx-js/loader',
            options: {
              jsx: true,
              providerImportSource: '@mdx-js/react',
              ...pluginOptions.mdxOptions,
              // Custom remark plugins for frontmatter handling
              remarkPlugins: [
                // Extract frontmatter metadata for App Router
                () => (tree: unknown, file: { data: { meta?: Record<string, unknown>; metadata?: Record<string, unknown> } }) => {
                  const { metadata } = file.data
                  if (metadata) {
                    // Convert metadata to App Router format
                    const { title, description, keywords, ...rest } = metadata as {
                      title?: string
                      description?: string
                      keywords?: string | string[]
                      [key: string]: unknown
                    }
                    file.data.meta = {
                      ...(title ? { title } : {}),
                      ...(description ? { description } : {}),
                      ...(keywords ? { keywords: Array.isArray(keywords) ? keywords : [keywords] } : {}),
                      ...rest,
                    }
                  }
                },
                // PLACEHOLDER: existing remarkPlugins from pluginOptions if any
              ],
            },
          },
          // Add metadata loader for App Router support
          {
            loader: fileURLToPath(new URL('mdx-metadata-loader.ts', import.meta.url)),
            options: {},
          },
        ],
      })

      // Call existing webpack config function if present
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options)
      }

      return config
    },
  }
}

/**
 * Standalone MDX processor for use without Next.js
 * @param filepath Path to MDX file
 * @param options Processing options
 * @returns Processed MDX content
 */
export async function processStandalone(filepath: string, options: MDXEPluginOptions = {}): Promise<ProcessedMDX> {
  return processMDX({
    filepath,
    compileOptions: options.mdxOptions,
    watch: options.watch,
  })
}
