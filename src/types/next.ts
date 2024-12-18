import type { Configuration as WebpackConfig } from 'webpack'

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

// Use Next.js webpack configuration context type
export interface WebpackConfigContext {
  dir: string
  dev: boolean
  isServer: boolean
  buildId: string
  config: WebpackConfig
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

export {}
