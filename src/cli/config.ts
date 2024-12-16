import type { CompileOptions } from '@mdx-js/mdx'

export interface MDXEConfig {
  /** MDX compilation options */
  mdxOptions?: CompileOptions
  /** Watch mode configuration */
  watch?: {
    /** Enable watch mode */
    enabled?: boolean
    /** Patterns to ignore */
    ignore?: string[]
  }
  /** Component import configuration */
  imports?: {
    /** Base URL for remote imports (e.g., 'https://esm.sh/') */
    baseUrl?: string
    /** Component aliases */
    aliases?: Record<string, string>
  }
  /** Next.js integration options */
  next?: {
    /** Enable Next.js dev mode */
    dev?: boolean
    /** Next.js project directory */
    dir?: string
  }
}
