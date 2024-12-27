import type { ComponentType } from 'react'

export interface RemoteImportOptions {
  url: string
  version?: string
  context?: string
  components?: {
    path?: string
    props?: Record<string, any>
  }
  layout?: {
    path?: string
    props?: Record<string, any>
  }
}

export interface RemoteImportResult {
  url?: string
  components?: Record<string, () => any>
  componentStrings?: Record<string, string>
  layout?: () => any
  layoutString?: string
}
