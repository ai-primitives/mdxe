import type { ComponentType } from 'react'
import type { ComponentResolutionOptions, LayoutResolutionOptions } from 'next-mdxld'

export interface RemoteImportOptions extends Partial<ComponentResolutionOptions>, Partial<LayoutResolutionOptions> {
  url: string
  version?: string
  context?: string
}

export interface RemoteImportResult {
  layout?: ComponentType
  components?: Record<string, ComponentType>
  layoutString?: string
  componentStrings?: Record<string, string>
}

// Re-export next-mdxld types for convenience
export type { ComponentResolutionOptions, LayoutResolutionOptions }
