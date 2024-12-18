// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig } from 'webpack'
import type { WebpackConfigContext as NextWebpackConfigContext } from 'next/dist/server/config-shared.js'

export type { NextWebpackConfigContext as WebpackConfigContext }

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
