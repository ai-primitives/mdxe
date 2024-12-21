import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig } from 'webpack'
import type { WebpackConfigContext } from '../types/next.js'
import { processMDX } from '../mdx/processor.js'
import type { ProcessedMDX } from '../mdx/processor.js'
import { fileURLToPath } from 'url'

interface MDXEPluginOptions {
  /** Additional MDX configuration */
  mdx?: {
    /** Remark plugins */
    remarkPlugins?: any[]
    /** Rehype plugins */
    rehypePlugins?: any[]
    /** Provider import source */
    providerImportSource?: string
    /** Additional options */
    [key: string]: unknown
  }
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
interface MDXNextConfig {
  extension: RegExp;
  options: {
    jsx?: boolean;
    remarkPlugins?: any[];
    rehypePlugins?: any[];
    [key: string]: unknown;
  };
}

export function withMDXE(nextConfig: NextConfig = {}, pluginOptions: MDXEPluginOptions = {}) {
  // Import @next/mdx dynamically since it's a peer dependency
  let withMDX: (config?: MDXNextConfig) => (config: NextConfig) => NextConfig
  try {
    withMDX = require('@next/mdx')
  } catch (e) {
    console.warn('Warning: @next/mdx is not installed. Please install it as a dependency.')
    withMDX = () => (config: NextConfig) => config
  }

  // Extract existing remark plugins
  const existingRemarkPlugins = Array.isArray(pluginOptions.mdx?.remarkPlugins)
    ? pluginOptions.mdx.remarkPlugins
    : []

  // Prepare MDX options for @next/mdx
  const mdxConfig: MDXNextConfig = {
    extension: /\.mdx?$/,
    options: {
      jsx: true,
      ...pluginOptions.mdx,
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
        ...existingRemarkPlugins,
      ],
    },
  }

  // Ensure experimental options are properly configured
  const experimental = {
    ...nextConfig.experimental,
    webpackBuildWorker: true,
    mdxRs: true
  }

  // Combine configurations
  const combinedConfig = {
    ...nextConfig,
    experimental,
    pageExtensions: [...(nextConfig.pageExtensions || ['tsx', 'ts', 'jsx', 'js']), 'mdx', 'md'],
  }

  // Apply @next/mdx configuration
  return withMDX(mdxConfig)(combinedConfig)
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
    compileOptions: options.mdx,
    watch: options.watch,
  })
}
