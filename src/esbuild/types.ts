import type { BuildOptions, BuildResult, Plugin } from 'esbuild'

// Re-export esbuild types directly to ensure compatibility
export type { BuildOptions, BuildResult, Plugin }

// MDX-specific options that can be added to build configuration
export interface MDXOptions {
  remarkPlugins?: any[]
  rehypePlugins?: any[]
}

// Extend BuildOptions with MDX-specific options
export interface MDXEBuildOptions extends BuildOptions {
  mdxOptions?: MDXOptions
}
