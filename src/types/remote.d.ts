import type { ComponentType } from 'react'
import type { ComponentResolutionOptions, LayoutResolutionOptions } from 'next-mdxld'

export interface RemoteImportOptions extends Partial<ComponentResolutionOptions>, Partial<LayoutResolutionOptions> {
  url: string
  version?: string
  context?: string
}

// RemoteImportResult is now just a URL string
export type RemoteImportResult = string

// Re-export next-mdxld types for convenience
export type { ComponentResolutionOptions, LayoutResolutionOptions }
