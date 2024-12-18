import type { Configuration as WebpackConfig } from 'webpack'

// Define our own WebpackConfigContext based on Next.js documentation
export interface WebpackConfigContext {
  dir: string
  dev: boolean
  isServer: boolean
  buildId: string
  config: {
    [key: string]: unknown
    webpack?: WebpackConfig
  }
  defaultLoaders: {
    babel: {
      loader: string
      options: Record<string, unknown>
    }
  }
  totalPages: number
  webpack: WebpackConfig
  nextRuntime?: 'nodejs' | 'edge'
}

// Augment the existing NextConfig interface
declare module 'next' {
  interface NextConfig {
    mdxe?: {
      styleOverrides?: boolean
      customComponents?: Record<string, string>
      theme?: {
        primary?: string
        secondary?: string
        accent?: string
        background?: string
        text?: string
      }
    }
  }
}

export type { WebpackConfig }

export {}
