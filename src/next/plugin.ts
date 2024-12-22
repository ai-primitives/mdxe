import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig, RuleSetRule, RuleSetUseItem } from 'webpack'
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
  // Configure webpack for MDX processing
  const webpack = (config: WebpackConfig, { dev, isServer }: WebpackConfigContext): WebpackConfig => {
    // Add MDX file handling
    if (!config.module) config.module = { rules: [] }
    if (!config.module.rules) config.module.rules = []

    // Find and modify the existing MDX rule if it exists
    const mdxRuleIndex = config.module.rules.findIndex(
      (rule): rule is RuleSetRule => {
        if (!rule || typeof rule !== 'object') return false
        const ruleObj = rule as RuleSetRule
        return !!(ruleObj.test instanceof RegExp && ruleObj.test.test('.mdx'))
      }
    )

    const mdxLoader = {
      loader: '@mdx-js/loader',
      options: {
        jsx: true,
        ...pluginOptions.mdx,
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
          ...(Array.isArray(pluginOptions.mdx?.remarkPlugins) ? pluginOptions.mdx.remarkPlugins : []),
        ],
        rehypePlugins: Array.isArray(pluginOptions.mdx?.rehypePlugins) ? pluginOptions.mdx.rehypePlugins : [],
      },
    }

    if (mdxRuleIndex !== -1) {
      // Modify existing rule
      const existingRule = config.module.rules[mdxRuleIndex] as RuleSetRule
      const currentUse = existingRule.use as RuleSetUseItem | RuleSetUseItem[] | undefined
      if (!currentUse) {
        existingRule.use = [mdxLoader]
      } else if (Array.isArray(currentUse)) {
        currentUse.unshift(mdxLoader)
      } else {
        // Convert any non-array use to an array of loaders
        existingRule.use = [mdxLoader, currentUse].filter(Boolean) as RuleSetUseItem[]
      }
    } else {
      // Add new rule
      config.module.rules.unshift({
        test: /\.mdx?$/,
        use: [mdxLoader],
      })
    }

    return config
  }

  // Ensure experimental options are properly configured
  const experimental = {
    ...nextConfig.experimental,
    webpackBuildWorker: true,
    mdxRs: true
  }

  // Combine configurations
  return {
    ...nextConfig,
    experimental,
    pageExtensions: [...(nextConfig.pageExtensions || ['tsx', 'ts', 'jsx', 'js']), 'mdx', 'md'],
    webpack,
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
    compileOptions: options.mdx,
    watch: options.watch,
  })
}
